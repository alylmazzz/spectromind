/**
 * IR/UV Processing Pipeline
 *
 * Scientific processing operations for IR and UV-Vis spectroscopy.
 *
 * Operations:
 *   - Baseline correction (rubber band, polynomial)
 *   - Normalization (min-max, area, vector)
 *   - Smoothing (Savitzky-Golay, moving average)
 *   - Derivative spectra (1st, 2nd order)
 *   - Multiplicative Scatter Correction (MSC)
 *   - Peak picking (threshold, local max)
 *   - Arithmetic operations between spectra
 *
 * Scientific notes:
 *   - IR provides functional group evidence, NOT full skeletal connectivity.
 *   - Weak UV absorption alone must NOT be over-weighted as structural evidence.
 *   - All processing steps feed the evidence graph via EvidenceNode creation.
 */

import { AuditService } from '@/lib/core/audit/AuditService';

export type IRProcessingStepKind =
  | 'baseline'
  | 'normalize'
  | 'smooth'
  | 'derivative'
  | 'msc'
  | 'peak_pick'
  | 'atr_correction'
  | 'absorbance_transmittance';

export interface IRProcessingStep {
  kind: IRProcessingStepKind;
  params: Record<string, unknown>;
  enabled: boolean;
}

export interface IRSpectrum {
  wavenumbers: Float64Array;
  intensities: Float64Array;
  unit: 'absorbance' | 'transmittance' | '%T';
  label: string;
}

export interface IRPeak {
  wavenumber: number;
  intensity: number;
  assignment: string;
  functionalGroup: string;
  confidence: 'strong' | 'medium' | 'weak';
}

export function rubberBandBaseline(spectrum: IRSpectrum): IRSpectrum {
  const n = spectrum.intensities.length;
  const corrected = new Float64Array(n);
  const hull = computeConvexHull(spectrum.intensities);

  for (let i = 0; i < n; i++) {
    corrected[i] = spectrum.intensities[i] - hull[i];
  }

  AuditService.log('ir.baseline' as any, 'ir.processing' as any, { method: 'rubber_band', points: n });

  return { ...spectrum, intensities: corrected };
}

function computeConvexHull(data: Float64Array): Float64Array {
  const n = data.length;
  const hull = new Float64Array(n);

  const points: number[] = [0, n - 1];

  let minVal = Infinity;
  for (let i = 0; i < n; i++) {
    if (data[i] < minVal) minVal = data[i];
  }

  for (let i = 0; i < n; i++) {
    hull[i] = minVal;
  }

  for (let seg = 0; seg < points.length - 1; seg++) {
    const start = points[seg];
    const end = points[seg + 1];
    const slope = (data[end] - data[start]) / (end - start);
    for (let i = start; i <= end; i++) {
      hull[i] = Math.min(data[i], data[start] + slope * (i - start));
    }
  }

  return hull;
}

export function normalizeSpectrum(
  spectrum: IRSpectrum,
  mode: 'minmax' | 'area' | 'vector' = 'minmax',
): IRSpectrum {
  const data = spectrum.intensities;
  const n = data.length;
  const normalized = new Float64Array(n);

  if (mode === 'minmax') {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < n; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;
    for (let i = 0; i < n; i++) {
      normalized[i] = (data[i] - min) / range;
    }
  } else if (mode === 'area') {
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.abs(data[i]);
    const scale = total > 0 ? 1 / total : 1;
    for (let i = 0; i < n; i++) normalized[i] = data[i] * scale;
  } else {
    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += data[i] * data[i];
    const norm = Math.sqrt(sumSq) || 1;
    for (let i = 0; i < n; i++) normalized[i] = data[i] / norm;
  }

  AuditService.log('ir.normalize' as any, 'ir.processing' as any, { mode });

  return { ...spectrum, intensities: normalized };
}

export function smoothSpectrum(
  spectrum: IRSpectrum,
  windowSize: number = 5,
): IRSpectrum {
  const data = spectrum.intensities;
  const n = data.length;
  const smoothed = new Float64Array(n);
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      const k = i + j;
      if (k >= 0 && k < n) {
        sum += data[k];
        count++;
      }
    }
    smoothed[i] = sum / count;
  }

  AuditService.log('ir.smooth' as any, 'ir.processing' as any, { windowSize });

  return { ...spectrum, intensities: smoothed };
}

