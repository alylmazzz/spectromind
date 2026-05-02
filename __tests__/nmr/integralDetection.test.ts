import { describe, it, expect } from 'vitest';
import {
  detectIntegralRegions,
  normalizeIntegrals,
  computeIntegralTrace,
  estimateNoiseThresholdFromSpectrum,
  SOLVENT_EXCLUSION_ZONES,
} from '@/lib/nmr/integralDetection';

describe('estimateNoiseThresholdFromSpectrum', () => {
  it('returns 0 for empty array', () => {
    expect(estimateNoiseThresholdFromSpectrum([])).toBe(0);
  });

  it('returns a positive threshold for random noise', () => {
    const noise = Array.from({ length: 1000 }, () => Math.random() * 0.01);
    const t = estimateNoiseThresholdFromSpectrum(noise);
    expect(t).toBeGreaterThan(0);
  });
});

describe('detectIntegralRegions', () => {
  it('returns empty for empty input', () => {
    expect(detectIntegralRegions([], [])).toEqual([]);
  });

  it('detects a single peak region', () => {
    const ppm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const intensity = [0, 0, 0, 0.5, 1.0, 0.5, 0, 0, 0, 0, 0];
    const regions = detectIntegralRegions(ppm, intensity, { noiseThreshold: 0.1 });
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(regions[0].area).toBeGreaterThan(0);
    expect(regions[0].provenance).toBe('auto');
  });

  it('detects two separate peaks', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => i * 0.14);
    const intensity = ppm.map((p) => {
      if (p > 2 && p < 3) return 1.0;
      if (p > 7 && p < 8) return 0.8;
      return 0.01;
    });
    const regions = detectIntegralRegions(ppm, intensity, { noiseThreshold: 0.05 });
    expect(regions.length).toBeGreaterThanOrEqual(2);
  });

  it('marks solvent-overlapping regions', () => {
    const ppm = [2.48, 2.49, 2.50, 2.51, 2.52, 2.53, 2.54, 2.55, 2.56];
    const intensity = [0, 0, 5.0, 8.0, 5.0, 0, 0, 0, 0];
    const regions = detectIntegralRegions(ppm, intensity, { noiseThreshold: 0.1 });
    const solventRegion = regions.find((r) => r.isSolventExcluded);
    expect(solventRegion).toBeDefined();
  });

  it('throws on mismatched lengths', () => {
    expect(() => detectIntegralRegions([1, 2], [1])).toThrow();
  });
});

describe('normalizeIntegrals', () => {
  it('returns empty for empty input', () => {
    expect(normalizeIntegrals([])).toEqual([]);
  });

  it('normalizes smallest non-solvent area to 1.0', () => {
    const regions = [
      { id: 'a', startPpm: 1, endPpm: 2, area: 5, normalizedArea: 5, peakCount: 1, confidence: 'high' as const, isSolventExcluded: false, provenance: 'auto' as const },
      { id: 'b', startPpm: 3, endPpm: 4, area: 10, normalizedArea: 10, peakCount: 1, confidence: 'high' as const, isSolventExcluded: false, provenance: 'auto' as const },
      { id: 'c', startPpm: 2.48, endPpm: 2.56, area: 100, normalizedArea: 100, peakCount: 1, confidence: 'high' as const, isSolventExcluded: true, provenance: 'auto' as const },
    ];
    const normalized = normalizeIntegrals(regions);
    expect(normalized[0].normalizedArea).toBeCloseTo(1.0);
    expect(normalized[1].normalizedArea).toBeCloseTo(2.0);
  });
});

describe('computeIntegralTrace', () => {
  it('returns empty for empty input', () => {
    const result = computeIntegralTrace([], []);
    expect(result.ppm).toEqual([]);
    expect(result.trace).toEqual([]);
  });

  it('produces monotonically increasing trace for positive spectrum', () => {
    const ppm = [0, 1, 2, 3, 4, 5];
    const intensity = [1, 2, 3, 2, 1, 0.5];
    const result = computeIntegralTrace(ppm, intensity);
    expect(result.ppm.length).toBe(6);
    expect(result.trace.length).toBe(6);
    expect(result.trace[0]).toBe(0);
    for (let i = 1; i < result.trace.length; i++) {
      expect(result.trace[i]).toBeGreaterThanOrEqual(result.trace[i - 1]);
    }
  });

  it('throws on mismatched lengths', () => {
    expect(() => computeIntegralTrace([1, 2, 3], [1, 2])).toThrow();
  });
});

describe('SOLVENT_EXCLUSION_ZONES', () => {
  it('contains CDCl3 and DMSO zones', () => {
    const ids = SOLVENT_EXCLUSION_ZONES.map((z) => z.solvent);
    expect(ids).toContain('CDCl3');
    expect(ids).toContain('DMSO-d6');
  });
});
