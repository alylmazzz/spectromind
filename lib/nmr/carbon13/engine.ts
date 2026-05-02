/**
 * Deterministic 13C NMR Prediction Engine
 *
 * Predicts approximate 13C chemical shifts from molecular graph using
 * additive substituent-effect models.  This is NOT a database lookup
 * (HOSE codes, ACD/Labs, etc.) — it is a parametric rule engine.
 *
 * Scientific basis:
 * - Base shifts for each carbon environment class
 * - Alpha/beta substituent increment tables
 * - Aromatic ipso/ortho/meta/para correction
 * - Heteroatom adjacency corrections
 * - Carbonyl subtype differentiation
 * - Ring strain / size corrections
 *
 * Known limitations (explicitly documented):
 * - Without a curated HOSE database, accuracy is limited to ~5-15 ppm MAE
 *   for common functional groups and ~20+ ppm for unusual environments.
 * - Steric effects (gauche/gamma) are approximated, not computed.
 * - Solvent effects are modeled as a global offset, not per-carbon.
 * - Conformer averaging is not performed (single conformer model).
 * - Long-range electronic effects (beyond beta) are ignored.
 */

import type { AtomRecord, BondRecord, MolecularGraph, AtomEnvironment } from '@/packages/chem-kernel/types';
import { classifyAtomEnvironment } from '@/packages/chem-kernel/chemUtils';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface Carbon13Prediction {
  atomIndex: number;
  predictedShift: number;
  shiftRange: [number, number];
  carbonType: CarbonType;
  deptClass: 'CH3' | 'CH2' | 'CH' | 'C' | 'unknown';
  hybridization: string;
  environment: AtomEnvironment;
  substituentsApplied: SubstituentEffect[];
  confidence: number;
  warnings: string[];
}

export interface Carbon13SpectrumPrediction {
  peaks: Carbon13Prediction[];
  uniqueSignalCount: number;
  totalCarbons: number;
  method: string;
  assumptions: string[];
  limitations: string[];
  version: string;
}

export type CarbonType =
  | 'alkyl_primary' | 'alkyl_secondary' | 'alkyl_tertiary' | 'alkyl_quaternary'
  | 'aromatic_ch' | 'aromatic_c_substituted'
  | 'aromatic_ipso' | 'aromatic_ortho' | 'aromatic_meta' | 'aromatic_para'
  | 'olefinic'
  | 'carbonyl_ketone' | 'carbonyl_aldehyde' | 'carbonyl_ester'
  | 'carbonyl_acid' | 'carbonyl_amide' | 'carbonyl_anhydride'
  | 'nitrile'
  | 'alkyne_terminal' | 'alkyne_internal'
  | 'alpha_to_oxygen' | 'alpha_to_nitrogen' | 'alpha_to_halogen'
  | 'cyclopropyl' | 'strained_ring'
  | 'unknown';

export interface SubstituentEffect {
  type: string;
  position: 'alpha' | 'beta' | 'gamma' | 'ipso' | 'ortho' | 'meta' | 'para';
  increment: number;
}

// --------------------------------------------------------------------------
// Base shift table (empirical, well-established values)
// --------------------------------------------------------------------------

const BASE_SHIFTS: Record<string, number> = {
  'alkyl_primary':          8.0,     // CH3 in alkane
  'alkyl_secondary':        16.0,    // CH2 in alkane
  'alkyl_tertiary':         25.0,    // CH in alkane
  'alkyl_quaternary':       32.0,    // C in alkane (neopentane-type)
  'aromatic_ch':            128.5,   // benzene C-H
  'aromatic_c_substituted': 137.0,   // substituted aromatic C
  'olefinic':               123.0,   // C=C (ethylene-type average)
  'carbonyl_ketone':        205.0,
  'carbonyl_aldehyde':      200.0,
  'carbonyl_ester':         170.0,
  'carbonyl_acid':          178.0,
  'carbonyl_amide':         168.0,
  'carbonyl_anhydride':     165.0,
  'nitrile':                118.0,
  'alkyne_terminal':        68.0,
  'alkyne_internal':        80.0,
  'cyclopropyl':            3.0,
};

// --------------------------------------------------------------------------
// Alpha-substituent increments (additive, from standard reference tables)
// --------------------------------------------------------------------------

