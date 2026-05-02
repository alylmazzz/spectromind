/**
 * Carbon-13 Chemical Shift Calculator
 * Based on Pavia "Introduction to Spectroscopy" and empirical additive rules
 *
 * Calculation of 13C Chemical Shifts using additive increments
 */

export interface ShiftIncrement {
  substituent: string;
  alpha: number;  // α-position increment
  beta: number;   // β-position increment
  gamma: number; // γ-position increment
}

// Base values for different carbon types (Pavia Section 6.2)
export const BASE_SHIFTS = {
  CH3: 5.7,
  CH2: 15.4,
  CH: 24.9,
  Cq: 27.7, // Quaternary carbon
  Aromatic: 128.5, // Benzene
  Alkenic: 123.3, // Ethene
  Carbonyl: {
    Aldehyde: 193.0,
    Ketone: 205.0,
    CarboxylicAcid: 177.0,
    Ester: 174.0,
    Amide: 170.0
  }
};

// Substituent increments (Pavia Appendix 8)
export const SUBSTITUENT_INCREMENTS: Record<string, ShiftIncrement> = {
  // Alkyl groups
  'CH3': { substituent: 'CH3', alpha: 9.1, beta: 9.4, gamma: -2.5 },
  'CH2': { substituent: 'CH2', alpha: 9.1, beta: 9.4, gamma: -2.5 },
  'CH': { substituent: 'CH', alpha: 9.1, beta: 9.4, gamma: -2.5 },
  'Cq': { substituent: 'Cq', alpha: 9.1, beta: 9.4, gamma: -2.5 },

  // Halogens
  'F': { substituent: 'F', alpha: 70.1, beta: 7.8, gamma: -6.8 },
  'Cl': { substituent: 'Cl', alpha: 31.0, beta: 10.0, gamma: -5.1 },
  'Br': { substituent: 'Br', alpha: 18.9, beta: 11.0, gamma: -3.8 },
  'I': { substituent: 'I', alpha: -7.2, beta: 11.0, gamma: -1.0 },

  // Oxygen-containing groups
  'OH': { substituent: 'OH', alpha: 48.9, beta: 10.0, gamma: -6.2 },
  'OCH3': { substituent: 'OCH3', alpha: 51.2, beta: 8.0, gamma: -5.1 },
  'OC2H5': { substituent: 'OC2H5', alpha: 51.2, beta: 8.0, gamma: -5.1 },
  'OCOCH3': { substituent: 'OCOCH3', alpha: 50.0, beta: 6.0, gamma: -3.0 },

  // Carbonyl groups
  'CHO': { substituent: 'CHO', alpha: 29.9, beta: -1.0, gamma: -2.0 },
  'COCH3': { substituent: 'COCH3', alpha: 22.5, beta: 3.0, gamma: -3.0 },
  'COOH': { substituent: 'COOH', alpha: 20.1, beta: 2.0, gamma: -2.5 },
  'COOCH3': { substituent: 'COOCH3', alpha: 20.1, beta: 2.0, gamma: -2.5 },

  // Nitrogen-containing groups
  'NH2': { substituent: 'NH2', alpha: 28.3, beta: 11.3, gamma: -5.4 },
  'N(CH3)2': { substituent: 'N(CH3)2', alpha: 22.4, beta: 10.0, gamma: -5.0 },
  'CN': { substituent: 'CN', alpha: 3.1, beta: 2.6, gamma: -3.3 },

  // Aromatic
  'C6H5': { substituent: 'C6H5', alpha: 22.1, beta: 9.3, gamma: -2.6 },

  // Double bonds
  'C=C': { substituent: 'C=C', alpha: 19.5, beta: 6.2, gamma: -1.5 },
  'C≡C': { substituent: 'C≡C', alpha: 4.4, beta: 5.6, gamma: -3.4 }
};

/**
 * Calculate 13C chemical shift using additive rules
 * @param baseType Base carbon type (CH3, CH2, CH, Cq)
 * @param substituents Array of substituents with their positions (alpha, beta, gamma)
 * @returns Calculated chemical shift in ppm
 */
