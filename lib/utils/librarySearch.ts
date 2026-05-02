import { NMRPeak, FTIRPeak, Solvent, Frequency } from '@/lib/types';

// Yeni nested yapı: Spektrum → Çözücü → Frekans → Peak'ler
export interface LibraryMoleculeData {
  nmr?: {
    [solvent in Solvent]?: {
      [freq in Frequency]?: NMRPeak[];
    };
  };
  ftir?: {
    peaks: FTIRPeak[];
  };
}

export interface LibraryMolecule {
  name: string;
  cid?: number | null;
  source?: string;
  explanation?: string;
  data?: LibraryMoleculeData; // Optional - backward compatibility

  // Eski sistemle uyumluluk için (deprecated)
  peaks?: NMRPeak[];
}

export interface LibrarySearchResult {
  match: LibraryMolecule;
  score: number;
  details: string;
  matchedPeaks: number;
  totalPeaks: number;
}

/**
 * Molekülden doğru peak'leri çek (Spektrum → Çözücü → Frekans'a göre)
 */
export function getPeaksForConditions(
  molecule: LibraryMolecule,
  solvent: Solvent,
  frequency: number
): NMRPeak[] | null {
  // Frekansı stringe çevir
  const freqKey = `${frequency}MHz` as Frequency;

  // Yeni nested yapı varsa kullan
  if (molecule.data?.nmr?.[solvent]?.[freqKey]) {
    return molecule.data.nmr[solvent][freqKey]!;
  }

  // Fallback 1: Aynı çözücüde başka frekans
  const availableFreqs = molecule.data?.nmr?.[solvent];
  if (availableFreqs) {
    // Önce en yakın frekansı bul
    const freqs = Object.keys(availableFreqs) as Frequency[];
    if (freqs.length > 0) {
      const closest = freqs[0]; // İlk bulduğunu kullan (TODO: En yakını bul)
      console.log(`⚠️ ${solvent} ${freqKey} bulunamadı, ${closest} kullanılıyor`);
      return availableFreqs[closest]!;
    }
  }

  // Fallback 2: Başka çözücüde aynı frekans (CDCl3 öncelikli)
  if (molecule.data?.nmr) {
    const fallbackSolvent = 'CDCl3' as Solvent;
    if (molecule.data.nmr[fallbackSolvent]?.[freqKey]) {
      console.log(`⚠️ ${solvent} bulunamadı, ${fallbackSolvent} kullanılıyor`);
      return molecule.data.nmr[fallbackSolvent][freqKey]!;
    }
  }

  // Fallback 3: Eski yapı (deprecated)
  if (molecule.peaks && molecule.peaks.length > 0) {
    console.log(`⚠️ Eski yapı kullanılıyor: ${molecule.name}`);
    return molecule.peaks;
  }

  return null;
}

export function normalizeMult(mult: string): string {
  if (!mult) return 's';
  const m = mult.toLowerCase().replace(/\s/g, '');
  const multMap: Record<string, string> = {
    'm': 'm', 't': 't', 'd': 'd', 's': 's', 'q': 'q',
    'dd': 'dd', 'br': 'br', 'sep': 'sep', 'td': 'td', 'dt': 'dt',
    'ddd': 'ddd', 'sex': 'sex', 'quin': 'quin'
  };
  return multMap[m] || m;
}

export function normalizePeaks(peaks: NMRPeak[]): NMRPeak[] {
  return peaks
    .map(p => ({
      shift: parseFloat((p.shift || 0).toFixed(2)),
      integ: parseFloat((p.integ || 1).toFixed(1)),
      mult: normalizeMult(p.mult || 's')
    }))
    .sort((a, b) => b.shift - a.shift);
}

/**
 * Ana kütüphane arama fonksiyonu - En iyi eşleşmeyi döndürür
 * %85'ten yüksek skor = Yüksek güven, AI atlanabilir
 */
