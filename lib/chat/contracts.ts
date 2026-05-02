export type ChatIntent =
  | 'simple_qa'
  | 'interpretation_request'
  | 'direct_action_request'
  | 'debug_audit_request'
  | 'export_report_request'
  | 'ui_command'
  | 'multi_step_workflow'
  | 'root_cause_request'
  | 'mixed_request';

export type AuthorityTier =
  | 'OBSERVED_PROCESSED_FID'
  | 'AUTHORITATIVE_OBSERVED'
  | 'FID_DERIVED_HELPER'
  | 'DISPLAY_ONLY_FALLBACK'
  | 'SIMULATED_STRUCTURE_MODEL';

export interface CandidateStructureRanked {
  name: string;
  support: number;
  contradictions?: string[];
  demoted?: boolean;
  demotion_reason?: string;
}

/** Chat + parity guard için tek kimlik yüzeyi (final_verdict ile hizalı). */
export interface IdentitySurfaceSnapshot {
  display_molecule: string;
  display_iupac: string;
  display_formula: string;
  display_smiles: string;
  final_identity_source: string;
  exact_id_active: boolean;
  parity_status: string;
  verdict_mode?: string;
  /** Üst kart teyit rozeti; exact-ID iken INCONCLUSIVE olmamalı. */
  display_verification_status?: 'PASS' | 'WARN' | 'INCONCLUSIVE';
}

export interface StructuredEvidenceObject {
  evidence_id: string;
  evidence_version: string;
  manifest_version: string;
  lineage_id: string;
  authority_source: AuthorityTier;
  modality: string;
  qc_status: 'PASS' | 'WARN' | 'FAIL_WITH_CONFIDENCE_CEILING';
  confidence_ceiling: number;
  confidence_basis: string;
  provenance_type: string;
  source_module: string;
  processing_trace: string[];
  solvent_context: string;
  residual_regions: string[];
  artifact_regions: string[];
  molecule_regions: string[];
  analyte_regions?: string[];
  cross_modal_anchors?: string[];
  candidate_structures_ranked: CandidateStructureRanked[];
  contradiction_analysis: string[];
  exact_id_eligibility?: {
    eligible: boolean;
    candidate?: string;
    reasons: string[];
  };
  next_actions: string[];
  title_source: string;
  body_source: string;
  summary_source: string;
  export_source: string;
  structure_card_source: string;
  depiction_source: string;
  formula_source: string;
  iupac_source: string;
  smiles_source: string;
  value_basis: string;
  export_basis: string;
  authority_tier: AuthorityTier;
  parser_confidence?: number;
  identity_surface?: IdentitySurfaceSnapshot;
  observability?: {
    final_identity_source?: string;
    iupac_source?: string;
    formula_source?: string;
    smiles_source?: string;
    verdict_source?: string;
    parity_status?: string;
    fallback_leak_detected?: boolean;
    authority_breach_detected?: boolean;
    assistant_response_mode?: string;
    assistant_language_mode?: string;
  };
}

export interface AuthorityGateResult {
  allowed: boolean;
  downgraded: boolean;
  effective_confidence_ceiling: number;
  reason_codes: string[];
}

export interface ChatToolAction {
  action: string;
  parameters?: Record<string, unknown>;
}

export interface ForensicRootCauseOutput {
  symptom: string;
  likely_cause: string;
  authority_source: AuthorityTier;
  missing_requirement: string;
  next_best_remediation: string;
}

export interface ActionReceipt {
  action_id: string;
  timestamp: string;
  actor: 'chatbot';
  requested_action: string;
  execution_status: 'success' | 'failed' | 'blocked' | 'rolled_back';
  affected_scope: 'ui_only' | 'analysis_view' | 'authoritative_pointer';
  provenance_impact: string;
  rollback_possible: boolean;
  rollback_action?: ChatToolAction;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterRequestPayload {
  messages: ChatMessage[];
  intent: ChatIntent;
  evidence: StructuredEvidenceObject;
  provider?: 'openrouter' | 'deepseek';
  actions?: ChatToolAction[];
  stream?: boolean;
  forensic?: ForensicRootCauseOutput | null;
}
