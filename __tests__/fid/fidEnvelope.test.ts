import { describe, expect, it } from 'vitest';
import { finalizeFidSuccess } from '@/lib/fid/buildFidProcessResponse';

describe('finalizeFidSuccess', () => {
  it('merges Python processing trace and surfaces qc + peak_list', () => {
    const body = finalizeFidSuccess({
      debugId: 'd1',
      datasetId: 'ds1',
      vendor: 'bruker',
      processing_steps: [{ step: 'api_start', ok: true }],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 4,
          metadata_confidence: 'normal',
        },
        ppm: [10, 9, 8, 7],
        intensity: [0.1, 0.2, 0.3, 0.4],
        peaks: [
          {
            ppm: 7.2,
            height: 1,
            area: 0.5,
            linewidth_estimate: 0.02,
            shape_model: 'lorentzian',
            fit_residual: 0.12,
            region_id: 'R1',
            overlap_flag: false,
            confidence: 0.82,
          },
        ],
        warnings: [],
        qc: {
          overall_status: 'SUCCESS_HIGH_CONFIDENCE',
          phase_neg_energy_ratio: 0.05,
          snr_estimate: 42,
          phase_failed_heuristic: false,
          has_meaningful_signal: true,
          ppm_axis_plausible: true,
        },
        processing: {
          vendor: 'bruker',
          group_delay_corrected: true,
          apodization: { lb_hz: 0.3, applied: true },
          zero_fill_factor: 2,
          fft_applied: true,
          phase_method: 'auto_entropy',
          baseline_method: 'xi_rocke_ps',
          reference_standard: 'CDCl3',
        },
        processing_steps_detail: [{ step: 'fft_positive', ok: true, detail: 'ok' }],
        integral_regions: [],
        multiplet_regions: [],
      },
    });

    expect(body.success).toBe(true);
    expect(body.qc?.overall_status).toBe('SUCCESS_HIGH_CONFIDENCE');
    expect(body.peak_list?.[0]?.position).toBe(7.2);
    expect(body.processing_steps.some((s) => s.step === 'py_fft_positive')).toBe(true);
    expect(body.observed_spectrum?.displayDirection).toBe('high_ppm_left');
    expect(body.default_x_range_ppm).toEqual([14, -1]);
    expect(body.processing?.apodization).toBeDefined();
    expect(body.processing?.zero_fill_factor).toBeDefined();
    expect(body.processing?.fft_applied).toBe(true);
    expect(body.processing?.phase_method).toBeDefined();
    expect(body.processing?.baseline_method).toBeDefined();
    expect(body.processing?.reference_standard).toBeDefined();
  });

  it('sanitizes NaN/Infinity in ppm and intensity arrays', () => {
    const body = finalizeFidSuccess({
      debugId: 'd2',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 4,
          metadata_confidence: 'normal',
        },
        ppm: [10, NaN, 8, Infinity],
        intensity: [0.1, -Infinity, 0.3, NaN],
        peaks: [],
        warnings: [],
        qc: {
          overall_status: 'PARTIAL_LOW_CONFIDENCE',
          phase_neg_energy_ratio: 0.5,
          snr_estimate: 5,
          phase_failed_heuristic: false,
        },
        processing: {},
      },
    });

    expect(body.success).toBe(true);
    const obs = body.observed_spectrum;
    expect(obs).toBeDefined();
    for (const v of obs!.x) {
      expect(Number.isFinite(v)).toBe(true);
    }
    for (const v of obs!.y) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(body.warnings.some(w => w.includes('NaN'))).toBe(true);
  });

  it('keeps 14->-1 first view when full SW span in metadata but axis is plausible', () => {
    const body = finalizeFidSuccess({
      debugId: 'd3b',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 30,
          offset: 4.7,
          data_points: 8,
          metadata_confidence: 'normal',
          actual_ppm_range: [-5, 25],
        },
        ppm: [24, 20, 14, 10, 7, 4, 2, -4],
        intensity: [0.01, 0.02, 0.1, 0.2, 0.15, 0.9, 0.05, 0.01],
        peaks: [],
        warnings: [],
        qc: {
          overall_status: 'SUCCESS_HIGH_CONFIDENCE',
          phase_neg_energy_ratio: 0.05,
          snr_estimate: 20,
          phase_failed_heuristic: false,
          ppm_axis_plausible: true,
        },
        processing: {},
      },
    });
    expect(body.success).toBe(true);
    expect(body.default_x_range_ppm).toEqual([14, -1]);
  });

  it('adapts default_x_range_ppm when axis uncertain (ppm_axis_plausible false)', () => {
    const body = finalizeFidSuccess({
      debugId: 'd3',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 25,
          offset: 100,
          data_points: 4,
          metadata_confidence: 'low',
          actual_ppm_range: [80, 120],
        },
        ppm: [120, 110, 90, 80],
        intensity: [0.1, 0.5, 0.3, 0.1],
        peaks: [],
        warnings: [],
        qc: {
          overall_status: 'PARTIAL_LOW_CONFIDENCE',
          phase_neg_energy_ratio: 0.5,
          snr_estimate: 5,
          phase_failed_heuristic: false,
          ppm_axis_plausible: false,
        },
        processing: {},
      },
    });

    expect(body.success).toBe(true);
    const xRange = body.default_x_range_ppm;
    expect(xRange).toBeDefined();
    // Should NOT be [14, -1] since data is at 80-120 ppm
    expect(xRange![0]).toBeGreaterThan(14);
    expect(body.warnings.some(w => w.includes('AXIS_UNCERTAIN'))).toBe(true);
  });

  it('warns when SUCCESS_HIGH_CONFIDENCE conflicts with implausible ppm axis', () => {
    const body = finalizeFidSuccess({
      debugId: 'd3c',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 2,
          metadata_confidence: 'normal',
        },
        ppm: [100, 90],
        intensity: [0.5, 0.3],
        peaks: [],
        warnings: [],
        qc: {
          overall_status: 'SUCCESS_HIGH_CONFIDENCE',
          phase_neg_energy_ratio: 0.05,
          snr_estimate: 50,
          phase_failed_heuristic: false,
          ppm_axis_plausible: false,
        },
        processing: {},
      },
    });
    expect(body.success).toBe(true);
    expect(body.warnings.some((w) => w.includes('SUCCESS_HIGH_CONFIDENCE'))).toBe(true);
    expect(body.warnings.some((w) => w.includes('eksen belirsizligi'))).toBe(true);
  });

  it('produces validation_failed for empty arrays', () => {
    const body = finalizeFidSuccess({
      debugId: 'd4',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 0,
          metadata_confidence: 'normal',
        },
        ppm: [],
        intensity: [],
        peaks: [],
        warnings: [],
      },
    });

    expect(body.success).toBe(false);
    expect(body.status).toBe('validation_failed');
    expect(body.observed_spectrum).toBeUndefined();
  });

  it('produces validation_failed for mismatched array lengths', () => {
    const body = finalizeFidSuccess({
      debugId: 'd5',
      processing_steps: [],
      data: {
        metadata: {
          spectrometer_freq: 400,
          spectral_width: 12,
          offset: 0,
          data_points: 5,
          metadata_confidence: 'normal',
        },
        ppm: [10, 9, 8, 7, 6],
        intensity: [0.1, 0.2],
        peaks: [],
        warnings: [],
      },
    });

    expect(body.success).toBe(false);
    expect(body.error_code).toBeDefined();
  });

  it('emits DOK-2 style debug export payload', () => {
    const body = finalizeFidSuccess({
      debugId: 'dbg-dok2',
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
        ppm: [10, 9, 8, 7],
        intensity: [0.1, 0.2, 0.3, 0.4],
        peaks: [
          {
            ppm: 7.2,
            height: 1,
            area: 0.5,
            linewidth_estimate: 0.02,
            shape_model: 'lorentzian',
            fit_residual: 0.12,
            region_id: 'R1',
            overlap_flag: false,
            confidence: 0.82,
          },
        ],
        warnings: [],
        processing: { reference: { status: 'solvent:CDCl3:applied:0.01' }, phase: {}, baseline: {} },
        qc: { ppm_axis_plausible: true, overall_status: 'SUCCESS_HIGH_CONFIDENCE' },
      },
    });

    expect(body.success).toBe(true);
    expect(body.debug_export).toBeDefined();
    expect(body.debug_export?.observed_ppm.length).toBe(4);
    expect(body.debug_export?.top_detected_peaks.length).toBe(1);
    expect(body.debug_export?.provenance_report.helper_is_authoritative_for_scoring).toBe(false);
    expect(body.debug_export?.top_detected_peaks[0]?.region_id).toBe('R1');
    expect(body.debug_export?.top_detected_peaks[0]?.shape_model).toBe('lorentzian');
  });

  it('surfaces processing recipe provenance and audit hash', () => {
    const body = finalizeFidSuccess({
      debugId: 'dbg-recipe',
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
        ppm: [10, 9, 8, 7],
        intensity: [0.1, 0.2, 0.3, 0.4],
        peaks: [{ ppm: 7.2, height: 1, area: 0.5 }],
        warnings: [],
        processing: {
          reference: { status: 'solvent:CDCl3:applied:0.01' },
          phase: {},
          baseline: {},
          advised_preset_applied: '1H_standard',
          user_overrides: { zeroFill: { factor: 4 } },
          final_processing_recipe: { preset_id: '1H_standard' },
          audit_hash: 'abc123',
          vendor_imported_processing: null,
        },
        qc: { ppm_axis_plausible: true, overall_status: 'SUCCESS_HIGH_CONFIDENCE' },
      },
    });

    expect(body.success).toBe(true);
    expect(body.debug_export?.processing_recipe_provenance?.advised_preset_applied).toBe('1H_standard');
    expect(body.debug_export?.processing_recipe_provenance?.audit_hash).toBe('abc123');
  });
});
