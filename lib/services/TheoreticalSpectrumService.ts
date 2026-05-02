/**
 * TheoreticalSpectrumService
 *
 * Single Responsibility: Generate theoretical NMR/FTIR/13C spectra from SMILES
 *
 * Principles Applied:
 * - DRY: Centralized theoretical spectrum generation
 * - SoC: Only handles spectrum generation, not analysis
 * - Strategy Pattern: Different algorithms for different spectrum types
 * - Fail Fast: Returns empty array if SMILES is invalid
 */

import type { NMRPeak, FTIRPeak, Carbon13Peak } from '@/lib/types';

export interface TheoreticalSpectrumResult<T> {
  peaks: T[];
  method: string;
  confidence: number;
  warnings: string[];
  success: boolean;
}

export class TheoreticalSpectrumService {
  /**
   * Generate theoretical 1H NMR spectrum using HOSE predictor
   *
   * @param smiles - SMILES string
   * @returns Array of predicted NMR peaks
   */
  static async generate1HNMR(smiles: string): Promise<TheoreticalSpectrumResult<NMRPeak>> {
    // Fail Fast: Invalid input
    if (!smiles || smiles.trim() === '') {
      return {
        peaks: [],
        method: 'none',
        confidence: 0,
        warnings: ['Invalid SMILES provided'],
        success: false
      };
    }

    try {
      console.log('🔬 Generating theoretical 1H NMR...');

      const response = await fetch('/api/hose-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles })
      });

      if (!response.ok) {
        throw new Error(`HOSE predictor API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.predicted_shifts) {
        throw new Error(data.error || 'HOSE prediction failed');
      }

      // Convert shifts to NMRPeak format (KISS: Simple mapping)
      const peaks: NMRPeak[] = data.predicted_shifts.map((shift: number, idx: number) => ({
        shift,
        integ: 1,
        mult: 's', // HOSE doesn't predict multiplicity
        label: `H${idx + 1} (theoretical)`
      }));

      console.log(`✅ Generated ${peaks.length} theoretical 1H NMR peaks`);

      return {
        peaks,
        method: 'HOSE code predictor',
        confidence: data.confidence || 0.7,
        warnings: data.warnings || [],
        success: true
      };

    } catch (error) {
      console.error('❌ 1H NMR generation failed:', error);
      return {
        peaks: [],
        method: 'HOSE code predictor',
        confidence: 0,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        success: false
      };
    }
  }

  /**
   * Generate theoretical FTIR spectrum using rule-based engine
   *
   * @param smiles - SMILES string
   * @returns Array of predicted FTIR peaks
   */
  static async generateFTIR(smiles: string): Promise<TheoreticalSpectrumResult<FTIRPeak>> {
    // Fail Fast
    if (!smiles || smiles.trim() === '') {
      return {
        peaks: [],
        method: 'none',
        confidence: 0,
        warnings: ['Invalid SMILES provided'],
        success: false
      };
    }

    try {
      console.log('🔬 Generating theoretical FTIR...');

      const response = await fetch('/api/ftir-theoretical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles })
      });

      if (!response.ok) {
        throw new Error(`FTIR API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.peaks) {
        throw new Error(data.error || 'FTIR prediction failed');
      }

      console.log(`✅ Generated ${data.peaks.length} theoretical FTIR peaks`);

      return {
        peaks: data.peaks,
        method: 'Rule-based engine (Hooke\'s Law)',
        confidence: 0.8,
        warnings: data.warnings || [],
        success: true
      };

    } catch (error) {
      console.error('❌ FTIR generation failed:', error);
      return {
        peaks: [],
        method: 'Rule-based engine',
        confidence: 0,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        success: false
      };
    }
  }

  /**
   * Generate theoretical 13C NMR spectrum using AI prediction
   *
   * @param smiles - SMILES string
   * @param moleculeName - Molecule name for AI context
   * @returns Array of predicted 13C peaks
   */
  static async generate13CNMR(
    smiles: string,
    moleculeName: string
  ): Promise<TheoreticalSpectrumResult<Carbon13Peak>> {
    // Fail Fast
    if (!smiles || smiles.trim() === '') {
      return {
        peaks: [],
        method: 'none',
        confidence: 0,
        warnings: ['Invalid SMILES provided'],
        success: false
      };
    }

    try {
      console.log('🔬 Generating theoretical 13C NMR...');

      const response = await fetch('/api/ai-nmr-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moleculeName,
          smiles,
          literature: [] // No literature for pure theoretical prediction
        })
      });

      if (!response.ok) {
        throw new Error(`AI prediction API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.prediction?.spectra) {
        throw new Error('AI 13C prediction failed');
      }

      // Extract 13C spectrum
      const c13Spectrum = data.prediction.spectra.find((s: any) => s.nucleus === '13C');

      if (!c13Spectrum || !c13Spectrum.peaks) {
        throw new Error('No 13C spectrum in AI response');
      }

      // Convert to Carbon13Peak format
      const peaks: Carbon13Peak[] = c13Spectrum.peaks.map((p: any) => ({
        shift: p.shift,
        intensity: p.integration || 1,
        assignment: p.assignment || 'Unknown'
      }));

      console.log(`✅ Generated ${peaks.length} theoretical 13C NMR peaks`);

      return {
        peaks,
        method: 'AI prediction (GPT-4O)',
        confidence: data.prediction.confidence || 0.75,
        warnings: data.prediction.warnings || [],
        success: true
      };

    } catch (error) {
      console.error('❌ 13C NMR generation failed:', error);
      return {
        peaks: [],
        method: 'AI prediction',
        confidence: 0,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        success: false
      };
    }
  }

  /**
   * Generate theoretical spectrum based on type (Strategy Pattern)
   *
   * @param smiles - SMILES string
   * @param type - Spectrum type
   * @param moleculeName - Optional molecule name for 13C
   * @returns Theoretical spectrum
   */
  static async generate(
    smiles: string,
    type: 'nmr' | 'ftir' | 'c13',
    moleculeName?: string
  ): Promise<TheoreticalSpectrumResult<any>> {
    // Strategy Pattern: Select algorithm based on type
    switch (type) {
      case 'nmr':
        return this.generate1HNMR(smiles);

      case 'ftir':
        return this.generateFTIR(smiles);

      case 'c13':
        return this.generate13CNMR(smiles, moleculeName || 'Unknown');

      default:
        // Fail Fast: Invalid type
        return {
          peaks: [],
          method: 'none',
          confidence: 0,
          warnings: [`Invalid spectrum type: ${type}`],
          success: false
        };
    }
  }
}
