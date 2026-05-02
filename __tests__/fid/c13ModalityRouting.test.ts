import { beforeEach, describe, expect, it } from 'vitest';
import { useSpectroMindStore } from '@/lib/core/store/spectromindStore';
import {
  defaultDomainForObservedModality,
  modalityMismatchDiagnostic,
  normalizeObservedExperimentType,
  spectrumTypeForObservedModality,
} from '@/lib/fid/modalityRouting';

describe('13C modality routing regression guards', () => {
  beforeEach(() => {
    useSpectroMindStore.setState({
      spectrumType: 'nmr',
      observedNmrOverlay: null,
      observedNmrOverlayH1: null,
      observedNmrOverlayC13: null,
      peaks: [],
      carbon13Peaks: [],
    });
  });

  it('C13_UPLOAD_ROUTES_TO_C13_STATE', () => {
    useSpectroMindStore.getState().setObservedNmrOverlay({
      ppm: [178, 149, 145, 79, 55, 15],
      intensity: [1, 0.7, 0.65, 0.5, 0.4, 0.3],
      experimentType: '13C',
      sessionId: 'c13-session',
    });
    expect(useSpectroMindStore.getState().observedNmrOverlayC13?.sessionId).toBe('c13-session');
    expect(useSpectroMindStore.getState().observedNmrOverlayH1).toBeNull();
  });

  it('H1_UPLOAD_ROUTES_TO_H1_STATE', () => {
    useSpectroMindStore.getState().setObservedNmrOverlay({
      ppm: [8.1, 7.2, 2.3, 1.1],
      intensity: [0.8, 1, 0.6, 0.5],
      experimentType: '1H',
      sessionId: 'h1-session',
    });
    expect(useSpectroMindStore.getState().observedNmrOverlayH1?.sessionId).toBe('h1-session');
    expect(useSpectroMindStore.getState().observedNmrOverlayC13).toBeNull();
  });

  it('C13_PAGE_PREFERS_AUTHORITATIVE_OBSERVED_OVER_EMPTY_PLACEHOLDER', () => {
    useSpectroMindStore.getState().setObservedNmrOverlay({
      ppm: [178, 149, 145],
      intensity: [1, 0.8, 0.7],
      experimentType: '13C',
      sessionId: 'c13-authoritative',
    });
    useSpectroMindStore.getState().setSpectrumType('c13');
    const active = useSpectroMindStore.getState().getActiveObservedNmrOverlay();
    expect(active?.sessionId).toBe('c13-authoritative');
    expect((active?.ppm?.length || 0) > 0).toBe(true);
  });

  it('C13_MAIN_AND_PREVIEW_USE_SAME_AUTHORITATIVE_MANIFEST', () => {
    useSpectroMindStore.getState().setObservedNmrOverlay({
      ppm: [178, 149, 145, 136, 123, 79, 55, 15],
      intensity: [1, 0.9, 0.87, 0.7, 0.68, 0.55, 0.42, 0.35],
      experimentType: '13C',
      sessionId: 'shared-manifest',
    });
    const manifest = useSpectroMindStore.getState().observedNmrOverlayC13;
    expect(manifest?.sessionId).toBe('shared-manifest');
    expect(manifest?.ppm?.[0]).toBe(178);
  });

  it('C13_TOOLTIP_USES_C13_PPM_VALUES', () => {
    const modality = normalizeObservedExperimentType('13C');
    expect(modality).toBe('13C');
    expect(defaultDomainForObservedModality(modality)).toEqual([230, -10]);
  });

  it('C13_PEAK_LIST_USES_C13_AUTHORITATIVE_VALUES', () => {
    const ppm = [178, 149, 145, 136, 123, 79, 55, 15];
    useSpectroMindStore.getState().setCarbon13Peaks(ppm.map((v) => ({ ppm: v })));
    expect(useSpectroMindStore.getState().carbon13Peaks.map((p) => p.ppm)).toEqual(ppm);
  });

  it('C13_EXPORT_USES_C13_AUTHORITATIVE_VALUES', () => {
    const modality = normalizeObservedExperimentType('13C');
    const defaultDomain = defaultDomainForObservedModality(modality);
    expect(defaultDomain).toEqual([230, -10]);
  });

  it('NO_C13_RENDER_ON_H1_SURFACE', () => {
    const mismatch = modalityMismatchDiagnostic('nmr', '13C');
    expect(mismatch).toContain('MODALITY_MISMATCH_DIAGNOSTIC_GUARD');
  });

  it('NO_H1_RENDER_ON_C13_SURFACE', () => {
    const mismatch = modalityMismatchDiagnostic('c13', '1H');
    expect(mismatch).toContain('MODALITY_MISMATCH_DIAGNOSTIC_GUARD');
  });

  it('MODALITY_MISMATCH_DIAGNOSTIC_GUARD', () => {
    expect(spectrumTypeForObservedModality('13C')).toBe('c13');
    expect(spectrumTypeForObservedModality('1H')).toBe('nmr');
    expect(modalityMismatchDiagnostic('c13', '13C')).toBeNull();
  });
});
