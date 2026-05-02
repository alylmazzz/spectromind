import { describe, expect, it } from 'vitest';
import type { NMRPeak } from '@/lib/types';
import { classifyNmrInterpretationSummary } from '@/lib/hooks/useSpectralAnalysis';

describe('chitosan polymer-mode interpretation', () => {
  const chitosanCasePeaks: NMRPeak[] = [
    { shift: 11.46, mult: 'unresolved_multiplet', integ: 3 },
    { shift: 5.0, mult: 'unresolved_multiplet', integ: 1 },
    { shift: 3.22, mult: 'unresolved_multiplet', integ: 1 },
    { shift: 2.04, mult: 'unresolved_multiplet', integ: 2.35 },
    { shift: 7.5, mult: 'm', integ: 0.2 },
    { shift: 0.14, mult: 'm', integ: 0.2 },
    { shift: 1.3, mult: 'unresolved_multiplet', integ: 0.2 },
    { shift: 1.23, mult: 'unresolved_multiplet', integ: 0.2 },
    { shift: 0.89, mult: 'unresolved_multiplet', integ: 0.2 },
    { shift: 1.38, mult: 'unresolved_multiplet', integ: 0.2 },
  ];

  it('enforces polymer-mode and confidence ceiling', () => {
    const summary = classifyNmrInterpretationSummary(
      chitosanCasePeaks,
      'AcOH-d4',
      true,
      ['OBS_PEAK_PICKING_REPRODUCIBILITY']
    );

    expect(summary.polymer_mode).toBe(true);
    expect(summary.interpretation_mode).toBe('polymer_mode');
    expect(summary.confidence_ceiling).toBeLessThanOrEqual(45);
    expect(summary.runtime_rules).toContain('AI_TEXT_POLYMER_MODE_REQUIRED_IF_BROAD_SUGAR_PATTERN');
  });

  it('separates solvent and artifact candidates from molecule regions', () => {
    const summary = classifyNmrInterpretationSummary(
      chitosanCasePeaks,
      'deuterated acetic acid',
      false,
      []
    );

    expect(summary.solvent_candidates.some((c) => String(c.label).includes('acidic proton'))).toBe(true);
    expect(summary.artifact_candidates?.some((c) => String(c.label).includes('trace aromatic contamination'))).toBe(true);
    expect(summary.artifact_candidates?.some((c) => String(c.label).includes('silicone'))).toBe(true);
    expect(summary.molecule_regions.some((c) => String(c.region).includes('4.70-5.40'))).toBe(true);
    expect(summary.next_best_actions.join(' ')).toMatch(/reclustering|Degree of deacetylation/i);
  });
});
