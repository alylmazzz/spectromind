/**
 * Peak Validation Utilities
 *
 * Based on: Silverstein "Spectrometric Identification of Organic Compounds"
 * Section 5.6: Chemical shift formula δ = (shift in Hz) / (spectrometer frequency in MHz)
 */

export interface ValidationResult {
  isValid: boolean;
  warning?: string;
  suggestion?: string;
}

/**
 * Validate 1H NMR chemical shift (δ in ppm)
 *
 * Normal range: 0-15 ppm
 * Extended range: -2 to 18 ppm (rare cases)
 */
export function validateProtonShift(shift: number): ValidationResult {
  // Check for NaN or empty
  if (isNaN(shift) || shift === null || shift === undefined) {
    return {
      isValid: false,
      warning: 'Chemical shift value required'
    };
  }

  // Physical impossibility check
  if (shift < -2 || shift > 18) {
    return {
      isValid: false,
      warning: `δ ${shift.toFixed(2)} ppm is outside physical range (-2 to 18 ppm)`,
      suggestion: 'Check if you entered the value correctly'
    };
  }

  // Unusual but valid (very downfield)
  if (shift > 15 && shift <= 18) {
    return {
      isValid: true,
      warning: `δ ${shift.toFixed(2)} ppm is very downfield`,
      suggestion: 'Common for enolic OH or strongly acidic protons (e.g., COOH)'
    };
  }

  // Unusual but valid (negative)
  if (shift < 0 && shift >= -2) {
    return {
      isValid: true,
      warning: `δ ${shift.toFixed(2)} ppm is negative (upfield)`,
      suggestion: 'Check for shielded protons or reference error'
    };
  }

  // Normal range
  return { isValid: true };
}

/**
 * Validate 13C NMR chemical shift (ppm)
 *
 * Normal range: 0-220 ppm
 * Extended range: -10 to 250 ppm
 */
export function validateCarbonShift(shift: number): ValidationResult {
  if (isNaN(shift) || shift === null || shift === undefined) {
    return {
      isValid: false,
      warning: 'Chemical shift value required'
    };
  }

  if (shift < -10 || shift > 250) {
    return {
      isValid: false,
      warning: `δ ${shift.toFixed(1)} ppm is outside physical range (-10 to 250 ppm)`,
      suggestion: 'Check if you entered the value correctly'
    };
  }

  if (shift > 220 && shift <= 250) {
    return {
      isValid: true,
      warning: `δ ${shift.toFixed(1)} ppm is very downfield for 13C`,
      suggestion: 'Rare for normal organic compounds'
    };
  }

  return { isValid: true };
}

/**
 * Validate FTIR wavenumber (cm⁻¹)
 *
 * Typical range: 400-4000 cm⁻¹
 */
export function validateWavenumber(wavenumber: number): ValidationResult {
  if (isNaN(wavenumber) || wavenumber === null || wavenumber === undefined) {
    return {
      isValid: false,
      warning: 'Wavenumber value required'
    };
  }

  if (wavenumber < 400 || wavenumber > 4000) {
    return {
      isValid: false,
      warning: `${wavenumber} cm⁻¹ is outside typical range (400-4000 cm⁻¹)`,
      suggestion: 'Check if you entered the value correctly'
    };
  }

  return { isValid: true };
}

/**
 * Validate integration value
 * Should be positive number
 */
export function validateIntegration(integ: number): ValidationResult {
  if (isNaN(integ) || integ === null || integ === undefined) {
    return {
      isValid: false,
      warning: 'Integration value required'
    };
  }

  if (integ <= 0) {
    return {
      isValid: false,
      warning: 'Integration must be positive',
      suggestion: 'Enter a value greater than 0'
    };
  }

  if (integ > 100) {
    return {
      isValid: true,
      warning: 'Very large integration value',
      suggestion: 'Consider normalizing integration values'
    };
  }

  return { isValid: true };
}

/**
 * Get friendly range description for spectrum type
 */
export function getRangeDescription(type: 'nmr' | 'c13' | 'ftir'): string {
  switch (type) {
    case 'nmr':
      return '0-15 ppm (typical), -2 to 18 ppm (extended)';
    case 'c13':
      return '0-220 ppm (typical), -10 to 250 ppm (extended)';
    case 'ftir':
      return '400-4000 cm⁻¹';
    default:
      return '';
  }
}

/**
 * Chemical Equivalence Detection
 * Based on: Section 5.8 - Chemical shift equivalence
 *
 * Detects if multiple peaks have the same or very similar chemical shifts,
 * which could indicate:
 * 1. Overlapping peaks (accidental equivalence)
 * 2. Chemical equivalence (same environment)
 * 3. Mixture (different molecules with coincident shifts)
 */

export interface OverlappingPeak {
  shift: number;
  count: number;
  peaks: Array<{ index: number; integ: number; mult: string }>;
  interpretation: 'equivalent' | 'overlapping' | 'mixture' | 'user_error';
  suggestion: string;
}

/**
 * Detect overlapping or equivalent peaks
 *
 * @param peaks - Array of NMR peaks
 * @param tolerance - Chemical shift tolerance in ppm (default: 0.01 ppm)
 * @returns Array of overlapping peak groups
 */
export function detectOverlappingPeaks(
  peaks: Array<{ shift: number; integ: number; mult: string }>,
  tolerance: number = 0.01
): OverlappingPeak[] {
  const overlaps: OverlappingPeak[] = [];
  const processed = new Set<number>();

  peaks.forEach((peak, index) => {
    if (processed.has(index)) return;

    // Find all peaks within tolerance
    const group: Array<{ index: number; integ: number; mult: string }> = [];

    peaks.forEach((otherPeak, otherIndex) => {
      if (Math.abs(peak.shift - otherPeak.shift) <= tolerance) {
        group.push({
          index: otherIndex,
          integ: otherPeak.integ,
          mult: otherPeak.mult
        });
        processed.add(otherIndex);
      }
    });

    // Only report if multiple peaks at same shift
    if (group.length > 1) {
      const interpretation = interpretOverlap(group);

      overlaps.push({
        shift: peak.shift,
        count: group.length,
        peaks: group,
        interpretation: interpretation.type,
        suggestion: interpretation.suggestion
      });
    }
  });

  return overlaps;
}

/**
 * Interpret why peaks overlap
 */
function interpretOverlap(
  peaks: Array<{ index: number; integ: number; mult: string }>
): { type: 'equivalent' | 'overlapping' | 'mixture' | 'user_error'; suggestion: string } {
  // Check if all multiplicities are the same
  const mults = peaks.map(p => p.mult);
  const uniqueMults = new Set(mults);

  // Check integration ratios
  const integrations = peaks.map(p => p.integ);
  const totalInteg = integrations.reduce((sum, i) => sum + i, 0);

  // Case 1: User accidentally entered same peak twice (most common error)
  if (
    uniqueMults.size === 1 &&
    integrations.every(i => Math.abs(i - integrations[0]) < 0.1)
  ) {
    return {
      type: 'user_error',
      suggestion: 'Same peak entered multiple times? Consider removing duplicates.'
    };
  }

  // Case 2: Chemical equivalence (TMS example: all 12H are equivalent)
  // High integration, same multiplicity
  if (uniqueMults.size === 1 && totalInteg > 3) {
    return {
      type: 'equivalent',
      suggestion: 'Chemically equivalent protons (same environment). Consider combining into single peak.'
    };
  }

  // Case 3: Accidental overlap (different multiplicities)
  if (uniqueMults.size > 1) {
    return {
      type: 'overlapping',
      suggestion: 'Accidentally overlapping peaks with different multiplicities. This is rare - verify experimental data.'
    };
  }

  // Case 4: Possible mixture
  if (totalInteg < 3 && peaks.length > 1) {
    return {
      type: 'mixture',
      suggestion: 'Possible mixture: small peaks at same shift from different molecules.'
    };
  }

  // Default: overlapping
  return {
    type: 'overlapping',
    suggestion: 'Overlapping peaks detected. Verify if this is intentional.'
  };
}

/**
 * Check if integration sum is reasonable
 * (Total should roughly match molecular formula)
 */
export function validateTotalIntegration(
  peaks: Array<{ integ: number }>,
  expectedProtons?: number
): ValidationResult {
  const total = peaks.reduce((sum, p) => sum + p.integ, 0);

  if (peaks.length === 0) {
    return {
      isValid: false,
      warning: 'No peaks to validate'
    };
  }

  // Check if total is reasonable
  if (total > 100) {
    return {
      isValid: true,
      warning: 'Very high total integration',
      suggestion: 'Consider normalizing integration values (divide by smallest, then round)'
    };
  }

  // If expected protons provided, check ratio
  if (expectedProtons) {
    const ratio = total / expectedProtons;

    if (ratio < 0.5 || ratio > 2.0) {
      return {
        isValid: true,
        warning: `Integration sum (${total.toFixed(1)}) doesn't match expected protons (${expectedProtons})`,
        suggestion: 'Check if all peaks are included or if normalization is needed'
      };
    }
  }

  return { isValid: true };
}

/**
 * Integration Ratio Normalization
 * Based on: Section 5.9 - Integration ratios should be whole numbers
 *
 * Example: Phenylacetone → 5:2:3 (aromatic:CH₂:CH₃)
 * If user enters 5.1:2.05:3.2, normalize to 5:2:3
 */

export interface NormalizedIntegration {
  original: number[];
  normalized: number[];
  gcd: number;
  suggestion: string;
  shouldNormalize: boolean;
}

/**
 * Calculate Greatest Common Divisor
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Find GCD of array
 */
function gcdArray(arr: number[]): number {
  return arr.reduce((acc, val) => gcd(acc, val), arr[0]);
}

/**
 * Normalize integration values to whole number ratios
 *
 * @param integrations - Array of integration values
 * @param tolerance - Tolerance for "close to integer" (default: 0.15)
 * @returns Normalized integration result with suggestions
 */
export function normalizeIntegrationRatios(
  integrations: number[],
  tolerance: number = 0.15
): NormalizedIntegration {
  if (integrations.length === 0 || integrations.some(i => i <= 0)) {
    return {
      original: integrations,
      normalized: integrations,
      gcd: 1,
      suggestion: 'Invalid integration values',
      shouldNormalize: false
    };
  }

  // Step 1: Find the smallest integration value
  const minInteg = Math.min(...integrations);

  // Step 2: Divide all by smallest (scale to smallest = 1)
  const scaled = integrations.map(i => i / minInteg);

  // Step 3: Check if values are close to integers
  const closestIntegers = scaled.map(val => Math.round(val));
  const deviations = scaled.map((val, idx) => Math.abs(val - closestIntegers[idx]));
  const maxDeviation = Math.max(...deviations);

  // Step 4: If close enough to integers, normalize
  if (maxDeviation <= tolerance) {
    // Reduce to simplest ratio using GCD
    const commonDivisor = gcdArray(closestIntegers);
    const simplified = closestIntegers.map(val => val / commonDivisor);

    // Check if normalization would actually change values
    const needsNormalization = integrations.some((orig, idx) =>
      Math.abs(orig - simplified[idx]) > 0.01
    );

    if (needsNormalization) {
      return {
        original: integrations,
        normalized: simplified,
        gcd: commonDivisor,
        suggestion: `Normalize to ${simplified.join(':')} ratio (currently ${integrations.map(v => v.toFixed(1)).join(':')})`,
        shouldNormalize: true
      };
    }
  }

  // Step 5: Values are already good or too far from integers
  return {
    original: integrations,
    normalized: integrations,
    gcd: 1,
    suggestion: maxDeviation > tolerance
      ? 'Integration ratios are not close to whole numbers - verify experimental data'
      : 'Integration ratios are already normalized',
    shouldNormalize: false
  };
}

/**
 * Get normalized peaks with updated integration values
 *
 * @param peaks - Array of NMR peaks
 * @returns Array of peaks with normalized integration values
 */
export function getNormalizedPeaks<T extends { integ: number }>(
  peaks: T[]
): { peaks: T[]; normalization: NormalizedIntegration } {
  const integrations = peaks.map(p => p.integ);
  const normalization = normalizeIntegrationRatios(integrations);

  if (normalization.shouldNormalize) {
    const normalizedPeaks = peaks.map((peak, idx) => ({
      ...peak,
      integ: normalization.normalized[idx]
    }));

    return { peaks: normalizedPeaks, normalization };
  }

  return { peaks, normalization };
}

/**
 * n+1 Rule Validation (Section 5.13)
 * Based on: Silverstein - Multiplicity is determined by n+1 rule
 *
 * n = number of equivalent neighboring protons
 * multiplicity = n + 1
 *
 * Examples:
 * - 0 neighbors → singlet (s) - 1 peak
 * - 1 neighbor → doublet (d) - 2 peaks
 * - 2 neighbors → triplet (t) - 3 peaks
 * - 3 neighbors → quartet (q) - 4 peaks
 * - 6 neighbors → septet (sept) - 7 peaks
 */

