/**
 * NMR Peak Picking Service
 *
 * Implements threshold-based and local-maximum peak detection for 1D NMR spectra.
 *
 * Scientific notes:
 *   - Noise estimation uses median absolute deviation (MAD) of the spectrum baseline regions.
 *   - Peaks below the noise threshold * user multiplier are rejected.
 *   - Each detected peak reports: position (index, ppm), intensity, linewidth at half-height,
 *     signal-to-noise ratio, and whether it is a potential artifact/solvent.
 */

import { AuditService } from '@/lib/core/audit/AuditService';

export interface DetectedPeak {
  index: number;
  ppm: number;
  intensity: number;
  linewidthHz: number;
  snr: number;
  isSolvent: boolean;
  isArtifact: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface PeakPickerConfig {
  thresholdMultiplier: number;
  minSNR: number;
  minDistancePoints: number;
  noiseRegionFraction: number;
  solventPeaksPpm: number[];
  solventTolerancePpm: number;
}

const DEFAULT_CONFIG: PeakPickerConfig = {
  thresholdMultiplier: 3.0,
  minSNR: 2.0,
  minDistancePoints: 3,
  noiseRegionFraction: 0.1,
  solventPeaksPpm: [],
  solventTolerancePpm: 0.05,
};

function estimateNoise(data: Float64Array, fraction: number): number {
  const n = data.length;
  const regionSize = Math.max(16, Math.floor(n * fraction));

  const leftRegion = data.slice(0, regionSize);
  const rightRegion = data.slice(n - regionSize);
  const noiseData = new Float64Array(leftRegion.length + rightRegion.length);
  noiseData.set(leftRegion, 0);
  noiseData.set(rightRegion, leftRegion.length);

  const sorted = Array.from(noiseData).map(Math.abs).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median * 1.4826;
}

function indexToPpm(index: number, n: number, swHz: number, refFreqHz: number): number {
  return ((n / 2 - index) * swHz) / (refFreqHz * n);
}

function hzPerPoint(swHz: number, n: number): number {
  return swHz / n;
}

function measureLinewidth(data: Float64Array, peakIndex: number, hzPt: number): number {
  const halfHeight = data[peakIndex] / 2;
  let leftIdx = peakIndex;
  let rightIdx = peakIndex;

  while (leftIdx > 0 && data[leftIdx] > halfHeight) leftIdx--;
  while (rightIdx < data.length - 1 && data[rightIdx] > halfHeight) rightIdx++;

  return (rightIdx - leftIdx) * hzPt;
}

export class PeakPicker {
  private config: PeakPickerConfig;

  constructor(config?: Partial<PeakPickerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  pick(
    real: Float64Array,
    spectralWidthHz: number,
    referenceFreqHz: number,
  ): DetectedPeak[] {
    const n = real.length;
    const noise = estimateNoise(real, this.config.noiseRegionFraction);
    const threshold = noise * this.config.thresholdMultiplier;
    const hzPt = hzPerPoint(spectralWidthHz, n);

    const candidates: number[] = [];

    for (let i = 1; i < n - 1; i++) {
      if (real[i] <= threshold) continue;
      if (real[i] >= real[i - 1] && real[i] >= real[i + 1]) {
        candidates.push(i);
      }
    }

    const filtered: number[] = [];
    for (const idx of candidates) {
      if (filtered.length === 0) {
        filtered.push(idx);
        continue;
      }
      const lastIdx = filtered[filtered.length - 1];
      if (idx - lastIdx < this.config.minDistancePoints) {
        if (real[idx] > real[lastIdx]) {
          filtered[filtered.length - 1] = idx;
        }
      } else {
        filtered.push(idx);
      }
    }

    const peaks: DetectedPeak[] = filtered.map(idx => {
      const ppm = indexToPpm(idx, n, spectralWidthHz, referenceFreqHz);
      const intensity = real[idx];
      const snr = noise > 0 ? intensity / noise : Infinity;
      const linewidthHz = measureLinewidth(real, idx, hzPt);

      const isSolvent = this.config.solventPeaksPpm.some(
        sp => Math.abs(ppm - sp) < this.config.solventTolerancePpm
      );

      const isArtifact = linewidthHz > 100 || linewidthHz < 0.1;

      let confidence: 'high' | 'medium' | 'low' = 'high';
      if (snr < 5) confidence = 'low';
      else if (snr < 10) confidence = 'medium';

      return { index: idx, ppm, intensity, linewidthHz, snr, isSolvent, isArtifact, confidence };
    });

    const validPeaks = peaks.filter(p => p.snr >= this.config.minSNR);

    AuditService.log('analysis.peak_pick', 'nmr.analysis', {
      totalCandidates: candidates.length,
      afterDistance: filtered.length,
      afterSNR: validPeaks.length,
      noiseEstimate: noise,
      threshold,
      config: this.config,
    });

    return validPeaks;
  }

  updateConfig(partial: Partial<PeakPickerConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getConfig(): Readonly<PeakPickerConfig> {
    return { ...this.config };
  }
}
