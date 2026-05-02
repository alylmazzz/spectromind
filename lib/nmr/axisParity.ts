import { C13_PRO_FIRST_VIEW_PPM, H1_PRO_FIRST_VIEW_PPM, observedPpmRange, smartInitialXDomain, validatePpmAxis } from '@/lib/nmr/nmrChartScaling';

export interface AxisParityResolution {
  domain: { min: number; max: number };
  source: 'processed_axis' | 'metadata_default' | 'safe_fallback';
  warning: string | null;
}

type Nucleus = '1H' | '13C';

function fallbackDomainForExperiment(experimentType: Nucleus): { min: number; max: number } {
  if (experimentType === '13C') {
    return { min: C13_PRO_FIRST_VIEW_PPM[1], max: C13_PRO_FIRST_VIEW_PPM[0] };
  }
  return { min: H1_PRO_FIRST_VIEW_PPM[1], max: H1_PRO_FIRST_VIEW_PPM[0] };
}

function domainFromDefaultPpm(pair: [number, number] | undefined, experimentType: Nucleus): { min: number; max: number } {
  if (!pair || pair.length !== 2) return fallbackDomainForExperiment(experimentType);
  const a = pair[0];
  const b = pair[1];
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

export function resolveAuthoritativeAxisDomain(params: {
  ppm?: number[] | null;
  experimentType?: string | null;
  defaultXPpm?: [number, number] | number[] | undefined;
  axisFallbackApplied?: boolean;
  axisFallbackReason?: string;
}): AxisParityResolution {
  const experimentType: Nucleus = params.experimentType === '13C' ? '13C' : '1H';
  const fallbackDomain = fallbackDomainForExperiment(experimentType);
  const defaultDomain = domainFromDefaultPpm(
    Array.isArray(params.defaultXPpm) && params.defaultXPpm.length === 2
      ? [Number(params.defaultXPpm[0]), Number(params.defaultXPpm[1])]
      : undefined,
    experimentType
  );
  const ppm = Array.isArray(params.ppm) ? params.ppm : [];
  if (!ppm.length) {
    return { domain: defaultDomain, source: 'metadata_default', warning: null };
  }

  const validation = validatePpmAxis(ppm, experimentType);
  if (!validation.plausible || params.axisFallbackApplied) {
    const reason = params.axisFallbackReason || validation.reason || 'processed ppm axis unavailable';
    const smart = smartInitialXDomain(observedPpmRange(ppm), fallbackDomain);
    return {
      domain: { min: smart.min, max: smart.max },
      source: 'safe_fallback',
      warning: `Axis fallback applied - ${reason}`,
    };
  }

  return { domain: defaultDomain, source: 'processed_axis', warning: null };
}
