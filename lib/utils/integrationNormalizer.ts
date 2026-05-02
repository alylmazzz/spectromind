/**
 * Integration Normalization Utilities
 * Based on Silverstein NMR Spectroscopy textbook systematic approach
 *
 * Example from textbook:
 * Raw integrals: 1.76 : 2.64 : 1.77 : 2.59
 * Step 1: Divide by smallest (1.76) → 1.0 : 1.5 : 1.01 : 1.47
 * Step 2: Multiply by 2, round → 2 : 3 : 2 : 3
 * Step 3: Verify total = formula H count → 2+3+2+3 = 10H ✅
 */

import { NMRPeak } from '@/lib/types';

export interface NormalizationResult {
  normalizedPeaks: NMRPeak[];
  totalH: number;
  multiplier: number;
  scaleFactor: number;
  warnings: string[];
  method: 'exact' | 'approximate' | 'failed';
  confidenceScore: number; // 0-100
}

/**
 * Normalize integration values to whole numbers
 * Following Silverstein's systematic method
 */
export function normalizeIntegrations(
  peaks: NMRPeak[],
  expectedTotalH?: number,
  options?: {
    maxMultiplier?: number; // Default: 12
    tolerance?: number; // Default: 0.15 (15% error acceptable)
    preferSmallMultiplier?: boolean; // Default: true
  }
): NormalizationResult {
  const maxMultiplier = options?.maxMultiplier ?? 12;
  const tolerance = options?.tolerance ?? 0.15;
  const preferSmallMultiplier = options?.preferSmallMultiplier ?? true;

  const warnings: string[] = [];

  // Handle edge cases
  if (peaks.length === 0) {
    return {
      normalizedPeaks: [],
      totalH: 0,
      multiplier: 1,
      scaleFactor: 1,
      warnings: ['⚠️ No peaks provided'],
      method: 'failed',
      confidenceScore: 0
    };
  }

  // Step 1: Find smallest integration (exclude zero or very small values)
  const validIntegrals = peaks
    .map(p => p.integ)
    .filter(i => i > 0.01); // Ignore essentially zero values

  if (validIntegrals.length === 0) {
    warnings.push('⚠️ All integration values are too small or zero');
    return {
      normalizedPeaks: peaks,
      totalH: 0,
      multiplier: 1,
      scaleFactor: 1,
      warnings,
      method: 'failed',
      confidenceScore: 0
    };
  }

  const minInteg = Math.min(...validIntegrals);

  // Step 2: Calculate ratios (divide by smallest)
  const ratios = peaks.map(p => p.integ / minInteg);

  // Step 3: Find best multiplier to get whole numbers
  let bestMultiplier = 1;
  let bestError = Infinity;
  let bestNormalized: number[] = [];

  for (let m = 1; m <= maxMultiplier; m++) {
    const testValues = ratios.map(r => Math.round(r * m));
    const errors = ratios.map((r, i) => Math.abs(r * m - testValues[i]));
    const maxError = Math.max(...errors);
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;

    // Prefer smaller multipliers if error is acceptable
    if (maxError < tolerance) {
      if (preferSmallMultiplier) {
        bestMultiplier = m;
        bestError = maxError;
        bestNormalized = testValues;
        break; // Use first acceptable multiplier
      } else {
        if (maxError < bestError) {
          bestMultiplier = m;
          bestError = maxError;
          bestNormalized = testValues;
        }
      }
    }
  }

  // If no good multiplier found, use multiplier=1 and round
  if (bestNormalized.length === 0) {
    warnings.push(
      `⚠️ Could not find exact whole number ratios within ${(tolerance * 100).toFixed(0)}% tolerance`
    );
    warnings.push(`   Using approximate values (multiplier=1)`);
    bestMultiplier = 1;
    bestNormalized = ratios.map(r => Math.round(r));
  }

  // Step 4: Apply multiplier and create normalized peaks
  const normalizedPeaks = peaks.map((p, i) => ({
    ...p,
    integ: bestNormalized[i],
    integOriginal: p.integ // Save original value
  }));

  const totalH = bestNormalized.reduce((sum, val) => sum + val, 0);

  // Step 5: Validate against expected total H
  if (expectedTotalH !== undefined) {
    const percentError = Math.abs(totalH - expectedTotalH) / expectedTotalH * 100;

    if (percentError > 10) {
      warnings.push(
        `⚠️ Integration mismatch! Calculated: ${totalH}H, Expected: ${expectedTotalH}H (${percentError.toFixed(1)}% error)`
      );
      warnings.push(`   This may indicate:`);
      warnings.push(`   - Overlapping peaks`);
      warnings.push(`   - Missing peaks`);
      warnings.push(`   - Incorrect molecular formula`);
      warnings.push(`   - Integration errors`);
    } else if (percentError > 5) {
      warnings.push(
        `⚡ Moderate integration mismatch: ${totalH}H vs ${expectedTotalH}H expected (${percentError.toFixed(1)}% error)`
      );
    } else {
      warnings.push(`✅ Integration matches expected total: ${totalH}H = ${expectedTotalH}H`);
    }
  }

  // Calculate confidence score
  let confidenceScore = 100;

  // Reduce confidence based on error
  if (bestError > 0.05) confidenceScore -= 20;
  if (bestError > 0.10) confidenceScore -= 30;
  if (bestError > tolerance) confidenceScore -= 40;

  // Reduce confidence if high multiplier needed
  if (bestMultiplier > 6) confidenceScore -= 15;
  if (bestMultiplier > 10) confidenceScore -= 25;

  // Reduce confidence if total mismatch
  if (expectedTotalH) {
    const percentError = Math.abs(totalH - expectedTotalH) / expectedTotalH * 100;
    if (percentError > 5) confidenceScore -= 20;
    if (percentError > 10) confidenceScore -= 40;
  }

  confidenceScore = Math.max(0, confidenceScore);

  // Determine method
  let method: 'exact' | 'approximate' | 'failed';
  if (bestError < 0.05) {
    method = 'exact';
  } else if (bestError < tolerance) {
    method = 'approximate';
  } else {
    method = 'failed';
  }

  return {
    normalizedPeaks,
    totalH,
    multiplier: bestMultiplier,
    scaleFactor: minInteg,
    warnings,
    method,
    confidenceScore
  };
}

