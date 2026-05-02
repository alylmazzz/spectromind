import type { FormatDetectionResult } from '@/lib/fid/formatDetector';
import { FidErrorCodes, hintForCode, type FidErrorCode } from '@/lib/fid/fidErrorCodes';
import {
  C13_PRO_FIRST_VIEW_PPM,
  H1_DISPLAY_PRESETS,
  H1_PRO_FIRST_VIEW_PPM,
  observedPpmRange,
} from '@/lib/nmr/nmrChartScaling';

export type FidPipelineStatus =
  | 'ok'
  | 'error'
  | 'validation_failed'
  | 'unsupported';

export interface FidPythonProcessingStep {
  step: string;
  ok: boolean;
  detail?: string;
}

export interface FidQcBlock {
  overall_status?: string;
  phase_neg_energy_ratio?: number;
  snr_estimate?: number | null;
  phase_failed_heuristic?: boolean;
  has_meaningful_signal?: boolean;
  ppm_axis_plausible?: boolean;
  baseline_uncertain?: boolean;
  ppm_axis_reason?: string;
  clipping_flag?: boolean | null;
}

export type FidQcRuleSeverity = 'info' | 'warn' | 'fatal';

export interface FidQcRuleResult {
  id: string;
  passed: boolean;
  severity: FidQcRuleSeverity;
  message: string;
  value?: number | string | boolean | Record<string, unknown>;
}

export interface FidLegacyChartData {
  metadata: {
    spectrometer_freq: number;
    spectral_width: number;
    offset: number;
    data_points: number;
    raw_fid_points?: number;
    axis_type?: string;
    ppm_source?: string;
    solvent_hint?: string | null;
    reference_mode?: string;
    reference_offset_ppm_applied?: number;
    metadata_confidence?: string;
    actual_ppm_range?: [number, number];
    nucleus?: string;
    vendor?: string;
    source_format?: string;
    display_direction?: string;
    default_display_range_ppm?: number[];
    default_wide_range_ppm?: number[] | null;
    solvent_normalized?: string | null;
    spectral_width_hz?: number;
    carrier_hz?: number;
  };
  ppm: number[];
  intensity: number[];
  baseline?: number[];
  peaks: Array<{
    ppm: number;
    position_ppm?: number;
    height: number;
    apex_intensity?: number;
    abs_height?: number;
    area: number;
    width_points?: number;
    linewidth_estimate?: number;
    shape_model?: string;
    fit_residual?: number;
    region_id?: string;
    overlap_flag?: boolean;
    confidence?: number;
  }>;
  warnings: string[];
  processing?: Record<string, unknown>;
  qc?: FidQcBlock;
  integral_regions?: unknown[];
  multiplet_regions?: unknown[];
  processing_steps_detail?: FidPythonProcessingStep[];
  intensity_scale_mode?: string;
  intensity_raw_max_scale?: number;
  display?: Record<string, unknown>;
  ppm_axis_raw?: number[];
  ppm_axis_referenced?: number[];
  intensity_raw?: number[];
  intensity_processed?: number[];
}

export interface ObservedSpectrumEnvelope {
  readonly kind: 'observed_nmr_1d';
  modality: 'NMR';
  source: 'fid_pipeline';
  xUnit: 'ppm';
  yUnit: 'normalized_intensity';
  x: number[];
  y: number[];
  peaks: Array<{
    position: number;
    intensity?: number;
    area?: number;
    linewidth_estimate?: number;
    shape_model?: string;
    fit_residual?: number;
    region_id?: string;
    overlap_flag?: boolean;
    confidence?: number;
  }>;
  experiment_type?: '1H' | '13C' | string;
  default_display_range_ppm?: [number, number];
  current_scale_mode?: string;
  display_presets?: Array<{ id: string; label: string; min: number; max: number }>;
  metadata: Record<string, unknown>;
  provenance: {
    authority_tier: 'OBSERVED_PROCESSED_FID' | 'OBSERVED_PROCESSED';
    source_module: string;
    source_reason: string;
    generated_at_stage: string;
    is_authoritative_for_scoring: boolean;
    is_display_only: boolean;
    processing_stage: string;
    reference_status: string;
    phase_status: string;
    baseline_status: string;
    axis_status: string;
    datasetId?: string;
    detectedVendor?: string;
    debugId: string;
    processingSteps: Array<{ step: string; ok: boolean; detail?: string }>;
  };
  quality: {
    isEmpty: boolean;
    pointCount: number;
    axisMatched: boolean;
    lowConfidenceMetadata: boolean;
    overallStatus?: string;
    phaseNegEnergyRatio?: number;
    snrEstimate?: number | null;
    phaseFailedHeuristic?: boolean;
    intensityScaleMode?: string;
    hasMeaningfulSignal?: boolean;
    ppmAxisPlausible?: boolean;
    qc_rules?: FidQcRuleResult[];
    interpretation_blocked?: boolean;
    trace_completeness?: number;
    trace_span_ppm?: number;
  };
  displayDirection?: 'high_ppm_left';
  axis_fallback_applied?: boolean;
  axis_fallback_reason?: string;
  qc?: FidQcBlock;
  processing?: Record<string, unknown>;
}

