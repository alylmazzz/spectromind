import { describe, expect, it } from 'vitest';
import { buildStructuredTurkishWhyWrong } from '@/lib/chat/structuredTurkishResponse';
import type { StructuredEvidenceObject } from '@/lib/chat/contracts';

const baseEvidence = (): StructuredEvidenceObject => ({
  evidence_id: 'e1',
  evidence_version: 'evidence.v2',
  manifest_version: 'v1',
  lineage_id: 'l1',
  authority_source: 'AUTHORITATIVE_OBSERVED',
  authority_tier: 'AUTHORITATIVE_OBSERVED',
  modality: '13C',
  qc_status: 'PASS',
  confidence_ceiling: 80,
  confidence_basis: 'b',
  provenance_type: 'p',
  source_module: 'm',
  processing_trace: [],
  solvent_context: 'Py-d5',
  residual_regions: [],
  artifact_regions: [],
  molecule_regions: [],
  candidate_structures_ranked: [],
  contradiction_analysis: [],
  next_actions: ['run_verification'],
  title_source: 'final_verdict_lock',
  body_source: 'final_verdict_lock',
  summary_source: 'final_verdict_lock',
  export_source: 'final_verdict_lock',
  structure_card_source: 'final_verdict_lock',
  depiction_source: 'final_verdict_lock',
  formula_source: 'final_verdict_lock',
  iupac_source: 'final_verdict_lock',
  smiles_source: 'final_verdict_lock',
  value_basis: 'final_verdict_lock',
  export_basis: 'final_verdict_lock',
});

describe('buildStructuredTurkishWhyWrong', () => {
  it('genel soruda null döner', () => {
    expect(buildStructuredTurkishWhyWrong('Merhaba', baseEvidence())).toBeNull();
  });

  it('"neden yanlış" ile deterministik Türkçe ve kaynak satırları üretir', () => {
    const ev = baseEvidence();
    ev.identity_surface = {
      display_molecule: 'Oleanolic Acid',
      display_iupac: '3beta-Hydroxy-olean-12-en-28-oic acid',
      display_formula: 'C30H48O3',
      display_smiles: 'CC(=O)O',
      final_identity_source: 'PUBCHEM_CID_10494_EXACT_ID_LOCK',
      exact_id_active: true,
      parity_status: 'LOCKED',
      verdict_mode: 'EXACT_ID_CONFIDENCE_CEILING',
      display_verification_status: 'PASS',
    };
    const out = buildStructuredTurkishWhyWrong('Neden IUPAC yanlış görünüyor?', ev);
    expect(out).toBeTruthy();
    expect(out).toMatch(/Kısa cevap/);
    expect(out).toMatch(/formula_source/);
    expect(out).toMatch(/Kök neden kodu/);
    expect(out).not.toMatch(/oleanolic acid-3,7-diol/i);
  });
});
