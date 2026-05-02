import { NMRPeak, AIAnalysisResult, EnhancedLibrary, EnhancedLibraryV1, EnhancedLibraryAnalysis, EnhancedLibraryMolecule, Solvent } from '@/lib/types';

const VERSION = '2.0.0';

/**
 * Peak'leri karşılaştırmak için hash oluştur
 */
function createPeakHash(peaks: NMRPeak[]): string {
  const sorted = [...peaks]
    .filter(p => p && p.shift != null && p.integ != null && p.mult)
    .sort((a, b) => (b.shift || 0) - (a.shift || 0))
    .map(p => `${(p.shift || 0).toFixed(2)}_${p.mult || 's'}_${(p.integ || 1).toFixed(1)}`)
    .join('|');
  return btoa(sorted);
}

/**
 * Analiz ID oluştur: "nmr_DMSO_3"
 */
function createAnalysisId(spectrumType: 'nmr' | 'ftir' | 'c13', solvent: Solvent, frequency: number): string {
  return `${spectrumType}_${solvent}_${frequency}`;
}

/**
 * v1.0 kütüphaneyi v2.0'a migrate et
 */
export function migrateV1ToV2(oldLibrary: EnhancedLibraryV1): EnhancedLibrary {
  console.log('🔄 Enhanced Library v1.0 → v2.0 migration başlatılıyor...');

  const newLibrary: EnhancedLibrary = {
    molecules: {},
    version: VERSION,
    provider: oldLibrary.provider,
    lastUpdated: Date.now()
  };

  // Eski entry'leri yeni formata dönüştür
  for (const oldEntry of oldLibrary.entries) {
    const moleculeName = oldEntry.moleculeName;

    // Molekül yoksa oluştur
    if (!newLibrary.molecules[moleculeName]) {
      newLibrary.molecules[moleculeName] = {
        cid: oldEntry.aiResult.cid || null,
        imageUrl: oldEntry.imageUrl,
        analyses: []
      };
    }

    // Eski entry'yi varsayılan koşullarla ekle (DMSO @ 300 MHz)
    const analysis: EnhancedLibraryAnalysis = {
      id: createAnalysisId('nmr', 'DMSO' as Solvent, 300),
      spectrumType: 'nmr',
      solvent: 'DMSO' as Solvent,
      frequency: 300,
      peaks: oldEntry.peaks,
      aiResult: oldEntry.aiResult,
      timestamp: oldEntry.timestamp,
      usageCount: oldEntry.usageCount
    };

    newLibrary.molecules[moleculeName].analyses.push(analysis);
  }

  console.log(`✅ Migration tamamlandı: ${Object.keys(newLibrary.molecules).length} molekül, ${VERSION}`);
  return newLibrary;
}

/**
 * Client-side için API'den yükle (ve server-side'da da kullanılabilir)
 */
export async function loadEnhancedLibrary(): Promise<EnhancedLibrary> {
  try {
    const response = await fetch('/api/enhanced-library?provider=chatgpt', {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Failed to load library');
    }

    const library: any = await response.json();

    // Version kontrolü - v1.0 ise migrate et
    if (!library.version || library.version === '1.0.0') {
      console.log('⚠️ Eski v1.0 kütüphane bulundu, v2.0\'a dönüştürülüyor...');
      const migratedLibrary = migrateV1ToV2(library as EnhancedLibraryV1);
      // Migrate edilmiş versiyonu kaydet
      await saveEnhancedLibrary(migratedLibrary);
      return migratedLibrary;
    }

    return library as EnhancedLibrary;
  } catch (error) {
    console.error('Enhanced library yüklenemedi:', error);
    return {
      molecules: {},
      version: VERSION,
      provider: 'chatgpt',
      lastUpdated: Date.now()
    };
  }
}

/**
 * Gelişmiş kütüphaneyi sunucuya kaydet
 */
export async function saveEnhancedLibrary(library: EnhancedLibrary): Promise<void> {
  try {
    library.lastUpdated = Date.now();
    library.version = VERSION;

    const response = await fetch('/api/enhanced-library', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(library)
    });

    if (!response.ok) {
      throw new Error('Failed to save library');
    }

    const moleculeCount = Object.keys(library.molecules).length;
    const analysisCount = Object.values(library.molecules).reduce((sum, mol) => sum + mol.analyses.length, 0);
    console.log(`✅ Enhanced library (${library.provider}) kaydedildi: ${moleculeCount} molekül, ${analysisCount} analiz`);
  } catch (error) {
    console.error('❌ Enhanced library kaydedilemedi:', error);
  }
}

