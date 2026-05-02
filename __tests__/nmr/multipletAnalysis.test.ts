import { describe, it, expect } from 'vitest';
import {
  classifyMultiplet,
  groupPeaksIntoMultiplets,
} from '@/lib/nmr/multipletAnalysis';

describe('classifyMultiplet', () => {
  it('classifies singlet from single peak', () => {
    const result = classifyMultiplet([7.26], 400);
    expect(result.classification).toBe('s');
    expect(result.classificationConfidence).toBe('high');
    expect(result.jCouplings.length).toBe(0);
  });

  it('classifies doublet from two peaks', () => {
    const result = classifyMultiplet([1.00, 1.018], 400);
    expect(result.classification).toBe('d');
    expect(result.jCouplings.length).toBe(1);
    expect(result.jCouplings[0].valueHz).toBeGreaterThan(0);
  });

  it('classifies triplet from three equally spaced peaks', () => {
    const j = 7.2 / 400;
    const result = classifyMultiplet([2.00, 2.00 + j, 2.00 + 2 * j], 400);
    expect(result.classification).toBe('t');
  });

  it('classifies quartet from four equally spaced peaks', () => {
    const j = 7.0 / 400;
    const result = classifyMultiplet([1.10, 1.10 + j, 1.10 + 2 * j, 1.10 + 3 * j], 400);
    expect(result.classification).toBe('q');
  });

  it('returns unresolved for too many irregular peaks', () => {
    const irregularPeaks = [1.0, 1.005, 1.013, 1.025, 1.04, 1.06, 1.09, 1.13];
    const result = classifyMultiplet(irregularPeaks, 400);
    expect(['m', 'unresolved']).toContain(result.classification);
  });

  it('handles empty input', () => {
    const result = classifyMultiplet([], 400);
    expect(result.classification).toBe('unresolved');
  });
});

describe('groupPeaksIntoMultiplets', () => {
  it('groups close peaks into one multiplet', () => {
    const peaks = [
      { ppm: 7.25, intensity: 1.0 },
      { ppm: 7.27, intensity: 0.8 },
      { ppm: 7.29, intensity: 1.0 },
    ];
    const regions = groupPeaksIntoMultiplets(peaks, { observeFreqMHz: 400 });
    expect(regions.length).toBe(1);
    expect(regions[0].peakCount).toBe(3);
  });

  it('separates distant peaks into different multiplets', () => {
    const peaks = [
      { ppm: 2.10, intensity: 1.0 },
      { ppm: 7.26, intensity: 0.5 },
    ];
    const regions = groupPeaksIntoMultiplets(peaks, { observeFreqMHz: 400 });
    expect(regions.length).toBe(2);
  });

  it('filters weak peaks below threshold', () => {
    const peaks = [
      { ppm: 3.00, intensity: 1.0 },
      { ppm: 3.02, intensity: 0.01 },
      { ppm: 3.04, intensity: 0.9 },
    ];
    const regions = groupPeaksIntoMultiplets(peaks, {
      observeFreqMHz: 400,
      minPeakIntensityFraction: 0.05,
    });
    expect(regions.length).toBe(1);
    expect(regions[0].peakCount).toBe(2);
  });

  it('returns empty for empty input', () => {
    expect(groupPeaksIntoMultiplets([], { observeFreqMHz: 400 })).toEqual([]);
  });
});
