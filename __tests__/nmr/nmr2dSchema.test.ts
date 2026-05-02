import { describe, it, expect } from 'vitest';
import {
  Nmr2dExperimentType,
  is2dExperiment,
  route2dExperiment,
  SUPPORTED_2D_EXPERIMENTS,
} from '@/lib/nmr/nmr2dSchema';

describe('is2dExperiment', () => {
  it('detects 2D from dimension hint', () => {
    expect(is2dExperiment('2D', [])).toBe(true);
    expect(is2dExperiment('2', [])).toBe(true);
    expect(is2dExperiment('2d_NMR', [])).toBe(true);
  });

  it('detects 2D from file names', () => {
    expect(is2dExperiment(undefined, ['exp/cosy/fid'])).toBe(true);
    expect(is2dExperiment(undefined, ['data.rr'])).toBe(true);
    expect(is2dExperiment(undefined, ['hsqc_folder/acqus'])).toBe(true);
  });

  it('returns false for standard 1D paths', () => {
    expect(is2dExperiment(undefined, ['fid', 'acqus', 'procs'])).toBe(false);
    expect(is2dExperiment('1D', ['fid'])).toBe(false);
  });
});

describe('route2dExperiment', () => {
  it('marks COSY as supported', () => {
    const result = route2dExperiment({
      experimentType: Nmr2dExperimentType.COSY,
      f1Ppm: [], f2Ppm: [], matrix: [],
      f1Nucleus: '1H', f2Nucleus: '1H',
      metadata: {},
      provenance: { vendor: 'bruker', processingSteps: [], debugId: 'test' },
      quality: { overallStatus: 'ok', f1AxisPlausible: true, f2AxisPlausible: true },
    });
    expect(result.supported).toBe(true);
    expect(result.adapterId).toBe('spectromind.2d.cosy');
  });

  it('marks NOESY as unsupported with reason', () => {
    const result = route2dExperiment({
      experimentType: Nmr2dExperimentType.NOESY,
      f1Ppm: [], f2Ppm: [], matrix: [],
      f1Nucleus: '1H', f2Nucleus: '1H',
      metadata: {},
      provenance: { vendor: 'bruker', processingSteps: [], debugId: 'test' },
      quality: { overallStatus: 'ok', f1AxisPlausible: true, f2AxisPlausible: true },
    });
    expect(result.supported).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe('SUPPORTED_2D_EXPERIMENTS', () => {
  it('includes COSY, HSQC, HMBC', () => {
    expect(SUPPORTED_2D_EXPERIMENTS).toContain(Nmr2dExperimentType.COSY);
    expect(SUPPORTED_2D_EXPERIMENTS).toContain(Nmr2dExperimentType.HSQC);
    expect(SUPPORTED_2D_EXPERIMENTS).toContain(Nmr2dExperimentType.HMBC);
  });
});
