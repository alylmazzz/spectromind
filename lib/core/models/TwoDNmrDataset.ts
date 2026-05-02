/**
 * 2D NMR Data Model
 *
 * Scientific foundation for HSQC, HMQC, COSY, HMBC, NOESY, ROESY, TOCSY, and INADEQUATE experiments.
 *
 * Design principles:
 *   - Matrix data stored as Float64Array with row-major ordering.
 *   - F1 (indirect) and F2 (direct) axes fully defined.
 *   - Contour settings decoupled from data.
 *   - 1D trace attachment is first-class.
 *   - 2D peaks carry correlation semantics (which atoms correlate).
 *   - Assignment-ready: each 2D peak can link to molecule atoms via AssignmentEdge.
 */

export type TwoDExperimentType =
  | 'COSY'
  | 'TOCSY'
  | 'NOESY'
  | 'ROESY'
  | 'HSQC'
  | 'HMQC'
  | 'HMBC'
  | 'INADEQUATE'
  | 'JRES'
  | 'DOSY'
  | 'other';

export type TwoDNucleus = '1H' | '13C' | '15N' | '19F' | '31P' | 'other';

export interface TwoDAxisDefinition {
  nucleus: TwoDNucleus;
  label: string;
  size: number;
  spectralWidthHz: number;
  referenceFreqMHz: number;
  offsetPpm: number;
  startPpm: number;
  endPpm: number;
}

export interface ContourSettings {
  levels: number;
  baseLevel: number;
  multiplier: number;
  positiveColor: string;
  negativeColor: string;
  showPositive: boolean;
  showNegative: boolean;
}

export interface TwoDPeak {
  id: string;
  f1Ppm: number;
  f2Ppm: number;
  f1Index: number;
  f2Index: number;
  intensity: number;
  volume: number;
  label: string;
  correlationType: CorrelationType;
  confidence: 'high' | 'medium' | 'low';
  assignedAtomF1: string | null;
  assignedAtomF2: string | null;
  assignedMoleculeId: string | null;
}

export type CorrelationType =
  | 'direct_CH'
  | 'long_range_CH'
  | 'HH_scalar'
  | 'HH_dipolar'
  | 'CC_direct'
  | 'diagonal'
  | 'relay'
  | 'artifact'
  | 'unknown';

export interface TraceLinkage {
  axis: 'f1' | 'f2';
  datasetId: string;
  nucleus: TwoDNucleus;
  syncedZoom: boolean;
  syncedReference: boolean;
}

export interface TwoDNmrDataset {
  id: string;
  documentId: string;
  experimentType: TwoDExperimentType;
  title: string;

  f1Axis: TwoDAxisDefinition;
  f2Axis: TwoDAxisDefinition;

  realMatrix: Float64Array;
  imagMatrix?: Float64Array;

  contourSettings: ContourSettings;
  peaks: TwoDPeak[];
  traceLinks: TraceLinkage[];

  vendor: string;
  importDate: string;
  processingHistory: string[];

  symmetryMode: 'none' | 'symmetrized' | 'covariance';
  noiseLevel: number;
}

export function createTwoDDatasetId(): string {
  return `2d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultContourSettings(): ContourSettings {
  return {
    levels: 16,
    baseLevel: 10000,
    multiplier: 1.3,
    positiveColor: '#3b82f6',
    negativeColor: '#ef4444',
    showPositive: true,
    showNegative: true,
  };
}

export function createEmptyTwoDDataset(
  experimentType: TwoDExperimentType,
  f1Nucleus: TwoDNucleus,
  f2Nucleus: TwoDNucleus,
  f1Size: number,
  f2Size: number,
): TwoDNmrDataset {
  return {
    id: createTwoDDatasetId(),
    documentId: '',
    experimentType,
    title: `${experimentType} ${f2Nucleus}-${f1Nucleus}`,

    f1Axis: {
      nucleus: f1Nucleus,
      label: `F1 (${f1Nucleus})`,
      size: f1Size,
      spectralWidthHz: 0,
      referenceFreqMHz: 0,
      offsetPpm: 0,
      startPpm: 0,
      endPpm: 0,
    },
    f2Axis: {
      nucleus: f2Nucleus,
      label: `F2 (${f2Nucleus})`,
      size: f2Size,
      spectralWidthHz: 0,
      referenceFreqMHz: 0,
      offsetPpm: 0,
      startPpm: 0,
      endPpm: 0,
    },

    realMatrix: new Float64Array(f1Size * f2Size),
    contourSettings: createDefaultContourSettings(),
    peaks: [],
    traceLinks: [],

    vendor: 'unknown',
    importDate: new Date().toISOString(),
    processingHistory: [],

    symmetryMode: 'none',
    noiseLevel: 0,
  };
}

export function getMatrixValue(
  dataset: TwoDNmrDataset,
  f1Index: number,
  f2Index: number,
): number {
  return dataset.realMatrix[f1Index * dataset.f2Axis.size + f2Index];
}

export function extractF2Trace(
  dataset: TwoDNmrDataset,
  f1Index: number,
): Float64Array {
  const f2Size = dataset.f2Axis.size;
  const offset = f1Index * f2Size;
  return dataset.realMatrix.slice(offset, offset + f2Size);
}

export function extractF1Trace(
  dataset: TwoDNmrDataset,
  f2Index: number,
): Float64Array {
  const f1Size = dataset.f1Axis.size;
  const f2Size = dataset.f2Axis.size;
  const trace = new Float64Array(f1Size);
  for (let i = 0; i < f1Size; i++) {
    trace[i] = dataset.realMatrix[i * f2Size + f2Index];
  }
  return trace;
}

export function indexToF1Ppm(dataset: TwoDNmrDataset, f1Index: number): number {
  const { startPpm, endPpm, size } = dataset.f1Axis;
  return startPpm + (endPpm - startPpm) * (f1Index / (size - 1));
}

export function indexToF2Ppm(dataset: TwoDNmrDataset, f2Index: number): number {
  const { startPpm, endPpm, size } = dataset.f2Axis;
  return startPpm + (endPpm - startPpm) * (f2Index / (size - 1));
}

export function experimentCorrelationType(type: TwoDExperimentType): CorrelationType {
  switch (type) {
    case 'HSQC':
    case 'HMQC':
      return 'direct_CH';
    case 'HMBC':
      return 'long_range_CH';
    case 'COSY':
    case 'TOCSY':
      return 'HH_scalar';
    case 'NOESY':
    case 'ROESY':
      return 'HH_dipolar';
    case 'INADEQUATE':
      return 'CC_direct';
    default:
      return 'unknown';
  }
}