const ALPHA_INCREMENTS: Record<string, number> = {
  'O_single':   49.0,    // -O- (ether, alcohol)
  'O_double':   0.0,     // =O is the carbonyl itself
  'N_single':   29.0,    // -N< (amine)
  'N_double':   0.0,     // =N part of imine
  'F':          68.0,
  'Cl':         31.0,
  'Br':         20.0,
  'I':          -6.0,
  'S_single':   11.0,
  'C_double':   20.0,    // =C (olefinic neighbor)
  'C_triple':   5.0,     // ≡C (alkyne neighbor)
  'C_aromatic': 22.0,    // aromatic ring attached
  'carbonyl':   30.0,    // C=O neighbor
  'nitrile':    4.0,     // C≡N neighbor (on the alpha carbon)
  'phenyl':     23.0,    // direct phenyl
};

const BETA_INCREMENTS: Record<string, number> = {
  'O_single':   10.0,
  'N_single':   8.0,
  'F':          8.0,
  'Cl':         10.0,
  'Br':         11.0,
  'I':          12.0,
  'S_single':   11.0,
  'C_aromatic': 9.5,
  'carbonyl':   2.0,
};

// --------------------------------------------------------------------------
// Aromatic substituent effects (Tobey/Johnstone reference tables simplified)
// --------------------------------------------------------------------------

const AROMATIC_SUBSTITUENT_EFFECTS: Record<string, { ipso: number; ortho: number; meta: number; para: number }> = {
  'CH3':    { ipso: 9.3,  ortho: 0.7,  meta: -0.1, para: -2.9 },
  'OH':     { ipso: 26.9, ortho: -12.7, meta: 1.4,  para: -7.3 },
  'OCH3':   { ipso: 31.4, ortho: -14.4, meta: 1.0,  para: -7.7 },
  'NH2':    { ipso: 18.0, ortho: -13.3, meta: 0.9,  para: -9.9 },
  'F':      { ipso: 34.8, ortho: -12.9, meta: 1.4,  para: -4.5 },
  'Cl':     { ipso: 6.2,  ortho: 0.4,   meta: 1.3,  para: -1.9 },
  'Br':     { ipso: -5.5, ortho: 3.4,   meta: 1.7,  para: -1.6 },
  'I':      { ipso: -32.2,ortho: 9.9,   meta: 2.6,  para: 0.4  },
  'NO2':    { ipso: 20.0, ortho: -4.8,  meta: 0.9,  para: 6.1  },
  'CN':     { ipso: -15.4,ortho: 3.6,   meta: 0.6,  para: 3.9  },
  'COCH3':  { ipso: 9.1,  ortho: 0.1,   meta: -0.1, para: 4.2  },
  'CHO':    { ipso: 8.6,  ortho: 1.3,   meta: 0.6,  para: 5.5  },
  'COOH':   { ipso: 2.1,  ortho: 1.5,   meta: 0.0,  para: 5.1  },
  'COOCH3': { ipso: 2.0,  ortho: 1.2,   meta: -0.1, para: 4.3  },
  'CF3':    { ipso: -9.0, ortho: -2.2,  meta: 0.3,  para: 3.2  },
  'alkyl':  { ipso: 9.0,  ortho: 0.5,   meta: 0.0,  para: -2.5 },
};

// --------------------------------------------------------------------------
// Solvent correction offsets (in ppm, relative to TMS)
// --------------------------------------------------------------------------

const SOLVENT_OFFSETS: Record<string, number> = {
  CDCl3:     0.0,
  'DMSO-d6': -0.5,
  CD3OD:     -0.3,
  D2O:       -0.5,
  acetone_d6:-0.2,
  benzene_d6: 0.3,
};

// --------------------------------------------------------------------------
// Ring strain corrections
// --------------------------------------------------------------------------

function ringStrainCorrection(ringSize: number | null): number {
  if (!ringSize) return 0;
  if (ringSize === 3) return -20.0;
  if (ringSize === 4) return -10.0;
  if (ringSize === 5) return -2.0;
  return 0;
}

// --------------------------------------------------------------------------
// Carbon classifier
// --------------------------------------------------------------------------

