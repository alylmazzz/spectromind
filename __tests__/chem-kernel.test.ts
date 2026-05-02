/**
 * Chemistry Kernel Tests
 *
 * Tests the single source of truth for:
 * - Formula parsing
 * - DBE calculation
 * - Atom counting
 * - Hill formula generation
 * - Validation
 */

import { describe, it, expect } from 'vitest';
import {
  parseFormula,
  computeDBE,
  computeDBEDetailed,
  formatHillFormula,
  normalizeFormula,
  validateFormula,
  formulaEquals,
  computeAtomCountsFromRDKitAtoms,
  normalizeToHill,
} from '../lib/chem/formula';

describe('parseFormula', () => {
  it('parses standard Hill formula', () => {
    const result = parseFormula('C6H12O6');
    expect(result.atomCounts).toEqual({ C: 6, H: 12, O: 6 });
    expect(result.hillFormula).toBe('C6H12O6');
  });

  it('parses formula with single-count elements', () => {
    const result = parseFormula('CH4');
    expect(result.atomCounts).toEqual({ C: 1, H: 4 });
    expect(result.hillFormula).toBe('CH4');
  });

  it('handles two-letter elements (Cl, Br)', () => {
    const result = parseFormula('C2H3Cl');
    expect(result.atomCounts).toEqual({ C: 2, H: 3, Cl: 1 });
    expect(result.hillFormula).toBe('C2H3Cl');
  });

  it('handles Br correctly', () => {
    const result = parseFormula('CH3Br');
    expect(result.atomCounts).toEqual({ C: 1, H: 3, Br: 1 });
  });

  it('handles phosphorus', () => {
    const result = parseFormula('C3H9PO4');
    expect(result.atomCounts).toEqual({ C: 3, H: 9, O: 4, P: 1 });
  });

  it('handles unicode subscripts', () => {
    const result = parseFormula('C₆H₁₂O₆');
    expect(result.atomCounts).toEqual({ C: 6, H: 12, O: 6 });
  });

  it('handles empty formula', () => {
    const result = parseFormula('');
    expect(result.atomCounts).toEqual({});
    expect(result.hillFormula).toBe('');
  });

  it('strips charge notation', () => {
    const result = parseFormula('C6H5O-');
    expect(result.atomCounts).toEqual({ C: 6, H: 5, O: 1 });
  });
});

describe('formatHillFormula', () => {
  it('puts C first, H second, then alphabetical', () => {
    expect(formatHillFormula({ C: 2, H: 6, O: 1, N: 1 })).toBe('C2H6NO');
  });

  it('handles single-count elements without number', () => {
    expect(formatHillFormula({ C: 1, H: 4 })).toBe('CH4');
  });

  it('handles no-carbon formulas', () => {
    expect(formatHillFormula({ H: 2, O: 1 })).toBe('H2O');
  });
});

describe('computeDBE', () => {
  it('computes benzene DBE = 4', () => {
    const dbe = computeDBE({ C: 6, H: 6 });
    expect(dbe).toBe(4);
  });

  it('computes methane DBE = 0', () => {
    const dbe = computeDBE({ C: 1, H: 4 });
    expect(dbe).toBe(0);
  });

  it('computes ethanol DBE = 0', () => {
    const dbe = computeDBE({ C: 2, H: 6, O: 1 });
    expect(dbe).toBe(0);
  });

  it('computes acetonitrile DBE = 2', () => {
    const dbe = computeDBE({ C: 2, H: 3, N: 1 });
    expect(dbe).toBe(2);
  });

  it('handles halogens correctly', () => {
    const dbe = computeDBE({ C: 1, H: 3, Cl: 1 });
    expect(dbe).toBe(0);
  });

  it('handles fluorine correctly', () => {
    const dbe = computeDBE({ C: 1, H: 2, F: 2 });
    expect(dbe).toBe(0);
  });

  it('uses float division — half-integer DBE preserved', () => {
    const dbe = computeDBE({ C: 1, H: 3, N: 1 });
    expect(dbe).toBe(1);
  });

  it('includes P in DBE (trivalent like N)', () => {
    const dbeWithP = computeDBE({ C: 3, H: 9, P: 1, O: 4 });
    const dbeWithN = computeDBE({ C: 3, H: 9, N: 1, O: 4 });
    expect(dbeWithP).toBe(dbeWithN);
  });

  it('handles charge', () => {
    // C6H5+ : DBE = 6 - 5/2 + 1/2 + 1 = 5
    const dbe = computeDBE({ C: 6, H: 5 }, 1);
    expect(dbe).toBe(5);
  });

  it('naphthalene DBE = 7', () => {
    const dbe = computeDBE({ C: 10, H: 8 });
    expect(dbe).toBe(7);
  });

  it('paclitaxel DBE = 16', () => {
    const dbe = computeDBE({ C: 47, H: 51, N: 1, O: 14 });
    expect(dbe).toBe(23);
  });
});

