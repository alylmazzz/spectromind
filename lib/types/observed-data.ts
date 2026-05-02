/**
 * Observed Data Schemas — strict separation from theoretical spectra.
 *
 * These types represent REAL experimental data, not predictions.
 * They must NEVER be conflated with TheoreticalSpectrum types.
 *
 * Data flow:
 *   Raw instrument file → RawObservation → ProcessedObservation → PeakList
 *   TheoreticalSpectrum is generated from structure, never from observation.
 *   VerificationInput pairs PeakList (observed) with TheoreticalSpectrum (predicted).
 */

// --------------------------------------------------------------------------
// Raw observation (from instrument)
// --------------------------------------------------------------------------

export interface RawObservation {
  readonly type: 'raw';
  format: 'bruker_fid' | 'varian_fid' | 'jcamp_dx' | 'csv' | 'manual';
  data?: Float64Array | number[];
  metadata: RawMetadata;
  provenance: DataProvenance;
}

export interface RawMetadata {
  instrumentType: 'NMR' | 'FTIR' | 'MS' | 'UV_VIS' | 'RAMAN';
  vendor?: string;
  fieldStrengthMHz?: number;
  nucleus?: '1H' | '13C' | '15N' | '31P' | '19F';
  solvent?: string;
  temperature?: number;
  pulseSequence?: string;
  spectralWidth?: number;
  numberOfPoints?: number;
  acquisitionTime?: number;
  groupDelay?: number;
  digitalFilter?: string;
  byteOrder?: 'little' | 'big';
  dspFirmwareVersion?: string;
  dateRecorded?: string;
}

// --------------------------------------------------------------------------
// Processed observation (after FID processing)
// --------------------------------------------------------------------------

export interface ProcessedObservation {
  readonly type: 'processed';
  instrumentType: 'NMR' | 'FTIR' | 'MS' | 'UV_VIS' | 'RAMAN';
  xValues: number[];
  yValues: number[];
  xUnit: 'ppm' | 'cm-1' | 'mz' | 'nm' | 'Hz';
  yUnit: 'intensity' | 'absorbance' | 'transmittance' | 'counts';
  processing: ProcessingRecord;
  provenance: DataProvenance;
}

export interface ProcessingRecord {
  apodization?: { type: string; parameter?: number };
  zeroFilling?: { factor: number; finalSize: number };
  phaseCorrection?: { ph0: number; ph1: number; method: string };
  baselineCorrection?: { method: string; parameters?: Record<string, number> };
  referencing?: { method: string; reference: string; referencePPM: number };
  solventSuppression?: { method: string; region?: [number, number] };
}

// --------------------------------------------------------------------------
// Peak list (extracted from processed spectrum)
// --------------------------------------------------------------------------

export interface PeakList {
  readonly type: 'peak_list';
  instrumentType: 'NMR' | 'FTIR' | 'MS';
  peaks: ObservedPeakEntry[];
  peakPickingMethod?: string;
  integralMode?: 'absolute_h' | 'relative_area' | 'calibrated';
  solvent?: string;
  fieldMHz?: number;
  temperature?: number;
  provenance: DataProvenance;
  qualityFlags: QualityFlags;
}

export interface ObservedPeakEntry {
  position: number; // ppm for NMR, cm-1 for IR, m/z for MS
  intensity?: number;
  integral?: number;
  multiplicity?: string;
  couplingConstants?: number[];
  lineWidth?: number;
  assignment?: string;
  confidence?: number;
  flags?: ('solvent' | 'impurity' | 'artifact' | 'low_snr' | 'overlap' | 'broad')[];
}

export interface QualityFlags {
  snrEstimate?: number;
  hasBaselineIssues: boolean;
  hasPhaseIssues: boolean;
  hasSolventContamination: boolean;
  hasOverlap: boolean;
  overallQuality: 'good' | 'acceptable' | 'poor' | 'unusable';
}

// --------------------------------------------------------------------------
// Theoretical spectrum (generated from structure)
// --------------------------------------------------------------------------

export interface TheoreticalSpectrum {
  readonly type: 'theoretical';
  instrumentType: 'NMR_1H' | 'NMR_13C' | 'HSQC' | 'COSY' | 'HMBC' | 'NOESY' | 'FTIR' | 'MS';
  peaks: TheoreticalPeakEntry[];
  method: string;
  version: string;
  assumptions: string[];
  limitations: string[];
  parameterProfile: string;
}

export interface TheoreticalPeakEntry {
  position: number;
  intensity?: number;
  assignment: string;
  atomIndices?: number[];
  multiplicity?: string;
  couplingConstants?: number[];
  confidence: number;
  isHeuristic: boolean;
}

// --------------------------------------------------------------------------
// Verification input (pairs observed and theoretical)
// --------------------------------------------------------------------------

export interface VerificationInput {
  readonly type: 'verification_input';
  canonicalSmiles: string;
  formula: string;
  observedData: {
    h1?: PeakList;
    c13?: PeakList;
    hsqc?: PeakList;
    cosy?: PeakList;
    hmbc?: PeakList;
    noesy?: PeakList;
    ftir?: PeakList;
    ms?: PeakList;
  };
  theoreticalData?: {
    h1?: TheoreticalSpectrum;
    c13?: TheoreticalSpectrum;
    hsqc?: TheoreticalSpectrum;
    cosy?: TheoreticalSpectrum;
    hmbc?: TheoreticalSpectrum;
    ftir?: TheoreticalSpectrum;
    ms?: TheoreticalSpectrum;
  };
  context: {
    solvent?: string;
    fieldMHz?: number;
    temperature?: number;
    ionMode?: 'positive' | 'negative' | 'EI';
    concentration?: string;
    snrClass?: 'normal' | 'lowSNR' | 'highRes';
  };
}

// --------------------------------------------------------------------------
// Provenance
// --------------------------------------------------------------------------

export interface DataProvenance {
  source: string;
  timestamp: string;
  version?: string;
  filename?: string;
  hash?: string;
  processingChain?: string[];
}
