import { NMRPeak } from '@/lib/types';

/**
 * PubChem Arama Sonucu
 */
export interface PubChemMatch {
  cid: number;
  name: string;
  matchedPeak: { ppm: number; intensity: number };
  difference: number;
  solvent: string;
  frequency: string;
  allPeaks: Array<{ ppm: number; intensity: number }>;
  nmrType: string;
}

export interface PubChemSearchResult {
  match: {
    name: string;
    cid: number | null;
    source: string;
    peaks: NMRPeak[];
    explanation: string;
  };
  score: number;
  details: string;
  matchedPeaks: number;
  totalPeaks: number;
  allMatches?: Array<{
    cid: number;
    name: string;
    formula: string;
    score: number;
    matchedPeaks: number;
    totalPeaks: number;
    source: string;
  }>;
}

/**
 * PubChem'de molekül ara
 * @param peaks Kullanıcının girdiği peak'ler
 * @param formula Molekül formülü (opsiyonel)
 * @param nmrType NMR tipi ('1H' veya '13C')
 * @param frequency Frekans (MHz)
 * @param solvent Solvent
 * @param tolerance Peak toleransı (ppm)
 */
export async function searchPubChem(
  peaks: NMRPeak[],
  formula?: string,
  nmrType: '1H' | '13C' = '1H',
  frequency?: number,
  solvent?: string,
  tolerance: number = 0.5
): Promise<PubChemSearchResult | null> {
  try {
    console.log('🔍 PubChem peak-based search başlıyor:', {
      peakCount: peaks.length,
      formula: formula || 'null',
      nmrType,
      frequency,
      solvent,
      tolerance
    });

    // Yeni unified peak search endpoint'ini kullan
    const response = await fetch('/api/pubchem/search-by-peaks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peaks: peaks.map(p => ({ shift: p.shift, integ: p.integ || 1 })), // İntegrasyon bilgisini de gönder
        nmrType,
        frequency,
        solvent,
        tolerance,
        formula: formula || null
      })
    });

    if (!response.ok) {
      console.error('❌ PubChem search-by-peaks API hatası:', response.status);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.match) {
      console.log('❌ PubChem\'de eşleşme bulunamadı');
      return null;
    }

    // Sonucu formatla
    const pubchemResult: PubChemSearchResult = {
      match: {
        name: result.match.name,
        cid: result.match.cid,
        source: result.match.source,
        peaks: result.match.peaks?.map((ppm: number) => ({
          shift: ppm,
          mult: 's',
          integ: 1
        })) || [],
        explanation: result.match.explanation || ''
      },
      score: result.score,
      details: result.details,
      matchedPeaks: result.matchedPeaks,
      totalPeaks: result.totalPeaks
    };

    console.log(`✅ PubChem'de bulundu: ${pubchemResult.match.name} (%${pubchemResult.score})`);
    return pubchemResult;

  } catch (error) {
    console.error('❌ PubChem arama hatası:', error);
    return null;
  }
}

