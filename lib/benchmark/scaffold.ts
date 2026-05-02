/**
 * Benchmark and Calibration Infrastructure
 *
 * Provides structure for:
 * - Golden test cases
 * - Adversarial cases
 * - Scientific metrics (MAE, RMSD, precision, recall)
 * - Determinism tests
 * - Confidence calibration
 * - Regression safety
 */

// --------------------------------------------------------------------------
// Benchmark case types
// --------------------------------------------------------------------------

export interface BenchmarkCase {
  id: string;
  name: string;
  smiles: string;
  formula: string;
  category: BenchmarkCategory;
  expectedResults: {
    h1Shifts?: Array<{ ppm: number; mult: string; integral: number; tolerance: number }>;
    c13Shifts?: Array<{ ppm: number; carbonType: string; tolerance: number }>;
    ftirBands?: Array<{ cm: number; tolerance: number; intensity: string }>;
    msFragments?: Array<{ mz: number; tolerance: number }>;
    dbe: number;
    uniqueCarbonCount?: number;
  };
  difficulty: 'easy' | 'medium' | 'hard' | 'adversarial';
  notes?: string;
}

export type BenchmarkCategory =
  | 'aliphatic_small'
  | 'aromatic_substituted'
  | 'halogenated'
  | 'carbonyl_rich'
  | 'nitrile'
  | 'amide_ester_acid'
  | 'alcohol_phenol_amine'
  | 'exchangeable_proton'
  | 'symmetry_heavy'
  | 'stereo_sensitive'
  | 'tautomer_protomer'
  | 'overlap_rich'
  | 'low_snr'
  | 'impurity_contaminated'
  | 'isotope_rich_ms';

// --------------------------------------------------------------------------
// Metrics types
// --------------------------------------------------------------------------

export interface ShiftMetrics {
  mae: number;
  rmsd: number;
  maxError: number;
  medianError: number;
  r2: number;
  n: number;
}

export interface ClassificationMetrics {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface BenchmarkReport {
  timestamp: string;
  version: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  metrics: {
    h1_shift?: ShiftMetrics;
    c13_shift?: ShiftMetrics;
    multiplicity?: ClassificationMetrics;
    ftir_bands?: ClassificationMetrics;
    ms_parent?: ClassificationMetrics;
    ms_isotope_fit?: { averageScore: number; n: number };
    candidate_ranking?: { top1Accuracy: number; top5Accuracy: number; n: number };
    confidence_calibration?: { calibrationError: number; brier_score: number };
  };
  byCategory: Record<string, { passed: number; failed: number; mae?: number }>;
  determinismCheck: { allDeterministic: boolean; nonDeterministicCases: string[] };
}

// --------------------------------------------------------------------------
// Metric computations
// --------------------------------------------------------------------------

export function computeShiftMetrics(
  predicted: number[],
  observed: number[]
): ShiftMetrics {
  if (predicted.length === 0 || predicted.length !== observed.length) {
    return { mae: NaN, rmsd: NaN, maxError: NaN, medianError: NaN, r2: NaN, n: 0 };
  }

  const n = predicted.length;
  const errors = predicted.map((p, i) => Math.abs(p - observed[i]));
  const mae = errors.reduce((s, e) => s + e, 0) / n;
  const rmsd = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / n);
  const maxError = Math.max(...errors);

  const sorted = [...errors].sort((a, b) => a - b);
  const medianError = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const obsMean = observed.reduce((s, v) => s + v, 0) / n;
  const ssRes = predicted.reduce((s, p, i) => s + (observed[i] - p) ** 2, 0);
  const ssTot = observed.reduce((s, v) => s + (v - obsMean) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { mae, rmsd, maxError, medianError, r2, n };
}

export function computeClassificationMetrics(
  predicted: boolean[],
  actual: boolean[]
): ClassificationMetrics {
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] && actual[i]) tp++;
    else if (predicted[i] && !actual[i]) fp++;
    else if (!predicted[i] && actual[i]) fn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return { precision, recall, f1, truePositives: tp, falsePositives: fp, falseNegatives: fn };
}

