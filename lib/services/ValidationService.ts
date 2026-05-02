/**
 * ValidationService - Single Responsibility
 * Handles IUPAC name and molecular formula validation
 */

import { AIAnalysisResult } from '@/lib/types';
import { LibrarySearchResult } from './LibrarySearchService';
import { KnownMolecule } from './KnownMoleculeService';

export class ValidationService {
  static async validateIUPAC(
    aiResult: AIAnalysisResult,
    cid: number | undefined
  ): Promise<AIAnalysisResult> {
    if (!cid || !aiResult.iupacName) {
      return aiResult;
    }

    try {
      const response = await fetch(`/api/pubchem/iupac?cid=${cid}`);
      const data = await response.json();

      if (data.success && data.iupacName) {
        const pubchemIUPAC = data.iupacName;
        const aiIUPAC = aiResult.iupacName;

        if (pubchemIUPAC !== aiIUPAC) {
          console.warn('⚠️ IUPAC mismatch - using PubChem:', pubchemIUPAC);

          return {
            ...aiResult,
            iupacName: pubchemIUPAC
          };
        }
      }
    } catch (error) {
      console.error('IUPAC validation failed:', error);
    }

    return aiResult;
  }

  static validateWithLibrary(
    aiResult: AIAnalysisResult,
    libraryResult: LibrarySearchResult,
    knownMolecule: KnownMolecule | null
  ): AIAnalysisResult {
    if (knownMolecule) {
      console.log('✅ Using knownMolecule override:', knownMolecule.name);

      return {
        ...aiResult,
        moleculeName: knownMolecule.name,
        cid: knownMolecule.cid,
        formula: knownMolecule.formula || aiResult.formula
      };
    }

    if (libraryResult.source === 'enhanced_library' && libraryResult.moleculeName) {
      console.log('✅ Using enhanced library result:', libraryResult.moleculeName);

      return {
        ...aiResult,
        moleculeName: libraryResult.moleculeName,
        cid: libraryResult.cid,
        formula: libraryResult.formula || aiResult.formula
      };
    }

    return aiResult;
  }
}
