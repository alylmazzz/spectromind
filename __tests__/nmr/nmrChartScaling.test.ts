import { describe, it, expect } from 'vitest';
import {
  H1_DEFAULT_X_DOMAIN,
  H1_DISPLAY_PRESETS,
  computeYBounds,
  fitSignalXDomain,
  downsampleXY,
  normalizeSimulatedToUnitMax,
  isInSolventExclusion,
  observedPpmRange,
  smartInitialXDomain,
  validatePpmAxis,
} from '@/lib/nmr/nmrChartScaling';

describe('H1_DEFAULT_X_DOMAIN', () => {
  it('defaults to -1-14 ppm authoritative domain', () => {
    expect(H1_DEFAULT_X_DOMAIN.min).toBe(-1);
    expect(H1_DEFAULT_X_DOMAIN.max).toBe(14);
  });
});

describe('H1_DISPLAY_PRESETS', () => {
  it('contains H1_FULL with -1..14', () => {
    const full = H1_DISPLAY_PRESETS.find((p) => p.id === 'H1_FULL');
    expect(full).toBeDefined();
    expect(full!.min).toBe(-1);
    expect(full!.max).toBe(14);
  });

  it('contains AROMATIC and ALIPHATIC presets', () => {
    expect(H1_DISPLAY_PRESETS.some((p) => p.id === 'AROMATIC')).toBe(true);
    expect(H1_DISPLAY_PRESETS.some((p) => p.id === 'ALIPHATIC')).toBe(true);
  });
});

describe('computeYBounds', () => {
  it('returns ROBUST_P99 bounds that clip dominant peak', () => {
    const obs = [
      { x: 7.26, y: 100 },
      { x: 2.0, y: 5 },
      { x: 3.0, y: 4 },
      { x: 4.0, y: 6 },
      { x: 5.0, y: 3 },
    ];
    const b = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'ROBUST_P99',
      solventMask: false,
      includeObserved: true,
      includeSimulated: false,
    });
    expect(b.max).toBeLessThan(100 * 1.12);
    expect(b.max).toBeGreaterThan(0);
  });

  it('solvent-masked excludes DMSO region from bounds', () => {
    const obs = [
      { x: 2.5, y: 200 },
      { x: 1.0, y: 5 },
      { x: 6.0, y: 8 },
    ];
    const unmasked = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'ROBUST_P99',
      solventMask: false,
      includeObserved: true,
      includeSimulated: false,
    });
    const masked = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'ROBUST_P99',
      solventMask: true,
      includeObserved: true,
      includeSimulated: false,
    });
    expect(masked.max).toBeLessThan(unmasked.max);
  });

  it('returns fallback {0,1} when no points match xDomain', () => {
    const obs = [
      { x: 50, y: 100 },
      { x: 60, y: 200 },
    ];
    const b = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'ROBUST_P99',
      solventMask: false,
      includeObserved: true,
      includeSimulated: false,
    });
    expect(b.min).toBe(0);
    expect(b.max).toBe(1);
  });

  it('PHYSICAL_AUTO preserves more visibility than GLOBAL_MAX with outlier', () => {
    const obs = Array.from({ length: 200 }, (_, i) => ({
      x: i * 0.07,
      y: i === 150 ? 500 : Math.random() * 2,
    }));
    const global = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'GLOBAL_MAX',
      solventMask: false,
      includeObserved: true,
      includeSimulated: false,
    });
    const physical = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'PHYSICAL_AUTO',
      solventMask: false,
      includeObserved: true,
      includeSimulated: false,
    });
    expect(physical.max).toBeLessThan(global.max);
  });

  it('ignores helper scale when observed exists', () => {
    const obs = [{ x: 7.2, y: 1 }, { x: 1.2, y: 1.2 }];
    const sim = [{ x: 1.1, y: 999 }];
    const b = computeYBounds(obs, sim, 0, 14, {
      yScaleMode: 'GLOBAL_MAX',
      solventMask: false,
      includeObserved: true,
      includeSimulated: true,
    });
    expect(b.max).toBeLessThan(50);
  });

  it('clamps negative overshoot to at most -8% of top', () => {
    const obs = [
      { x: 2, y: 10 },
      { x: 5, y: -50 },
    ];
    const b = computeYBounds(obs, [], 0, 14, {
      yScaleMode: 'ROBUST_P99',
      solventMask: false,
      includeObserved: true,
      includeSimulated: false,
    });
    expect(b.min).toBeGreaterThanOrEqual(-b.max * 0.09);
  });
});

describe('fitSignalXDomain', () => {
  it('tightly fits around peaks with margin', () => {
    const ppm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const int = [0, 0, 0.01, 0.5, 1.0, 0.3, 0.01, 0, 0, 0, 0];
    const d = fitSignalXDomain(ppm, int);
    expect(d.min).toBeLessThan(3);
    expect(d.max).toBeGreaterThan(5);
    expect(d.max - d.min).toBeLessThan(14);
  });

  it('returns full range when intensity is empty', () => {
    const d = fitSignalXDomain([], []);
    expect(d.min).toBe(-1);
    expect(d.max).toBe(14);
  });
});

