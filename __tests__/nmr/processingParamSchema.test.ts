import { describe, expect, it } from 'vitest';
import { normalizeProcessingParams } from '@/lib/nmr/processing/paramSchema';

describe('normalizeProcessingParams', () => {
  it('maps apodization UI aliases to canonical executor keys', () => {
    const out = normalizeProcessingParams('apodization', { type: 'exponential', lb: 0.7, gb: 0.2 });
    expect(out.window).toBe('exp');
    expect(out.lbHz).toBe(0.7);
    expect(out.gbHz).toBe(0.2);
  });

  it('maps baseline method to algorithm', () => {
    const out = normalizeProcessingParams('baseline', { method: 'polynomial', degree: 7 });
    expect(out.algorithm).toBe('polynomial');
    expect(out.degree).toBe(7);
  });

  it('maps reference target_ppm to ppm', () => {
    const out = normalizeProcessingParams('reference', { target_ppm: 7.26 });
    expect(out.ppm).toBe(7.26);
  });

  it('maps phase ph0_deg/ph1_deg to canonical ph0/ph1', () => {
    const out = normalizeProcessingParams('phase', { ph0_deg: 15, ph1_deg: -2 });
    expect(out.ph0).toBe(15);
    expect(out.ph1).toBe(-2);
  });
});