export interface FidProcessApiEnvelope {
  success: boolean;
  status: FidPipelineStatus;
  error_code?: FidErrorCode | string;
  error_message?: string;
  user_hint?: string;
  debug_id: string;
  detected_format?: string;
  detected_experiment?: FormatDetectionResult;
  processing_steps: Array<{ step: string; ok: boolean; detail?: string }>;
  warnings: string[];
  /** @deprecated use observed_spectrum */
  data?: FidLegacyChartData;
  observed_spectrum?: ObservedSpectrumEnvelope;
  qc?: FidQcBlock;
  processing?: Record<string, unknown>;
  peak_list?: Array<{
    position: number;
    intensity?: number;
    area?: number;
    linewidth_estimate?: number;
    shape_model?: string;
    fit_residual?: number;
    region_id?: string;
    overlap_flag?: boolean;
    confidence?: number;
  }>;
  integral_regions?: unknown[];
  multiplet_regions?: unknown[];
  comparison?: unknown;
  stderr?: string;
  default_x_range_ppm?: [number, number];
  default_y_scale_mode?: string;
  display_presets?: Array<{ id: string; label: string; min: number; max: number }>;
  debug_export?: {
    observed_ppm: number[];
    observed_intensity: number[];
    applied_domain_ppm?: [number, number];
    applied_scale_mode?: string;
    reference_metadata?: Record<string, unknown>;
    top_detected_peaks: Array<{
      position: number;
      intensity?: number;
      area?: number;
      linewidth_estimate?: number;
      shape_model?: string;
      fit_residual?: number;
      region_id?: string;
      overlap_flag?: boolean;
      confidence?: number;
    }>;
    helper_peaks: Array<{
      position: number;
      intensity?: number;
      area?: number;
      linewidth_estimate?: number;
      shape_model?: string;
      fit_residual?: number;
      region_id?: string;
      overlap_flag?: boolean;
      confidence?: number;
    }>;
    provenance_report: {
      observed_authority_tier: string;
      helper_is_display_only: boolean;
      helper_is_authoritative_for_scoring: boolean;
    };
    processing_recipe_provenance?: {
      vendor_imported_processing: Record<string, unknown> | null;
      advised_preset_applied: string;
      user_overrides: Record<string, unknown>;
      final_processing_recipe: Record<string, unknown>;
      audit_hash: string;
    };
  };
}

function detectNucleusFromPayload(data: FidLegacyChartData): '1H' | '13C' {
  const raw = data.metadata?.nucleus ?? data.processing?.nucleus;
  const n = String(raw ?? '1H').toUpperCase();
  if (n === '13C' || n === 'C13' || n === 'BC') return '13C';
  return '1H';
}

/**
 * 1H profesyonel ilk gorunum: her zaman [14, 0] — tam spektral genislige OTOMATIK acilmaz
 * (MestReNova benzeri odak; aksi halde ~25..-5 penceresi kucuk pikleri eziyordu).
 * Yalnizca eksen belirsiz (ppm_uncertain / ppm_axis_plausible false) ise actual_ppm_range ile genis pencere.
 */
function computeDefaultXRange(data: FidLegacyChartData): [number, number] {
  if (detectNucleusFromPayload(data) === '13C') {
    return [...C13_PRO_FIRST_VIEW_PPM] as [number, number];
  }

  const axisUncertain =
    data.metadata?.axis_type === 'ppm_uncertain' ||
    data.qc?.ppm_axis_plausible === false;

  const range = data.metadata?.actual_ppm_range;
  if (axisUncertain && range && Array.isArray(range) && range.length === 2) {
    const [lo, hi] = range;
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
      const margin = (hi - lo) * 0.05 + 0.5;
      return [hi + margin, lo - margin];
    }
  }

  // Authoritative proton default contract (MestReNova parity): 14 -> -1 ppm.
  // Optional wide view (14 -> -2) is provided via presets/UI.
  return [...H1_PRO_FIRST_VIEW_PPM] as [number, number];
}