describe('downsampleXY', () => {
  it('returns original if under maxPoints', () => {
    const ppm = [1, 2, 3];
    const int = [0.5, 1.0, 0.2];
    const result = downsampleXY(ppm, int, 100);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 1, y: 0.5 });
  });

  it('downsamples large arrays while preserving peaks', () => {
    const n = 10000;
    const ppm = Array.from({ length: n }, (_, i) => i * 0.001);
    const int = Array.from({ length: n }, () => 0.01);
    int[5000] = 100.0; // sharp peak that naive stride could miss
    const result = downsampleXY(ppm, int, 500);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.length).toBeGreaterThan(200);
    const maxY = Math.max(...result.map(p => p.y));
    expect(maxY).toBe(100.0); // peak must be preserved
  });
});

describe('normalizeSimulatedToUnitMax', () => {
  it('normalizes max in window to 1.0', () => {
    const pts = [
      { x: 2, y: 50 },
      { x: 5, y: 200 },
      { x: 8, y: 100 },
    ];
    const norm = normalizeSimulatedToUnitMax(pts, 0, 14);
    const maxVal = Math.max(...norm.map((p) => p.y));
    expect(maxVal).toBe(1.0);
  });
});

describe('isInSolventExclusion', () => {
  it('detects DMSO residual zone', () => {
    expect(isInSolventExclusion(2.5)).toBe(true);
  });

  it('rejects non-exclusion zone', () => {
    expect(isInSolventExclusion(4.0)).toBe(false);
  });
});

// =============================================
// NEW: observedPpmRange
// =============================================
describe('observedPpmRange', () => {
  it('returns min/max from valid ppm array', () => {
    const range = observedPpmRange([10, 7, 3, 0.5, -0.2]);
    expect(range).not.toBeNull();
    expect(range!.min).toBeCloseTo(-0.2);
    expect(range!.max).toBeCloseTo(10);
  });

  it('returns null for empty array', () => {
    expect(observedPpmRange([])).toBeNull();
  });

  it('ignores NaN values', () => {
    const range = observedPpmRange([5, NaN, 2, NaN]);
    expect(range).not.toBeNull();
    expect(range!.min).toBe(2);
    expect(range!.max).toBe(5);
  });

  it('returns null for all-NaN array', () => {
    expect(observedPpmRange([NaN, NaN, NaN])).toBeNull();
  });
});

// =============================================
// NEW: smartInitialXDomain
// =============================================
describe('smartInitialXDomain', () => {
  it('returns default domain when data overlaps 0-14', () => {
    const range = { min: 0.5, max: 10 };
    const result = smartInitialXDomain(range);
    expect(result.adapted).toBe(false);
    expect(result.min).toBe(-1);
    expect(result.max).toBe(14);
  });

  it('adapts domain when data is completely outside 0-14', () => {
    const range = { min: 50, max: 200 };
    const result = smartInitialXDomain(range);
    expect(result.adapted).toBe(true);
    expect(result.min).toBeLessThan(50);
    expect(result.max).toBeGreaterThan(200);
  });

  it('returns default domain when range is null', () => {
    const result = smartInitialXDomain(null);
    expect(result.adapted).toBe(false);
    expect(result.min).toBe(-1);
    expect(result.max).toBe(14);
  });

  it('uses custom default domain if provided', () => {
    const range = { min: 0.5, max: 8 };
    const result = smartInitialXDomain(range, { min: -1, max: 14 });
    expect(result.adapted).toBe(false);
    expect(result.min).toBe(-1);
    expect(result.max).toBe(14);
  });
});

// =============================================
// NEW: validatePpmAxis
// =============================================
describe('validatePpmAxis', () => {
  it('marks normal 1H range as plausible', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => 14 - i * 0.14);
    const v = validatePpmAxis(ppm, '1H');
    expect(v.plausible).toBe(true);
    expect(v.actualRange).not.toBeNull();
  });

  it('marks absurd range as not plausible for 1H', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => 500 + i);
    const v = validatePpmAxis(ppm, '1H');
    expect(v.plausible).toBe(false);
    expect(v.reason).toContain('PPM_OUTSIDE_H1_RANGE');
  });

  it('marks too-wide span as not plausible for 1H', () => {
    const ppm = Array.from({ length: 200 }, (_, i) => i);
    const v = validatePpmAxis(ppm, '1H');
    expect(v.plausible).toBe(false);
    expect(v.reason).toContain('PPM_SPAN_TOO_WIDE_FOR_H1');
  });

  it('marks empty array as not plausible', () => {
    const v = validatePpmAxis([], '1H');
    expect(v.plausible).toBe(false);
    expect(v.reason).toBe('EMPTY_OR_INVALID_PPM');
  });

  it('marks normal 13C range as plausible', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => 220 - i * 2);
    const v = validatePpmAxis(ppm, '13C');
    expect(v.plausible).toBe(true);
  });
});
