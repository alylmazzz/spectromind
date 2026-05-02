/**
 * Module 9: ¹³C Nuclear Overhauser Effect (NOE)
 *
 * PURPOSE:
 * - Calculates NOE enhancement factor for ¹³C NMR
 * - Based on molecular weight and rotational correlation time
 * - Predicts signal intensity enhancement
 *
 * USAGE:
 * import { calculateNOE } from '@/lib/enhancement-modules/module9-noe';
 * const noe = calculateNOE(molecularWeight, temperature);
 *
 * REMOVE:
 * Delete this file if you don't need NOE calculations
 */

import { calculateMolecularWeight, type MolecularStructure } from '@/lib/utils/molecularStructure';

const R = 8.314; // J/(mol·K) - Gas constant
const AVOGADRO = 6.02214076e23; // mol⁻¹

/**
 * Calculate NOE enhancement factor
 *
 * @param molecularWeight - Molecular weight in g/mol
 * @param temperature - Temperature in K
 * @param viscosity - Solvent viscosity in Pa·s (default water @ 25°C)
 * @returns NOE enhancement factor (typically 0-2 for ¹³C)
 */
export function calculateNOE(
  molecularWeight: number,
  temperature: number = 298.15,
  viscosity: number = 0.001
): number {
  // Estimate molecular radius from MW (rough approximation)
  const density = 1.0; // g/cm³
  const volume = molecularWeight / (AVOGADRO * density); // cm³
  const radius = Math.cbrt((3 * volume) / (4 * Math.PI)); // cm

  // Rotational correlation time (Stokes-Einstein-Debye)
  const k_boltzmann = R / AVOGADRO; // J/K
  const tau_c = (4 * Math.PI * viscosity * Math.pow(radius, 3)) /
                (3 * k_boltzmann * temperature); // seconds

  // ¹³C Larmor frequency (assume 100 MHz)
  const omega_C = 2 * Math.PI * 100e6; // rad/s
  const x = omega_C * tau_c;

  // NOE factor (simplified)
  let noe: number;
  if (x < 1) {
    // Extreme narrowing (small molecules)
    noe = 1.988; // Maximum NOE for ¹³C-¹H
  } else {
    // Slower tumbling (larger molecules)
    noe = 1.988 * (1 - x) / (1 + x);
  }

  return Math.max(0, noe);
}

/**
 * Calculate NOE from molecular structure
 *
 * @param structure - Parsed molecular structure
 * @param temperature - Temperature in K
 * @returns NOE enhancement factor
 */
export function calculateNOEFromStructure(
  structure: MolecularStructure,
  temperature: number = 298.15
): number {
  const mw = calculateMolecularWeight(structure);
  return calculateNOE(mw, temperature);
}

/**
 * Estimate if molecule is in extreme narrowing regime
 *
 * @param molecularWeight - MW in g/mol
 * @returns true if extreme narrowing (MW < ~500)
 */
export function isExtremeNarrowing(molecularWeight: number): boolean {
  return molecularWeight < 500;
}
