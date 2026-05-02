import { describe, expect, it } from 'vitest';
import { buildRecipeProvenance } from '@/lib/fid/processingPresets';

describe('buildRecipeProvenance', () => {
  it('applies 1H advised preset by default', () => {
    const result = buildRecipeProvenance({
      nucleus: '1H',
      processingSpecRaw: null,
      vendorImportedProcessing: null,
    });

    expect(result.advised_preset_applied).toBe('1H_standard');
    expect(result.final_processing_recipe.preset_id).toBe('1H_standard');
    expect(result.final_processing_recipe.apodization.lb_hz).toBe(0.3);
    expect(result.final_processing_recipe.baseline.method).toBe('xi_rocke_ps');
    expect(result.audit_hash.length).toBe(64);
  });

  it('maps 13C nucleus to 13C advised preset', () => {
    const result = buildRecipeProvenance({
      nucleus: '13C',
      processingSpecRaw: null,
      vendorImportedProcessing: null,
    });

    expect(result.advised_preset_applied).toBe('13C_standard');
    expect(result.final_processing_recipe.preset_id).toBe('13C_standard');
    expect(result.final_processing_recipe.apodization.lb_hz).toBe(0.8);
    expect(result.final_processing_recipe.baseline.method).toBe('xi_rocke_ps');
  });

  it('merges user overrides and keeps deterministic hash', () => {
    const processingSpecRaw = JSON.stringify({
      apodization: { lb_hz: 1.2 },
      zeroFill: { factor: 4 },
      baseline: { algorithm: 'asls' },
    });

    const a = buildRecipeProvenance({
      nucleus: '1H',
      processingSpecRaw,
      vendorImportedProcessing: null,
    });
    const b = buildRecipeProvenance({
      nucleus: '1H',
      processingSpecRaw,
      vendorImportedProcessing: null,
    });

    expect(a.final_processing_recipe.apodization.lb_hz).toBe(1.2);
    expect(a.final_processing_recipe.zero_fill.factor).toBe(4);
    expect(a.final_processing_recipe.baseline.method).toBe('asls');
    expect(a.audit_hash).toBe(b.audit_hash);
  });
});
