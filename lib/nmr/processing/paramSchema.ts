import type { ProcessingStep } from '@/lib/core/models/NormalizedDataset';

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Canonical processing param normalization used by both UI and executors.
 * This prevents panel/executor naming drift (type/lb vs window/lbHz, etc.).
 */
export function normalizeProcessingParams(
  kind: ProcessingStep['kind'],
  params: Record<string, unknown>
): Record<string, unknown> {
  switch (kind) {
    case 'apodization': {
      const uiType = (params.type as string | undefined) ?? (params.window as string | undefined);
      const window =
        uiType === 'exponential' ? 'exp' :
        uiType === 'gaussian' ? 'gauss' :
        uiType ?? 'exp';
      const lbHz = asNumber(params.lbHz ?? params.lb ?? params.lb_hz, 0.5);
      const gbHz = asNumber(params.gbHz ?? params.gb, 0.3);
      const phase = asNumber(params.phase, 0);
      return { ...params, window, lbHz, gbHz, phase };
    }
    case 'phase': {
      const ph0 = asNumber(params.ph0 ?? params.ph0_deg, 0);
      const ph1 = asNumber(params.ph1 ?? params.ph1_deg, 0);
      const modeRaw = String(params.mode ?? 'auto_entropy').toLowerCase();
      const mode =
        modeRaw === 'manual' || modeRaw === 'manual_ph0_ph1'
          ? 'manual_ph0_ph1'
          : modeRaw === 'regions_analysis'
            ? 'regions_analysis'
            : 'auto_entropy';
      const manual = mode === 'manual_ph0_ph1';
      return { ...params, ph0, ph1, mode, manual, ph0_deg: ph0, ph1_deg: ph1 };
    }
    case 'baseline': {
      const algorithm =
        (params.algorithm as string | undefined) ??
        (params.method as string | undefined) ??
        'xi_rocke_ps';
      return { ...params, algorithm };
    }
    case 'reference': {
      const target_ppm = asNumber(params.ppm ?? params.target_ppm ?? params.reference_ppm, 0);
      const method = String(params.method ?? 'solvent').toLowerCase();
      const solvent = String(params.solvent ?? 'CDCl3');
      const standard = String(params.standard ?? method);
      const confidence = String(params.confidence ?? 'medium').toLowerCase();
      return { ...params, ppm: target_ppm, target_ppm, method, solvent, standard, confidence };
    }
    default:
      return params;
  }
}