/**
 * Gelişmiş kütüphanede ara (peak'lere, solvent, frequency'e göre)
 */
export async function searchEnhancedLibrary(
  peaks: NMRPeak[],
  spectrumType: 'nmr' | 'ftir' | 'c13' = 'nmr',
  solvent: Solvent = 'DMSO',
  frequency: number = 300
): Promise<EnhancedLibraryAnalysis | null> {
  // ⚠️ FTIR için cache'i devre dışı bırak - peaks çok benzer olabiliyor
  if (spectrumType === 'ftir') {
    console.log('⏭️  FTIR için cache atlanıyor (teorik motor kullanılacak)');
    return null;
  }

  const library = await loadEnhancedLibrary();
  const inputHash = createPeakHash(peaks);
  const analysisId = createAnalysisId(spectrumType, solvent, frequency);

  console.log(`🔍 Cache araması: ${spectrumType}, ${solvent}, ${frequency} MHz`);

  // 1. Exact match - Hem peak'ler hem koşullar aynı
  for (const [moleculeName, molecule] of Object.entries(library.molecules)) {
    for (const analysis of molecule.analyses) {
      const analysisHash = createPeakHash(analysis.peaks);

      // Peak'ler eşleşiyor mu?
      if (inputHash === analysisHash) {
        // Koşullar da eşleşiyor mu?
        if (analysis.spectrumType === spectrumType &&
            analysis.solvent === solvent &&
            analysis.frequency === frequency) {
          console.log(`✅ EXACT MATCH BULUNDU: ${moleculeName} (${analysisId})`);
          console.log(`📊 Cache Peak'leri:`, analysis.peaks.map(p => `${p.shift}: ${p.mult} (${p.integ}H)`).join(', '));
          console.log(`🔬 AI Sonucu: ${analysis.aiResult.moleculeName} (${analysis.aiResult.formula})`);
          console.log(`⚠️ Eğer bu yanlışsa, cache'i temizleyin veya yeni analiz yaptırın`);

          // Usage count artır
          analysis.usageCount++;
          await saveEnhancedLibrary(library);

          return analysis;
        }
      }
    }
  }

  // 2. Peak match ama farklı koşullar - Sadece log göster
  for (const [moleculeName, molecule] of Object.entries(library.molecules)) {
    for (const analysis of molecule.analyses) {
      const analysisHash = createPeakHash(analysis.peaks);

      if (inputHash === analysisHash) {
        console.log(`⚠️ Peak'ler eşleşti ama koşullar farklı: ${moleculeName}`);
        console.log(`   Cache: ${analysis.spectrumType}, ${analysis.solvent}, ${analysis.frequency} MHz`);
        console.log(`   İstenen: ${spectrumType}, ${solvent}, ${frequency} MHz`);
        console.log(`   → Yeni analiz yapılacak ve eklenecek`);
      }
    }
  }

  // 3. Yakın eşleşme ara (fuzzy match)
  const tolerance = 0.15;
  for (const [moleculeName, molecule] of Object.entries(library.molecules)) {
    for (const analysis of molecule.analyses) {
      if (Math.abs(analysis.peaks.length - peaks.length) > 2) continue;

      let matchCount = 0;
      for (const peak of peaks) {
        for (const analysisPeak of analysis.peaks) {
          if (Math.abs(peak.shift - analysisPeak.shift) <= tolerance) {
            matchCount++;
            break;
          }
        }
      }

      const matchPercent = (matchCount / Math.max(peaks.length, analysis.peaks.length)) * 100;
      if (matchPercent >= 90) {
        // Koşullar da eşleşiyor mu?
        if (analysis.spectrumType === spectrumType &&
            analysis.solvent === solvent &&
            analysis.frequency === frequency) {
          console.log(`✅ FUZZY MATCH: ${moleculeName} (${matchPercent.toFixed(0)}%)`);

          analysis.usageCount++;
          await saveEnhancedLibrary(library);

          return analysis;
        }
      }
    }
  }

  console.log('❌ Cache\'te eşleşme bulunamadı');
  return null;
}

