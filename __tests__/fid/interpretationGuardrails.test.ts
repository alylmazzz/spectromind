import { describe, expect, it } from 'vitest';
import { applyObservedQcGuardrails } from '@/lib/fid/interpretationGuardrails';
import type { AIAnalysisResult } from '@/lib/types';

const baseResult: AIAnalysisResult = {
  moleculeName: 'Test Molecule',
  formula: 'C10H10',
  confidence: 92,
  reasoning: 'Base interpretation',
  alternatives: [
    { moleculeName: 'Alt 1', confidence: 88 },
    { moleculeName: 'Alt 2', confidence: 72 },
  ],
};

describe('applyObservedQcGuardrails', () => {
  it('observed QC fail durumunda confidence düşürür', () => {
    const out = applyObservedQcGuardrails(baseResult, {
      interpretationBlocked: false,
      qcRules: [
        { id: 'OBSERVED_H1_PEAK_DISTRIBUTION_COLLAPSE_WARN', passed: false, severity: 'warn', message: 'warn' },
      ],
    });

    expect(out.blocked).toBe(false);
    expect(out.adjustedResult.confidence).toBeLessThan(baseResult.confidence);
    expect(out.adjustedResult.reasoning).toContain('Observed QC Guardrail');
  });

  it('helper contamination fail durumunda yorumu bloklar ve confidence cap uygular', () => {
    const out = applyObservedQcGuardrails(baseResult, {
      interpretationBlocked: false,
      qcRules: [
        { id: 'OBSERVED_H1_HELPER_CONTAMINATION_FATAL', passed: false, severity: 'fatal', message: 'fatal' },
      ],
    });

    expect(out.blocked).toBe(true);
    expect(out.adjustedResult.confidence).toBeLessThanOrEqual(35);
    expect(out.adjustedResult.alternatives?.every((a) => a.confidence <= 40)).toBe(true);
  });

  it('phase/baseline + reference fail kombinasyonunda ek güven düşümü uygular', () => {
    const out = applyObservedQcGuardrails(baseResult, {
      interpretationBlocked: false,
      qcRules: [
        { id: 'OBSERVED_H1_REFERENCE_LOCK_REQUIRED', passed: false, severity: 'fatal', message: 'ref' },
        { id: 'OBS_PHASE_BASELINE_CHAIN_COMPLETE', passed: false, severity: 'fatal', message: 'phase' },
      ],
    });

    expect(out.adjustedResult.confidence).toBeLessThan(70);
    expect(out.notes.join(' ')).toContain('ppm-tabanlı');
    expect(out.notes.join(' ')).toContain('multiplicity/integral');
  });
});
