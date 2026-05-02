/**
 * Enhancement Modules Orchestrator
 *
 * Central hub for all 10 enhancement modules.
 * Turn modules ON/OFF easily by commenting/uncommenting.
 *
 * USAGE:
 * import { enhanceSpectrum } from '@/lib/enhancement-modules';
 * const enhanced = await enhanceSpectrum(input);
 *
 * CUSTOMIZE:
 * - Comment out modules you don't need
 * - Each module is independent
 * - No circular dependencies
 */

import type { NMRPeak, Carbon13Peak, FTIRPeak } from '@/lib/types';
import { applyBoltzmannWeighting } from './module1-boltzmann';
import { analyzeExchange, estimateExchangeRate } from './module2-exchange';
import { detectSymmetry } from './module6-symmetry';
import { calculateNOEFromStructure } from './module9-noe';
import { parseSMILES } from '@/lib/utils/molecularStructure';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancementInput {
  smiles?: string;
  moleculeName: string;
  cid?: number; // PubChem CID (for structure cache lookup)
  nmrPeaks?: NMRPeak[];
  c13Peaks?: Carbon13Peak[];
  ftirPeaks?: FTIRPeak[];
  solvent?: string;
  temperature?: number;
  frequency?: number;
}

export interface EnhancementResult {
  nmr?: NMRPeak[];
  c13?: Carbon13Peak[];
  ftir?: FTIRPeak[];
  metadata: {
    modulesApplied: string[];
    warnings: string[];
    // Optional: extra data from modules
    boltzmann?: any;
    symmetry?: any;
  };
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Apply all active enhancement modules
 *
 * @param input - Spectrum data and molecule info
 * @returns Enhanced spectrum with metadata
 */
export async function enhanceSpectrum(
  input: EnhancementInput
): Promise<EnhancementResult> {
  const result: EnhancementResult = {
    nmr: input.nmrPeaks ? [...input.nmrPeaks] : undefined,
    c13: input.c13Peaks ? [...input.c13Peaks] : undefined,
    ftir: input.ftirPeaks ? [...input.ftirPeaks] : undefined,
    metadata: {
      modulesApplied: [],
      warnings: []
    }
  };

  if (!input.smiles) {
    result.metadata.warnings.push('No SMILES provided - skipping structure-based modules');
    return result;
  }

  // ========================================
  // MODULE 1: Boltzmann Weighting
  // ========================================
  // REMOVE: Comment this block to disable
  try {
    const boltzmann = await applyBoltzmannWeighting(
      input.smiles,
      input.temperature || 298.15
    );

    if (boltzmann.success) {
      result.metadata.boltzmann = boltzmann;
      result.metadata.modulesApplied.push('Boltzmann Weighting');
      console.log(`✅ Boltzmann: ${boltzmann.conformers?.length || 0} conformers`);
    }
  } catch (error) {
    result.metadata.warnings.push('Boltzmann module failed');
  }

  // ========================================
  // MODULE 2: Exchange Dynamics
  // ========================================
  // REMOVE: Comment this block to disable
  if (input.solvent && result.nmr && result.nmr.length > 1) {
    try {
      const rate = estimateExchangeRate(input.solvent, input.temperature || 298.15);

      // Check exchange for each peak pair
      for (let i = 0; i < result.nmr.length - 1; i++) {
        for (let j = i + 1; j < result.nmr.length; j++) {
          const delta = Math.abs(result.nmr[i].shift - result.nmr[j].shift);

          if (delta > 0.1) {
            const exchange = analyzeExchange(rate, delta, input.frequency || 400);

            if (exchange.regime !== 'slow') {
              console.log(`🔄 Exchange: ${exchange.regime} regime`);
            }
          }
        }
      }

      result.metadata.modulesApplied.push('Exchange Dynamics');
    } catch (error) {
      result.metadata.warnings.push('Exchange module failed');
    }
  }

  // ========================================
  // MODULE 6: Point Group Symmetry
  // ========================================
  // REMOVE: Comment this block to disable
  try {
    const symmetry = await detectSymmetry(
      input.smiles,
      input.cid, // Use CID for cache lookup
      input.moleculeName
    );

    if (symmetry.success) {
      result.metadata.symmetry = symmetry;
      result.metadata.modulesApplied.push('Point Group Symmetry');
      console.log(`🔷 Symmetry: ${symmetry.pointGroup} (source: ${symmetry.source})`);
    }
  } catch (error) {
    result.metadata.warnings.push('Symmetry module failed');
  }

  // ========================================
  // MODULE 9: ¹³C NOE
  // ========================================
  // REMOVE: Comment this block to disable
  if (result.c13 && result.c13.length > 0) {
    try {
      const structure = parseSMILES(input.smiles);
      const noe = calculateNOEFromStructure(structure, input.temperature || 298.15);

      result.metadata.modulesApplied.push('¹³C NOE Model');
      console.log(`✅ NOE: η = ${noe.toFixed(2)}`);
    } catch (error) {
      result.metadata.warnings.push('NOE module failed');
    }
  }

  // ========================================
  // Add more modules here as needed
  // ========================================

  return result;
}
