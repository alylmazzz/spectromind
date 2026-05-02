import { describe, expect, it } from 'vitest';
import { finalizeFidSuccess } from '@/lib/fid/buildFidProcessResponse';

describe('FID authority and axis contract', () => {
  it('uses referenced axis/intensity as authoritative source when provided', () => {
    const body = finalizeFidSuccess({
      debugId: 'auth-axis-1',
      vendor: 'bruker',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 4,
          metadata_confidence: 'normal',
          nucleus: '1H',
        },
        ppm: [1, 2, 3, 4],
        intensity: [9, 9, 9, 9],
        ppm_axis_referenced: [10, 8, 6, 4],
        intensity_processed: [0.1, 0.2, 0.3, 0.4],
        peaks: [{ ppm: 7.2, height: 1.1, area: 0.8 }],
        warnings: [],
        processing: { phase: {}, baseline: {}, reference: {} },
        qc: { ppm_axis_plausible: true, overall_status: 'SUCCESS_HIGH_CONFIDENCE' },
      },
    });

    expect(body.success).toBe(true);
    expect(body.observed_spectrum?.x).toEqual([10, 8, 6, 4]);
    expect(body.observed_spectrum?.y).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(body.observed_spectrum?.metadata.trace_source).toBe('authoritative_processed');
  });

  it('preserves descending ppm direction and 1H default domain contract', () => {
    const body = finalizeFidSuccess({
      debugId: 'axis-dir-1',
      vendor: 'bruker',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 4,
          metadata_confidence: 'normal',
          nucleus: '1H',
        },
        ppm: [10, 8, 6, 4],
        intensity: [0.1, 0.2, 0.3, 0.4],
        peaks: [{ ppm: 7.2, height: 1.1, area: 0.8 }],
        warnings: [],
        processing: { phase: {}, baseline: {}, reference: {} },
        qc: { ppm_axis_plausible: true, overall_status: 'SUCCESS_HIGH_CONFIDENCE' },
      },
    });

    expect(body.default_x_range_ppm).toEqual([14, -1]);
    const x = body.observed_spectrum?.x ?? [];
    expect(x.length).toBeGreaterThan(1);
    expect(x[0]).toBeGreaterThan(x[x.length - 1]);
  });

  it('returns 13C default window as 230->-10', () => {
    const body = finalizeFidSuccess({
      debugId: 'c13-1',
      vendor: 'bruker',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 100,
          spectral_width: 200,
          offset: 0,
          data_points: 4,
          metadata_confidence: 'normal',
          nucleus: '13C',
        },
        ppm: [220, 120, 80, 10],
        intensity: [0.2, 0.3, 0.4, 0.1],
        peaks: [{ ppm: 170, height: 1.2, area: 0.4 }],
        warnings: [],
        processing: { phase: {}, baseline: {}, reference: {} },
        qc: { ppm_axis_plausible: true, overall_status: 'SUCCESS_HIGH_CONFIDENCE' },
      },
    });
    expect(body.success).toBe(true);
    expect(body.default_x_range_ppm).toEqual([230, -10]);
  });

  it('exposes authoritative provenance flags on observed spectrum', () => {
    const body = finalizeFidSuccess({
      debugId: 'prov-1',
      vendor: 'bruker',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 4,
          metadata_confidence: 'normal',
          nucleus: '1H',
        },
        ppm: [10, 8, 6, 2],
        intensity: [0.1, 0.3, 0.2, 0.5],
        peaks: [{ ppm: 7.2, height: 1.1, area: 0.8 }],
        warnings: [],
        processing: { phase: {}, baseline: {}, reference: {} },
        qc: { ppm_axis_plausible: true, overall_status: 'SUCCESS_HIGH_CONFIDENCE' },
      },
    });
    expect(body.observed_spectrum?.provenance.authority_tier).toBe('OBSERVED_PROCESSED_FID');
    expect(body.observed_spectrum?.provenance.is_authoritative_for_scoring).toBe(true);
    expect(body.observed_spectrum?.provenance.is_display_only).toBe(false);
    expect(body.observed_spectrum?.provenance.processing_stage).toBe('observed_processed_spectrum');
  });

  it('blocks interpretation when observed QC fatal rule fails', () => {
    const body = finalizeFidSuccess({
      debugId: 'qc-block-1',
      vendor: 'bruker',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 6,
          metadata_confidence: 'normal',
          nucleus: '1H',
        },
        ppm: [2.0, 1.8, 1.6, 1.4, 1.2, 1.0],
        intensity: [0.2, 0.3, 0.4, 0.38, 0.3, 0.25],
        peaks: [
          { ppm: 1.9, height: 0.9, area: 0.6, width_points: 1.2, confidence: 0.4 },
          { ppm: 1.6, height: 0.8, area: 0.5, width_points: 1.1, confidence: 0.35 },
        ],
        warnings: [],
        processing: { reference: { status: 'none' }, phase: {}, baseline: {} },
        qc: { ppm_axis_plausible: true, overall_status: 'PARTIAL_LOW_CONFIDENCE', phase_failed_heuristic: false },
      },
    });

    expect(body.success).toBe(true);
    expect(body.observed_spectrum?.quality?.interpretation_blocked).toBe(true);
    const ruleIds = body.observed_spectrum?.quality?.qc_rules?.filter((r) => !r.passed).map((r) => r.id) || [];
    expect(ruleIds).toContain('OBS_QC_TRACE_COMPLETE');
    expect(ruleIds).toContain('OBS_REFERENCE_ALIGNMENT_WITH_STANDARD');
    expect(ruleIds).toContain('OBSERVED_H1_REGION_VISIBILITY_REQUIRED');
    expect(ruleIds).toContain('OBSERVED_H1_REFERENCE_LOCK_REQUIRED');
    expect(ruleIds).toContain('INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL');
  });
});
