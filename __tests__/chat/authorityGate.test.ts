import { describe, expect, it } from 'vitest';
import { evaluateAuthorityGate } from '@/lib/chat/authorityGate';
import type { StructuredEvidenceObject } from '@/lib/chat/contracts';

function baseEvidence(): StructuredEvidenceObject {
  return {
    evidence_id: 'e1',
    evidence_version: 'evidence.v2',
    manifest_version: 'v1',
    lineage_id: 'l1',
    authority_source: 'AUTHORITATIVE_OBSERVED',
    authority_tier: 'AUTHORITATIVE_OBSERVED',
    modality: '1H',
    qc_status: 'PASS',
    confidence_ceiling: 85,
    confidence_basis: 'test',
    provenance_type: 'test',
    source_module: 'test',
    processing_trace: ['a'],
    solvent_context: 'DMSO',
    residual_regions: [],
    artifact_regions: [],
    molecule_regions: [],
    candidate_structures_ranked: [],
    contradiction_analysis: [],
    next_actions: [],
    title_source: 'analysis_sot',
    body_source: 'analysis_sot',
    summary_source: 'analysis_sot',
    export_source: 'analysis_sot',
    structure_card_source: 'analysis_sot',
    depiction_source: 'analysis_sot',
    formula_source: 'analysis_sot',
    iupac_source: 'analysis_sot',
    smiles_source: 'analysis_sot',
    value_basis: 'analysis_sot',
    export_basis: 'analysis_sot',
  };
}

describe('evaluateAuthorityGate', () => {
  it('fallback authority durumunda confidence düşürür', () => {
    const ev = baseEvidence();
    ev.authority_tier = 'DISPLAY_ONLY_FALLBACK';
    const result = evaluateAuthorityGate(ev);
    expect(result.downgraded).toBe(true);
    expect(result.effective_confidence_ceiling).toBeLessThanOrEqual(45);
  });

  it('provenance eksikliğinde deny döner', () => {
    const ev = baseEvidence();
    ev.processing_trace = [];
    const result = evaluateAuthorityGate(ev);
    expect(result.allowed).toBe(false);
    expect(result.reason_codes).toContain('PROVENANCE_GAP');
  });
});