export function calculateCarbon13Shift(
  baseType: 'CH3' | 'CH2' | 'CH' | 'Cq',
  substituents: Array<{ name: string; position: 'alpha' | 'beta' | 'gamma' }>
): number {
  let shift = BASE_SHIFTS[baseType];

  for (const sub of substituents) {
    const increment = SUBSTITUENT_INCREMENTS[sub.name];
    if (increment) {
      if (sub.position === 'alpha') {
        shift += increment.alpha;
      } else if (sub.position === 'beta') {
        shift += increment.beta;
      } else if (sub.position === 'gamma') {
        shift += increment.gamma;
      }
    }
  }

  return Math.round(shift * 10) / 10; // Round to 1 decimal place
}

/**
 * Estimate chemical shift from carbon type and environment
 * Simplified version for quick estimation
 */
export function estimateShiftFromType(
  carbonType: 'CH3' | 'CH2' | 'CH' | 'Cq',
  hybridization: 'sp3' | 'sp2' | 'sp',
  functionalGroup?: string
): number {
  if (hybridization === 'sp2') {
    // Aromatic or alkenic
    if (functionalGroup === 'aromatic') {
      return 110 + Math.random() * 50; // 110-160 ppm
    } else if (functionalGroup === 'carbonyl') {
      return 160 + Math.random() * 60; // 160-220 ppm
    } else {
      return 100 + Math.random() * 50; // 100-150 ppm (alkene)
    }
  } else if (hybridization === 'sp') {
    // Alkyne
    return 70 + Math.random() * 20; // 70-90 ppm
  } else {
    // sp3 - aliphatic
    if (functionalGroup === 'C-O' || functionalGroup === 'C-N') {
      return 50 + Math.random() * 40; // 50-90 ppm
    } else {
      // Regular aliphatic
      if (carbonType === 'CH3') {
        return 10 + Math.random() * 20; // 10-30 ppm
      } else if (carbonType === 'CH2') {
        return 20 + Math.random() * 20; // 20-40 ppm
      } else if (carbonType === 'CH') {
        return 25 + Math.random() * 20; // 25-45 ppm
      } else {
        return 30 + Math.random() * 20; // 30-50 ppm (Cq)
      }
    }
  }
}

/**
 * Validate chemical shift range based on carbon type
 * Returns true if shift is in expected range
 */
export function validateShiftRange(
  shift: number,
  carbonType: 'CH3' | 'CH2' | 'CH' | 'Cq',
  hybridization: 'sp3' | 'sp2' | 'sp'
): { valid: boolean; expectedRange: string; warning?: string } {
  if (hybridization === 'sp2') {
    if (shift >= 100 && shift <= 160) {
      return { valid: true, expectedRange: '100-160 ppm (sp2: alkenic/aromatic)' };
    } else if (shift >= 160 && shift <= 220) {
      return { valid: true, expectedRange: '160-220 ppm (sp2: carbonyl)' };
    } else {
      return {
        valid: false,
        expectedRange: '100-220 ppm (sp2)',
        warning: `Shift ${shift} ppm is outside expected sp2 range`
      };
    }
  } else if (hybridization === 'sp') {
    if (shift >= 70 && shift <= 90) {
      return { valid: true, expectedRange: '70-90 ppm (sp: alkyne)' };
    } else {
      return {
        valid: false,
        expectedRange: '70-90 ppm (sp)',
        warning: `Shift ${shift} ppm is outside expected alkyne range`
      };
    }
  } else {
    // sp3
    if (shift >= 0 && shift <= 50) {
      return { valid: true, expectedRange: '0-50 ppm (sp3: aliphatic)' };
    } else if (shift >= 50 && shift <= 100) {
      return {
        valid: true,
        expectedRange: '50-100 ppm (sp3: heteroatom-substituted)',
        warning: 'Shift suggests heteroatom substitution (O, N, halogen)'
      };
    } else {
      return {
        valid: false,
        expectedRange: '0-100 ppm (sp3)',
        warning: `Shift ${shift} ppm is outside expected sp3 range`
      };
    }
  }
}
