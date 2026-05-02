/**
 * DatabaseService - Single Responsibility
 * Handles saving analysis results to database
 */

import { AIAnalysisResult, NMRPeak, Carbon13Peak, FTIRPeak } from '@/lib/types';

export class DatabaseService {
  static async saveAnalysis(
    result: AIAnalysisResult,
    peaks: NMRPeak[] | Carbon13Peak[] | FTIRPeak[],
    spectrumType: 'nmr' | 'ftir' | 'c13',
    solvent?: string,
    frequency?: number
  ): Promise<void> {
    if (!result.moleculeName || !result.cid) {
      console.log('⚠️ No molecule identified, skipping database save');
      return;
    }

    try {
      const payload = {
        moleculeName: result.moleculeName,
        cid: result.cid,
        formula: result.formula,
        iupacName: result.iupacName,
        smiles: result.structure,
        spectrumType,
        peaks,
        solvent: spectrumType === 'nmr' ? solvent : undefined,
        frequency: spectrumType === 'nmr' ? frequency : undefined,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/save-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log('✅ Analysis saved to database');
      } else {
        console.warn('⚠️ Failed to save analysis:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Database save error:', error);
    }
  }
}
