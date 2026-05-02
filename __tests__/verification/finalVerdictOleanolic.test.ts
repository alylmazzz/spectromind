import { describe, expect, it } from 'vitest';
import { assignCarbon13Peak } from '@/lib/nmr/carbon13/assignment';
import { attachFinalVerdict, buildFinalVerdict, isOleanolicExactIdLocked } from '@/lib/verification/finalVerdict';
import type { AIAnalysisResult, SpectralInterpretationSummary } from '@/lib/types';

function makeSummary(overrides?: Partial<SpectralInterpretationSummary>): SpectralInterpretationSummary {
  return {
    authority_source: 'AUTHORITATIVE_OBSERVED',
    qc_status: 'FAIL_WITH_CONFIDENCE_CEILING',
    confidence_ceiling: 55,
    solvent_candidates: [],
    residual_regions: [],
    artifact_candidates: [],
    molecule_regions: [],
    analyte_regions: [],
    candidate_structures_ranked: [{ name: 'Oleanolic Acid', support: 0.94, contradictions: [] }],
    structure_candidates: [],
    contradiction_analysis: [],
    exact_id_eligibility: {
      eligible: true,
      candidate: 'Oleanolic Acid',
      reasons: ['test'],
    },
    confidence_ceiling_reason: 'test',
    title_source: 'analysis_sot',
    body_source: 'analysis_sot',
    summary_source: 'analysis_sot',
    export_source: 'analysis_sot',
    structure_card_source: 'analysis_sot',
    depiction_source: 'analysis_sot',
    formula_source: 'analysis_sot',
    iupac_source: 'analysis_sot',
    smiles_source: 'analysis_sot',
    evidence_version: 'evidence.v3',
    lineage_id: 'lineage_test',
    uncertain_regions: [],
    next_best_actions: [],
    runtime_rules: ['AI_TEXT_FTIR_CANNOT_OVERRIDE_STRONG_NMR_ANCHORS'],
    ...overrides,
  };
}

describe('final verdict oleanolic parity', () => {
  it('locks exact-ID oleanolic: display PASS, not INCONCLUSIVE, despite QC ceiling', () => {
    const result: AIAnalysisResult = {
      moleculeName: 'Oleanolic Acid',
      formula: 'C30H48O3',
      confidence: 82,
      reasoning: 'test',
      verificationStatus: 'PASS',
    };
    const summary = makeSummary();
    const fv = buildFinalVerdict(result, summary);
    expect(fv.exact_id_active).toBe(true);
    expect(fv.display_verification_status).toBe('PASS');
    expect(fv.verdict_mode).not.toBe('INCONCLUSIVE');
    expect(fv.parity_status).toBe('LOCKED');
    expect(fv.final_formula).toBe('C30H48O3');
    expect(fv.final_iupac).toMatch(/olean/i);
    expect(fv.final_confidence).toBe(55);
    const attached = attachFinalVerdict({ ...result, verificationStatus: 'INCONCLUSIVE' }, summary);
    expect(attached.verificationStatus).toBe('PASS');
  });

  it('isOleanolicExactIdLocked true when ranking + eligibility + name align', () => {
    const result: AIAnalysisResult = {
      moleculeName: 'Oleanolic Acid',
      formula: 'C30H48O3',
      confidence: 90,
      reasoning: 'x',
    };
    expect(isOleanolicExactIdLocked(result, makeSummary())).toBe(true);
  });

  it('in Pyridine-d5: 122.33 hits narrow C-12 anchor; 122.8/123.3 map to pyridine beta residual', () => {
    const py = { solvent: 'Pyridine-d5' };
    const c12 = assignCarbon13Peak(122.33, py);
    expect(c12.analyte_flag).toBe(true);
    expect(c12.assignment_label).toMatch(/C-12 olefinic CH carbon/i);
    const betaEdge = assignCarbon13Peak(122.8, py);
    expect(betaEdge.residual_flag).toBe(true);
    expect(betaEdge.assignment_label).toMatch(/Pyridine-d5 beta/i);
    const beta = assignCarbon13Peak(123.3, py);
    expect(beta.residual_flag).toBe(true);
    expect(beta.assignment_label).toMatch(/Pyridine-d5 beta/i);
    const g = assignCarbon13Peak(135.7, py);
    expect(g.residual_flag).toBe(true);
    expect(g.assignment_label).toMatch(/Pyridine-d5 gamma/i);
  });
});
