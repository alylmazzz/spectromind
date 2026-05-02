/**
 * Module 2: NMR Timescale Exchange Dynamics
 *
 * PURPOSE:
 * - Analyzes chemical exchange regimes (slow/intermediate/fast)
 * - Estimates OH/NH proton exchange rates
 * - Predicts peak broadening/averaging behavior
 *
 * USAGE:
 * import { analyzeExchange } from '@/lib/enhancement-modules/module2-exchange';
 * const regime = analyzeExchange(rate, deltaPPM, frequency);
 *
 * REMOVE:
 * Delete this file if you don't need exchange dynamics
 */

export type ExchangeRegime = 'slow' | 'intermediate' | 'fast';

export interface ExchangeResult {
  regime: ExchangeRegime;
  rateConstant: number; // s⁻¹
  deltaNu: number; // Hz
  peakBehavior: 'separate' | 'broadened' | 'averaged';
}

/**
 * Analyze exchange regime based on k/Δν ratio
 *
 * @param rateConstant - Exchange rate in s⁻¹
 * @param deltaPPM - Chemical shift difference in ppm
 * @param frequency - Spectrometer frequency in MHz
 * @returns Exchange regime and behavior
 */
export function analyzeExchange(
  rateConstant: number,
  deltaPPM: number,
  frequency: number
): ExchangeResult {
  const deltaNu = deltaPPM * frequency; // Convert to Hz
  const ratio = rateConstant / deltaNu;

  let regime: ExchangeRegime;
  let peakBehavior: 'separate' | 'broadened' | 'averaged';

  if (ratio > 10) {
    regime = 'fast';
    peakBehavior = 'averaged';
  } else if (ratio < 0.1) {
    regime = 'slow';
    peakBehavior = 'separate';
  } else {
    regime = 'intermediate';
    peakBehavior = 'broadened';
  }

  return {
    regime,
    rateConstant,
    deltaNu,
    peakBehavior
  };
}

/**
 * Estimate proton exchange rate (OH/NH)
 *
 * @param solvent - Solvent name
 * @param temperature - Temperature in K
 * @returns Exchange rate in s⁻¹
 */
export function estimateExchangeRate(
  solvent: string,
  temperature: number = 298.15
): number {
  const baseRates: Record<string, number> = {
    'D2O': 1e6,
    'DMSO': 1e2,
    'CDCl3': 1e1,
    'CD3OD': 1e5,
    'Acetone': 1e2
  };

  const baseRate = baseRates[solvent] || 1e2;

  // Temperature correction (Arrhenius-like)
  const Ea = 50000; // J/mol (activation energy)
  const R = 8.314; // J/(mol·K)
  const T0 = 298.15; // Reference temperature

  const tempFactor = Math.exp(-Ea / R * (1 / temperature - 1 / T0));

  return baseRate * tempFactor;
}
