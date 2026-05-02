/**
 * LibrarySearchService - Single Responsibility
 * Handles enhanced library and PubChem search operations
 */

import { NMRPeak, Carbon13Peak, FTIRPeak } from '@/lib/types';
import { searchEnhancedLibrary } from '@/lib/utils/enhancedLibrary';

export interface LibrarySearchResult {
  source: 'enhanced_library' | 'none';
  moleculeName?: string;
  cid?: number;
  formula?: string;
  confidence?: number;
  matchedPeaks?: number;
  totalPeaks?: number;
}

export class LibrarySearchService {
  static async search(
    peaks: NMRPeak[] | Carbon13Peak[] | FTIRPeak[],
    spectrumType: 'nmr' | 'ftir' | 'c13'
  ): Promise<LibrarySearchResult> {
    if (spectrumType !== 'nmr') {
      return { source: 'none' };
    }

    const nmrPeaks = peaks as NMRPeak[];
    const enhancedResult = await searchEnhancedLibrary(nmrPeaks);

    if (enhancedResult && enhancedResult.aiResult) {
      const confidence = enhancedResult.aiResult.confidence / 100; // AIAnalysisResult uses 0-100 scale

      if (confidence >= 0.95) {
        console.log('✅ Enhanced library match:', enhancedResult.aiResult.moleculeName, `(${confidence.toFixed(2)})`);

        return {
          source: 'enhanced_library',
          moleculeName: enhancedResult.aiResult.moleculeName,
          cid: enhancedResult.aiResult.cid ?? undefined,
          formula: enhancedResult.aiResult.formula,
          confidence,
          matchedPeaks: enhancedResult.peaks.length,
          totalPeaks: nmrPeaks.length
        };
      }
    }

    return { source: 'none' };
  }
}