export function searchMoleculeLibrary(
  userPeaks: NMRPeak[],
  moleculeLibrary: LibraryMolecule[],
  solvent: Solvent = 'DMSO',
  frequency: number = 300
): LibrarySearchResult | null {
  if (!userPeaks || userPeaks.length === 0) return null;

  console.log(`🔍 Arama: ${solvent} @ ${frequency} MHz`);

  const userNormalized = normalizePeaks(userPeaks.filter(p => !p.isSolvent));
  let bestMatch: LibrarySearchResult | null = null;
  let highestScore = 0;

  for (const mol of moleculeLibrary) {
    // Yeni yapıya göre peak'leri çek
    const molPeaks = getPeaksForConditions(mol, solvent, frequency);
    if (!molPeaks || molPeaks.length === 0) continue;

    const libNormalized = normalizePeaks(molPeaks);

    // Peak sayısı kontrolü - SIKI (peak sayıları yakın olmalı)
    const peakCountDiff = Math.abs(userNormalized.length - libNormalized.length);
    if (peakCountDiff > 2) continue; // Maksimum 2 peak farkı kabul edilir

    // Eşleşme skoru hesapla
    let matches = 0;
    let totalScore = 0;
    const usedLibIndices = new Set<number>();
    const tolerance = 0.3; // ±0.3 ppm shift tolerance (çözgen etkisi)

    for (const userP of userNormalized) {
      let bestPeakScore = 0;
      let bestLibIdx = -1;

      for (let libIdx = 0; libIdx < libNormalized.length; libIdx++) {
        if (usedLibIndices.has(libIdx)) continue;

        const libP = libNormalized[libIdx];
        const shiftDiff = Math.abs(userP.shift - libP.shift);
        const integDiff = Math.abs(userP.integ - libP.integ);
        const multMatch = userP.mult === libP.mult;

        // Eşleşme kriterleri - Shift ±0.3 ppm içinde olmalı
        if (shiftDiff <= tolerance) {
          // Shift skoru: 0.3 ppm içinde %100, 0 ppm'de maksimum
          const shiftScore = (1 - shiftDiff / tolerance) * 60; // 0-60 (öncelik shift'e)

          // İntegrasyon skoru: Esnek (1e1 olmalı ama toleranslı)
          const integScore = Math.max(0, 1 - integDiff / Math.max(userP.integ, libP.integ, 1)) * 20; // 0-20

          // Multiplicity skoru: Eşleşirse bonus, eşleşmese de sorun değil
          const multScore = multMatch ? 20 : 5; // 5-20

          const peakScore = shiftScore + integScore + multScore;

          if (peakScore > bestPeakScore) {
            bestPeakScore = peakScore;
            bestLibIdx = libIdx;
          }
        }
      }

      // Daha düşük threshold: Shift eşleşiyorsa kabul et
      if (bestLibIdx >= 0 && bestPeakScore > 40) {
        usedLibIndices.add(bestLibIdx);
        matches++;
        totalScore += bestPeakScore;
      }
    }

    // Final score calculation
    const avgScore = matches > 0 ? totalScore / matches : 0;
    const coverage = matches / Math.max(userNormalized.length, libNormalized.length);
    const finalScore = avgScore * 0.7 + coverage * 100 * 0.3;

    if (finalScore > highestScore && matches >= Math.min(userNormalized.length, libNormalized.length) * 0.6) {
      highestScore = finalScore;
      bestMatch = {
        match: mol,
        score: Math.round(finalScore),
        details: `${matches}/${libNormalized.length} peak eşleşti`,
        matchedPeaks: matches,
        totalPeaks: libNormalized.length
      };
    }
  }

  return bestMatch;
}

/**
 * Tüm potansiyel eşleşmeleri döndürür (AI'ya context için)
 */
export function searchAllLibraryMatches(
  userPeaks: NMRPeak[],
  moleculeLibrary: LibraryMolecule[],
  solvent: Solvent = 'DMSO',
  frequency: number = 300,
  minScore: number = 60
): LibrarySearchResult[] {
  if (!userPeaks || userPeaks.length === 0) return [];

  const userNormalized = normalizePeaks(userPeaks.filter(p => !p.isSolvent));
  const allMatches: LibrarySearchResult[] = [];

  for (const mol of moleculeLibrary) {
    const molPeaks = getPeaksForConditions(mol, solvent, frequency);
    if (!molPeaks || molPeaks.length === 0) continue;

    const libNormalized = normalizePeaks(molPeaks);

    // Peak sayısı kontrolü - SIKI
    const peakCountDiff = Math.abs(userNormalized.length - libNormalized.length);
    if (peakCountDiff > 2) continue; // Maksimum 2 peak farkı

    // Aynı eşleşme mantığı
    let matches = 0;
    let totalScore = 0;
    const usedLibIndices = new Set<number>();
    const tolerance = 0.3; // ±0.3 ppm shift tolerance (çözgen etkisi)

    for (const userP of userNormalized) {
      let bestPeakScore = 0;
      let bestLibIdx = -1;

      for (let libIdx = 0; libIdx < libNormalized.length; libIdx++) {
        if (usedLibIndices.has(libIdx)) continue;

        const libP = libNormalized[libIdx];
        const shiftDiff = Math.abs(userP.shift - libP.shift);
        const integDiff = Math.abs(userP.integ - libP.integ);
        const multMatch = userP.mult === libP.mult;

        if (shiftDiff <= tolerance) {
          const shiftScore = (1 - shiftDiff / tolerance) * 60; // 0-60
          const integScore = Math.max(0, 1 - integDiff / Math.max(userP.integ, libP.integ, 1)) * 20; // 0-20
          const multScore = multMatch ? 20 : 5; // 5-20

          const peakScore = shiftScore + integScore + multScore;

          if (peakScore > bestPeakScore) {
            bestPeakScore = peakScore;
            bestLibIdx = libIdx;
          }
        }
      }

      if (bestLibIdx >= 0 && bestPeakScore > 40) {
        usedLibIndices.add(bestLibIdx);
        matches++;
        totalScore += bestPeakScore;
      }
    }

    const avgScore = matches > 0 ? totalScore / matches : 0;
    const coverage = matches / Math.max(userNormalized.length, libNormalized.length);
    const finalScore = avgScore * 0.7 + coverage * 100 * 0.3;

    if (finalScore >= minScore && matches >= Math.min(userNormalized.length, libNormalized.length) * 0.5) {
      allMatches.push({
        match: mol,
        score: Math.round(finalScore),
        details: `${matches}/${libNormalized.length} peak eşleşti`,
        matchedPeaks: matches,
        totalPeaks: libNormalized.length
      });
    }
  }

  return allMatches.sort((a, b) => b.score - a.score);
}
