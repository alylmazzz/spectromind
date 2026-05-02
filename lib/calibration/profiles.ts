/**
 * Scientific Calibration Profiles
 *
 * Centralized, versioned parameter sets for all spectral computations.
 * No hardcoded constants should exist outside this module.
 */

export const CALIBRATION_VERSION = '1.0.0';

export interface SolventProfile {
  name: string;
  shortName: string;
  residualPeaks: {
    h1: Array<{ ppm: number; mult: string; note: string }>;
    c13: Array<{ ppm: number; mult: string; note: string }>;
  };
  referenceShift: number;
  deuteriumContent: number;
  dielectricConstant: number;
  boilingPoint: number;
}

export const SOLVENT_PROFILES: Record<string, SolventProfile> = {
  CDCl3: {
    name: 'Chloroform-d',
    shortName: 'CDCl3',
    residualPeaks: {
      h1: [{ ppm: 7.26, mult: 's', note: 'CHCl3 residual' }],
      c13: [{ ppm: 77.16, mult: 't', note: 'CDCl3 triplet' }],
    },
    referenceShift: 7.26,
    deuteriumContent: 99.8,
    dielectricConstant: 4.81,
    boilingPoint: 61.2,
  },
  'DMSO-d6': {
    name: 'Dimethyl sulfoxide-d6',
    shortName: 'DMSO-d6',
    residualPeaks: {
      h1: [{ ppm: 2.50, mult: 'quintet', note: 'DMSO residual' }],
      c13: [{ ppm: 39.52, mult: 'septet', note: 'DMSO-d6' }],
    },
    referenceShift: 2.50,
    deuteriumContent: 99.9,
    dielectricConstant: 46.7,
    boilingPoint: 189,
  },
  CD3OD: {
    name: 'Methanol-d4',
    shortName: 'CD3OD',
    residualPeaks: {
      h1: [
        { ppm: 3.31, mult: 'quintet', note: 'CHD2OD residual' },
        { ppm: 4.87, mult: 's', note: 'OH/OD' },
      ],
      c13: [{ ppm: 49.00, mult: 'septet', note: 'CD3OD' }],
    },
    referenceShift: 3.31,
    deuteriumContent: 99.8,
    dielectricConstant: 32.7,
    boilingPoint: 64.7,
  },
  D2O: {
    name: 'Deuterium oxide',
    shortName: 'D2O',
    residualPeaks: {
      h1: [{ ppm: 4.79, mult: 's', note: 'HOD' }],
      c13: [],
    },
    referenceShift: 4.79,
    deuteriumContent: 99.9,
    dielectricConstant: 80.1,
    boilingPoint: 101.4,
  },
  'acetone-d6': {
    name: 'Acetone-d6',
    shortName: 'acetone-d6',
    residualPeaks: {
      h1: [{ ppm: 2.05, mult: 'quintet', note: 'acetone residual' }],
      c13: [
        { ppm: 29.84, mult: 'septet', note: 'CD3' },
        { ppm: 206.26, mult: 's', note: 'C=O' },
      ],
    },
    referenceShift: 2.05,
    deuteriumContent: 99.9,
    dielectricConstant: 20.7,
    boilingPoint: 56.5,
  },
  'benzene-d6': {
    name: 'Benzene-d6',
    shortName: 'C6D6',
    residualPeaks: {
      h1: [{ ppm: 7.16, mult: 's', note: 'C6D5H residual' }],
      c13: [{ ppm: 128.06, mult: 't', note: 'C6D6' }],
    },
    referenceShift: 7.16,
    deuteriumContent: 99.6,
    dielectricConstant: 2.28,
    boilingPoint: 80.1,
  },
};

export interface ToleranceProfile {
  id: string;
  name: string;
  h1_ppm_tolerance: number;
  c13_ppm_tolerance: number;
  j_tolerance_hz: number;
  mz_tolerance_ppm: number;
  ir_band_tolerance_cm: number;
  hsqc_ppm_tolerance_h: number;
  hsqc_ppm_tolerance_c: number;
  hmbc_ppm_tolerance_h: number;
  hmbc_ppm_tolerance_c: number;
  integral_tolerance_fraction: number;
}

