import { createHash } from 'crypto';

export type FidProcessingPresetId =
  | '1H_standard'
  | '13C_standard'
  | '1H_mnova_parity'
  | '13C_mnova_parity'
  | 'custom';

export interface FidProcessingRecipe {
  preset_id: FidProcessingPresetId;
  nucleus: '1H' | '13C' | 'unknown';
  apodization: { window: 'exp' | 'gauss'; lb_hz: number };
  zero_fill: { factor: number };
  phase: {
    mode: 'auto_entropy' | 'regions_analysis' | 'manual_ph0_ph1';
    method?: string;
    ph0_deg?: number;
    ph1_deg?: number;
  };
  baseline: {
    method: 'xi_rocke_ps' | 'asls' | 'polynomial' | 'bernstein_polynomial_fit' | 'whittaker_smoother';
  };
  reference: { strategy: 'solvent' | 'manual' | 'tms'; target_ppm?: number };
}

export interface FidRecipeProvenance {
  vendor_imported_processing: Record<string, unknown> | null;
  advised_preset_applied: FidProcessingPresetId;
  user_overrides: Record<string, unknown>;
  final_processing_recipe: FidProcessingRecipe;
  audit_hash: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function buildRecipeAuditHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function getPresetForNucleus(nucleus: FidProcessingRecipe['nucleus']): FidProcessingRecipe {
  if (nucleus === '13C') {
    return {
      preset_id: '13C_standard',
      nucleus,
      apodization: { window: 'exp', lb_hz: 0.8 },
      zero_fill: { factor: 2 },
      phase: { mode: 'regions_analysis', method: 'regions_analysis' },
      baseline: { method: 'xi_rocke_ps' },
      reference: { strategy: 'solvent', target_ppm: 0 },
    };
  }
  return {
    preset_id: '1H_standard',
    nucleus: '1H',
    apodization: { window: 'exp', lb_hz: 0.3 },
    zero_fill: { factor: 2 },
    phase: { mode: 'auto_entropy', method: 'auto_entropy' },
    baseline: { method: 'xi_rocke_ps' },
    reference: { strategy: 'solvent', target_ppm: 0 },
  };
}

export function buildRecipeProvenance(args: {
  nucleus?: string;
  processingSpecRaw?: string | null;
  vendorImportedProcessing?: Record<string, unknown> | null;
}): FidRecipeProvenance {
  const nucleusRaw = String(args.nucleus ?? '1H').toUpperCase();
  const nucleus: FidProcessingRecipe['nucleus'] =
    nucleusRaw === '13C' || nucleusRaw === 'C13'
      ? '13C'
      : nucleusRaw === '1H'
          ? '1H'
          : 'unknown';

  const preset = getPresetForNucleus(nucleus === 'unknown' ? '1H' : nucleus);
  let userOverrides: Record<string, unknown> = {};
  if (args.processingSpecRaw) {
    try {
      userOverrides = JSON.parse(args.processingSpecRaw) as Record<string, unknown>;
    } catch {
      userOverrides = { parse_error: true };
    }
  }

  const requestedPreset = String(userOverrides.preset_id ?? '').trim() as FidProcessingPresetId;
  const overridePreset =
    requestedPreset === '1H_standard' ||
    requestedPreset === '13C_standard' ||
    requestedPreset === '1H_mnova_parity' ||
    requestedPreset === '13C_mnova_parity' ||
    requestedPreset === 'custom'
      ? requestedPreset
      : preset.preset_id;

  const finalRecipe: FidProcessingRecipe = {
    ...preset,
    preset_id: overridePreset,
    apodization: {
      ...preset.apodization,
      lb_hz:
        typeof userOverrides?.apodization === 'object' &&
        userOverrides.apodization &&
        typeof (userOverrides.apodization as Record<string, unknown>).lb_hz === 'number'
          ? Number((userOverrides.apodization as Record<string, unknown>).lb_hz)
          : preset.apodization.lb_hz,
    },
    zero_fill: {
      ...preset.zero_fill,
      factor:
        typeof userOverrides?.zeroFill === 'object' &&
        userOverrides.zeroFill &&
        typeof (userOverrides.zeroFill as Record<string, unknown>).factor === 'number'
          ? Number((userOverrides.zeroFill as Record<string, unknown>).factor)
          : preset.zero_fill.factor,
    },
    baseline: {
      ...preset.baseline,
      method:
        typeof userOverrides?.baseline === 'object' &&
        userOverrides.baseline &&
        typeof (userOverrides.baseline as Record<string, unknown>).algorithm === 'string'
          ? (String((userOverrides.baseline as Record<string, unknown>).algorithm) as FidProcessingRecipe['baseline']['method'])
          : preset.baseline.method,
    },
  };

  const provenanceCore = {
    vendor_imported_processing: args.vendorImportedProcessing ?? null,
    advised_preset_applied: finalRecipe.preset_id,
    user_overrides: userOverrides,
    final_processing_recipe: finalRecipe,
  };

  return {
    ...provenanceCore,
    audit_hash: buildRecipeAuditHash(provenanceCore),
  };
}
