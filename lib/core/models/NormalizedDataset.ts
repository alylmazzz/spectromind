import type { DataProvenance } from '@/lib/types/observed-data';

export type Modality = 'nmr-1d' | 'nmr-2d' | 'ms' | 'ir' | 'uv';
export type RawDomain = 'time' | 'frequency' | 'chromatographic';
export type AxisUnit = 'ppm' | 'hz' | 'cm-1' | 'nm' | 'mz' | 'seconds' | 'points';

export interface AxisDefinition {
  label: string;
  unit: AxisUnit;
  size: number;
  referenceValue?: number;
  spectralWidthHz?: number;
  offset?: number;
}

export interface AcquisitionMetadata {
  nucleus?: string;
  spectrometerFrequencyMHz?: number;
  pulseProgram?: string;
  solvent?: string;
  temperatureK?: number;
  spectralWidthHz?: number;
  numberOfPoints?: number;
  acquisitionTimeSec?: number;
  groupDelayPoints?: number;
  digitalFilter?: string;
  receiverGain?: number;
  dspFirmwareVersion?: string;
  dateRecorded?: string;
  experimentType?: string;
  vendor?: string;
  probeName?: string;
  numberOfScans?: number;
  relaxationDelaySec?: number;
}

export type ProcessingStepKind =
  | 'group_delay'
  | 'fid_shift'
  | 'apodization'
  | 'truncation'
  | 'zero_fill'
  | 'linear_prediction'
  | 'ft'
  | 'phase'
  | 'baseline'
  | 'reference'
  | 'signal_suppression'
  | 'noise_reduction'
  | 'symmetrize'
  | 'tilt45'
  | 't1_noise_reduction'
  | 'covariance'
  | 'normalize'
  | 'bin'
  | 'reference_deconvolution'
  | 'frequency_shift'
  | 'drift_correction';

export interface ProcessingStep {
  kind: ProcessingStepKind;
  params: Record<string, unknown>;
  enabled: boolean;
}

export interface QualityFlags {
  snrEstimate?: number;
  hasBaselineIssues: boolean;
  hasPhaseIssues: boolean;
  hasSolventContamination: boolean;
  hasOverlap: boolean;
  overallQuality: 'good' | 'acceptable' | 'poor' | 'unusable';
}

export interface NormalizedDataset {
  id: string;
  modality: Modality;
  rawDomain: RawDomain;
  vendor?: string;
  nucleus?: string;
  experiment?: string;
  axes: AxisDefinition[];
  acquisition: AcquisitionMetadata;
  processingHistory: ProcessingStep[];
  realData?: Float64Array | number[];
  imagData?: Float64Array | number[];
  provenance: DataProvenance;
  qualityFlags?: QualityFlags;
  parentDatasetId?: string;
  createdAt: string;
  updatedAt: string;
}

export function createDatasetId(): string {
  return `ds_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyDataset(modality: Modality): NormalizedDataset {
  return {
    id: createDatasetId(),
    modality,
    rawDomain: 'frequency',
    axes: [],
    acquisition: {},
    processingHistory: [],
    provenance: {
      source: 'manual',
      timestamp: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
