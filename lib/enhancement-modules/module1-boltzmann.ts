/**
 * Module 1: Boltzmann Conformer Weighting
 *
 * PURPOSE:
 * - Calculates conformer energies using RDKit MMFF94
 * - Computes Boltzmann weights for each conformer
 * - Applies thermal population weighting to NMR shifts
 *
 * USAGE:
 * import { applyBoltzmannWeighting } from '@/lib/enhancement-modules/module1-boltzmann';
 * const result = await applyBoltzmannWeighting(smiles, temperature);
 *
 * REMOVE:
 * Delete this file if you don't need Boltzmann weighting
 */

export interface Conformer {
  id: string;
  energy: number; // kcal/mol
  weight: number; // Boltzmann weight (0-1, sum=1)
}

export interface BoltzmannResult {
  success: boolean;
  conformers?: Conformer[];
  lowestEnergy?: number;
  error?: string;
}

/**
 * Apply Boltzmann weighting to conformers
 *
 * @param smiles - SMILES string of molecule
 * @param temperature - Temperature in Kelvin (default 298.15K)
 * @returns Boltzmann-weighted conformers
 */
export async function applyBoltzmannWeighting(
  smiles: string,
  temperature: number = 298.15
): Promise<BoltzmannResult> {
  try {
    const response = await fetch('/api/rdkit/calculate-energy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles, temperature })
    });

    if (!response.ok) {
      return { success: false, error: 'RDKit energy API failed' };
    }

    const data = await response.json();

    if (!data.success || !data.conformers) {
      return { success: false, error: data.error || 'No conformers generated' };
    }

    // Convert to simple format
    const conformers: Conformer[] = data.conformers.map((c: any) => ({
      id: String(c.id),
      energy: c.energy,
      weight: c.boltzmann_weight
    }));

    return {
      success: true,
      conformers,
      lowestEnergy: data.lowest_energy
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate weighted average chemical shift
 *
 * @param conformerShifts - Array of {conformerId, shift, weight}
 * @returns Weighted average shift
 */
export function calculateWeightedShift(
  conformerShifts: Array<{ shift: number; weight: number }>
): number {
  return conformerShifts.reduce(
    (sum, c) => sum + c.shift * c.weight,
    0
  );
}
