import type { AuthorityTier, IdentitySurfaceSnapshot, StructuredEvidenceObject } from '@/lib/chat/contracts';

export interface ChatEvidenceContext {
  modality: string;
  solvent: string;
  qcStatus: 'PASS' | 'WARN' | 'FAIL_WITH_CONFIDENCE_CEILING';
  authorityTier: AuthorityTier;
  moleculeRegions: string[];
  residualRegions: string[];
  artifactRegions: string[];
  contradictions: string[];
  candidateStructures?: Array<{ name: string; support: number; contradictions?: string[] }>;
  analyteRegions?: string[];
  crossModalAnchors?: string[];
  exactIdEligibility?: { eligible: boolean; candidate?: string; reasons: string[] };
  parserConfidence?: number;
  identitySurface?: IdentitySurfaceSnapshot;
  observability?: StructuredEvidenceObject['observability'];
}

export function buildStructuredEvidence(context: ChatEvidenceContext): StructuredEvidenceObject {
  const isFallbackOnly = context.authorityTier === 'DISPLAY_ONLY_FALLBACK';
  const baseCeiling = context.qcStatus === 'FAIL_WITH_CONFIDENCE_CEILING' ? 35 : 80;
  const safeCeiling = isFallbackOnly ? Math.min(baseCeiling, 45) : baseCeiling;
  const identityLocked =
    context.observability?.iupac_source === 'final_verdict_lock' ||
    Boolean(context.identitySurface?.final_identity_source?.includes('EXACT_ID_LOCK'));
  const sourceTag = identityLocked ? 'final_verdict_lock' : 'analysis_sot';
  return {
    evidence_id: `evidence_${Date.now()}`,
    evidence_version: 'evidence.v2',
    manifest_version: 'chatbot.v1',
    lineage_id: `lineage_${Date.now()}`,
    authority_source: context.authorityTier,
    authority_tier: context.authorityTier,
    modality: context.modality,
    qc_status: context.qcStatus,
    confidence_ceiling: safeCeiling,
    confidence_basis: 'qc_status + authority_tier',
    provenance_type: 'SPECTROMIND_CHAT_CONTEXT',
    source_module: 'lib/chat/evidenceBuilder',
    processing_trace: ['authority_gate', 'qc_gate', 'solvent_residual_screen', 'contradiction_analysis'],
    solvent_context: context.solvent,
    residual_regions: context.residualRegions,
    artifact_regions: context.artifactRegions,
    molecule_regions: context.moleculeRegions,
    analyte_regions: context.analyteRegions ?? context.moleculeRegions,
    cross_modal_anchors: context.crossModalAnchors ?? [],
    candidate_structures_ranked:
      context.candidateStructures?.map((c) => ({
        name: c.name,
        support: c.support,
        contradictions: c.contradictions,
      })) ?? [],
    contradiction_analysis: context.contradictions,
    exact_id_eligibility: context.exactIdEligibility,
    next_actions: ['apply_residual_mask', 'recluster_peaks', 'run_verification'],
    title_source: sourceTag,
    body_source: sourceTag,
    summary_source: sourceTag,
    export_source: sourceTag,
    structure_card_source: sourceTag,
    depiction_source: sourceTag,
    formula_source: sourceTag,
    iupac_source: sourceTag,
    smiles_source: sourceTag,
    value_basis: sourceTag,
    export_basis: sourceTag,
    parser_confidence: context.parserConfidence,
    identity_surface: context.identitySurface,
    observability: context.observability ?? {
      final_identity_source: context.identitySurface?.final_identity_source,
      iupac_source: 'analysis_sot',
      formula_source: 'analysis_sot',
      smiles_source: 'analysis_sot',
      verdict_source: 'analysis_sot',
      parity_status: context.identitySurface?.parity_status,
      fallback_leak_detected: context.identitySurface?.parity_status === 'DRIFT_DETECTED',
      authority_breach_detected: context.authorityTier === 'DISPLAY_ONLY_FALLBACK',
      assistant_response_mode: 'evidence.v2',
      assistant_language_mode: 'tr_default',
    },
  };
}
