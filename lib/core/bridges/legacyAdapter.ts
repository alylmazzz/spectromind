/**
 * Legacy Type Bridge
 *
 * Converts between legacy types (NMRPeak[], FTIRPeak[], MSPeak[], Carbon13Peak[])
 * and the new core domain models (NormalizedDataset, EvidenceNode, etc.).
 *
 * This bridge enables gradual migration: the UI can continue using legacy peak arrays
 * while new services operate on NormalizedDataset.
 */

import type { NMRPeak, Carbon13Peak, FTIRPeak, MSPeak } from '@/lib/types';
import type { NormalizedDataset } from '@/lib/core/models/NormalizedDataset';
import { createEmptyDataset } from '@/lib/core/models/NormalizedDataset';
import type { EvidenceNode } from '@/lib/core/models/EvidenceNode';
import { createEvidenceId } from '@/lib/core/models/EvidenceNode';

export function nmrPeaksToDataset(
  peaks: NMRPeak[],
  solvent: string,
  frequency: number,
  ): NormalizedDataset {
    const ds = createEmptyDataset('nmr-1d');
    ds.vendor = 'spectromind_legacy';
    ds.acquisition = {
      nucleus: '1H',
      solvent,
      spectrometerFrequencyMHz: frequency,
      spectralWidthHz: frequency * 15,
      temperatureK: 298,
      pulseProgram: 'zg',
      numberOfScans: 0,
      receiverGain: 0,
    };

  const n = peaks.length;
  ds.realData = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ds.realData[i] = peaks[i].integ;
  }

  ds.provenance = {
    source: 'legacy_peak_input',
    timestamp: new Date().toISOString(),
    filename: '',
    hash: '',
  };

  return ds;
}

export function carbon13PeaksToDataset(
  peaks: Carbon13Peak[],
  solvent: string,
  frequency: number,
): NormalizedDataset {
  const ds = createEmptyDataset('nmr-1d');
  ds.vendor = 'spectromind_legacy';
  ds.acquisition = {
    nucleus: '13C',
    solvent,
    spectrometerFrequencyMHz: frequency / 4,
    spectralWidthHz: (frequency / 4) * 250,
    temperatureK: 298,
    pulseProgram: 'zgpg30',
    numberOfScans: 0,
    receiverGain: 0,
  };

  const n = peaks.length;
  ds.realData = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ds.realData[i] = peaks[i].intensity ?? 0;
  }

  ds.provenance = {
    source: 'legacy_peak_input',
    timestamp: new Date().toISOString(),
    filename: '',
    hash: '',
  };

  return ds;
}

export function ftirPeaksToDataset(peaks: FTIRPeak[]): NormalizedDataset {
  const ds = createEmptyDataset('ir');
  ds.vendor = 'spectromind_legacy';

  const n = peaks.length;
  ds.realData = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ds.realData[i] = peaks[i].intensity;
  }

  ds.provenance = {
    source: 'legacy_peak_input',
    timestamp: new Date().toISOString(),
    filename: '',
    hash: '',
  };

  return ds;
}

export function msPeaksToDataset(peaks: MSPeak[]): NormalizedDataset {
  const ds = createEmptyDataset('ms');
  ds.vendor = 'spectromind_legacy';

  const n = peaks.length;
  ds.realData = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ds.realData[i] = peaks[i].intensity;
  }

  ds.provenance = {
    source: 'legacy_peak_input',
    timestamp: new Date().toISOString(),
    filename: '',
    hash: '',
  };

  return ds;
}

export function nmrPeakToEvidence(
  peak: NMRPeak,
  datasetId: string,
  index: number,
): EvidenceNode {
  return {
    id: createEvidenceId(),
    modality: '1H',
    category: 'shift_agreement',
    observationType: 'peak',
    rawSourceRef: `dataset:${datasetId}:peak:${index}`,
    interpretedMeaning: peak.label || `1H peak at ${peak.shift} ppm`,
    supportsHypothesisIds: [],
    contradictsHypothesisIds: [],
    confidence: 0.7,
    quality: 1.0,
    weight: 1.0,
    provenance: {
      source: 'legacy_bridge',
      timestamp: new Date().toISOString(),
      filename: '',
      hash: '',
    },
  };
}

export function ftirPeakToEvidence(
  peak: FTIRPeak,
  datasetId: string,
  index: number,
): EvidenceNode {
  return {
    id: createEvidenceId(),
    modality: 'IR',
    category: 'ir_band_match',
    observationType: 'band',
    rawSourceRef: `dataset:${datasetId}:band:${index}`,
    interpretedMeaning: peak.assignment || `IR band at ${peak.wavenumber} cm⁻¹`,
    supportsHypothesisIds: [],
    contradictsHypothesisIds: [],
    confidence: 0.6,
    quality: 0.8,
    weight: 0.7,
    provenance: {
      source: 'legacy_bridge',
      timestamp: new Date().toISOString(),
      filename: '',
      hash: '',
    },
  };
}

export function msPeakToEvidence(
  peak: MSPeak,
  datasetId: string,
  index: number,
): EvidenceNode {
  return {
    id: createEvidenceId(),
    modality: 'MS',
    category: 'mass_match',
    observationType: 'ion',
    rawSourceRef: `dataset:${datasetId}:ion:${index}`,
    interpretedMeaning: peak.assignment || `MS peak at m/z ${peak.mz}`,
    supportsHypothesisIds: [],
    contradictsHypothesisIds: [],
    confidence: 0.8,
    quality: 1.0,
    weight: 1.0,
    provenance: {
      source: 'legacy_bridge',
      timestamp: new Date().toISOString(),
      filename: '',
      hash: '',
    },
  };
}