/**
 * Visual "eyeball method" for quick estimation
 * Compares relative peak heights/areas without calculations
 */
export function visualIntegrationEstimate(peaks: NMRPeak[]): {
  visualRatio: string;
  estimatedTotal: number;
  description: string;
} {
  if (peaks.length === 0) {
    return {
      visualRatio: '-',
      estimatedTotal: 0,
      description: 'No peaks'
    };
  }

  // Sort by integration
  const sorted = [...peaks].sort((a, b) => a.integ - b.integ);
  const smallest = sorted[0].integ;

  // Calculate simple ratios
  const simpleRatios = peaks.map(p => {
    const ratio = p.integ / smallest;
    // Round to nearest 0.5
    return Math.round(ratio * 2) / 2;
  });

  const visualRatio = simpleRatios.join(':');
  const estimatedTotal = simpleRatios.reduce((sum, r) => sum + r, 0);

  return {
    visualRatio,
    estimatedTotal: Math.round(estimatedTotal),
    description: `Görsel olarak: ${visualRatio} oranı, toplamda ~${Math.round(estimatedTotal)}H`
  };
}

/**
 * Detect potential integration problems
 */
export function detectIntegrationProblems(peaks: NMRPeak[]): {
  hasProblems: boolean;
  problems: string[];
  suggestions: string[];
} {
  const problems: string[] = [];
  const suggestions: string[] = [];

  // Check for zero integrations
  const zeroInteg = peaks.filter(p => p.integ === 0 || p.integ < 0.01);
  if (zeroInteg.length > 0) {
    problems.push(`${zeroInteg.length} peak(s) with zero or very small integration`);
    suggestions.push('Check if these are impurity peaks or experimental error');
  }

  // Check for very large integration differences
  const integrations = peaks.map(p => p.integ).filter(i => i > 0);
  if (integrations.length > 0) {
    const maxInteg = Math.max(...integrations);
    const minInteg = Math.min(...integrations);

    if (maxInteg / minInteg > 20) {
      problems.push(`Very large integration ratio (${(maxInteg / minInteg).toFixed(1)}:1)`);
      suggestions.push('This may indicate:');
      suggestions.push('- Overlapping peaks');
      suggestions.push('- Peak integration error');
      suggestions.push('- Consider re-integrating manually');
    }
  }

  // Check for suspicious fractional integrations
  const hasWeirdFractions = peaks.some(p => {
    const integ = p.integ;
    // Check if close to X.33 or X.66 (might indicate overlapping peaks)
    const fractional = integ - Math.floor(integ);
    return (Math.abs(fractional - 0.33) < 0.05 || Math.abs(fractional - 0.67) < 0.05);
  });

  if (hasWeirdFractions) {
    problems.push('Suspicious fractional integrations detected');
    suggestions.push('May indicate overlapping peaks - check baseline carefully');
  }

  return {
    hasProblems: problems.length > 0,
    problems,
    suggestions
  };
}

/**
 * Suggest expected integration based on multiplicity
 * Using n+1 rule reverse engineering
 */
export function suggestIntegrationFromMultiplicity(mult: string): {
  minH: number;
  typicalH: number[];
  reasoning: string;
} {
  const multMap: Record<string, { min: number; typical: number[]; reason: string }> = {
    's': { min: 0, typical: [1, 2, 3, 6, 9], reason: 'Singlet: no neighbors, any H count possible' },
    'd': { min: 1, typical: [1, 2, 3], reason: 'Doublet: 1 neighbor, typically 1-3H' },
    't': { min: 1, typical: [2, 3], reason: 'Triplet: 2 neighbors, typically CH₂' },
    'q': { min: 1, typical: [2], reason: 'Quartet: 3 neighbors, typically O-CH₂ or similar' },
    'quintet': { min: 1, typical: [2], reason: 'Quintet: 4 neighbors, typically middle CH₂' },
    'sextet': { min: 1, typical: [2], reason: 'Sextet: 5 neighbors, typically CH₂ between CH₂ and CH₃' },
    'sep': { min: 1, typical: [1], reason: 'Septet: 6 neighbors, typically CH with two CH₃' },
    'm': { min: 1, typical: [1, 2, 3], reason: 'Multiplet: complex coupling, variable H count' },
    'dd': { min: 1, typical: [1, 2], reason: 'Doublet of doublets: 2 different neighbors' },
    'dt': { min: 1, typical: [1, 2], reason: 'Doublet of triplets: 1 + 2 neighbors' },
    'ddd': { min: 1, typical: [1], reason: 'Doublet of doublet of doublets: 3 different neighbors' },
    'br s': { min: 0, typical: [1], reason: 'Broad singlet: exchangeable H (OH, NH) typically 1H' },
  };

  const info = multMap[mult.toLowerCase()] || { min: 1, typical: [1], reason: 'Unknown multiplicity' };

  return {
    minH: info.min,
    typicalH: info.typical,
    reasoning: info.reason
  };
}