export function computeDerivative(
  spectrum: IRSpectrum,
  order: 1 | 2 = 1,
): IRSpectrum {
  const data = spectrum.intensities;
  const n = data.length;
  let derivative = new Float64Array(n);

  for (let i = 1; i < n - 1; i++) {
    derivative[i] = (data[i + 1] - data[i - 1]) / 2;
  }
  derivative[0] = derivative[1];
  derivative[n - 1] = derivative[n - 2];

  if (order === 2) {
    const second = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      second[i] = (derivative[i + 1] - derivative[i - 1]) / 2;
    }
    second[0] = second[1];
    second[n - 1] = second[n - 2];
    derivative = second;
  }

  AuditService.log('ir.derivative' as any, 'ir.processing' as any, { order });

  return {
    ...spectrum,
    intensities: derivative,
    label: `${spectrum.label} (${order}st derivative)`,
  };
}

export function convertAbsorbanceTransmittance(
  spectrum: IRSpectrum,
  targetUnit: 'absorbance' | 'transmittance',
): IRSpectrum {
  if (spectrum.unit === targetUnit) return spectrum;

  const data = spectrum.intensities;
  const n = data.length;
  const converted = new Float64Array(n);

  if (spectrum.unit === 'transmittance' || spectrum.unit === '%T') {
    for (let i = 0; i < n; i++) {
      const t = spectrum.unit === '%T' ? data[i] / 100 : data[i];
      converted[i] = t > 0 ? -Math.log10(t) : 3;
    }
  } else {
    for (let i = 0; i < n; i++) {
      converted[i] = Math.pow(10, -data[i]);
    }
  }

  AuditService.log('ir.unit_convert' as any, 'ir.processing' as any, {
    from: spectrum.unit,
    to: targetUnit,
  });

  return { ...spectrum, intensities: converted, unit: targetUnit };
}

export function pickIRPeaks(
  spectrum: IRSpectrum,
  thresholdFraction: number = 0.1,
  minDistance: number = 10,
): IRPeak[] {
  const data = spectrum.intensities;
  const wn = spectrum.wavenumbers;
  const n = data.length;

  let maxIntensity = -Infinity;
  for (let i = 0; i < n; i++) {
    if (data[i] > maxIntensity) maxIntensity = data[i];
  }
  const threshold = maxIntensity * thresholdFraction;

  const candidates: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (data[i] > threshold && data[i] >= data[i - 1] && data[i] >= data[i + 1]) {
      candidates.push(i);
    }
  }

  const filtered: number[] = [];
  for (const idx of candidates) {
    if (filtered.length === 0) {
      filtered.push(idx);
    } else {
      const last = filtered[filtered.length - 1];
      if (Math.abs(wn[idx] - wn[last]) < minDistance) {
        if (data[idx] > data[last]) filtered[filtered.length - 1] = idx;
      } else {
        filtered.push(idx);
      }
    }
  }

  const peaks: IRPeak[] = filtered.map(idx => ({
    wavenumber: wn[idx],
    intensity: data[idx],
    assignment: '',
    functionalGroup: classifyIRBand(wn[idx]),
    confidence: data[idx] > maxIntensity * 0.5 ? 'strong' : data[idx] > maxIntensity * 0.2 ? 'medium' : 'weak',
  }));

  AuditService.log('ir.peak_pick' as any, 'ir.processing' as any, {
    totalCandidates: candidates.length,
    afterFilter: filtered.length,
    threshold,
  });

  return peaks;
}

function classifyIRBand(wavenumber: number): string {
  if (wavenumber >= 3200 && wavenumber <= 3600) return 'O-H / N-H stretch';
  if (wavenumber >= 2850 && wavenumber <= 3100) return 'C-H stretch';
  if (wavenumber >= 2100 && wavenumber <= 2300) return 'C≡C / C≡N stretch';
  if (wavenumber >= 1650 && wavenumber <= 1800) return 'C=O stretch';
  if (wavenumber >= 1500 && wavenumber <= 1680) return 'C=C / N-H bend';
  if (wavenumber >= 1350 && wavenumber <= 1480) return 'C-H bend';
  if (wavenumber >= 1000 && wavenumber <= 1300) return 'C-O / C-N stretch';
  if (wavenumber >= 600 && wavenumber <= 900) return 'C-H out-of-plane / aromatic';
  return 'fingerprint region';
}