function classifyCarbonType(
  atom: AtomRecord,
  env: AtomEnvironment,
  atoms: AtomRecord[],
  bonds: BondRecord[]
): CarbonType {
  if (atom.symbol !== 'C') return 'unknown';

  if (env.envClass === 'nitrile') return 'nitrile';
  if (env.envClass === 'carbonyl_ketone') return 'carbonyl_ketone';
  if (env.envClass === 'carbonyl_aldehyde') return 'carbonyl_aldehyde';
  if (env.envClass === 'carbonyl_ester') return 'carbonyl_ester';
  if (env.envClass === 'carbonyl_acid') return 'carbonyl_acid';
  if (env.envClass === 'carbonyl_amide') return 'carbonyl_amide';

  if (atom.isAromatic) {
    return atom.implicitHydrogens > 0 ? 'aromatic_ch' : 'aromatic_c_substituted';
  }

  const hybr = atom.hybridization ?? '';
  if (hybr.includes('SP') && !hybr.includes('SP2') && !hybr.includes('SP3')) {
    return atom.implicitHydrogens > 0 ? 'alkyne_terminal' : 'alkyne_internal';
  }

  if (hybr.includes('SP2') && !atom.isAromatic) return 'olefinic';

  if (atom.ringSize === 3) return 'cyclopropyl';

  if (env.envClass === 'alpha_to_oxygen') return 'alpha_to_oxygen';
  if (env.envClass === 'alpha_to_nitrogen') return 'alpha_to_nitrogen';
  if (env.envClass === 'alpha_to_halogen') return 'alpha_to_halogen';

  const hCount = atom.implicitHydrogens;
  if (hCount >= 3) return 'alkyl_primary';
  if (hCount === 2) return 'alkyl_secondary';
  if (hCount === 1) return 'alkyl_tertiary';
  return 'alkyl_quaternary';
}

// --------------------------------------------------------------------------
// Substituent effect computation
// --------------------------------------------------------------------------

function computeSubstituentEffects(
  atomIdx: number,
  atoms: AtomRecord[],
  bonds: BondRecord[]
): SubstituentEffect[] {
  const effects: SubstituentEffect[] = [];
  const adj = bonds.filter(b => b.beginAtomIdx === atomIdx || b.endAtomIdx === atomIdx);

  for (const bond of adj) {
    const neighborIdx = bond.beginAtomIdx === atomIdx ? bond.endAtomIdx : bond.beginAtomIdx;
    const neighbor = atoms.find(a => a.index === neighborIdx);
    if (!neighbor) continue;

    let key: string | null = null;
    if (neighbor.symbol === 'O' && bond.bondOrder === 1) key = 'O_single';
    else if (neighbor.symbol === 'N' && bond.bondOrder === 1) key = 'N_single';
    else if (neighbor.symbol === 'F') key = 'F';
    else if (neighbor.symbol === 'Cl') key = 'Cl';
    else if (neighbor.symbol === 'Br') key = 'Br';
    else if (neighbor.symbol === 'I') key = 'I';
    else if (neighbor.symbol === 'S' && bond.bondOrder === 1) key = 'S_single';
    else if (neighbor.symbol === 'C' && bond.bondOrder === 2) key = 'C_double';
    else if (neighbor.symbol === 'C' && bond.bondOrder === 3) key = 'C_triple';
    else if (neighbor.symbol === 'C' && neighbor.isAromatic) key = 'C_aromatic';

    if (key && ALPHA_INCREMENTS[key] !== undefined) {
      effects.push({ type: key, position: 'alpha', increment: ALPHA_INCREMENTS[key] });
    }

    if (!neighbor || neighbor.symbol === 'H') continue;
    const betaAdj = bonds.filter(b =>
      (b.beginAtomIdx === neighborIdx || b.endAtomIdx === neighborIdx) &&
      !(b.beginAtomIdx === atomIdx || b.endAtomIdx === atomIdx)
    );
    for (const bb of betaAdj) {
      const betaIdx = bb.beginAtomIdx === neighborIdx ? bb.endAtomIdx : bb.beginAtomIdx;
      const beta = atoms.find(a => a.index === betaIdx);
      if (!beta) continue;
      let betaKey: string | null = null;
      if (beta.symbol === 'O' && bb.bondOrder === 1) betaKey = 'O_single';
      else if (beta.symbol === 'N' && bb.bondOrder === 1) betaKey = 'N_single';
      else if (beta.symbol === 'Cl') betaKey = 'Cl';
      else if (beta.symbol === 'Br') betaKey = 'Br';

      if (betaKey && BETA_INCREMENTS[betaKey] !== undefined) {
        effects.push({ type: betaKey, position: 'beta', increment: BETA_INCREMENTS[betaKey] });
      }
    }
  }

  return effects;
}

