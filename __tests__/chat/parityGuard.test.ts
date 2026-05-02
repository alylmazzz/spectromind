import { describe, expect, it } from 'vitest';
import { enforceParityGuard } from '@/lib/chat/parityGuard';
import type { StructuredEvidenceObject } from '@/lib/chat/contracts';

const makeEvidence = (): StructuredEvidenceObject => ({
  evidence_id: 'e',
  evidence_version: 'evidence.v2',
  manifest_version: 'v1',
  lineage_id: 'l',
  authority_source: 'AUTHORITATIVE_OBSERVED',
  authority_tier: 'AUTHORITATIVE_OBSERVED',
  modality: '1H',
  qc_status: 'PASS',
  confidence_ceiling: 80,
  confidence_basis: 'b',
  provenance_type: 'p',
  source_module: 'm',
  processing_trace: ['x'],
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
});

describe('enforceParityGuard', () => {
  it('source mismatch varsa parity fail', () => {
    const evidence = makeEvidence();
    evidence.summary_source = 'verification_report';
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('TITLE_BODY_SUMMARY_CONTRADICTION');
  });

  it('structure-card kaynak mismatch varsa parity fail', () => {
    const evidence = makeEvidence();
    evidence.smiles_source = 'fallback';
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('STRUCTURE_CARD_SOURCE_PARITY_VIOLATION');
  });

  it('Oleanolic exact-ID iken IUPAC polimer placeholder ise STRUCTURE_CARD_SOURCE_PARITY_FAILURE', () => {
    const evidence = makeEvidence();
    evidence.identity_surface = {
      display_molecule: 'Oleanolic Acid',
      display_iupac: 'Bilinmeyen Polimer',
      display_formula: 'C30H48O3',
      display_smiles: 'Bilinmeyen',
      final_identity_source: 'PUBCHEM_CID_10494_EXACT_ID_LOCK',
      exact_id_active: true,
      parity_status: 'LOCKED',
      verdict_mode: 'EXACT_ID_CONFIDENCE_CEILING',
      display_verification_status: 'PASS',
    };
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('STRUCTURE_CARD_SOURCE_PARITY_FAILURE');
  });

  it('Oleanolic exact-ID iken formül C30H48O3 değilse STRUCTURE_CARD_SOURCE_PARITY_FAILURE', () => {
    const evidence = makeEvidence();
    evidence.identity_surface = {
      display_molecule: 'Oleanolic Acid',
      display_iupac: '3beta-Hydroxy-olean-12-en-28-oic acid',
      display_formula: 'C80H160O40',
      display_smiles: 'CC',
      final_identity_source: 'PUBCHEM_CID_10494_EXACT_ID_LOCK',
      exact_id_active: true,
      parity_status: 'LOCKED',
      verdict_mode: 'EXACT_ID_CONFIDENCE_CEILING',
      display_verification_status: 'PASS',
    };
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('STRUCTURE_CARD_SOURCE_PARITY_FAILURE');
  });

  it('Oleanolic exact-ID iken verdict_mode INCONCLUSIVE ise FINAL_VERDICT_RESOLVER_MISMATCH', () => {
    const evidence = makeEvidence();
    evidence.identity_surface = {
      display_molecule: 'Oleanolic Acid',
      display_iupac: '3beta-Hydroxy-olean-12-en-28-oic acid',
      display_formula: 'C30H48O3',
      display_smiles: 'C',
      final_identity_source: 'PUBCHEM_CID_10494_EXACT_ID_LOCK',
      exact_id_active: true,
      parity_status: 'LOCKED',
      verdict_mode: 'INCONCLUSIVE',
      display_verification_status: 'PASS',
    };
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('FINAL_VERDICT_RESOLVER_MISMATCH');
  });

  it('Oleanolic exact-ID iken display_verification_status INCONCLUSIVE ise FINAL_VERDICT_RESOLVER_MISMATCH', () => {
    const evidence = makeEvidence();
    evidence.identity_surface = {
      display_molecule: 'Oleanolic Acid',
      display_iupac: '3beta-Hydroxy-olean-12-en-28-oic acid',
      display_formula: 'C30H48O3',
      display_smiles: 'CC',
      final_identity_source: 'PUBCHEM_CID_10494_EXACT_ID_LOCK',
      exact_id_active: true,
      parity_status: 'LOCKED',
      verdict_mode: 'EXACT_ID_CONFIDENCE_CEILING',
      display_verification_status: 'INCONCLUSIVE',
    };
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('FINAL_VERDICT_RESOLVER_MISMATCH');
  });
});