describe('computeDBEDetailed', () => {
  it('returns validity info', () => {
    const result = computeDBEDetailed({ C: 6, H: 6 });
    expect(result.isValid).toBe(true);
    expect(result.parityNote).toBe('');
  });

  it('detects negative DBE', () => {
    const result = computeDBEDetailed({ C: 1, H: 100 });
    expect(result.dbe).toBeLessThan(0);
    expect(result.isValid).toBe(false);
    expect(result.parityNote).toContain('negative');
  });

  it('includes P term', () => {
    const result = computeDBEDetailed({ C: 3, H: 9, P: 1, O: 4 });
    expect(result.terms.P).toBe(1);
  });
});

describe('normalizeFormula', () => {
  it('preserves Cl and Br casing', () => {
    const result = normalizeFormula('C2H3ClBr');
    expect(result).toContain('Cl');
    expect(result).toContain('Br');
    expect(result).not.toContain('CL');
    expect(result).not.toContain('BR');
  });

  it('normalizes unicode subscripts', () => {
    const result = normalizeFormula('C₆H₁₂O₆');
    expect(result).toBe('C6H12O6');
  });

  it('handles empty string', () => {
    expect(normalizeFormula('')).toBe('');
  });
});

describe('validateFormula', () => {
  it('validates identical formulas', () => {
    expect(validateFormula('C6H12O6', 'C6H12O6')).toBe(true);
  });

  it('validates with different formatting', () => {
    expect(validateFormula('C₆H₁₂O₆', 'C6H12O6')).toBe(true);
  });

  it('detects mismatched formulas', () => {
    expect(validateFormula('C6H12O6', 'C6H12O5')).toBe(false);
  });
});

describe('formulaEquals', () => {
  it('handles order differences', () => {
    expect(formulaEquals('H2O', 'OH2')).toBe(true);
  });
});

describe('computeAtomCountsFromRDKitAtoms', () => {
  it('includes implicit hydrogens in H count', () => {
    const atoms = [
      { symbol: 'C', implicitHydrogens: 4 },
    ];
    const counts = computeAtomCountsFromRDKitAtoms(atoms);
    expect(counts['C']).toBe(1);
    expect(counts['H']).toBe(4);
  });

  it('handles multiple atoms with implicit H', () => {
    const atoms = [
      { symbol: 'C', implicitHydrogens: 3 },
      { symbol: 'C', implicitHydrogens: 3 },
    ];
    const counts = computeAtomCountsFromRDKitAtoms(atoms);
    expect(counts['C']).toBe(2);
    expect(counts['H']).toBe(6);
  });

  it('handles atoms without implicit H', () => {
    const atoms = [
      { symbol: 'C', implicitHydrogens: 0 },
      { symbol: 'O', implicitHydrogens: 1 },
    ];
    const counts = computeAtomCountsFromRDKitAtoms(atoms);
    expect(counts['C']).toBe(1);
    expect(counts['O']).toBe(1);
    expect(counts['H']).toBe(1);
  });
});
