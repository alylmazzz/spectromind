/**
 * NMR Integration Service
 *
 * Provides region-based integration of frequency-domain NMR spectra.
 *
 * Scientific notes:
 *   - Integration region is defined by a start/end ppm range.
 *   - Absolute integral = sum of intensity values within the region.
 *   - Relative integrals are normalized to a reference region (user-specified proton count).
 *   - Integral bias correction subtracts a linear baseline between region boundaries.
 *   - Running integral (cumulative sum) is computed for visualization.
 */

import { AuditService } from '@/lib/core/audit/AuditService';

export interface IntegrationRegion {
  id: string;
  startPpm: number;
  endPpm: number;
  absoluteIntegral: number;
  correctedIntegral: number;
  relativeIntegral: number;
  assignedProtons: number | null;
  label: string;
}

export interface IntegrationConfig {
  biasCorrection: boolean;
  normalizationMode: 'none' | 'reference' | 'total';
  referenceRegionId: string | null;
  referenceProtonCount: number;
}

const DEFAULT_CONFIG: IntegrationConfig = {
  biasCorrection: true,
  normalizationMode: 'none',
  referenceRegionId: null,
  referenceProtonCount: 1,
};

function ppmToIndex(ppm: number, n: number, swHz: number, refFreqHz: number): number {
  return Math.round(n / 2 - (ppm * refFreqHz * n) / swHz);
}

function regionId(): string {
  return `int_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export class IntegrationService {
  private config: IntegrationConfig;
  private regions: IntegrationRegion[] = [];

  constructor(config?: Partial<IntegrationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addRegion(
    startPpm: number,
    endPpm: number,
    real: Float64Array,
    swHz: number,
    refFreqHz: number,
    label?: string,
  ): IntegrationRegion {
    const n = real.length;
    const lo = Math.min(startPpm, endPpm);
    const hi = Math.max(startPpm, endPpm);
    const startIdx = ppmToIndex(hi, n, swHz, refFreqHz);
    const endIdx = ppmToIndex(lo, n, swHz, refFreqHz);

    const safeStart = Math.max(0, Math.min(startIdx, n - 1));
    const safeEnd = Math.max(0, Math.min(endIdx, n - 1));

    let sum = 0;
    for (let i = safeStart; i <= safeEnd; i++) {
      sum += real[i];
    }
    const absoluteIntegral = sum;

    let correctedIntegral = absoluteIntegral;
    if (this.config.biasCorrection && safeEnd > safeStart) {
      const leftVal = real[safeStart];
      const rightVal = real[safeEnd];
      const regionLen = safeEnd - safeStart + 1;
      let biasSum = 0;
      for (let i = 0; i < regionLen; i++) {
        biasSum += leftVal + (rightVal - leftVal) * (i / (regionLen - 1));
      }
      correctedIntegral = absoluteIntegral - biasSum;
    }

    const region: IntegrationRegion = {
      id: regionId(),
      startPpm: lo,
      endPpm: hi,
      absoluteIntegral,
      correctedIntegral,
      relativeIntegral: correctedIntegral,
      assignedProtons: null,
      label: label ?? `${lo.toFixed(2)} - ${hi.toFixed(2)} ppm`,
    };

    this.regions.push(region);
    this.recalculateRelative();

    AuditService.log('analysis.integrate', 'nmr.analysis', {
      regionId: region.id,
      startPpm: lo,
      endPpm: hi,
      absoluteIntegral,
      correctedIntegral,
    });

    return region;
  }

  removeRegion(id: string): void {
    this.regions = this.regions.filter(r => r.id !== id);
    this.recalculateRelative();
  }

  assignProtons(id: string, count: number): void {
    const region = this.regions.find(r => r.id === id);
    if (region) {
      region.assignedProtons = count;
    }
  }

  setReferenceRegion(id: string, protonCount: number): void {
    this.config.referenceRegionId = id;
    this.config.referenceProtonCount = protonCount;
    this.config.normalizationMode = 'reference';
    this.recalculateRelative();
  }

  normalizeToTotal(): void {
    this.config.normalizationMode = 'total';
    this.config.referenceRegionId = null;
    this.recalculateRelative();
  }

  private recalculateRelative(): void {
    if (this.regions.length === 0) return;

    if (this.config.normalizationMode === 'reference' && this.config.referenceRegionId) {
      const ref = this.regions.find(r => r.id === this.config.referenceRegionId);
      if (ref && ref.correctedIntegral !== 0) {
        const scale = this.config.referenceProtonCount / ref.correctedIntegral;
        for (const r of this.regions) {
          r.relativeIntegral = r.correctedIntegral * scale;
        }
        return;
      }
    }

    if (this.config.normalizationMode === 'total') {
      const total = this.regions.reduce((s, r) => s + Math.abs(r.correctedIntegral), 0);
      if (total > 0) {
        for (const r of this.regions) {
          r.relativeIntegral = (r.correctedIntegral / total) * 100;
        }
        return;
      }
    }

    for (const r of this.regions) {
      r.relativeIntegral = r.correctedIntegral;
    }
  }

  computeRunningIntegral(
    real: Float64Array,
    swHz: number,
    refFreqHz: number,
    startPpm: number,
    endPpm: number,
  ): Float64Array {
    const n = real.length;
    const lo = Math.min(startPpm, endPpm);
    const hi = Math.max(startPpm, endPpm);
    const startIdx = Math.max(0, ppmToIndex(hi, n, swHz, refFreqHz));
    const endIdx = Math.min(n - 1, ppmToIndex(lo, n, swHz, refFreqHz));
    const len = endIdx - startIdx + 1;
    const cumulative = new Float64Array(len);

    if (len <= 0) return cumulative;

    cumulative[0] = real[startIdx];
    for (let i = 1; i < len; i++) {
      cumulative[i] = cumulative[i - 1] + real[startIdx + i];
    }

    return cumulative;
  }

  getRegions(): readonly IntegrationRegion[] {
    return this.regions;
  }

  getConfig(): Readonly<IntegrationConfig> {
    return { ...this.config };
  }

  updateConfig(partial: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...partial };
    this.recalculateRelative();
  }

  clear(): void {
    this.regions = [];
  }
}