function buildObserved(
  data: FidLegacyChartData,
  ctx: {
    debugId: string;
    datasetId?: string;
    vendor?: string;
    steps: FidProcessApiEnvelope['processing_steps'];
  }
): ObservedSpectrumEnvelope {
  const axisRef = data.ppm_axis_referenced ?? [];
  const intensityProcessed = data.intensity_processed ?? [];
  const hasAuthoritativeTrace =
    axisRef.length > 0 &&
    intensityProcessed.length > 0 &&
    axisRef.length === intensityProcessed.length;
  const xTrace = hasAuthoritativeTrace ? axisRef : data.ppm;
  const yTrace = hasAuthoritativeTrace ? intensityProcessed : data.intensity;

  const axisMatched = xTrace.length === yTrace.length && xTrace.length > 0;
  const isEmpty = !axisMatched || xTrace.length === 0;
  const qc = data.qc;
  const scaleMode =
    data.intensity_scale_mode === 'global_max'
      ? 'GLOBAL_MAX'
      : data.intensity_scale_mode === 'authoritative_max'
        ? 'AUTHORITATIVE_MAX'
        : data.intensity_scale_mode === 'physical_auto'
          ? 'PHYSICAL_AUTO'
          : data.intensity_scale_mode === 'robust_p995'
            ? 'ROBUST_P995'
            : data.intensity_scale_mode === 'robust_p99'
              ? 'ROBUST_P99'
              : 'GLOBAL_MAX';
  const nucleus = detectNucleusFromPayload(data);
  const presets =
    nucleus === '13C'
      ? [{ id: 'C13_FULL', label: '13C tam (230->0)', min: 0, max: 230 }]
      : H1_DISPLAY_PRESETS.map((p) => ({
          id: p.id,
          label: p.label,
          min: p.min,
          max: p.max,
        }));

  const xRange = computeDefaultXRange({
    ...data,
    ppm: xTrace,
    intensity: yTrace,
  });
  const qcRules = computeObservedQcRules(data, nucleus);
  const interpretationBlocked = qcRules.some((r) => r.severity === 'fatal' && !r.passed);
  const observedRange = observedPpmRange(xTrace);
  const traceSpanPpm = observedRange ? observedRange.max - observedRange.min : 0;
  const traceCompleteness = hasAuthoritativeTrace ? 1 : axisMatched ? 0.5 : 0;

  return {
    kind: 'observed_nmr_1d',
    modality: 'NMR',
    source: 'fid_pipeline',
    xUnit: 'ppm',
    yUnit: 'normalized_intensity',
    x: xTrace,
    y: yTrace,
    peaks: (data.peaks || []).map((p) => ({
      position: p.ppm,
      intensity: p.height,
      area: p.area,
      linewidth_estimate: p.linewidth_estimate,
      shape_model: p.shape_model,
      fit_residual: p.fit_residual,
      region_id: p.region_id,
      overlap_flag: p.overlap_flag,
      confidence: p.confidence,
    })),
    metadata: {
      ...data.metadata,
      trace_source: hasAuthoritativeTrace ? 'authoritative_processed' : 'legacy_alias',
    },
    provenance: {
      authority_tier: 'OBSERVED_PROCESSED_FID',
      source_module: 'api/fid/process',
      source_reason: 'Observed FID processed by python authoritative pipeline',
      generated_at_stage: 'fid_pipeline_finalize',
      is_authoritative_for_scoring: true,
      is_display_only: false,
      processing_stage: 'observed_processed_spectrum',
      reference_status: String((data.processing as Record<string, unknown> | undefined)?.reference ? 'applied' : 'unknown'),
      phase_status: String((data.processing as Record<string, unknown> | undefined)?.phase ? 'applied' : 'unknown'),
      baseline_status: String((data.processing as Record<string, unknown> | undefined)?.baseline ? 'applied' : 'unknown'),
      axis_status: hasAuthoritativeTrace
        ? data.qc?.ppm_axis_plausible === false
          ? 'uncertain'
          : 'authoritative_referenced'
        : 'legacy_axis_fallback',
      datasetId: ctx.datasetId,
      detectedVendor: ctx.vendor,
      debugId: ctx.debugId,
      processingSteps: ctx.steps,
    },
    displayDirection: 'high_ppm_left',
    qc,
    processing: data.processing,
    experiment_type: nucleus,
    default_display_range_ppm: xRange,
    current_scale_mode: scaleMode,
    display_presets: presets,
    quality: {
      isEmpty,
      pointCount: xTrace.length,
      axisMatched,
      lowConfidenceMetadata:
        !data.metadata?.spectrometer_freq ||
        data.metadata.spectral_width <= 0 ||
        data.metadata.metadata_confidence === 'low',
      overallStatus: qc?.overall_status,
      phaseNegEnergyRatio: qc?.phase_neg_energy_ratio,
      snrEstimate: qc?.snr_estimate ?? undefined,
      phaseFailedHeuristic: qc?.phase_failed_heuristic,
      intensityScaleMode: data.intensity_scale_mode,
      hasMeaningfulSignal: qc?.has_meaningful_signal,
      ppmAxisPlausible: qc?.ppm_axis_plausible,
      qc_rules: qcRules,
      interpretation_blocked: interpretationBlocked,
      trace_completeness: traceCompleteness,
      trace_span_ppm: Number(traceSpanPpm.toFixed(5)),
    },
  };
}