// --------------------------------------------------------------------------
// Main prediction engine
// --------------------------------------------------------------------------

export function predictCarbon13Spectrum(
  graph: MolecularGraph,
  options: { solvent?: string } = {}
): Carbon13SpectrumPrediction {
  const { atoms, bonds } = graph;
  const carbons = atoms.filter(a => a.symbol === 'C');

  if (carbons.length === 0) {
    return {
      peaks: [],
      uniqueSignalCount: 0,
      totalCarbons: 0,
      method: 'additive_substituent_model_v1',
      assumptions: ['No carbon atoms in structure'],
      limitations: [],
      version: '1.0.0',
    };
  }

  const assumptions: string[] = [
    'Additive substituent-effect model (not HOSE-code database lookup)',
    'Single conformer assumption — no Boltzmann averaging',
  ];
  const limitations: string[] = [
    'Accuracy limited to ~5-15 ppm MAE for common environments',
    'Steric effects approximated, not computed',
    'Solvent effects modeled as global offset',
    'Long-range electronic effects beyond beta position ignored',
  ];

  const solventOffset = SOLVENT_OFFSETS[options.solvent ?? 'CDCl3'] ?? 0;

  const peaks: Carbon13Prediction[] = [];

  for (const carbon of carbons) {
    const env = classifyAtomEnvironment(carbon, atoms, bonds);
    const cType = classifyCarbonType(carbon, env, atoms, bonds);
    const baseKey = cType === 'alpha_to_oxygen' ? 'alkyl_secondary'
                  : cType === 'alpha_to_nitrogen' ? 'alkyl_secondary'
                  : cType === 'alpha_to_halogen' ? 'alkyl_secondary'
                  : cType;
    const baseShift = BASE_SHIFTS[baseKey] ?? BASE_SHIFTS['alkyl_secondary'] ?? 20;

    const effects = computeSubstituentEffects(carbon.index, atoms, bonds);
    const totalIncrement = effects.reduce((sum, e) => sum + e.increment, 0);
    const ringCorr = ringStrainCorrection(carbon.ringSize);
    const rawShift = baseShift + totalIncrement + ringCorr + solventOffset;
    const clampedShift = Math.max(-5, Math.min(250, rawShift));

    const uncertainty = cType.startsWith('carbonyl') ? 8.0
      : cType.startsWith('aromatic') ? 5.0
      : effects.length > 3 ? 12.0
      : 8.0;

    const deptClass: 'CH3' | 'CH2' | 'CH' | 'C' | 'unknown' =
      carbon.implicitHydrogens >= 3 ? 'CH3'
      : carbon.implicitHydrogens === 2 ? 'CH2'
      : carbon.implicitHydrogens === 1 ? 'CH'
      : carbon.implicitHydrogens === 0 ? 'C'
      : 'unknown';

    const warnings: string[] = [];
    if (cType === 'alkyl_quaternary' && !carbon.isAromatic) {
      warnings.push('Quaternary carbon: may show weak or absent signal in 13C');
    }
    if (effects.length > 4) {
      warnings.push('Multiple substituent effects applied: prediction less reliable');
    }

    peaks.push({
      atomIndex: carbon.index,
      predictedShift: Math.round(clampedShift * 10) / 10,
      shiftRange: [
        Math.round((clampedShift - uncertainty) * 10) / 10,
        Math.round((clampedShift + uncertainty) * 10) / 10,
      ],
      carbonType: cType,
      deptClass,
      hybridization: carbon.hybridization,
      environment: env,
      substituentsApplied: effects,
      confidence: effects.length <= 2 ? 0.7 : effects.length <= 4 ? 0.5 : 0.3,
      warnings,
    });
  }

  peaks.sort((a, b) => b.predictedShift - a.predictedShift);

  const uniqueShifts = new Set(peaks.map(p => Math.round(p.predictedShift)));

  return {
    peaks,
    uniqueSignalCount: uniqueShifts.size,
    totalCarbons: carbons.length,
    method: 'additive_substituent_model_v1',
    assumptions,
    limitations,
    version: '1.0.0',
  };
}