export const TOLERANCE_PROFILES: Record<string, ToleranceProfile> = {
  normal: {
    id: 'normal',
    name: 'Standard measurement',
    h1_ppm_tolerance: 0.05,
    c13_ppm_tolerance: 0.5,
    j_tolerance_hz: 1.0,
    mz_tolerance_ppm: 5,
    ir_band_tolerance_cm: 15,
    hsqc_ppm_tolerance_h: 0.05,
    hsqc_ppm_tolerance_c: 0.5,
    hmbc_ppm_tolerance_h: 0.05,
    hmbc_ppm_tolerance_c: 1.0,
    integral_tolerance_fraction: 0.15,
  },
  lowSNR: {
    id: 'lowSNR',
    name: 'Low SNR / overlap',
    h1_ppm_tolerance: 0.1,
    c13_ppm_tolerance: 1.0,
    j_tolerance_hz: 2.0,
    mz_tolerance_ppm: 10,
    ir_band_tolerance_cm: 25,
    hsqc_ppm_tolerance_h: 0.1,
    hsqc_ppm_tolerance_c: 1.0,
    hmbc_ppm_tolerance_h: 0.1,
    hmbc_ppm_tolerance_c: 2.0,
    integral_tolerance_fraction: 0.25,
  },
  highRes: {
    id: 'highRes',
    name: 'High resolution',
    h1_ppm_tolerance: 0.02,
    c13_ppm_tolerance: 0.3,
    j_tolerance_hz: 0.5,
    mz_tolerance_ppm: 2,
    ir_band_tolerance_cm: 10,
    hsqc_ppm_tolerance_h: 0.02,
    hsqc_ppm_tolerance_c: 0.3,
    hmbc_ppm_tolerance_h: 0.03,
    hmbc_ppm_tolerance_c: 0.5,
    integral_tolerance_fraction: 0.10,
  },
};

export interface CommonImpurity {
  name: string;
  h1_peaks: Array<{ ppm: number; mult: string }>;
  c13_peaks: Array<{ ppm: number }>;
  solvents: string[];
}

export const COMMON_IMPURITIES: CommonImpurity[] = [
  {
    name: 'water',
    h1_peaks: [
      { ppm: 1.56, mult: 's' }, // in CDCl3
      { ppm: 3.33, mult: 's' }, // in DMSO-d6
      { ppm: 4.79, mult: 's' }, // in D2O
    ],
    c13_peaks: [],
    solvents: ['CDCl3', 'DMSO-d6', 'D2O', 'CD3OD'],
  },
  {
    name: 'grease',
    h1_peaks: [{ ppm: 1.26, mult: 's' }, { ppm: 0.86, mult: 't' }],
    c13_peaks: [{ ppm: 29.7 }, { ppm: 14.1 }],
    solvents: ['CDCl3'],
  },
  {
    name: 'acetone',
    h1_peaks: [{ ppm: 2.17, mult: 's' }],
    c13_peaks: [{ ppm: 30.9 }, { ppm: 206.7 }],
    solvents: ['CDCl3', 'DMSO-d6', 'CD3OD'],
  },
  {
    name: 'ethyl acetate',
    h1_peaks: [
      { ppm: 2.05, mult: 's' },
      { ppm: 4.12, mult: 'q' },
      { ppm: 1.26, mult: 't' },
    ],
    c13_peaks: [{ ppm: 21.0 }, { ppm: 60.4 }, { ppm: 14.2 }, { ppm: 171.0 }],
    solvents: ['CDCl3'],
  },
  {
    name: 'dichloromethane',
    h1_peaks: [{ ppm: 5.30, mult: 's' }],
    c13_peaks: [{ ppm: 53.5 }],
    solvents: ['CDCl3'],
  },
];

export function getToleranceProfile(name: string): ToleranceProfile {
  return TOLERANCE_PROFILES[name] ?? TOLERANCE_PROFILES['normal'];
}

export function getSolventProfile(name: string): SolventProfile | undefined {
  return SOLVENT_PROFILES[name];
}