function computeObservedQcRules(
  data: FidLegacyChartData,
  nucleus: '1H' | '13C'
): FidQcRuleResult[] {
  const processing = (data.processing as Record<string, unknown> | undefined) ?? {};
  const phaseObj = (processing.phase as Record<string, unknown> | undefined) ?? {};
  const baselineObj = (processing.baseline as Record<string, unknown> | undefined) ?? {};
  const referenceObj = (processing.reference as Record<string, unknown> | undefined) ?? {};
  const peaks = data.peaks || [];
  const total = Math.max(peaks.length, 1);
  const snr = Number(data.qc?.snr_estimate ?? 0);
  const phaseResidual = Number(data.qc?.phase_neg_energy_ratio ?? 0);
  const dynamicMax = Math.max(...data.intensity.map((v) => Math.abs(v)), 0);
  const dynamicP995 =
    data.intensity.length > 0
      ? [...data.intensity]
          .map((v) => Math.abs(v))
          .sort((a, b) => a - b)[Math.max(0, Math.floor(data.intensity.length * 0.995) - 1)] ?? 0
      : 0;
  const clippingRatio = dynamicMax > 0 ? dynamicP995 / dynamicMax : 1;
  const clippingFlag = data.qc?.clipping_flag;
  const clippingByAuthority = typeof clippingFlag === 'boolean' ? clippingFlag : null;
  // Diagnostic-only heuristic; authoritative clipping decision should come from backend qc.clipping_flag.
  const clippingHeuristicSuspicious = clippingRatio <= 0.08;
  const clippingSuspected = clippingByAuthority ?? clippingHeuristicSuspicious;
  const linewidths = peaks
    .map((p) => Number(p.linewidth_estimate ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0);
  const linewidthMedian =
    linewidths.length > 0
      ? linewidths.slice().sort((a, b) => a - b)[Math.floor(linewidths.length / 2)]
      : 0;
  const confidences = peaks
    .map((p) => Number(p.confidence ?? 0))
    .filter((v) => Number.isFinite(v));
  const meanConfidence =
    confidences.length > 0
      ? confidences.reduce((acc, v) => acc + v, 0) / confidences.length
      : 0;
  const processSteps = data.processing_steps_detail ?? [];
  const stepNames = new Set(processSteps.map((s) => s.step));

  const complexDataPresent =
    Number(data.metadata?.raw_fid_points ?? 0) > 0 ||
    Boolean(processing.group_delay_corrected) ||
    Boolean(processing.dc_removed);
  const zeroFillFactor = Number(processing.zero_fill_factor ?? (processing.zero_fill as Record<string, unknown> | undefined)?.factor ?? 1);
  const apodizationDeclared =
    Boolean(processing.apodization_declared) ||
    Boolean((processing.apodization as Record<string, unknown> | undefined)?.applied);
  const fftApplied =
    Boolean(processing.fft_applied) ||
    stepNames.has('fft_positive') ||
    stepNames.has('py_fft_positive');
  const baselineFlatnessOk = phaseResidual <= 0.55 && data.qc?.baseline_uncertain !== true;
  const refStatus = String(referenceObj.status ?? 'unknown').toLowerCase();
  const referenceAligned =
    !refStatus.includes('none') &&
    !refStatus.includes('no_peak') &&
    !refStatus.includes('shift_too_large');
  const solventArtifactFlag =
    peaks.filter((p) => p.ppm >= 7.0 && p.ppm <= 7.4).length > Math.max(4, Math.floor(total * 0.5));
  const reproduciblePeakPicking =
    peaks.length > 0 && meanConfidence >= 0.3 && processSteps.some((s) => s.step.includes('peak') || s.step.includes('pick'));
  const traceComplete =
    complexDataPresent &&
    apodizationDeclared &&
    fftApplied &&
    Boolean(phaseObj.method) &&
    Boolean(baselineObj.method) &&
    Boolean(referenceObj.status);
  const processedFromRawOrImported =
    complexDataPresent || Boolean((processing.vendor_imported_processing as Record<string, unknown> | undefined)?.vendor);

  const rules: FidQcRuleResult[] = [
    {
      id: 'OBS_FID_COMPLEX_DATA_PRESENT',
      passed: complexDataPresent,
      severity: 'fatal',
      message: complexDataPresent ? 'Ham kompleks FID izi doğrulandı.' : 'Ham kompleks FID izi doğrulanamadı.',
      value: complexDataPresent,
    },
    {
      id: 'OBS_ZERO_FILL_FACTOR_MIN',
      passed: Number.isFinite(zeroFillFactor) && zeroFillFactor >= 2,
      severity: 'fatal',
      message:
        Number.isFinite(zeroFillFactor) && zeroFillFactor >= 2
          ? 'Zero-fill faktörü minimum eşiği karşılıyor.'
          : 'Zero-fill faktörü minimum eşiğin altında.',
      value: zeroFillFactor,
    },
    {
      id: 'OBS_APODIZATION_DECLARED',
      passed: apodizationDeclared,
      severity: 'fatal',
      message: apodizationDeclared ? 'Apodization adımı beyan edildi.' : 'Apodization adımı eksik.',
      value: apodizationDeclared,
    },
    {
      id: 'OBS_FOURIER_TRANSFORM_APPLIED',
      passed: fftApplied,
      severity: 'fatal',
      message: fftApplied ? 'Fourier transform adımı doğrulandı.' : 'Fourier transform adımı doğrulanamadı.',
      value: fftApplied,
    },
    {
      id: 'OBS_PHASE_CORRECTION_RESIDUAL_MIN',
      passed: Number.isFinite(phaseResidual) && phaseResidual <= 0.65,
      severity: 'fatal',
      message:
        Number.isFinite(phaseResidual) && phaseResidual <= 0.65
          ? 'Phase residual kabul edilebilir sınırda.'
          : 'Phase residual yüksek; gözlenen spektrum dispersif olabilir.',
      value: Number(phaseResidual.toFixed(4)),
    },
    {
      id: 'OBS_BASELINE_FLATNESS_MAX',
      passed: baselineFlatnessOk,
      severity: 'fatal',
      message: baselineFlatnessOk ? 'Baseline düzlüğü kabul edilebilir.' : 'Baseline düzlüğü yetersiz.',
      value: baselineFlatnessOk,
    },
    {
      id: 'OBS_REFERENCE_ALIGNMENT_WITH_STANDARD',
      passed: referenceAligned,
      severity: 'fatal',
      message: referenceAligned ? 'Referans kilidi standartla hizalı.' : 'Referans kilidi standartla hizalı değil.',
      value: refStatus,
    },
    {
      id: 'OBS_LINEWIDTH_QC_WITHIN_EXPECTED',
      passed: linewidthMedian === 0 || (linewidthMedian >= 0.001 && linewidthMedian <= 0.2),
      severity: 'warn',
      message:
        linewidthMedian === 0 || (linewidthMedian >= 0.001 && linewidthMedian <= 0.2)
          ? 'Linewidth dağılımı beklenen aralıkta.'
          : 'Linewidth dağılımı beklenen aralığın dışında.',
      value: Number(linewidthMedian.toFixed(5)),
    },
    {
      id: 'OBS_SNR_MIN_FOR_ASSIGNMENT',
      passed: Number.isFinite(snr) && snr >= 3,
      severity: 'fatal',
      message: Number.isFinite(snr) && snr >= 3 ? 'SNR assignment için yeterli.' : 'SNR assignment için yetersiz.',
      value: Number.isFinite(snr) ? Number(snr.toFixed(3)) : snr,
    },
    {
      id: 'OBS_DYNAMIC_RANGE_NOT_CLIPPED',
      passed: !clippingSuspected,
      severity: 'warn',
      message: !clippingSuspected
        ? 'Dinamik aralık clipping göstermiyor.'
        : 'Dinamik aralık clipping şüphesi var (uyarı).',
      value: {
        ratio_p995_to_max: Number(clippingRatio.toFixed(4)),
        clipping_flag_authoritative: clippingByAuthority,
      },
    },
    {
      id: 'OBS_SOLVENT_SUPPRESSION_ARTIFACT_FLAG',
      passed: !solventArtifactFlag,
      severity: 'warn',
      message: solventArtifactFlag ? 'Çözücü bastırma artifaktı şüphesi var.' : 'Belirgin çözücü artifaktı tespit edilmedi.',
      value: solventArtifactFlag,
    },
    {
      id: 'OBS_PEAK_PICKING_REPRODUCIBILITY',
      passed: reproduciblePeakPicking,
      severity: 'warn',
      message: reproduciblePeakPicking ? 'Peak picking tekrarlanabilirlik metriği kabul edilebilir.' : 'Peak picking tekrarlanabilirliği düşük güven.',
      value: Number(meanConfidence.toFixed(4)),
    },
    {
      id: 'OBS_QC_TRACE_COMPLETE',
      passed: traceComplete,
      severity: 'fatal',
      message: traceComplete ? 'QC trace zinciri tam.' : 'QC trace zinciri eksik.',
      value: traceComplete,
    },
    {
      id: 'OBS_PROCESSED_FROM_RAW_OR_DECLARED_IMPORT',
      passed: processedFromRawOrImported,
      severity: 'fatal',
      message: processedFromRawOrImported
        ? 'Observed spektrum ham FID veya beyanlı importtan üretildi.'
        : 'Observed spektrum kaynağı doğrulanamadı.',
      value: processedFromRawOrImported,
    },
  ];

  if (nucleus !== '1H') {
    const hasFatalFail = rules.some((r) => r.severity === 'fatal' && !r.passed);
    rules.push({
      id: 'INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL',
      passed: !hasFatalFail,
      severity: 'fatal',
      message: hasFatalFail
        ? 'Observed QC fail nedeniyle interpretation bloklandı.'
        : 'Observed QC uygun; interpretation serbest.',
      value: hasFatalFail,
    });
    return rules;
  }

  const inRange = (lo: number, hi: number) =>
    peaks.filter((p) => p.ppm >= lo && p.ppm <= hi);
  const aromatic = inRange(6.0, 9.5);
  const aliphatic = inRange(0.6, 2.5);
  const aliphaticRatio = aliphatic.length / total;

  const overfragmentationScore = peaks.reduce((acc, p) => {
    return acc + ((p.width_points ?? 0) < 2.2 && (p.confidence ?? 0) < 0.55 ? 1 : 0);
  }, 0);
  const overfragmentationRatio = overfragmentationScore / total;

  const phaseApplied = Boolean(
    (data.processing as Record<string, unknown> | undefined)?.phase
  );
  const baselineApplied = Boolean(
    (data.processing as Record<string, unknown> | undefined)?.baseline
  );
  const helperContamination = false;

  rules.push(
    {
      id: 'OBSERVED_H1_REGION_VISIBILITY_REQUIRED',
      passed: aromatic.length > 0 && aliphatic.length > 0,
      severity: 'fatal',
      message:
        aromatic.length > 0 && aliphatic.length > 0
          ? 'Observed pikler aromatik/downfield ve alifatik bölgeleri kapsıyor.'
          : 'Observed 1H region visibility eksik: aromatik/downfield veya alifatik pencere boş.',
      value: `aromatic=${aromatic.length},aliphatic=${aliphatic.length}`,
    },
    {
      id: 'OBSERVED_H1_PEAK_DISTRIBUTION_COLLAPSE_WARN',
      passed: aliphaticRatio <= 0.85,
      severity: 'warn',
      message:
        aliphaticRatio <= 0.85
          ? 'Peak dağılımı kabul edilebilir.'
          : 'Peak dağılımı alifatik bölgede aşırı yığılmış görünüyor.',
      value: Number(aliphaticRatio.toFixed(3)),
    },
    {
      id: 'OBSERVED_H1_MULTIPLET_OVERFRAGMENTATION_WARN',
      passed: overfragmentationRatio <= 0.45,
      severity: 'warn',
      message:
        overfragmentationRatio <= 0.45
          ? 'Over-fragmentation metriği kabul edilebilir.'
          : 'Gözlenen pik tablosunda over-fragmentation riski yüksek.',
      value: Number(overfragmentationRatio.toFixed(3)),
    },
    {
      id: 'OBSERVED_H1_REFERENCE_LOCK_REQUIRED',
      passed:
        !refStatus.includes('none') &&
        !refStatus.includes('no_peak') &&
        !refStatus.includes('shift_too_large'),
      severity: 'fatal',
      message:
        !refStatus.includes('none') &&
        !refStatus.includes('no_peak') &&
        !refStatus.includes('shift_too_large')
          ? 'Referans kilidi uygulanmış.'
          : 'Referans kilidi başarısız veya belirsiz.',
      value: refStatus,
    },
    {
      id: 'OBSERVED_H1_PHASE_BASELINE_PROVENANCE_REQUIRED',
      passed: phaseApplied && baselineApplied && data.qc?.phase_failed_heuristic !== true,
      severity: 'fatal',
      message:
        phaseApplied && baselineApplied && data.qc?.phase_failed_heuristic !== true
          ? 'Phase/baseline provenance doğrulandı.'
          : 'Phase/baseline provenance eksik veya düşük güven.',
      value: phaseApplied && baselineApplied,
    },
    {
      id: 'OBSERVED_H1_HELPER_CONTAMINATION_FATAL',
      passed: !helperContamination,
      severity: 'fatal',
      message: helperContamination
        ? 'Observed kararları helper/simulated katmanla kontamine görünüyor.'
        : 'Helper contamination tespit edilmedi.',
      value: helperContamination,
    },
  );

  const hasFatalFail = rules.some((r) => r.severity === 'fatal' && !r.passed);
  rules.push({
    id: 'INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL',
    passed: !hasFatalFail,
    severity: 'fatal',
    message: hasFatalFail
      ? 'Observed QC fail nedeniyle interpretation bloklandı.'
      : 'Observed QC uygun; interpretation serbest.',
    value: hasFatalFail,
  });

  return rules;
}

export function finalizeFidSuccess(args: {
  data: FidLegacyChartData;
  comparison?: unknown;
  datasetId?: string;
  vendor?: string;
  pathGuess?: FormatDetectionResult;
  debugId: string;
  processing_steps: FidProcessApiEnvelope['processing_steps'];
}): FidProcessApiEnvelope {
  const warnings = [...(args.data.warnings || [])];
  const steps = [...args.processing_steps];
  const pyTrace = args.data.processing_steps_detail;
  if (pyTrace?.length) {
    for (const s of pyTrace) {
      steps.push({
        step: `py_${s.step}`,
        ok: s.ok,
        detail: s.detail,
      });
    }
  }

  if (args.pathGuess?.dimensionHint === '2D') {
    warnings.push(
      'Klasorde pdata/ veya 2D ipuclari var; pipeline su an 1D gosterim uretir. 2D tam destek planli.'
    );
  }

  const qcSt = args.data.qc?.overall_status;
  if (qcSt === 'PARTIAL_LOW_CONFIDENCE') {
    warnings.push(
      'QC: dusuk guven -- faz, taban cizgisi veya SNR supheli; sonuclari dikkatle yorumlayin.'
    );
  } else if (qcSt === 'SUCCESS_MEDIUM_CONFIDENCE') {
    warnings.push('QC: orta guven -- metadata veya faz iyilestirmesi gerekebilir.');
  }
  if (args.data.qc?.phase_failed_heuristic) {
    warnings.push('Faz QC: spektrum hala kismen dispersif olabilir; manuel ph0/ph1 deneyin.');
  }
  if (args.data.qc?.has_meaningful_signal === false) {
    warnings.push('FLAT_SIGNAL: Islennis spektrumda anlamli sinyal tespit edilemedi.');
  }
  if (args.data.qc?.ppm_axis_plausible === false) {
    warnings.push('AXIS_UNCERTAIN: PPM ekseni sacma gorunuyor; referans kalibrasyonu kontrol edilmeli.');
  }
  if (
    args.data.qc?.overall_status === 'SUCCESS_HIGH_CONFIDENCE' &&
    (args.data.metadata?.axis_type === 'ppm_uncertain' ||
      args.data.qc?.ppm_axis_plausible === false)
  ) {
    warnings.push(
      'QC: SUCCESS_HIGH_CONFIDENCE ile eksen belirsizligi birlikte; yuksek guven mesajini dikkatle yorumlayin.'
    );
  }

  let status: FidPipelineStatus = 'ok';
  let success = true;
  let error_code: FidErrorCode | undefined;
  let error_message: string | undefined;

  const n = args.data.ppm?.length ?? 0;
  const m = args.data.intensity?.length ?? 0;
  if (n === 0 || m === 0 || n !== m) {
    success = false;
    status = 'validation_failed';
    error_code = n !== m ? FidErrorCodes.AXIS_MISMATCH : FidErrorCodes.EMPTY_SPECTRUM;
    error_message =
      n !== m
        ? `ppm (${n}) ve intensity (${m}) uzunluklari eslesmiyor.`
        : 'Islenmis spektrum bos; ham veri veya metadata supheli.';
    steps.push({ step: 'validate_spectrum_arrays', ok: false, detail: error_message });
  } else {
    // NaN/Infinity sanitization at TS level
    let nanCount = 0;
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(args.data.ppm[i])) {
        args.data.ppm[i] = 0;
        nanCount++;
      }
      if (!Number.isFinite(args.data.intensity[i])) {
        args.data.intensity[i] = 0;
        nanCount++;
      }
    }
    if (nanCount > 0) {
      warnings.push(`${nanCount} NaN/Infinity deger sifira donusturuldu.`);
      steps.push({ step: 'nan_sanitize', ok: true, detail: `${nanCount} values` });
    }
    steps.push({ step: 'validate_spectrum_arrays', ok: true });
  }

  const observed_spectrum = success
    ? buildObserved(args.data, {
        debugId: args.debugId,
        datasetId: args.datasetId,
        vendor: args.vendor,
        steps,
      })
    : undefined;

  const peak_list = success
    ? (args.data.peaks || []).map((p) => ({
        position: p.ppm,
        intensity: p.height,
        area: p.area,
        linewidth_estimate: p.linewidth_estimate,
        shape_model: p.shape_model,
        fit_residual: p.fit_residual,
        region_id: p.region_id,
        overlap_flag: p.overlap_flag,
        confidence: p.confidence,
      }))
    : undefined;

  const nucleus = detectNucleusFromPayload(args.data);
  const display_presets = success
    ? nucleus === '13C'
      ? [{ id: 'C13_FULL', label: '13C tam (230->0)', min: 0, max: 230 }]
      : H1_DISPLAY_PRESETS.map((p) => ({ id: p.id, label: p.label, min: p.min, max: p.max }))
    : undefined;

  const defaultXRange = success ? computeDefaultXRange(args.data) : undefined;
  const qcRules = observed_spectrum?.quality?.qc_rules ?? [];
  const failedRuleIds = qcRules.filter((r) => !r.passed).map((r) => r.id);
  if (failedRuleIds.length > 0) {
    warnings.push(`OBSERVED_QC_RULE_FAIL: ${failedRuleIds.join(', ')}`);
  }
  const debugExport =
    success && observed_spectrum
      ? {
          observed_ppm: observed_spectrum.x,
          observed_intensity: observed_spectrum.y,
          applied_domain_ppm: observed_spectrum.default_display_range_ppm,
          applied_scale_mode: observed_spectrum.current_scale_mode,
          reference_metadata:
            (args.data.processing as Record<string, unknown> | undefined)?.reference as
              | Record<string, unknown>
              | undefined,
          top_detected_peaks: peak_list?.slice(0, 64) || [],
          helper_peaks: [],
          provenance_report: {
            observed_authority_tier: observed_spectrum.provenance.authority_tier,
            helper_is_display_only: true,
            helper_is_authoritative_for_scoring: false,
          },
          processing_recipe_provenance: (() => {
            const p = (args.data.processing as Record<string, unknown> | undefined) ?? {};
            const advised = p.advised_preset_applied;
            const userOverrides = p.user_overrides;
            const finalRecipe = p.final_processing_recipe;
            const audit = p.audit_hash;
            if (
              typeof advised !== 'string' ||
              typeof audit !== 'string' ||
              !userOverrides ||
              typeof userOverrides !== 'object' ||
              !finalRecipe ||
              typeof finalRecipe !== 'object'
            ) {
              return undefined;
            }
            return {
              vendor_imported_processing:
                (p.vendor_imported_processing as Record<string, unknown> | null) ?? null,
              advised_preset_applied: advised,
              user_overrides: userOverrides as Record<string, unknown>,
              final_processing_recipe: finalRecipe as Record<string, unknown>,
              audit_hash: audit,
            };
          })(),
        }
      : undefined;

  return {
    success,
    status: success ? 'ok' : status,
    error_code,
    error_message,
    user_hint: error_code ? hintForCode(error_code) : undefined,
    debug_id: args.debugId,
    detected_format: args.vendor,
    detected_experiment: args.pathGuess,
    processing_steps: steps,
    warnings,
    data: success ? args.data : undefined,
    observed_spectrum,
    qc: success ? args.data.qc : undefined,
    processing: success ? args.data.processing : undefined,
    peak_list,
    integral_regions: success ? args.data.integral_regions : undefined,
    multiplet_regions: success ? args.data.multiplet_regions : undefined,
    comparison: success ? args.comparison : undefined,
    default_x_range_ppm: defaultXRange,
    default_y_scale_mode: success ? 'GLOBAL_MAX' : undefined,
    display_presets,
    debug_export: debugExport,
  };
}

export function finalizeFidFailure(args: {
  error_message: string;
  error_code?: FidErrorCode | string;
  debugId: string;
  processing_steps: FidProcessApiEnvelope['processing_steps'];
  stderr?: string;
  pathGuess?: FormatDetectionResult;
}): FidProcessApiEnvelope {
  const code = args.error_code || FidErrorCodes.PYTHON_EXIT;
  return {
    success: false,
    status: 'error',
    error_code: code,
    error_message: args.error_message,
    user_hint: hintForCode(code),
    debug_id: args.debugId,
    detected_experiment: args.pathGuess,
    processing_steps: args.processing_steps,
    warnings: [],
    stderr: args.stderr,
  };
}
