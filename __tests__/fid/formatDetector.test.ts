import { describe, it, expect } from 'vitest';
import { detectFormatFromRelPaths } from '@/lib/fid/formatDetector';
import { finalizeFidSuccess, finalizeFidFailure } from '@/lib/fid/buildFidProcessResponse';
import { FidErrorCodes } from '@/lib/fid/fidErrorCodes';

describe('detectFormatFromRelPaths', () => {
  it('detects Varian from procpar + fid', () => {
    const r = detectFormatFromRelPaths(['PROTON_02/fid', 'PROTON_02/procpar']);
    expect(r.vendor).toBe('varian');
    expect(r.rawFileKind).toBe('fid');
    expect(r.confidence).toBe('confirmed');
  });

  it('detects Bruker from acqus + ser', () => {
    const r = detectFormatFromRelPaths(['1/ser', '1/acqus']);
    expect(r.vendor).toBe('bruker');
    expect(r.rawFileKind).toBe('ser');
    expect(r.confidence).toBe('confirmed');
  });

  it('detects JEOL jdf-only paths', () => {
    const r = detectFormatFromRelPaths(['run/sample.jdf']);
    expect(r.vendor).toBe('jeol');
    expect(r.rawFileKind).toBe('jdf');
  });
});

describe('finalizeFidSuccess', () => {
  it('rejects empty ppm/intensity with error code', () => {
    const body = finalizeFidSuccess({
      data: {
        metadata: { spectrometer_freq: 400, spectral_width: 10, offset: 0, data_points: 0 },
        ppm: [],
        intensity: [],
        peaks: [],
        warnings: [],
      },
      debugId: 'test-uuid',
      processing_steps: [{ step: 'python', ok: true }],
    });
    expect(body.success).toBe(false);
    expect(body.error_code).toBe(FidErrorCodes.EMPTY_SPECTRUM);
  });

  it('accepts aligned arrays', () => {
    const body = finalizeFidSuccess({
      data: {
        metadata: { spectrometer_freq: 400, spectral_width: 10, offset: 0, data_points: 2 },
        ppm: [1, 2],
        intensity: [0.5, 0.8],
        peaks: [],
        warnings: [],
      },
      debugId: 'id',
      processing_steps: [],
    });
    expect(body.success).toBe(true);
    expect(body.observed_spectrum?.x).toEqual([1, 2]);
  });
});

describe('finalizeFidFailure', () => {
  it('includes hint for known codes', () => {
    const b = finalizeFidFailure({
      error_message: 'x',
      error_code: FidErrorCodes.RAW_FILE_NOT_FOUND,
      debugId: 'd',
      processing_steps: [],
    });
    expect(b.success).toBe(false);
    expect(b.user_hint).toBeDefined();
  });
});