export interface MultiplicityInfo {
  multiplicity: string;
  expectedNeighbors: number;
  peakCount: number;
  description: string;
  typicalIntegrationRange?: [number, number]; // Typical H count for this multiplicity
}

/**
 * Multiplicity reference table
 */
export const MULTIPLICITY_TABLE: Record<string, MultiplicityInfo> = {
  's': {
    multiplicity: 'singlet',
    expectedNeighbors: 0,
    peakCount: 1,
    description: 'No neighboring protons',
    typicalIntegrationRange: [1, 9]
  },
  'd': {
    multiplicity: 'doublet',
    expectedNeighbors: 1,
    peakCount: 2,
    description: '1 neighboring proton',
    typicalIntegrationRange: [1, 6]
  },
  't': {
    multiplicity: 'triplet',
    expectedNeighbors: 2,
    peakCount: 3,
    description: '2 neighboring protons',
    typicalIntegrationRange: [1, 4]
  },
  'q': {
    multiplicity: 'quartet',
    expectedNeighbors: 3,
    peakCount: 4,
    description: '3 neighboring protons (e.g., CH₃ next to CH₂)',
    typicalIntegrationRange: [1, 3]
  },
  'quint': {
    multiplicity: 'quintet',
    expectedNeighbors: 4,
    peakCount: 5,
    description: '4 neighboring protons',
    typicalIntegrationRange: [1, 2]
  },
  'sext': {
    multiplicity: 'sextet',
    expectedNeighbors: 5,
    peakCount: 6,
    description: '5 neighboring protons',
    typicalIntegrationRange: [1, 2]
  },
  'sept': {
    multiplicity: 'septet',
    expectedNeighbors: 6,
    peakCount: 7,
    description: '6 neighboring protons (e.g., CH next to two CH₃)',
    typicalIntegrationRange: [1, 1] // Almost always 1H
  },
  'oct': {
    multiplicity: 'octet',
    expectedNeighbors: 7,
    peakCount: 8,
    description: '7 neighboring protons',
    typicalIntegrationRange: [1, 1]
  },
  'non': {
    multiplicity: 'nonet',
    expectedNeighbors: 8,
    peakCount: 9,
    description: '8 neighboring protons',
    typicalIntegrationRange: [1, 1]
  },
  // İkili kombinasyonlar
  'dd': {
    multiplicity: 'doublet of doublets',
    expectedNeighbors: 2,
    peakCount: 4,
    description: '2 non-equivalent neighboring protons',
    typicalIntegrationRange: [1, 2]
  },
  'dt': {
    multiplicity: 'doublet of triplets',
    expectedNeighbors: 3,
    peakCount: 6,
    description: '1 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 2]
  },
  'td': {
    multiplicity: 'triplet of doublets',
    expectedNeighbors: 3,
    peakCount: 6,
    description: '2 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 2]
  },
  'dq': {
    multiplicity: 'doublet of quartets',
    expectedNeighbors: 4,
    peakCount: 8,
    description: '1 + 3 non-equivalent neighbors',
    typicalIntegrationRange: [1, 2]
  },
  'qd': {
    multiplicity: 'quartet of doublets',
    expectedNeighbors: 4,
    peakCount: 8,
    description: '3 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 2]
  },
  'tt': {
    multiplicity: 'triplet of triplets',
    expectedNeighbors: 4,
    peakCount: 9,
    description: '2 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 2]
  },
  'tq': {
    multiplicity: 'triplet of quartets',
    expectedNeighbors: 5,
    peakCount: 12,
    description: '2 + 3 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'qt': {
    multiplicity: 'quartet of triplets',
    expectedNeighbors: 5,
    peakCount: 12,
    description: '3 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'qq': {
    multiplicity: 'quartet of quartets',
    expectedNeighbors: 6,
    peakCount: 16,
    description: '3 + 3 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  // Üçlü kombinasyonlar
  'ddd': {
    multiplicity: 'doublet of doublets of doublets',
    expectedNeighbors: 3,
    peakCount: 8,
    description: '3 non-equivalent neighboring protons',
    typicalIntegrationRange: [1, 1]
  },
  'ddt': {
    multiplicity: 'doublet of doublet of triplets',
    expectedNeighbors: 4,
    peakCount: 12,
    description: '2 + 1 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'dtd': {
    multiplicity: 'doublet of triplet of doublets',
    expectedNeighbors: 4,
    peakCount: 12,
    description: '1 + 2 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'tdd': {
    multiplicity: 'triplet of doublet of doublets',
    expectedNeighbors: 4,
    peakCount: 12,
    description: '2 + 1 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'dtt': {
    multiplicity: 'doublet of triplet of triplets',
    expectedNeighbors: 5,
    peakCount: 18,
    description: '1 + 2 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'tdt': {
    multiplicity: 'triplet of doublet of triplets',
    expectedNeighbors: 5,
    peakCount: 18,
    description: '2 + 1 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'ttd': {
    multiplicity: 'triplet of triplet of doublets',
    expectedNeighbors: 5,
    peakCount: 18,
    description: '2 + 2 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'ttt': {
    multiplicity: 'triplet of triplet of triplets',
    expectedNeighbors: 6,
    peakCount: 27,
    description: '2 + 2 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'ddq': {
    multiplicity: 'doublet of doublet of quartets',
    expectedNeighbors: 5,
    peakCount: 16,
    description: '1 + 1 + 3 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'dqd': {
    multiplicity: 'doublet of quartet of doublets',
    expectedNeighbors: 5,
    peakCount: 16,
    description: '1 + 3 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'qdd': {
    multiplicity: 'quartet of doublet of doublets',
    expectedNeighbors: 5,
    peakCount: 16,
    description: '3 + 1 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  // Dörtlü kombinasyonlar
  'dddd': {
    multiplicity: 'doublet of doublet of doublet of doublets',
    expectedNeighbors: 4,
    peakCount: 16,
    description: '4 non-equivalent neighboring protons',
    typicalIntegrationRange: [1, 1]
  },
  'dddt': {
    multiplicity: 'doublet of doublet of doublet of triplets',
    expectedNeighbors: 5,
    peakCount: 24,
    description: '1 + 1 + 1 + 2 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'ddtd': {
    multiplicity: 'doublet of doublet of triplet of doublets',
    expectedNeighbors: 5,
    peakCount: 24,
    description: '1 + 1 + 2 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'dtdd': {
    multiplicity: 'doublet of triplet of doublet of doublets',
    expectedNeighbors: 5,
    peakCount: 24,
    description: '1 + 2 + 1 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  'tddd': {
    multiplicity: 'triplet of doublet of doublet of doublets',
    expectedNeighbors: 5,
    peakCount: 24,
    description: '2 + 1 + 1 + 1 non-equivalent neighbors',
    typicalIntegrationRange: [1, 1]
  },
  // Broad peaks
  'm': {
    multiplicity: 'multiplet',
    expectedNeighbors: -1, // Unknown
    peakCount: -1, // Variable
    description: 'Complex overlapping pattern',
    typicalIntegrationRange: [1, 10]
  },
  'br': {
    multiplicity: 'broad',
    expectedNeighbors: -1, // N/A for broad peaks
    peakCount: 1,
    description: 'Broad peak (exchange, quadrupole)',
    typicalIntegrationRange: [1, 3]
  },
  'br s': {
    multiplicity: 'broad singlet',
    expectedNeighbors: 0,
    peakCount: 1,
    description: 'Broad singlet (OH, NH)',
    typicalIntegrationRange: [1, 3]
  },
  'br d': {
    multiplicity: 'broad doublet',
    expectedNeighbors: 1,
    peakCount: 2,
    description: 'Broad doublet',
    typicalIntegrationRange: [1, 3]
  },
  'br t': {
    multiplicity: 'broad triplet',
    expectedNeighbors: 2,
    peakCount: 3,
    description: 'Broad triplet',
    typicalIntegrationRange: [1, 3]
  },
  'br q': {
    multiplicity: 'broad quartet',
    expectedNeighbors: 3,
    peakCount: 4,
    description: 'Broad quartet',
    typicalIntegrationRange: [1, 3]
  },
  'br m': {
    multiplicity: 'broad multiplet',
    expectedNeighbors: -1,
    peakCount: -1,
    description: 'Broad multiplet',
    typicalIntegrationRange: [1, 3]
  },
  // Apparent multiplicities
  'app t': {
    multiplicity: 'apparent triplet',
    expectedNeighbors: 2,
    peakCount: 3,
    description: 'Apparent triplet (may be overlapping doublets)',
    typicalIntegrationRange: [1, 4]
  },
  'app q': {
    multiplicity: 'apparent quartet',
    expectedNeighbors: 3,
    peakCount: 4,
    description: 'Apparent quartet (may be overlapping patterns)',
    typicalIntegrationRange: [1, 3]
  },
  'app d': {
    multiplicity: 'apparent doublet',
    expectedNeighbors: 1,
    peakCount: 2,
    description: 'Apparent doublet (may be overlapping)',
    typicalIntegrationRange: [1, 6]
  }
};

/**
 * Validate multiplicity vs integration consistency
 *
 * @param multiplicity - Peak multiplicity (s, d, t, q, sept, etc.)
 * @param integration - Number of protons
 * @returns Validation result with warnings/suggestions
 */
export function validateMultiplicityIntegration(
  multiplicity: string,
  integration: number
): ValidationResult {
  const mult = multiplicity.toLowerCase().trim();
  const info = MULTIPLICITY_TABLE[mult];

  if (!info) {
    return {
      isValid: true,
      warning: `Unknown multiplicity: ${multiplicity}`,
      suggestion: 'Use standard abbreviations: s, d, t, q, sept, m, br'
    };
  }

  // Skip validation for multiplet and broad (too variable)
  if (mult === 'm' || mult === 'br') {
    return { isValid: true };
  }

  const [minH, maxH] = info.typicalIntegrationRange || [1, 10];

  // Check if integration is physically reasonable for this multiplicity
  if (integration < minH || integration > maxH) {
    // Special case: Septet with integration > 1H
    if (mult === 'sept' && integration > 1) {
      return {
        isValid: false,
        warning: `Septet with ${integration}H is unusual`,
        suggestion: 'Septet typically integrates for 1H (e.g., CH in isopropyl group). Verify multiplicity or check for overlapping peaks.'
      };
    }

    // Special case: High integration for complex multiplicities
    if (['dd', 'dt', 'td', 'ddd'].includes(mult) && integration > 2) {
      return {
        isValid: true,
        warning: `${info.multiplicity} with ${integration}H is unusual`,
        suggestion: `${info.multiplicity} typically integrates for 1-2H. Check for overlapping peaks.`
      };
    }

    // General case: Integration outside typical range
    if (integration > maxH) {
      return {
        isValid: true,
        warning: `${info.multiplicity} with ${integration}H is unusual`,
        suggestion: `${info.description}. Typical integration: ${minH}-${maxH}H. Consider if multiplet (m) is more appropriate.`
      };
    }
  }

  return { isValid: true };
}

/**
 * Get multiplicity info for display
 */
export function getMultiplicityInfo(multiplicity: string): MultiplicityInfo | null {
  const mult = multiplicity.toLowerCase().trim();
  return MULTIPLICITY_TABLE[mult] || null;
}

/**
 * Coupling Constant (J) Validation (Section 5.17)
 * Based on: Silverstein - J values are constant (in Hz) regardless of field strength
 *
 * Important Rules:
 * 1. J values are independent of spectrometer frequency
 *    - 60 MHz: J = 7.5 Hz
 *    - 600 MHz: J = 7.5 Hz (SAME!)
 *
 * 2. Typical J value ranges (1H NMR):
 *    - ³J (vicinal, aliphatic): 6-8 Hz
 *    - ³J (trans alkene): 11-18 Hz
 *    - ³J (cis alkene): 6-15 Hz
 *    - ³J (ortho aromatic): 7-10 Hz
 *    - ⁴J (meta aromatic): 2-3 Hz
 *    - ²J (geminal): 10-15 Hz
 *    - ²J_HF: 45-55 Hz (fluorine!)
 */

export interface CouplingValidationResult extends ValidationResult {
  expectedCouplings?: number; // Expected number of J values for multiplicity
  typicalRange?: [number, number]; // Typical J value range in Hz
}

/**
 * Get expected number of coupling constants for a multiplicity
 */
export function getExpectedCouplingCount(multiplicity: string): number {
  const mult = multiplicity.toLowerCase().trim();

  const couplingMap: Record<string, number> = {
    // Basit multiplisiteler
    's': 0,      // Singlet - no coupling
    'd': 1,      // Doublet - 1 J value
    't': 1,      // Triplet - 1 J value (equal spacing)
    'q': 1,      // Quartet - 1 J value
    'quint': 1,  // Quintet - 1 J value
    'sext': 1,   // Sextet - 1 J value
    'sept': 1,   // Septet - 1 J value
    'oct': 1,    // Octet - 1 J value
    'non': 1,    // Nonet - 1 J value
    // İkili kombinasyonlar
    'dd': 2,     // Doublet of doublets - 2 J values
    'dt': 2,     // Doublet of triplets - 2 J values
    'td': 2,     // Triplet of doublets - 2 J values
    'dq': 2,     // Doublet of quartets - 2 J values
    'qd': 2,     // Quartet of doublets - 2 J values
    'tt': 2,     // Triplet of triplets - 2 J values
    'tq': 2,     // Triplet of quartets - 2 J values
    'qt': 2,     // Quartet of triplets - 2 J values
    'qq': 2,     // Quartet of quartets - 2 J values
    // Üçlü kombinasyonlar
    'ddd': 3,    // Doublet of doublets of doublets - 3 J values
    'ddt': 3,    // Doublet of doublet of triplets - 3 J values
    'dtd': 3,    // Doublet of triplet of doublets - 3 J values
    'tdd': 3,    // Triplet of doublet of doublets - 3 J values
    'dtt': 3,    // Doublet of triplet of triplets - 3 J values
    'tdt': 3,    // Triplet of doublet of triplets - 3 J values
    'ttd': 3,    // Triplet of triplet of doublets - 3 J values
    'ttt': 3,    // Triplet of triplet of triplets - 3 J values
    'ddq': 3,    // Doublet of doublet of quartets - 3 J values
    'dqd': 3,    // Doublet of quartet of doublets - 3 J values
    'qdd': 3,    // Quartet of doublet of doublets - 3 J values
    // Dörtlü kombinasyonlar
    'dddd': 4,   // Doublet of doublet of doublet of doublets - 4 J values
    'dddt': 4,   // Doublet of doublet of doublet of triplets - 4 J values
    'ddtd': 4,   // Doublet of doublet of triplet of doublets - 4 J values
    'dtdd': 4,   // Doublet of triplet of doublet of doublets - 4 J values
    'tddd': 4,   // Triplet of doublet of doublet of doublets - 4 J values
    // Broad peaks
    'm': -1,     // Multiplet - variable
    'br': 0,     // Broad - no resolved coupling
    'br s': 0,   // Broad singlet - no coupling
    'br d': 1,   // Broad doublet - 1 J value (may be unresolved)
    'br t': 1,   // Broad triplet - 1 J value (may be unresolved)
    'br q': 1,   // Broad quartet - 1 J value (may be unresolved)
    'br m': -1,  // Broad multiplet - variable
    // Apparent multiplicities
    'app t': 1,  // Apparent triplet - 1 J value
    'app q': 1,  // Apparent quartet - 1 J value
    'app d': 1   // Apparent doublet - 1 J value
  };

  return couplingMap[mult] ?? -1;
}

/**
 * Validate coupling constant value and consistency with multiplicity
 *
 * @param jValue - Coupling constant in Hz (single value or array for multiple couplings)
 * @param multiplicity - Peak multiplicity
 * @param context - Additional context (e.g., 'aromatic', 'alkene', 'aliphatic')
 * @returns Validation result with suggestions
 */
export function validateCouplingConstant(
  jValue: number | number[] | undefined,
  multiplicity: string,
  context?: 'aromatic' | 'alkene' | 'aliphatic' | 'fluorine'
): CouplingValidationResult {
  const mult = multiplicity.toLowerCase().trim();
  const expectedCount = getExpectedCouplingCount(mult);

  // Normalize jValue to array for easier processing
  const jValues: number[] = Array.isArray(jValue) 
    ? jValue.filter(v => v && v > 0)
    : (jValue && jValue > 0 ? [jValue] : []);

  // Check if J value should exist
  if (expectedCount === 0) {
    if (jValues.length > 0) {
      return {
        isValid: true,
        warning: `${mult} typically shows no coupling`,
        suggestion: 'Singlets and broad peaks should have J = 0 or empty'
      };
    }
    return { isValid: true };
  }

  // Check if J value is missing when expected
  if (expectedCount > 0 && jValues.length === 0) {
    return {
      isValid: true,
      warning: `${mult} should have coupling constant (J)`,
      suggestion: `Enter J value(s) - ${mult} typically has ${expectedCount} coupling constant${expectedCount > 1 ? 's' : ''}`,
      expectedCouplings: expectedCount
    };
  }

  // Check if correct number of J values provided
  if (expectedCount > 1 && jValues.length === 1) {
    return {
      isValid: true,
      warning: `${mult} typically requires ${expectedCount} J values`,
      suggestion: `Enter ${expectedCount} J values separated by commas (e.g., 8.9, 2.4)`,
      expectedCouplings: expectedCount
    };
  }

  // Validate each J value magnitude
  if (jValues.length > 0) {
    for (const jVal of jValues) {
      // Very large J value (likely fluorine)
      if (jVal > 30 && context !== 'fluorine') {
        return {
          isValid: true,
          warning: `J = ${jVal.toFixed(1)} Hz is very large`,
          suggestion: 'J > 30 Hz suggests fluorine coupling (²J_HF ≈ 50 Hz). Is this a fluorinated compound?',
          typicalRange: [45, 55]
        };
      }

      // Check context-specific ranges
      if (context === 'aromatic') {
        if (jVal < 2 || jVal > 10) {
          return {
            isValid: true,
            warning: `J = ${jVal.toFixed(1)} Hz unusual for aromatics`,
            suggestion: 'Aromatic coupling: ortho (7-10 Hz), meta (2-3 Hz), para (0-1 Hz)',
            typicalRange: [2, 10]
          };
        }
      } else if (context === 'alkene') {
        if (jVal < 6 || jVal > 18) {
          return {
            isValid: true,
            warning: `J = ${jVal.toFixed(1)} Hz unusual for alkenes`,
            suggestion: 'Alkene coupling: trans (11-18 Hz), cis (6-15 Hz)',
            typicalRange: [6, 18]
          };
        }
      } else if (context === 'aliphatic') {
        if (jVal < 5 || jVal > 9) {
          return {
            isValid: true,
            warning: `J = ${jVal.toFixed(1)} Hz unusual for aliphatics`,
            suggestion: 'Aliphatic ³J typically 6-8 Hz',
            typicalRange: [6, 8]
          };
        }
      }

      // General sanity check
      if (jVal > 100) {
        return {
          isValid: false,
          warning: `J = ${jVal.toFixed(1)} Hz is physically unrealistic`,
          suggestion: 'Check if you entered Hz (not ppm). Typical J values: 0-20 Hz (non-fluorine)'
        };
      }

      if (jVal < 1 && mult !== 's' && mult !== 'br' && mult !== 'br s') {
        return {
          isValid: true,
          warning: `J = ${jVal.toFixed(1)} Hz is very small`,
          suggestion: 'Long-range or para coupling? Consider if this is resolvable.'
        };
      }
    }
  }

  return {
    isValid: true,
    expectedCouplings: expectedCount
  };
}

/**
 * Determine coupling context from chemical shift
 */
export function determineCouplingContext(shift: number): 'aromatic' | 'alkene' | 'aliphatic' | undefined {
  if (shift >= 6.5 && shift <= 8.0) return 'aromatic';
  if (shift >= 4.5 && shift <= 6.5) return 'alkene';
  if (shift >= 0.5 && shift <= 4.5) return 'aliphatic';
  return undefined;
}

/**
 * Format J value for display
 * Supports single value or array for multiple couplings (dd, dt, td, etc.)
 */
export function formatJValue(jValue: number | number[] | undefined): string {
  if (!jValue) return '—';
  
  // Handle array of J values (for dd, dt, td, ddd, etc.)
  if (Array.isArray(jValue)) {
    const validValues = jValue.filter(v => v && v > 0);
    if (validValues.length === 0) return '—';
    if (validValues.length === 1) return `J=${validValues[0].toFixed(1)} Hz`;
    return `J=${validValues.map(v => v.toFixed(1)).join(', ')} Hz`;
  }
  
  // Handle single J value
  if (jValue <= 0) return '—';
  return `J=${jValue.toFixed(1)} Hz`;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * SILVERSTEIN APPENDIX 2 & 3: FUNCTIONAL GROUP PREDICTORS
 * ═══════════════════════════════════════════════════════════════════
 */

export interface FunctionalGroupPrediction {
  groups: string[];
  confidence: 'high' | 'medium' | 'low';
  description: string;
  reasoning: string;
}

/**
 * Predict functional groups from chemical shift (1H NMR)
 * Based on Silverstein Appendix 2 & 3
 */
export function predictFunctionalGroup(
  shift: number,
  integration?: number,
  multiplicity?: string
): FunctionalGroupPrediction {
  const groups: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  let description = '';
  let reasoning = '';

  // δ 0-2 ppm: Aliphatic region
  if (shift >= 0.7 && shift <= 1.3) {
    groups.push('CH₃-R (Aliphatic methyl)');
    description = 'Likely CH₃ group on aliphatic carbon';
    reasoning = 'Most shielded region (0.7-1.3 ppm) - characteristic of alkyl methyl groups';
    confidence = 'high';
  } else if (shift >= 1.2 && shift <= 1.7) {
    groups.push('R-CH₂-R or R₃-CH (Aliphatic methylene/methine)');
    description = 'Likely aliphatic CH₂ or CH groups';
    reasoning = 'Mid-aliphatic region (1.2-1.7 ppm) - typical for internal methylenes';
    confidence = 'medium';
  } else if (shift >= 1.6 && shift <= 2.6) {
    groups.push('Allylic C=C-CH');
    groups.push('α to C=O');
    description = 'Likely allylic (next to C=C) or α to carbonyl';
    reasoning = '1.6-2.6 ppm region - deshielded by adjacent π-system or C=O';
    confidence = 'medium';
  } else if (shift >= 2.1 && shift <= 2.5) {
    groups.push('CH₃-C=O (Acetyl)');
    groups.push('CH₃-COO (Ester methyl)');
    description = 'Likely acetyl or ester α-methyl';
    reasoning = '2.1-2.5 ppm - classic α-carbonyl position';
    confidence = 'high';
  }

  // δ 2-5 ppm: Heteroatom-adjacent region
  else if (shift >= 2.0 && shift <= 3.0) {
    groups.push('N-CH or NR₂-CH (Amine)');
    groups.push('S-CH (Sulfide)');
    description = 'Likely adjacent to nitrogen or sulfur';
    reasoning = '2.0-3.0 ppm - characteristic of N-CH and S-CH';
    confidence = 'medium';
  } else if (shift >= 3.0 && shift <= 3.2) {
    groups.push('I-CH (Iodide)');
    description = 'Possible C-I bond';
    reasoning = '~3.0 ppm - characteristic of C-I (least electronegative halogen)';
    confidence = 'medium';
  } else if (shift >= 3.1 && shift <= 4.1) {
    groups.push('RO-CH (Ether/Alcohol)');
    if (shift >= 3.7 && shift <= 3.9 && integration === 3 && multiplicity?.toLowerCase() === 's') {
      groups.push('Ph-OCH₃ (Aromatic methoxy) ⭐');
      description = 'HIGHLY LIKELY aromatic methoxy (Ph-OCH₃)';
      reasoning = 'δ 3.8 ppm (3H, s) is signature of aromatic methoxy - very diagnostic!';
      confidence = 'high';
    } else {
      description = 'Likely ether or alcohol (-OCH)';
      reasoning = '3.1-4.1 ppm - protons adjacent to oxygen';
      confidence = 'medium';
    }
  } else if (shift >= 3.2 && shift <= 3.8) {
    groups.push('Br-CH (Bromide)');
    description = 'Possible C-Br bond';
    reasoning = '3.2-3.8 ppm - characteristic of C-Br';
    confidence = 'medium';
  } else if (shift >= 3.5 && shift <= 4.8) {
    groups.push('Cl-CH (Chloride)');
    groups.push('RCOO-CH (Ester)');
    description = 'Likely C-Cl or ester -OCH';
    reasoning = '3.5-4.8 ppm - most deshielded by Cl or ester oxygen';
    confidence = 'medium';
  }

  // δ 4.5-8 ppm: Olefinic & Aromatic region
  else if (shift >= 4.5 && shift <= 6.5) {
    groups.push('C=C-H (Olefinic)');
    groups.push('Acetal/Ketal R-O-CH-O-R');
    description = 'Likely olefinic (alkene) or acetal proton';
    reasoning = '4.5-6.5 ppm - vinylic protons or acetal/ketal';
    confidence = 'high';
  } else if (shift >= 6.5 && shift <= 8.0) {
    groups.push('Aromatic C-H');
    description = 'Aromatic protons detected';
    reasoning = '6.5-8.0 ppm - characteristic aromatic region';
    confidence = 'high';
  } else if (shift >= 8.0 && shift <= 8.5) {
    groups.push('Aromatic C-H (electron-withdrawing substituent)');
    description = 'Aromatic protons with strong deshielding';
    reasoning = '8.0-8.5 ppm - aromatic protons ortho/para to NO₂, C=O, etc.';
    confidence = 'high';
  }

  // δ 9-15 ppm: Carbonyl region
  else if (shift >= 9.0 && shift <= 10.0) {
    groups.push('R-CHO (Aldehyde) ⭐⭐');
    description = 'ALDEHYDE detected! (R-CHO)';
    reasoning = '9.0-10.0 ppm - VERY diagnostic for aldehydic proton';
    confidence = 'high';
    if (integration === 1) {
      reasoning += '. Integration = 1H confirms aldehyde';
    }
  } else if (shift >= 10.0 && shift <= 13.0) {
    groups.push('R-COOH (Carboxylic acid) ⭐⭐');
    description = 'CARBOXYLIC ACID detected! (R-COOH)';
    reasoning = '11-12 ppm - VERY diagnostic for -COOH. Exchangeable with D₂O!';
    confidence = 'high';
    if (multiplicity?.toLowerCase().includes('br')) {
      reasoning += '. Broad peak confirms -COOH';
    }
  } else if (shift > 13.0) {
    groups.push('Enolic OH or highly acidic proton');
    description = 'Extremely downfield - enolic or very acidic';
    reasoning = '>13 ppm - rare! Enol tautomer or extremely acidic proton';
    confidence = 'high';
  }

  // No match
  if (groups.length === 0) {
    groups.push('Unclassified');
    description = 'Chemical shift outside typical ranges';
    reasoning = 'May be unusual functional group or reference error';
    confidence = 'low';
  }

  return { groups, confidence, description, reasoning };
}

/**
 * Methyl/Methylene/Methine Discrimination
 * Based on: "If H is part of CH₃ → low end, CH₂ → mid, CH → high end"
 */
export function predictCarbonType(
  shift: number,
  integration?: number
): { type: 'CH₃' | 'CH₂' | 'CH' | 'unknown'; reasoning: string } {
  // For same functional group, progression: CH₃ < CH₂ < CH

  // RO-CH example
  if (shift >= 3.0 && shift <= 4.2) {
    if (shift >= 3.0 && shift <= 3.4) {
      return {
        type: 'CH₃',
        reasoning: 'RO-CH₃ region (~3.3 ppm) - methoxy or similar'
      };
    } else if (shift >= 3.4 && shift <= 3.8) {
      return {
        type: 'CH₂',
        reasoning: 'RO-CH₂-R region (~3.6 ppm) - ether/alcohol methylene'
      };
    } else {
      return {
        type: 'CH',
        reasoning: 'RO-CH< region (~4.0 ppm) - ether/alcohol methine'
      };
    }
  }

  // Halogen-CH example
  if (shift >= 2.5 && shift <= 4.8) {
    if (shift <= 3.0 && integration === 3) {
      return { type: 'CH₃', reasoning: 'Likely X-CH₃ (halide methyl)' };
    } else if (shift >= 3.0 && shift <= 3.8) {
      return { type: 'CH₂', reasoning: 'Likely X-CH₂ (halide methylene)' };
    } else {
      return { type: 'CH', reasoning: 'Likely X-CH< (halide methine)' };
    }
  }

  // Integration-based guess
  if (integration === 3) {
    return { type: 'CH₃', reasoning: 'Integration = 3H suggests -CH₃' };
  } else if (integration === 2) {
    return { type: 'CH₂', reasoning: 'Integration = 2H suggests -CH₂-' };
  } else if (integration === 1) {
    return { type: 'CH', reasoning: 'Integration = 1H suggests -CH<' };
  }

  return { type: 'unknown', reasoning: 'Insufficient data for CH₃/CH₂/CH classification' };
}

/**
 * Halogen Effect Validator
 * Trend: I < Br < Cl (deshielding increases)
 */
export function validateHalogenEffect(
  shift: number,
  molecularFormula?: string
): ValidationResult & { halogen?: 'I' | 'Br' | 'Cl' | 'F' } {
  if (!molecularFormula) {
    return { isValid: true };
  }

  const hasI = molecularFormula.includes('I');
  const hasBr = molecularFormula.includes('Br');
  const hasCl = molecularFormula.includes('Cl');
  const hasF = molecularFormula.includes('F');

  // I-CH: ~3.0 ppm
  if (shift >= 2.8 && shift <= 3.2 && hasI) {
    return {
      isValid: true,
      halogen: 'I',
      suggestion: 'Consistent with C-I bond (~3.0 ppm). Least deshielded halogen.'
    };
  }

  // Br-CH: ~3.2-3.8 ppm
  if (shift >= 3.2 && shift <= 3.8 && hasBr) {
    return {
      isValid: true,
      halogen: 'Br',
      suggestion: 'Consistent with C-Br bond (3.2-3.8 ppm). Moderate deshielding.'
    };
  }

  // Cl-CH: ~3.5-4.8 ppm
  if (shift >= 3.5 && shift <= 4.8 && hasCl) {
    return {
      isValid: true,
      halogen: 'Cl',
      suggestion: 'Consistent with C-Cl bond (3.5-4.8 ppm). Most deshielded common halogen.'
    };
  }

  // F-CH: very special (coupling!)
  if (hasF) {
    return {
      isValid: true,
      halogen: 'F',
      warning: 'Fluorine present in formula',
      suggestion: 'Expect large ²J_HF coupling (~50 Hz) and complex multiplets'
    };
  }

  return { isValid: true };
}

/**
 * Exchangeable Proton Detector
 * OH, NH, COOH protons are variable (concentration, temp, solvent dependent)
 */
export function detectExchangeableProton(
  shift: number,
  multiplicity?: string
): { isExchangeable: boolean; type?: 'OH' | 'NH' | 'COOH' | 'Phenolic OH'; suggestion: string } {
  const mult = multiplicity?.toLowerCase() || '';
  const isBroad = mult.includes('br');

  // R-COOH: 11-12 ppm (very characteristic!)
  if (shift >= 10.5 && shift <= 13.0) {
    return {
      isExchangeable: true,
      type: 'COOH',
      suggestion: 'CARBOXYLIC ACID proton detected (11-12 ppm). Very exchangeable - will disappear in D₂O!'
    };
  }

  // Ar-OH: 4.0-7.0 ppm (broad)
  if (shift >= 4.0 && shift <= 7.0 && isBroad) {
    return {
      isExchangeable: true,
      type: 'Phenolic OH',
      suggestion: 'Possible phenolic OH (4-7 ppm, broad). Exchangeable with D₂O. Try D₂O exchange to confirm.'
    };
  }

  // R-OH or R-NH: 0.5-5.0 ppm (broad)
  if (shift >= 0.5 && shift <= 5.0 && isBroad) {
    return {
      isExchangeable: true,
      type: shift >= 2.5 ? 'NH' : 'OH',
      suggestion: `Possible ${shift >= 2.5 ? 'NH' : 'OH'} proton (broad peak). Exchangeable - try D₂O shake test.`
    };
  }

  return {
    isExchangeable: false,
    suggestion: 'Not in typical exchangeable proton range'
  };
}

/**
 * Aldehyde/Carboxylic Acid Auto-Detection
 * δ 9-10 ppm = 99% Aldehyde
 * δ 11-12 ppm = 99% Carboxylic acid
 */
export function detectCarbonylProton(
  shift: number,
  integration?: number,
  multiplicity?: string
): { detected: boolean; type?: 'Aldehyde' | 'Carboxylic Acid'; confidence: number; warning: string } {
  // Aldehyde: 9.0-10.0 ppm
  if (shift >= 9.0 && shift <= 10.0) {
    let confidence = 90;
    let warning = 'ALDEHYDE detected (R-CHO)! δ 9-10 ppm is diagnostic.';

    if (integration === 1) {
      confidence = 99;
      warning += ' Integration = 1H confirms aldehyde.';
    }

    if (multiplicity?.toLowerCase().includes('d')) {
      warning += ' Doublet suggests α-CH (e.g., R-CH₂-CHO).';
    } else if (multiplicity?.toLowerCase().includes('s')) {
      warning += ' Singlet suggests aromatic aldehyde (Ar-CHO).';
    }

    return { detected: true, type: 'Aldehyde', confidence, warning };
  }

  // Carboxylic acid: 11-12 ppm
  if (shift >= 10.5 && shift <= 13.0) {
    let confidence = 95;
    let warning = 'CARBOXYLIC ACID detected (R-COOH)! δ 11-12 ppm is diagnostic.';

    if (multiplicity?.toLowerCase().includes('br')) {
      confidence = 99;
      warning += ' Broad singlet confirms -COOH. Disappears in D₂O!';
    }

    if (integration === 1) {
      warning += ' Integration = 1H consistent with COOH.';
    }

    warning += ' CRITICAL: Molecular formula MUST contain -COOH group!';

    return { detected: true, type: 'Carboxylic Acid', confidence, warning };
  }

  return { detected: false, confidence: 0, warning: '' };
}

/**
 * Aromatic Methoxy Signature
 * δ 3.8 ppm (3H, s) = 90% Ph-OCH₃
 */
export function detectAromaticMethoxy(
  shift: number,
  integration?: number,
  multiplicity?: string
): { detected: boolean; confidence: number; suggestion: string } {
  // Very specific signature
  if (
    shift >= 3.7 &&
    shift <= 3.9 &&
    integration === 3 &&
    multiplicity?.toLowerCase() === 's'
  ) {
    return {
      detected: true,
      confidence: 90,
      suggestion: 'AROMATIC METHOXY detected (Ph-OCH₃)! δ 3.8 ppm (3H, s) is highly diagnostic. Check for aromatic protons at δ 6.8-7.2 ppm (ortho/para to OCH₃ are upfield due to electron donation).'
    };
  }

  // Close but not exact
  if (shift >= 3.6 && shift <= 4.0 && integration === 3) {
    return {
      detected: true,
      confidence: 60,
      suggestion: 'Possible aromatic methoxy or aliphatic methoxy (R-OCH₃). Check for aromatic signals.'
    };
  }

  return { detected: false, confidence: 0, suggestion: '' };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔬 SILVERSTEIN APPENDIX 5: COUPLING CONSTANT VALIDATORS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🎯 CRITICAL: Trans > Cis Rule Validator (Silverstein Appendix 5)
 *
 * Validates alkene geometry based on coupling constants:
 * - ³J_trans (11-18 Hz) > ³J_cis (6-15 Hz)
 * - Geminal: ²J_gem = 0-3 Hz (typically ~2 Hz)
 *
 * @param J1 - First coupling constant (Hz)
 * @param J2 - Second coupling constant (Hz)
 * @param multiplicity - Peak multiplicity (dd, ddd, etc.)
 *
 * @returns Geometry prediction and validation
 *
 * @example
 * validateTransCisRule(15.6, 8.2, 'dd')
 * // Returns: { geometry: 'trans', confidence: 'high', warning: '' }
 */
export interface TransCisValidation {
  geometry?: 'trans' | 'cis' | 'geminal' | 'ambiguous';
  confidence: 'high' | 'medium' | 'low';
  warning: string;
  interpretation: string;
}

export function validateTransCisRule(
  J1: number,
  J2?: number,
  multiplicity?: string
): TransCisValidation {
  // Single coupling constant analysis
  if (!J2) {
    // Trans alkene: ³J = 11-18 Hz (typical: 12-16 Hz)
    if (J1 >= 11 && J1 <= 18) {
      return {
        geometry: 'trans',
        confidence: J1 >= 12 && J1 <= 16 ? 'high' : 'medium',
        warning: '',
        interpretation: `³J = ${J1} Hz → TRANS alkene (RHC=CHR'). Typical range: 12-16 Hz`
      };
    }

    // Cis alkene: ³J = 6-15 Hz (typical: 7-11 Hz)
    if (J1 >= 6 && J1 <= 11) {
      return {
        geometry: 'cis',
        confidence: J1 >= 7 && J1 <= 10 ? 'high' : 'medium',
        warning: '',
        interpretation: `³J = ${J1} Hz → CIS alkene (RHC=CHR'). Typical range: 7-11 Hz`
      };
    }

    // Geminal: ²J = 0-3 Hz
    if (J1 >= 0 && J1 <= 3) {
      return {
        geometry: 'geminal',
        confidence: 'medium',
        warning: '',
        interpretation: `²J = ${J1} Hz → GEMINAL coupling (H-C=C_H₂). Typical: ~2 Hz`
      };
    }

    // Ambiguous range (overlap between cis and trans)
    if (J1 > 11 && J1 <= 15) {
      return {
        geometry: 'ambiguous',
        confidence: 'low',
        warning: '⚠️ Ambiguous range! J = 11-15 Hz could be large cis OR small trans',
        interpretation: `³J = ${J1} Hz → Could be large cis (11-15 Hz) OR small trans (11-12 Hz). Need more data!`
      };
    }

    return {
      confidence: 'low',
      warning: `⚠️ J = ${J1} Hz outside typical alkene range (0-18 Hz). Check for errors!`,
      interpretation: 'Not typical for alkene coupling'
    };
  }

  // Two coupling constants (dd pattern)
  const Jmax = Math.max(J1, J2);
  const Jmin = Math.min(J1, J2);

  // Trans-trans disubstituted: both J large
  if (Jmax >= 11 && Jmax <= 18 && Jmin >= 11 && Jmin <= 18) {
    return {
      geometry: 'trans',
      confidence: 'high',
      warning: '',
      interpretation: `dd: J = ${Jmax}, ${Jmin} Hz → Both TRANS couplings (E,E-diene or vicinal)`
    };
  }

  // Trans + Cis pattern
  if (Jmax >= 11 && Jmax <= 18 && Jmin >= 6 && Jmin <= 11) {
    return {
      geometry: 'trans',
      confidence: 'high',
      warning: '',
      interpretation: `dd: J = ${Jmax} Hz (TRANS), ${Jmin} Hz (CIS) → Mixed geometry or ABX system`
    };
  }

  // Cis-cis disubstituted: both J medium
  if (Jmax >= 6 && Jmax <= 11 && Jmin >= 6 && Jmin <= 11) {
    return {
      geometry: 'cis',
      confidence: 'high',
      warning: '',
      interpretation: `dd: J = ${Jmax}, ${Jmin} Hz → Both CIS couplings (Z,Z-diene or vicinal)`
    };
  }

  // Trans + Geminal
  if (Jmax >= 11 && Jmax <= 18 && Jmin >= 0 && Jmin <= 3) {
    return {
      geometry: 'trans',
      confidence: 'high',
      warning: '',
      interpretation: `dd: J = ${Jmax} Hz (TRANS), ${Jmin} Hz (GEMINAL) → Terminal alkene (RHC=CH₂)`
    };
  }

  // Cis + Geminal
  if (Jmax >= 6 && Jmax <= 11 && Jmin >= 0 && Jmin <= 3) {
    return {
      geometry: 'cis',
      confidence: 'medium',
      warning: '',
      interpretation: `dd: J = ${Jmax} Hz (CIS), ${Jmin} Hz (GEMINAL) → Terminal alkene (RHC=CH₂)`
    };
  }

  return {
    geometry: 'ambiguous',
    confidence: 'low',
    warning: `⚠️ Unusual coupling pattern: J = ${Jmax}, ${Jmin} Hz. Check for errors or complex system!`,
    interpretation: 'Not typical for simple alkene coupling'
  };
}

/**
 * 🪑 HIGH PRIORITY: Cyclohexane Conformation Analyzer (Silverstein Appendix 5)
 *
 * Detects cyclohexane conformations from vicinal coupling constants:
 * - Axial-Axial: ³J = 8-14 Hz (typically ~10-12 Hz)
 * - Axial-Equatorial: ³J = 2-6 Hz (typically ~3-4 Hz)
 * - Equatorial-Equatorial: ³J = 0-7 Hz (typically ~2-3 Hz)
 * - Dynamic averaging: ³J = 7-8 Hz (chair flip)
 *
 * @param J - Coupling constant (Hz)
 *
 * @returns Conformation analysis
 *
 * @example
 * analyzeCyclohexaneConformation(11.5)
 * // Returns: { conformation: 'axial-axial', rigidity: 'rigid', confidence: 'high' }
 */
export interface CyclohexaneConformation {
  conformation: 'axial-axial' | 'axial-equatorial' | 'equatorial-equatorial' | 'dynamic' | 'ambiguous';
  rigidity: 'rigid' | 'dynamic' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function analyzeCyclohexaneConformation(J: number): CyclohexaneConformation {
  // Axial-Axial: ³J = 8-14 Hz (RIGID, dihedral ~180°)
  if (J >= 8 && J <= 14) {
    return {
      conformation: 'axial-axial',
      rigidity: 'rigid',
      confidence: J >= 10 && J <= 12 ? 'high' : 'medium',
      interpretation: `³J = ${J} Hz → AXIAL-AXIAL coupling (dihedral ~180°)`,
      suggestion: '🪑 RIGID chair conformation! Both H atoms are axial. No chair flipping at this temperature.'
    };
  }

  // Dynamic Averaging: ³J = 7-8 Hz (chair flip at room temp)
  if (J >= 7 && J < 8) {
    return {
      conformation: 'dynamic',
      rigidity: 'dynamic',
      confidence: 'high',
      interpretation: `³J = ${J} Hz → DYNAMIC AVERAGING (chair flip)`,
      suggestion: '🔄 DYNAMIC system! Rapid chair flipping at room temperature. Try low-temp NMR to freeze conformation.'
    };
  }

  // Axial-Equatorial: ³J = 2-6 Hz
  if (J >= 2 && J < 7) {
    return {
      conformation: 'axial-equatorial',
      rigidity: 'rigid',
      confidence: J >= 3 && J <= 4 ? 'high' : 'medium',
      interpretation: `³J = ${J} Hz → AXIAL-EQUATORIAL coupling (dihedral ~60°)`,
      suggestion: '🪑 One H is axial, one is equatorial. Check for substituent effects on chair stability.'
    };
  }

  // Equatorial-Equatorial: ³J = 0-2 Hz
  if (J >= 0 && J < 2) {
    return {
      conformation: 'equatorial-equatorial',
      rigidity: 'rigid',
      confidence: 'medium',
      interpretation: `³J = ${J} Hz → EQUATORIAL-EQUATORIAL coupling (dihedral ~60°, small J)`,
      suggestion: '🪑 Both H atoms are equatorial. Most stable conformation for unsubstituted cyclohexane.'
    };
  }

  // Outside typical range
  return {
    conformation: 'ambiguous',
    rigidity: 'unknown',
    confidence: 'low',
    interpretation: `³J = ${J} Hz → Outside typical cyclohexane range (0-14 Hz)`,
    suggestion: '⚠️ Not typical for cyclohexane. Could be different ring system or measurement error.'
  };
}

/**
 * 🔮 MEDIUM PRIORITY: Heterocycle Pattern Recognition (Silverstein Appendix 5)
 *
 * Identifies heterocyclic aromatics from characteristic coupling patterns:
 * - Furan: ³J₂₃ = 1.6-2.0 Hz, ³J₂₄ = 0.5-1.0 Hz
 * - Pyrrole: ³J₂₃ = 2.0-2.6 Hz
 * - Thiophene: ³J₂₃ = 4.6-5.8 Hz, ³J₂₄ = 2.8-3.8 Hz
 * - Pyridine: Ortho = 4.5-6.0 Hz, Meta = 1.0-2.0 Hz, Para = 0-1.0 Hz
 *
 * @param J1 - Primary coupling constant (Hz)
 * @param J2 - Secondary coupling constant (Hz, optional)
 * @param shift - Chemical shift (ppm, optional for validation)
 *
 * @returns Heterocycle identification
 */
export interface HeterocyclePattern {
  heterocycle: 'furan' | 'pyrrole' | 'thiophene' | 'pyridine' | 'unknown';
  position?: '2,3' | '2,4' | 'ortho' | 'meta' | 'para';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function detectHeterocycle(
  J1: number,
  J2?: number,
  shift?: number
): HeterocyclePattern {
  // FURAN: Very small couplings (³J₂₃ = 1.6-2.0 Hz)
  if (J1 >= 1.6 && J1 <= 2.0) {
    // Check chemical shift for furan (δ 6.3-7.5 ppm)
    const shiftMatch = shift ? (shift >= 6.3 && shift <= 7.5) : true;

    return {
      heterocycle: 'furan',
      position: '2,3',
      confidence: shiftMatch ? 'high' : 'medium',
      interpretation: `³J = ${J1} Hz → FURAN (O-heterocycle)`,
      suggestion: `🌟 FURAN detected! Very small ³J₂₃ coupling (1.6-2.0 Hz) is diagnostic.${shift ? ` δ ${shift} ppm confirms furan.` : ''}`
    };
  }

  // FURAN: Ultra-small ³J₂₄ coupling
  if (J1 >= 0.5 && J1 <= 1.0) {
    return {
      heterocycle: 'furan',
      position: '2,4',
      confidence: 'medium',
      interpretation: `³J = ${J1} Hz → FURAN (2,4-coupling)`,
      suggestion: '🌟 Likely FURAN! Very small ³J₂₄ coupling (0.5-1.0 Hz) is characteristic.'
    };
  }

  // PYRROLE: Small couplings (³J₂₃ = 2.0-2.6 Hz)
  if (J1 >= 2.0 && J1 <= 2.6) {
    const shiftMatch = shift ? (shift >= 6.0 && shift <= 7.0) : true;

    return {
      heterocycle: 'pyrrole',
      position: '2,3',
      confidence: shiftMatch ? 'high' : 'medium',
      interpretation: `³J = ${J1} Hz → PYRROLE (N-heterocycle)`,
      suggestion: `🔬 PYRROLE detected! ³J₂₃ = 2.0-2.6 Hz is diagnostic.${shift ? ` δ ${shift} ppm confirms pyrrole.` : ''}`
    };
  }

  // THIOPHENE: Medium couplings (³J₂₃ = 4.6-5.8 Hz)
  if (J1 >= 4.6 && J1 <= 5.8) {
    const shiftMatch = shift ? (shift >= 6.9 && shift <= 7.5) : true;

    if (J2 && J2 >= 2.8 && J2 <= 3.8) {
      return {
        heterocycle: 'thiophene',
        position: '2,3',
        confidence: 'high',
        interpretation: `³J₂₃ = ${J1} Hz, ³J₂₄ = ${J2} Hz → THIOPHENE (S-heterocycle)`,
        suggestion: '💎 THIOPHENE confirmed! Both ³J₂₃ (4.6-5.8 Hz) and ³J₂₄ (2.8-3.8 Hz) match perfectly.'
      };
    }

    return {
      heterocycle: 'thiophene',
      position: '2,3',
      confidence: shiftMatch ? 'high' : 'medium',
      interpretation: `³J = ${J1} Hz → THIOPHENE (S-heterocycle)`,
      suggestion: `💎 THIOPHENE detected! ³J₂₃ = 4.6-5.8 Hz is diagnostic.${shift ? ` δ ${shift} ppm confirms thiophene.` : ''}`
    };
  }

  // THIOPHENE: ³J₂₄ coupling
  if (J1 >= 2.8 && J1 <= 3.8) {
    return {
      heterocycle: 'thiophene',
      position: '2,4',
      confidence: 'medium',
      interpretation: `³J = ${J1} Hz → THIOPHENE (2,4-coupling)`,
      suggestion: '💎 Likely THIOPHENE! ³J₂₄ = 2.8-3.8 Hz is characteristic.'
    };
  }

  // PYRIDINE: Ortho coupling (⁴J = 4.5-6.0 Hz)
  if (J1 >= 4.5 && J1 <= 6.0) {
    const shiftMatch = shift ? (shift >= 7.0 && shift <= 9.0) : true;

    return {
      heterocycle: 'pyridine',
      position: 'ortho',
      confidence: shiftMatch ? 'high' : 'medium',
      interpretation: `³J = ${J1} Hz → PYRIDINE (ortho coupling)`,
      suggestion: `🔷 PYRIDINE detected! Ortho coupling (4.5-6.0 Hz) is typical.${shift ? ` δ ${shift} ppm confirms pyridine.` : ''}`
    };
  }

  // PYRIDINE: Meta coupling (⁴J = 1.0-2.0 Hz)
  if (J1 >= 1.0 && J1 <= 1.6) {
    return {
      heterocycle: 'pyridine',
      position: 'meta',
      confidence: 'medium',
      interpretation: `⁴J = ${J1} Hz → PYRIDINE (meta coupling)`,
      suggestion: '🔷 Likely PYRIDINE! Meta coupling (1.0-2.0 Hz) is characteristic.'
    };
  }

  // PYRIDINE: Para coupling (⁵J = 0-1.0 Hz)
  if (J1 >= 0 && J1 <= 1.0 && shift && shift >= 7.0 && shift <= 9.0) {
    return {
      heterocycle: 'pyridine',
      position: 'para',
      confidence: 'low',
      interpretation: `⁵J = ${J1} Hz → PYRIDINE (para coupling)`,
      suggestion: '🔷 Possibly PYRIDINE! Para coupling is very small (0-1.0 Hz).'
    };
  }

  return {
    heterocycle: 'unknown',
    confidence: 'low',
    interpretation: `³J = ${J1} Hz → Not diagnostic for common heterocycles`,
    suggestion: 'Not matching furan/pyrrole/thiophene/pyridine patterns. Could be other heterocycle or benzene derivative.'
  };
}

/**
 * ⚛️ MEDIUM PRIORITY: Fluorine Coupling Detector (Silverstein Appendix 5)
 *
 * Detects H-F coupling from unusually large J values:
 * - ²J_HF (geminal): 44-81 Hz (very large!)
 * - ³J_HF (vicinal): 0-30 Hz (depends on dihedral)
 * - ⁴J_HF (long-range): 0-14 Hz
 *
 * @param J - Coupling constant (Hz)
 * @param multiplicity - Peak multiplicity
 *
 * @returns Fluorine coupling analysis
 *
 * @example
 * detectFluorineCoupling(48.5, 'd')
 * // Returns: { detected: true, type: 'geminal', confidence: 'high' }
 */
export interface FluorineCoupling {
  detected: boolean;
  type?: 'geminal' | 'vicinal' | 'long-range';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  warning: string;
}

export function detectFluorineCoupling(
  J: number,
  multiplicity?: string
): FluorineCoupling {
  // ²J_HF (Geminal): 44-81 Hz - VERY DIAGNOSTIC!
  if (J >= 44 && J <= 81) {
    return {
      detected: true,
      type: 'geminal',
      confidence: 'high',
      interpretation: `²J_HF = ${J} Hz → GEMINAL H-F coupling (H-C-F)`,
      warning: `⚛️ FLUORINE DETECTED! ²J_HF = ${J} Hz is highly diagnostic for geminal H-F coupling. Molecule contains C-F bond!`
    };
  }

  // Suspicious large J (30-44 Hz) - likely fluorine
  if (J >= 30 && J < 44) {
    return {
      detected: true,
      type: 'vicinal',
      confidence: 'high',
      interpretation: `³J_HF = ${J} Hz → Likely VICINAL H-F coupling (H-C-C-F)`,
      warning: `⚛️ FLUORINE LIKELY! J = ${J} Hz is too large for H-H coupling. Check for F substitution!`
    };
  }

  // ³J_HF (Vicinal): 0-30 Hz (overlaps with H-H, but >20 Hz suspicious)
  if (J >= 20 && J < 30) {
    return {
      detected: true,
      type: 'vicinal',
      confidence: 'medium',
      interpretation: `J = ${J} Hz → Possibly VICINAL H-F coupling (H-C-C-F)`,
      warning: `⚠️ J = ${J} Hz is large for H-H coupling. Consider fluorine substitution!`
    };
  }

  // ⁴J_HF (Long-range): 0-14 Hz (hard to distinguish from H-H)
  if (J >= 10 && J < 20) {
    return {
      detected: false, // Too ambiguous
      confidence: 'low',
      interpretation: `J = ${J} Hz → Could be H-H or ⁴J_HF (long-range)`,
      warning: `💡 J = ${J} Hz could be long-range H-F coupling if molecule contains fluorine. Check molecular formula!`
    };
  }

  // Normal H-H coupling range
  if (J >= 0 && J < 10) {
    return {
      detected: false,
      confidence: 'low',
      interpretation: `J = ${J} Hz → Typical H-H coupling range`,
      warning: ''
    };
  }

  // Unusually large (>81 Hz) - measurement error or P/Si coupling
  if (J > 81) {
    return {
      detected: true,
      type: 'geminal',
      confidence: 'medium',
      interpretation: `J = ${J} Hz → EXTREMELY LARGE! Could be ²J_HF or other heteronuclear coupling`,
      warning: `🚨 J = ${J} Hz is EXTREMELY LARGE! Check for: 1) Fluorine (²J_HF up to 81 Hz), 2) Phosphorus (J_HP up to 700 Hz!), 3) Measurement error`
    };
  }

  return {
    detected: false,
    confidence: 'low',
    interpretation: `J = ${J} Hz → Not indicative of fluorine coupling`,
    warning: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🌟 SILVERSTEIN APPENDIX: AROMATIC PATTERN RECOGNITION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔍 HIGH PRIORITY: Aromatic Coupling Constant Validator
 *
 * Validates coupling constants in aromatic systems (δ 6.5-8.5 ppm):
 * - ³J (ortho): 7-10 Hz (strongest, most common)
 * - ⁴J (meta): 1-3 Hz (weak but observable)
 * - ⁵J (para): 0-1 Hz (usually unresolved)
 *
 * @param J - Coupling constant (Hz)
 * @param shift - Chemical shift (ppm)
 *
 * @returns Aromatic coupling validation
 *
 * @example
 * validateAromaticCoupling(8.5, 7.34)
 * // Returns: { type: 'ortho', confidence: 'high', interpretation: '...' }
 */
export interface AromaticCoupling {
  type: 'ortho' | 'meta' | 'para' | 'non-aromatic';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  warning: string;
}

export function validateAromaticCoupling(J: number, shift?: number): AromaticCoupling {
  // Check if chemical shift is in aromatic region
  const isAromatic = shift ? (shift >= 6.5 && shift <= 8.5) : true;

  if (!isAromatic) {
    return {
      type: 'non-aromatic',
      confidence: 'low',
      interpretation: `δ ${shift} ppm → Not in aromatic region (6.5-8.5 ppm)`,
      warning: ''
    };
  }

  // ³J (Ortho): 7-10 Hz - Most common aromatic coupling
  if (J >= 7 && J <= 10) {
    return {
      type: 'ortho',
      confidence: 'high',
      interpretation: `³J = ${J} Hz → ORTHO aromatic coupling (typical range)`,
      warning: shift && shift >= 6.5 && shift <= 8.5
        ? `✅ Aromatic ortho coupling confirmed (δ ${shift} ppm, J = ${J} Hz)`
        : ''
    };
  }

  // ⁴J (Meta): 1-3 Hz - Weak but observable
  if (J >= 1 && J < 7) {
    if (J >= 1 && J <= 3) {
      return {
        type: 'meta',
        confidence: 'high',
        interpretation: `⁴J = ${J} Hz → META aromatic coupling (weak but observable)`,
        warning: shift && shift >= 6.5 && shift <= 8.5
          ? `✅ Aromatic meta coupling confirmed (δ ${shift} ppm, J = ${J} Hz)`
          : ''
      };
    } else {
      // J = 3-7 Hz ambiguous (could be ortho or complex system)
      return {
        type: 'ortho',
        confidence: 'low',
        interpretation: `³J = ${J} Hz → Small ortho coupling OR complex aromatic system`,
        warning: '⚠️ J = 3-7 Hz is unusual for simple aromatic systems. Could be small ortho coupling or second-order effects.'
      };
    }
  }

  // ⁵J (Para): 0-1 Hz - Usually unresolved
  if (J >= 0 && J < 1) {
    return {
      type: 'para',
      confidence: 'medium',
      interpretation: `⁵J = ${J} Hz → PARA aromatic coupling (very weak, often unresolved)`,
      warning: shift && shift >= 6.5 && shift <= 8.5
        ? `💡 Para coupling is typically unresolved (δ ${shift} ppm, J = ${J} Hz)`
        : ''
    };
  }

  // J > 10 Hz - Unusual for aromatics
  if (J > 10) {
    return {
      type: 'non-aromatic',
      confidence: 'low',
      interpretation: `J = ${J} Hz → Too large for typical aromatic coupling`,
      warning: `⚠️ J = ${J} Hz is unusual for aromatic systems (ortho = 7-10 Hz max). Check for: 1) Alkene (³J = 11-18 Hz), 2) Measurement error, 3) Non-aromatic system`
    };
  }

  return {
    type: 'non-aromatic',
    confidence: 'low',
    interpretation: `J = ${J} Hz → Not typical for aromatic coupling`,
    warning: ''
  };
}

/**
 * 🎨 HIGH PRIORITY: Monosubstituted Benzene Detector
 *
 * Detects monosubstituted benzene rings (C₆H₅-R) from peak patterns:
 * - Total aromatic integration: 5H
 * - At 60 MHz: Single broad peak (unresolved)
 * - At 300 MHz: Two groups
 *   * Ortho/Para (3H): One group
 *   * Meta (2H): Another group
 *
 * Electron-donating substituents (OCH₃, NH₂, OH):
 * - Ortho/Para → upfield (δ 6.8-7.2)
 * - Meta → downfield (δ 7.2-7.5)
 *
 * Electron-withdrawing substituents (NO₂, COOH, C=O):
 * - Ortho → downfield (δ 7.5-8.5)
 * - Meta/Para → upfield (δ 7.0-7.5)
 *
 * @param totalIntegration - Total aromatic integration
 * @param peakGroups - Number of resolved peak groups
 * @param shifts - Chemical shifts of peak groups
 *
 * @returns Monosubstituted benzene analysis
 */
export interface MonosubstitutedBenzene {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  substituentType?: 'electron-donating' | 'electron-withdrawing' | 'alkyl' | 'unknown';
  interpretation: string;
  suggestion: string;
}

export function detectMonosubstitutedBenzene(
  totalIntegration: number,
  peakGroups?: number,
  shifts?: number[]
): MonosubstitutedBenzene {
  // Check if total integration is ~5H (monosubstituted)
  const isMonosubstituted = Math.abs(totalIntegration - 5) < 0.5;

  if (!isMonosubstituted) {
    return {
      detected: false,
      confidence: 'low',
      interpretation: `Total aromatic integration = ${totalIntegration}H → Not monosubstituted (expected ~5H)`,
      suggestion: ''
    };
  }

  // If no peak groups specified, just confirm monosubstituted
  if (!peakGroups) {
    return {
      detected: true,
      confidence: 'medium',
      interpretation: `Total aromatic integration = ${totalIntegration}H → MONOSUBSTITUTED benzene (C₆H₅-R)`,
      suggestion: '🌟 At 300 MHz, ortho/para and meta protons should be resolved into two groups (3:2 ratio)'
    };
  }

  // Single broad peak (60 MHz or unresolved)
  if (peakGroups === 1) {
    return {
      detected: true,
      confidence: 'high',
      substituentType: 'unknown',
      interpretation: `5H aromatic (single peak) → MONOSUBSTITUTED benzene (C₆H₅-R)`,
      suggestion: '💡 Single peak suggests low-field NMR (60 MHz) or alkyl substituent. At 300 MHz, expect two groups (ortho/para vs meta).'
    };
  }

  // Two peak groups (300 MHz, resolved)
  if (peakGroups === 2 && shifts && shifts.length === 2) {
    const shift1 = shifts[0];
    const shift2 = shifts[1];
    const upfieldShift = Math.min(shift1, shift2);
    const downfieldShift = Math.max(shift1, shift2);

    // Electron-donating: Ortho/Para upfield (δ 6.8-7.2), Meta downfield (δ 7.2-7.5)
    if (upfieldShift >= 6.8 && upfieldShift <= 7.2 && downfieldShift >= 7.2 && downfieldShift <= 7.5) {
      return {
        detected: true,
        confidence: 'high',
        substituentType: 'electron-donating',
        interpretation: `5H aromatic (2 groups: δ ${upfieldShift}, ${downfieldShift}) → MONOSUBSTITUTED benzene with ELECTRON-DONATING substituent`,
        suggestion: '🎨 Electron-donating group (OCH₃, NH₂, OH) detected! Ortho/para protons are upfield due to resonance electron donation. Expected ratio: 3H (o,p) : 2H (m).'
      };
    }

    // Electron-withdrawing: Ortho downfield (δ 7.5-8.5), Meta/Para upfield (δ 7.0-7.5)
    if (downfieldShift >= 7.5 && downfieldShift <= 8.5) {
      return {
        detected: true,
        confidence: 'high',
        substituentType: 'electron-withdrawing',
        interpretation: `5H aromatic (2 groups: δ ${upfieldShift}, ${downfieldShift}) → MONOSUBSTITUTED benzene with ELECTRON-WITHDRAWING substituent`,
        suggestion: '⚡ Electron-withdrawing group (NO₂, COOH, C=O) detected! Ortho protons are downfield due to magnetic anisotropy. Expected ratio: 2H (o) : 3H (m,p).'
      };
    }

    // Alkyl substituent: Both groups near δ 7.0-7.3
    if (upfieldShift >= 7.0 && upfieldShift <= 7.3 && downfieldShift >= 7.0 && downfieldShift <= 7.3) {
      return {
        detected: true,
        confidence: 'high',
        substituentType: 'alkyl',
        interpretation: `5H aromatic (2 groups: δ ${upfieldShift}, ${downfieldShift}) → MONOSUBSTITUTED benzene with ALKYL substituent`,
        suggestion: '🔧 Alkyl substituent (CH₃, C₂H₅, etc.) detected! Ortho/para and meta protons are slightly resolved. Expected ratio: 3H (o,p) : 2H (m).'
      };
    }

    return {
      detected: true,
      confidence: 'medium',
      substituentType: 'unknown',
      interpretation: `5H aromatic (2 groups: δ ${upfieldShift}, ${downfieldShift}) → MONOSUBSTITUTED benzene`,
      suggestion: '💡 Monosubstituted benzene detected but substituent type unclear from chemical shifts alone.'
    };
  }

  return {
    detected: true,
    confidence: 'medium',
    interpretation: `${totalIntegration}H aromatic → MONOSUBSTITUTED benzene (C₆H₅-R)`,
    suggestion: '🌟 Monosubstituted benzene detected. Check for two peak groups at 300 MHz (ortho/para vs meta).'
  };
}

/**
 * 💎 CRITICAL: Para-Disubstituted Benzene Pattern Detector
 *
 * Detects para-disubstituted benzene rings from characteristic patterns:
 * - Total aromatic integration: 4H
 * - Characteristic: AA'BB' second-order system
 * - Pattern: 4-line pattern (four distorted triplets)
 * - Symmetric substituents: Single singlet (e.g., p-xylene: δ 7.05, 4H)
 *
 * Key Features:
 * - Ha = Ha' and Hb = Hb' (symmetry plane)
 * - Ortho coupling (³J): 7-10 Hz
 * - Para coupling (⁵J): ~0 Hz (not observed)
 * - Second-order effects cause pattern distortion
 *
 * @param totalIntegration - Total aromatic integration
 * @param peakPattern - Pattern description
 * @param couplingConstants - Observed J values
 *
 * @returns Para-disubstituted benzene analysis
 */
export interface ParaDisubstitutedBenzene {
  detected: boolean;
  patternType: 'AA\'BB\' second-order' | 'symmetric singlet' | 'simple doublets' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function detectParaDisubstitutedBenzene(
  totalIntegration: number,
  peakPattern?: 'singlet' | 'doublet' | 'multiplet' | '4-line',
  couplingConstants?: number[]
): ParaDisubstitutedBenzene {
  // Check if total integration is ~4H (para-disubstituted)
  const isParaDisubstituted = Math.abs(totalIntegration - 4) < 0.5;

  if (!isParaDisubstituted) {
    return {
      detected: false,
      patternType: 'unknown',
      confidence: 'low',
      interpretation: `Total aromatic integration = ${totalIntegration}H → Not para-disubstituted (expected ~4H)`,
      suggestion: ''
    };
  }

  // Symmetric substituents: Single singlet (e.g., p-xylene)
  if (peakPattern === 'singlet') {
    return {
      detected: true,
      patternType: 'symmetric singlet',
      confidence: 'high',
      interpretation: `4H aromatic singlet → PARA-DISUBSTITUTED benzene with IDENTICAL substituents`,
      suggestion: '💎 Symmetric para-disubstituted benzene detected (e.g., p-xylene, p-dichlorobenzene). All 4 aromatic protons are equivalent.'
    };
  }

  // AA'BB' second-order system: 4-line pattern
  if (peakPattern === '4-line' || peakPattern === 'multiplet') {
    const hasOrthoCoupling = couplingConstants && couplingConstants.some(J => J >= 7 && J <= 10);

    return {
      detected: true,
      patternType: 'AA\'BB\' second-order',
      confidence: hasOrthoCoupling ? 'high' : 'medium',
      interpretation: `4H aromatic (${peakPattern}) → PARA-DISUBSTITUTED benzene (AA'BB' system)`,
      suggestion: `💎 Para-disubstituted benzene detected! Characteristic AA'BB' second-order pattern (4-line distorted triplets).${hasOrthoCoupling ? ` Ortho coupling (³J = ${couplingConstants?.find(J => J >= 7 && J <= 10)} Hz) confirmed.` : ''} This pattern is diagnostic for para-disubstitution or symmetric ortho-disubstitution.`
    };
  }

  // Simple doublets (first-order approximation)
  if (peakPattern === 'doublet') {
    const hasOrthoCoupling = couplingConstants && couplingConstants.some(J => J >= 7 && J <= 10);

    return {
      detected: true,
      patternType: 'simple doublets',
      confidence: hasOrthoCoupling ? 'high' : 'medium',
      interpretation: `4H aromatic (doublet) → PARA-DISUBSTITUTED benzene (first-order approximation)`,
      suggestion: `💎 Para-disubstituted benzene detected! Simple doublet pattern suggests first-order analysis.${hasOrthoCoupling ? ` Ortho coupling (³J = ${couplingConstants?.find(J => J >= 7 && J <= 10)} Hz) confirmed.` : ''} At higher field strength, expect AA'BB' second-order pattern.`
    };
  }

  // Pattern not specified but 4H aromatic
  return {
    detected: true,
    patternType: 'unknown',
    confidence: 'medium',
    interpretation: `4H aromatic → PARA-DISUBSTITUTED or SYMMETRIC ORTHO-DISUBSTITUTED benzene`,
    suggestion: '💎 Para-disubstituted benzene likely! Check for: 1) 4-line pattern (AA\'BB\' system), 2) Singlet (symmetric substituents), 3) Ortho coupling (³J = 7-10 Hz).'
  };
}

/**
 * 📊 HIGH PRIORITY: Aromatic Substituent Effect Analyzer
 *
 * Analyzes aromatic chemical shifts to predict substituent effects:
 *
 * Electron-donating groups (push electrons via resonance):
 * - NH₂: δ 6.36 (strongest donor)
 * - OH: δ 6.60
 * - OCH₃: δ 6.80
 * - CH₃: δ 7.05
 *
 * Reference:
 * - H (benzene): δ 7.32
 *
 * Electron-withdrawing groups (pull electrons):
 * - COOH: δ 8.20
 * - NO₂: δ 8.48 (strongest acceptor)
 *
 * @param shift - Aromatic chemical shift (ppm)
 * @param integration - Peak integration
 *
 * @returns Substituent effect analysis
 */
export interface AromaticSubstituentEffect {
  effect: 'strong donor' | 'weak donor' | 'neutral' | 'weak acceptor' | 'strong acceptor' | 'non-aromatic';
  possibleGroups: string[];
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function analyzeAromaticSubstituentEffect(
  shift: number,
  integration?: number
): AromaticSubstituentEffect {
  // Not in aromatic region
  if (shift < 6.0 || shift > 9.0) {
    return {
      effect: 'non-aromatic',
      possibleGroups: [],
      confidence: 'low',
      interpretation: `δ ${shift} ppm → Not in aromatic region (6.0-9.0 ppm)`,
      suggestion: ''
    };
  }

  // Strong electron-donating: δ 6.36-6.80 (NH₂, OH, OCH₃)
  if (shift >= 6.36 && shift <= 6.80) {
    return {
      effect: 'strong donor',
      possibleGroups: ['NH₂ (δ 6.36)', 'OH (δ 6.60)', 'OCH₃ (δ 6.80)'],
      confidence: 'high',
      interpretation: `δ ${shift} ppm → STRONG ELECTRON-DONATING substituent`,
      suggestion: '🎨 Strong electron donor detected (NH₂, OH, or OCH₃)! These groups push electrons via resonance, causing upfield shift (shielding) of ortho/para protons. Check for: 1) N-H or O-H peaks, 2) OCH₃ singlet at δ 3.8 ppm (3H).'
    };
  }

  // Weak electron-donating: δ 6.80-7.20 (OCH₃, CH₃)
  if (shift > 6.80 && shift <= 7.20) {
    return {
      effect: 'weak donor',
      possibleGroups: ['OCH₃ (δ 6.80)', 'CH₃ (δ 7.05)', 'Alkyl groups'],
      confidence: 'medium',
      interpretation: `δ ${shift} ppm → WEAK ELECTRON-DONATING substituent`,
      suggestion: '🔧 Weak electron donor detected (OCH₃, CH₃, or alkyl)! Slight upfield shift from benzene (δ 7.32). Check for aliphatic CH₃ peaks at δ 2.0-2.5 ppm.'
    };
  }

  // Neutral: δ 7.20-7.50 (H, halogens)
  if (shift > 7.20 && shift <= 7.50) {
    return {
      effect: 'neutral',
      possibleGroups: ['H (benzene δ 7.32)', 'Cl', 'Br', 'Alkyl'],
      confidence: 'medium',
      interpretation: `δ ${shift} ppm → NEUTRAL substituent (near benzene reference)`,
      suggestion: '⚖️ Chemical shift near benzene (δ 7.32). Substituent has minimal electron-donating/withdrawing effect. Could be H, halogen, or weak alkyl group.'
    };
  }

  // Weak electron-withdrawing: δ 7.50-8.00
  if (shift > 7.50 && shift <= 8.00) {
    return {
      effect: 'weak acceptor',
      possibleGroups: ['C=O (ketone)', 'COOR (ester)', 'CN'],
      confidence: 'medium',
      interpretation: `δ ${shift} ppm → WEAK ELECTRON-WITHDRAWING substituent`,
      suggestion: '⚡ Weak electron acceptor detected! Downfield shift from benzene (δ 7.32). Could be C=O, COOR, or CN. Check for carbonyl peaks in ¹³C NMR or IR (1650-1750 cm⁻¹).'
    };
  }

  // Strong electron-withdrawing: δ 8.00-8.50+ (COOH, NO₂)
  if (shift > 8.00) {
    return {
      effect: 'strong acceptor',
      possibleGroups: ['COOH (δ 8.20)', 'NO₂ (δ 8.48)'],
      confidence: 'high',
      interpretation: `δ ${shift} ppm → STRONG ELECTRON-WITHDRAWING substituent`,
      suggestion: '⚡⚡ Strong electron acceptor detected (COOH or NO₂)! Strong downfield shift (deshielding) of ortho protons due to magnetic anisotropy. Check for: 1) COOH peak at δ 10-13 ppm (br s), 2) NO₂ in molecular formula.'
    };
  }

  return {
    effect: 'non-aromatic',
    possibleGroups: [],
    confidence: 'low',
    interpretation: `δ ${shift} ppm → Unusual aromatic shift`,
    suggestion: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🎯 SILVERSTEIN APPENDIX 3: SPECIFIC COMPOUND CHEMICAL SHIFT PATTERNS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔬 HIGH PRIORITY: Specific Compound Pattern Matcher
 *
 * Matches chemical shifts against known compound patterns from Silverstein Appendix 3.
 * This provides highly specific predictions based on characteristic shift values.
 *
 * Key Examples from Appendix 3:
 * - Ph-OCH₃ (Anisole): δ 3.8 ppm (3H, s)
 * - Ph-CH₂- (Benzyl): δ 2.3 ppm
 * - CH₃-COOR (Ester): δ 2.1 ppm
 * - Ph-H (Benzene): δ 7.3 ppm
 * - Ph-NO₂: δ 8.2 ppm
 * - R-CHO (Aliphatic aldehyde): δ 9.6 ppm
 * - Ph-CHO (Aromatic aldehyde): δ 9.8-10.0 ppm
 * - Enol (C=C-OH): δ 14.92 ppm (extremely downfield!)
 *
 * @param shift - Chemical shift (ppm)
 * @param integration - Peak integration
 * @param multiplicity - Peak multiplicity
 *
 * @returns Specific compound pattern match
 */
export interface SpecificCompoundPattern {
  matches: Array<{
    compound: string;
    confidence: number;
    explanation: string;
  }>;
  bestMatch?: {
    compound: string;
    confidence: number;
    explanation: string;
  };
}

export function matchSpecificCompoundPattern(
  shift: number,
  integration?: number,
  multiplicity?: string
): SpecificCompoundPattern {
  const matches: Array<{ compound: string; confidence: number; explanation: string }> = [];

  // δ 0.9 ppm - CH₃-C-C
  if (shift >= 0.85 && shift <= 0.95) {
    matches.push({
      compound: 'CH₃-C-C (Aliphatic methyl)',
      confidence: 90,
      explanation: 'δ 0.9 ppm is characteristic of simple aliphatic CH₃ groups (Appendix 3)'
    });
  }

  // δ 1.5 ppm - CH₃-C-Cl
  if (shift >= 1.45 && shift <= 1.55 && integration === 3) {
    matches.push({
      compound: 'CH₃-C-Cl (Chloromethyl)',
      confidence: 80,
      explanation: 'δ 1.5 ppm (3H) suggests CH₃ adjacent to C-Cl (Appendix 3)'
    });
  }

  // δ 2.0 ppm - CH₃-CN (Acetonitrile type)
  if (shift >= 1.95 && shift <= 2.05 && integration === 3) {
    matches.push({
      compound: 'CH₃-CN (Nitrile methyl)',
      confidence: 85,
      explanation: 'δ 2.0 ppm (3H) is diagnostic for CH₃-CN (Appendix 3)'
    });
  }

  // δ 2.1 ppm - CH₃-COOR or CH₃-C=O-R (VERY COMMON!)
  if (shift >= 2.05 && shift <= 2.15 && integration === 3 && multiplicity?.toLowerCase() === 's') {
    matches.push({
      compound: 'CH₃-COOR (Ester methyl) OR CH₃-C=O-R (Acetyl)',
      confidence: 95,
      explanation: 'δ 2.1 ppm (3H, s) is HIGHLY characteristic of acetyl or ester CH₃ (Appendix 3)'
    });
  }

  // δ 2.2 ppm - CH₃-I (Iodomethane type)
  if (shift >= 2.15 && shift <= 2.25 && integration === 3) {
    matches.push({
      compound: 'CH₃-I (Iodomethyl)',
      confidence: 80,
      explanation: 'δ 2.2 ppm (3H) suggests CH₃-I (Appendix 3)'
    });
  }

  // δ 2.3 ppm - Ph-CH₂- (Benzyl)
  if (shift >= 2.25 && shift <= 2.35 && integration === 2) {
    matches.push({
      compound: 'Ph-CH₂- (Benzyl methylene)',
      confidence: 85,
      explanation: 'δ 2.3 ppm (2H) is characteristic of benzyl CH₂ (Ph-CH₂-R) (Appendix 3)'
    });
  }

  // δ 2.7 ppm - CH₃-Br
  if (shift >= 2.65 && shift <= 2.75 && integration === 3) {
    matches.push({
      compound: 'CH₃-Br (Bromomethyl)',
      confidence: 85,
      explanation: 'δ 2.7 ppm (3H) is diagnostic for CH₃-Br (Appendix 3)'
    });
  }

  // δ 3.1 ppm - CH₃-Cl
  if (shift >= 3.05 && shift <= 3.15 && integration === 3) {
    matches.push({
      compound: 'CH₃-Cl (Chloromethyl)',
      confidence: 85,
      explanation: 'δ 3.1 ppm (3H) is diagnostic for CH₃-Cl (Appendix 3)'
    });
  }

  // δ 3.2 ppm - CH₂-I
  if (shift >= 3.15 && shift <= 3.25 && integration === 2) {
    matches.push({
      compound: 'CH₂-I (Iodomethylene)',
      confidence: 80,
      explanation: 'δ 3.2 ppm (2H) suggests R-CH₂-I (Appendix 3)'
    });
  }

  // δ 3.3 ppm - RO-CH₃ or CH₃-OH
  if (shift >= 3.25 && shift <= 3.35 && integration === 3 && multiplicity?.toLowerCase() === 's') {
    matches.push({
      compound: 'RO-CH₃ (Methoxy) OR CH₃-OH (Methanol)',
      confidence: 90,
      explanation: 'δ 3.3 ppm (3H, s) is characteristic of aliphatic methoxy or methanol (Appendix 3)'
    });
  }

  // δ 3.4 ppm - CH₂-OH or CH₂-Br
  if (shift >= 3.35 && shift <= 3.45 && integration === 2) {
    matches.push({
      compound: 'CH₂-OH (Hydroxymethylene) OR CH₂-Br',
      confidence: 80,
      explanation: 'δ 3.4 ppm (2H) suggests R-CH₂-OH or R-CH₂-Br (Appendix 3)'
    });
  }

  // δ 3.5 ppm - CH₂-Cl
  if (shift >= 3.45 && shift <= 3.55 && integration === 2) {
    matches.push({
      compound: 'CH₂-Cl (Chloromethylene)',
      confidence: 85,
      explanation: 'δ 3.5 ppm (2H) is diagnostic for R-CH₂-Cl (Appendix 3)'
    });
  }

  // δ 3.8 ppm - Ph-O-CH₃ (ANISOLE - VERY DIAGNOSTIC!)
  if (shift >= 3.75 && shift <= 3.85 && integration === 3 && multiplicity?.toLowerCase() === 's') {
    matches.push({
      compound: 'Ph-O-CH₃ (Aromatic methoxy / Anisole)',
      confidence: 98,
      explanation: '⭐⭐ δ 3.8 ppm (3H, s) is HIGHLY DIAGNOSTIC for aromatic methoxy (Ph-OCH₃) (Appendix 3). This is one of the most reliable NMR signatures!'
    });
  }

  // δ 5.0-5.8 ppm - HC=CH (Alkene)
  if (shift >= 5.0 && shift <= 5.8) {
    matches.push({
      compound: 'HC=CH (Vinylic proton)',
      confidence: 85,
      explanation: 'δ 5.0-5.8 ppm is characteristic of vinylic protons (C=C-H) (Appendix 3)'
    });
  }

  // δ 6.8-7.0 ppm - Ph-OR (Phenol ether)
  if (shift >= 6.8 && shift <= 7.0) {
    matches.push({
      compound: 'Ph-OR (Phenolic ether)',
      confidence: 80,
      explanation: 'δ 6.8-7.0 ppm suggests aromatic protons ortho/para to -OR (electron-donating) (Appendix 3)'
    });
  }

  // δ 7.2 ppm - Ph-R (Alkylbenzene)
  if (shift >= 7.15 && shift <= 7.25) {
    matches.push({
      compound: 'Ph-R (Alkylbenzene)',
      confidence: 75,
      explanation: 'δ 7.2 ppm is characteristic of aromatic protons in alkylbenzenes (Appendix 3)'
    });
  }

  // δ 7.3 ppm - Ph-H (Benzene reference)
  if (shift >= 7.28 && shift <= 7.34) {
    matches.push({
      compound: 'Ph-H (Benzene)',
      confidence: 90,
      explanation: 'δ 7.3 ppm is the reference shift for benzene (C₆H₆) (Appendix 3)'
    });
  }

  // δ 7.9-8.0 ppm - Ph-COOH (Benzoic acid)
  if (shift >= 7.9 && shift <= 8.0) {
    matches.push({
      compound: 'Ph-COOH (Benzoic acid aromatic)',
      confidence: 85,
      explanation: 'δ 7.9-8.0 ppm suggests aromatic protons ortho to -COOH (Appendix 3)'
    });
  }

  // δ 8.2 ppm - Ph-NO₂ (Nitrobenzene)
  if (shift >= 8.15 && shift <= 8.25) {
    matches.push({
      compound: 'Ph-NO₂ (Nitrobenzene)',
      confidence: 90,
      explanation: 'δ 8.2 ppm is characteristic of aromatic protons ortho to -NO₂ (strongest deshielding) (Appendix 3)'
    });
  }

  // δ 9.6 ppm - R-CHO (Aliphatic aldehyde)
  if (shift >= 9.5 && shift <= 9.7 && integration === 1) {
    matches.push({
      compound: 'R-CHO (Aliphatic aldehyde)',
      confidence: 95,
      explanation: '⭐ δ 9.6 ppm (1H) is diagnostic for aliphatic aldehyde (R-CHO) (Appendix 3)'
    });
  }

  // δ 9.8-10.0 ppm - Ph-CHO (Aromatic aldehyde / Benzaldehyde)
  if (shift >= 9.8 && shift <= 10.0 && integration === 1) {
    matches.push({
      compound: 'Ph-CHO (Aromatic aldehyde / Benzaldehyde)',
      confidence: 98,
      explanation: '⭐⭐ δ 9.8-10.0 ppm (1H) is HIGHLY DIAGNOSTIC for aromatic aldehyde (Ph-CHO) (Appendix 3)'
    });
  }

  // δ 11-12 ppm - R-COOH (Carboxylic acid)
  if (shift >= 11.0 && shift <= 12.0 && integration === 1) {
    matches.push({
      compound: 'R-COOH (Carboxylic acid)',
      confidence: 98,
      explanation: '⭐⭐ δ 11-12 ppm (1H, broad) is HIGHLY DIAGNOSTIC for carboxylic acid (R-COOH) (Appendix 3). Exchangeable with D₂O!'
    });
  }

  // δ 14.92 ppm - Enol (C=C-OH) - EXTREMELY RARE!
  if (shift >= 14.5 && shift <= 15.5) {
    matches.push({
      compound: 'Enol (C=C-OH)',
      confidence: 95,
      explanation: '⭐⭐⭐ δ ~14.92 ppm is EXTREMELY DIAGNOSTIC for enolic proton (C=C-OH) (Appendix 3). This is the most downfield ¹H signal possible! Indicates keto-enol tautomerism.'
    });
  }

  // Find best match (highest confidence)
  const bestMatch = matches.length > 0
    ? matches.reduce((best, current) => current.confidence > best.confidence ? current : best)
    : undefined;

  return { matches, bestMatch };
}

/**
 * 🧪 MEDIUM PRIORITY: Enhanced Chemical Shift Range Validator
 *
 * Validates that chemical shifts are within physically reasonable ranges,
 * with detailed warnings for edge cases.
 *
 * ¹H NMR typical range: -2 to +18 ppm (most compounds: 0-15 ppm)
 * ¹³C NMR typical range: -10 to +250 ppm (most compounds: 0-220 ppm)
 *
 * @param shift - Chemical shift (ppm)
 * @param spectrumType - Type of NMR spectrum
 *
 * @returns Validation result with warnings
 */
export interface EnhancedShiftValidation {
  isValid: boolean;
  severity: 'error' | 'warning' | 'info' | 'ok';
  message: string;
  suggestion?: string;
}

export function validateChemicalShiftRange(
  shift: number,
  spectrumType: '1H' | '13C' = '1H'
): EnhancedShiftValidation {
  if (spectrumType === '1H') {
    // Physical impossibility
    if (shift < -2 || shift > 18) {
      return {
        isValid: false,
        severity: 'error',
        message: `δ ${shift.toFixed(2)} ppm is outside physical range for ¹H NMR (-2 to +18 ppm)`,
        suggestion: 'Check for measurement error, incorrect reference, or data entry mistake.'
      };
    }

    // Very unusual (>15 ppm) but possible
    if (shift > 15 && shift <= 18) {
      return {
        isValid: true,
        severity: 'warning',
        message: `δ ${shift.toFixed(2)} ppm is EXTREMELY downfield (>15 ppm)`,
        suggestion: 'This is very rare! Check for: 1) Enolic OH (δ ~14.92), 2) Strongly hydrogen-bonded protons, 3) Measurement error.'
      };
    }

    // Unusual (12-15 ppm) but less rare
    if (shift > 12 && shift <= 15) {
      return {
        isValid: true,
        severity: 'info',
        message: `δ ${shift.toFixed(2)} ppm is very downfield (12-15 ppm)`,
        suggestion: 'Unusual range. Possible: 1) Carboxylic acid COOH (δ 11-12), 2) Enolic protons, 3) Chelated protons.'
      };
    }

    // Negative shifts (rare but valid)
    if (shift < 0 && shift >= -2) {
      return {
        isValid: true,
        severity: 'warning',
        message: `δ ${shift.toFixed(2)} ppm is NEGATIVE (upfield from TMS)`,
        suggestion: 'Rare but valid! Possible for protons in shielded environments (e.g., inside fullerenes, cyclophanes).'
      };
    }

    // Normal range
    return {
      isValid: true,
      severity: 'ok',
      message: `δ ${shift.toFixed(2)} ppm is within normal ¹H NMR range`,
      suggestion: ''
    };
  }

  // ¹³C NMR validation
  if (spectrumType === '13C') {
    if (shift < -10 || shift > 250) {
      return {
        isValid: false,
        severity: 'error',
        message: `δ ${shift.toFixed(1)} ppm is outside physical range for ¹³C NMR (-10 to +250 ppm)`,
        suggestion: 'Check for measurement error or incorrect reference.'
      };
    }

    if (shift > 220 && shift <= 250) {
      return {
        isValid: true,
        severity: 'warning',
        message: `δ ${shift.toFixed(1)} ppm is very downfield for ¹³C NMR (>220 ppm)`,
        suggestion: 'Unusual range. Possible for highly deshielded carbonyl carbons or heteroatom-substituted carbons.'
      };
    }

    if (shift < 0 && shift >= -10) {
      return {
        isValid: true,
        severity: 'warning',
        message: `δ ${shift.toFixed(1)} ppm is NEGATIVE for ¹³C NMR`,
        suggestion: 'Rare but valid! Possible for highly shielded carbons (e.g., metal-coordinated).'
      };
    }

    return {
      isValid: true,
      severity: 'ok',
      message: `δ ${shift.toFixed(1)} ppm is within normal ¹³C NMR range`,
      suggestion: ''
    };
  }

  return {
    isValid: false,
    severity: 'error',
    message: 'Unknown spectrum type',
    suggestion: ''
  };
}
