import { describe, expect, it } from 'vitest';
import { buildJointModalityContext } from '@/lib/hooks/useSpectralAnalysis';

describe('joint modality prompt context', () => {
  it('contains mandatory cross-modality guardrails and evidence keys', () => {
    const context = buildJointModalityContext({
      h1Peaks: [{ shift: 5.49, integ: 1, mult: 'm' }],
      c13Peaks: [{ ppm: 122.14 }],
      solvent: 'Pyridine-d5',
      sourceMatrix: 'Chardonnay blanc grape pomace',
      observedH1Qc: 'FAIL: OBS_PEAK_PICKING_REPRODUCIBILITY',
      observedC13Qc: 'WARN',
      authorityH1: 'AUTHORITATIVE_OBSERVED',
      authorityC13: 'AUTHORITATIVE_OBSERVED',
    });

    expect(context).toContain('JOINT_MODALITY_EVIDENCE_JSON');
    expect(context).toContain('AI_TEXT_JOINT_MODALITY_REQUIRED');
    expect(context).toContain('AI_TEXT_RESIDUAL_SCREEN_BEFORE_STRUCTURE_REQUIRED');
    expect(context).toContain('AI_TEXT_CROSS_MODAL_ANCHOR_REQUIRED');
    expect(context).toContain('AI_TEXT_POLYMER_MODE_REQUIRED_IF_BROAD_SUGAR_PATTERN');
    expect(context).toContain('Chardonnay blanc grape pomace');
    expect(context).toContain('122.14');
    expect(context).toContain('5.49');
  });

  it('flags polymer context for chitosan acidic solvent case', () => {
    const context = buildJointModalityContext({
      h1Peaks: [
        { shift: 5.0, integ: 1, mult: 'm' },
        { shift: 3.22, integ: 1, mult: 'm' },
        { shift: 2.04, integ: 2, mult: 'm' },
      ],
      c13Peaks: [],
      solvent: 'AcOH-d4',
      sourceMatrix: 'chitosan standard in deuterated acetic acid',
      authorityH1: 'AUTHORITATIVE_OBSERVED',
      authorityC13: 'DISPLAY_ONLY_FALLBACK',
    });

    expect(context).toContain('polymerContext');
    expect(context).toContain('chitosanPatternCandidate');
    expect(context).toContain('deuterated acetic acid');
  });
});
