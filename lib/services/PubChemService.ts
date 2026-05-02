/**
 * PubChemService
 * Extracted from page.tsx lines 232-335
 *
 * Handles all PubChem API interactions
 */

import type { NMRPeak } from '@/lib/types';

export interface PubChemSearchOptions {
  peaks: NMRPeak[];
  formula?: string;
  solvent: string;
  frequency: number;
  useEnhancedLibrary?: boolean;
}

export interface PubChemResult {
  success: boolean;
  match?: {
    name: string;
    formula?: string;
    cid?: number;
    score?: number;
    source?: string;
  };
  allMatches?: Array<{
    name: string;
    formula?: string;
    cid?: number;
    score: number;
    source?: string;
  }>;
  error?: string;
}

export class PubChemService {

  /**
   * Search PubChem by formula and match peaks
   */
  async searchByFormula(options: PubChemSearchOptions): Promise<PubChemResult> {
    const { formula, peaks, solvent, frequency } = options;

    if (!formula || formula.trim() === '') {
      return { success: false, error: 'Formula not provided' };
    }

    try {
      // Call Next.js API route
      const response = await fetch(`/api/pubchem?type=formula&query=${encodeURIComponent(formula)}`);

      if (!response.ok) {
        return { success: false, error: 'PubChem API error' };
      }

      const data = await response.json();

      if (!data.success || !data.molecules || data.molecules.length === 0) {
        return { success: false, error: 'No molecules found' };
      }

      // Return first match
      const match = data.molecules[0];

      return {
        success: true,
        match: {
          name: match.name,
          formula: match.formula,
          cid: match.cid,
          score: 100,
          source: 'PubChem'
        },
        allMatches: data.molecules.map((m: any) => ({
          name: m.name,
          formula: m.formula,
          cid: m.cid,
          score: 100,
          source: 'PubChem'
        }))
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'PubChem search failed'
      };
    }
  }

  /**
   * Search PubChem by peaks (POST endpoint)
   */
  async searchByPeaks(options: PubChemSearchOptions): Promise<PubChemResult> {
    const { peaks, formula, solvent, frequency } = options;

    try {
      const response = await fetch('/api/pubchem/search-by-peaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peaks: peaks.map(p => ({
            shift: p.shift,
            integration: p.integ,
            multiplicity: p.mult
          })),
          formula,
          solvent,
          frequency
        })
      });

      if (!response.ok) {
        return { success: false, error: 'Peak search failed' };
      }

      const data = await response.json();

      if (!data.success || !data.match) {
        return { success: false, error: 'No peak matches found' };
      }

      return {
        success: true,
        match: data.match,
        allMatches: data.allMatches
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Peak search failed'
      };
    }
  }

  /**
   * Intelligent search: Try formula first, then peaks
   */
  async search(options: PubChemSearchOptions): Promise<PubChemResult> {
    // Try formula search first (faster)
    if (options.formula) {
      const formulaResult = await this.searchByFormula(options);
      if (formulaResult.success) {
        return formulaResult;
      }
    }

    // Fallback to peak-based search
    const peakResult = await this.searchByPeaks(options);
    return peakResult;
  }
}

// Export singleton
export const pubchemService = new PubChemService();