/**
 * AI sonucunu gelişmiş kütüphaneye ekle
 * NOT: Sadece yüksek güvenilirlikte (>= 85%) sonuçlar cache'lenir
 */
export async function addToEnhancedLibrary(
  peaks: NMRPeak[],
  aiResult: AIAnalysisResult,
  spectrumType: 'nmr' | 'ftir' | 'c13' = 'nmr',
  solvent: Solvent = 'DMSO',
  frequency: number = 300
): Promise<void> {
  // ⚠️ CONFIDENCE THRESHOLD: Düşük güvenilirlikte sonuçları cache'leme
  const CONFIDENCE_THRESHOLD = 85;

  if (aiResult.confidence < CONFIDENCE_THRESHOLD) {
    console.log(`⏭️  Cache'lenmedi: Düşük güven skoru (%${aiResult.confidence} < %${CONFIDENCE_THRESHOLD})`);
    console.log(`   Molekül: ${aiResult.moleculeName}`);
    console.log(`   ⚠️ Bu sonuç yanlış olabilir, bu yüzden cache'e eklenmedi`);
    return;
  }

  const library = await loadEnhancedLibrary();
  const moleculeName = aiResult.moleculeName;
  const analysisId = createAnalysisId(spectrumType, solvent, frequency);

  // Molekül yoksa oluştur
  if (!library.molecules[moleculeName]) {
    library.molecules[moleculeName] = {
      cid: aiResult.cid || null,
      imageUrl: aiResult.cid
        ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${aiResult.cid}/PNG?record_type=2d&image_size=400x400`
        : undefined,
      analyses: []
    };
    console.log(`➕ Yeni molekül: ${moleculeName}`);
  }

  // Bu koşullarda analiz var mı?
  const existingAnalysisIndex = library.molecules[moleculeName].analyses.findIndex(
    a => a.id === analysisId
  );

  const newAnalysis: EnhancedLibraryAnalysis = {
    id: analysisId,
    spectrumType,
    solvent,
    frequency,
    peaks,
    aiResult,
    timestamp: Date.now(),
    usageCount: 1
  };

  if (existingAnalysisIndex >= 0) {
    // Güncelle
    console.log(`🔄 Analiz güncelleniyor: ${moleculeName} (${analysisId})`);
    const existing = library.molecules[moleculeName].analyses[existingAnalysisIndex];
    library.molecules[moleculeName].analyses[existingAnalysisIndex] = {
      ...newAnalysis,
      usageCount: existing.usageCount + 1
    };
  } else {
    // Yeni analiz ekle
    console.log(`➕ Yeni analiz: ${moleculeName} (${analysisId})`);
    library.molecules[moleculeName].analyses.push(newAnalysis);
  }

  library.provider = 'chatgpt';
  await saveEnhancedLibrary(library);
}

/**
 * Gelişmiş kütüphaneyi temizle
 */
export async function clearEnhancedLibrary(): Promise<void> {
  try {
    const response = await fetch('/api/enhanced-library?provider=chatgpt', {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to clear library');
    }

    console.log('🗑️ Enhanced library temizlendi');
  } catch (error) {
    console.error('❌ Enhanced library temizlenemedi:', error);
  }
}

/**
 * İstatistikler
 */
export async function getLibraryStats(): Promise<{
  totalMolecules: number;
  totalAnalyses: number;
  totalUsage: number;
  mostUsedAnalysis: { moleculeName: string; analysis: EnhancedLibraryAnalysis } | null;
}> {
  const library = await loadEnhancedLibrary();

  const totalMolecules = Object.keys(library.molecules).length;
  let totalAnalyses = 0;
  let totalUsage = 0;
  let mostUsedAnalysis: { moleculeName: string; analysis: EnhancedLibraryAnalysis } | null = null;
  let maxUsage = 0;

  for (const [moleculeName, molecule] of Object.entries(library.molecules)) {
    totalAnalyses += molecule.analyses.length;

    for (const analysis of molecule.analyses) {
      totalUsage += analysis.usageCount;

      if (analysis.usageCount > maxUsage) {
        maxUsage = analysis.usageCount;
        mostUsedAnalysis = { moleculeName, analysis };
      }
    }
  }

  return {
    totalMolecules,
    totalAnalyses,
    totalUsage,
    mostUsedAnalysis
  };
}
