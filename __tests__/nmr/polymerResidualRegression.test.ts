import { describe, expect, it } from 'vitest';
import type { NMRPeak } from '@/lib/types';
import { classifyNmrInterpretationSummary } from '@/lib/hooks/useSpectralAnalysis';

const basePeak = (shift: number, integ = 1, mult = 'm'): NMRPeak => ({ shift, integ, mult });

describe('polymer/residual regression guards', () => {
  it('detects pyridine/chloroform overlap as residual-first', () => {
    const peaks = [basePeak(8.71), basePeak(7.57), basePeak(7.26), basePeak(2.1)];
    const summary = classifyNmrInterpretationSummary(peaks, 'Pyridine-d5', false, []);
    expect(summary.solvent_candidates.length).toBeGreaterThanOrEqual(2);
    expect(summary.next_best_actions.join(' ')).toMatch(/Residual mask/i);
  });

  it('prevents single aromatic impurity from dominating interpretation', () => {
    const peaks = [basePeak(7.5, 0.2), basePeak(2.04, 2.1), basePeak(3.2), basePeak(5.0)];
    const summary = classifyNmrInterpretationSummary(peaks, 'AcOH-d4', false, []);
    expect(summary.artifact_candidates?.some((x) => x.label.includes('aromatic contamination'))).toBe(true);
    expect(summary.interpretation_mode).toBe('polymer_mode');
  });

  it('keeps non-polymer aliphatic profile outside polymer mode', () => {
    const peaks = [basePeak(5.45), basePeak(2.2), basePeak(1.25), basePeak(0.9)];
    const summary = classifyNmrInterpretationSummary(peaks, 'CDCl3', false, []);
    expect(summary.polymer_mode).toBe(false);
    expect(summary.interpretation_mode).toBe('small_molecule_mode');
  });
});