export function computeCalibrationError(
  confidences: number[],
  correct: boolean[],
  bins = 10
): number {
  if (confidences.length === 0) return NaN;
  const binSize = 1.0 / bins;
  let totalError = 0;
  let totalSamples = 0;

  for (let b = 0; b < bins; b++) {
    const low = b * binSize;
    const high = (b + 1) * binSize;
    const inBin = confidences
      .map((c, i) => ({ c, correct: correct[i] }))
      .filter(x => x.c >= low && x.c < high);

    if (inBin.length === 0) continue;

    const avgConfidence = inBin.reduce((s, x) => s + x.c, 0) / inBin.length;
    const accuracy = inBin.filter(x => x.correct).length / inBin.length;
    totalError += Math.abs(avgConfidence - accuracy) * inBin.length;
    totalSamples += inBin.length;
  }

  return totalSamples > 0 ? totalError / totalSamples : NaN;
}

// --------------------------------------------------------------------------
// Golden benchmark set (seed)
// --------------------------------------------------------------------------

export const GOLDEN_BENCHMARKS: BenchmarkCase[] = [
  {
    id: 'BM_001', name: 'Ethanol', smiles: 'CCO', formula: 'C2H6O',
    category: 'aliphatic_small', difficulty: 'easy',
    expectedResults: { dbe: 0, uniqueCarbonCount: 2 },
  },
  {
    id: 'BM_002', name: 'Benzene', smiles: 'c1ccccc1', formula: 'C6H6',
    category: 'aromatic_substituted', difficulty: 'easy',
    expectedResults: { dbe: 4, uniqueCarbonCount: 1 },
  },
  {
    id: 'BM_003', name: 'Acetone', smiles: 'CC(=O)C', formula: 'C3H6O',
    category: 'carbonyl_rich', difficulty: 'easy',
    expectedResults: { dbe: 1, uniqueCarbonCount: 2 },
  },
  {
    id: 'BM_004', name: 'Chlorobenzene', smiles: 'c1ccc(Cl)cc1', formula: 'C6H5Cl',
    category: 'halogenated', difficulty: 'easy',
    expectedResults: { dbe: 4 },
  },
  {
    id: 'BM_005', name: 'Acetonitrile', smiles: 'CC#N', formula: 'C2H3N',
    category: 'nitrile', difficulty: 'easy',
    expectedResults: { dbe: 2, uniqueCarbonCount: 2 },
  },
  {
    id: 'BM_006', name: 'Acetic acid', smiles: 'CC(=O)O', formula: 'C2H4O2',
    category: 'amide_ester_acid', difficulty: 'easy',
    expectedResults: { dbe: 1, uniqueCarbonCount: 2 },
  },
  {
    id: 'BM_007', name: 'Phenol', smiles: 'Oc1ccccc1', formula: 'C6H6O',
    category: 'alcohol_phenol_amine', difficulty: 'easy',
    expectedResults: { dbe: 4 },
  },
  {
    id: 'BM_008', name: 'p-Xylene', smiles: 'Cc1ccc(C)cc1', formula: 'C8H10',
    category: 'symmetry_heavy', difficulty: 'medium',
    expectedResults: { dbe: 4, uniqueCarbonCount: 4 },
    notes: 'C2v symmetry — 4 unique carbons expected',
  },
  {
    id: 'BM_009', name: 'Naphthalene', smiles: 'c1ccc2ccccc2c1', formula: 'C10H8',
    category: 'aromatic_substituted', difficulty: 'medium',
    expectedResults: { dbe: 7, uniqueCarbonCount: 5 },
    notes: 'D2h symmetry — 5 unique carbons (α, β, junction)',
  },
  {
    id: 'BM_010', name: 'Bromobenzene', smiles: 'c1ccc(Br)cc1', formula: 'C6H5Br',
    category: 'isotope_rich_ms', difficulty: 'medium',
    expectedResults: { dbe: 4 },
    notes: 'MS: ~1:1 M/M+2 ratio expected for Br',
  },
  {
    id: 'BM_011', name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', formula: 'C9H8O4',
    category: 'amide_ester_acid', difficulty: 'medium',
    expectedResults: { dbe: 6 },
  },
  {
    id: 'BM_012', name: 'Caffeine', smiles: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O', formula: 'C8H10N4O2',
    category: 'overlap_rich', difficulty: 'hard',
    expectedResults: { dbe: 6 },
  },
];
