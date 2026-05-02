import type { RuleEvalStatus } from './evaluateRules.js';

export interface DriftTelemetryIncident {
  incident_code: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'CRITICAL';
  domain: 'AUTHORITY' | 'PARITY' | 'VERDICT' | 'COVERAGE' | 'PROVENANCE' | 'MODALITY';
  rule_id: string;
  root_cause_class: string;
  authority_tier: string;
  source_module: string;
  why: string;
  suggested_action: string;
  evidence_ref: string;
}

export interface DriftTelemetryV1 {
  schema_version: '1.0.0';
  event_id: string;
  event_ts: string;
  run_context: {
    engine_id: string;
    ruleset_version: string;
    scenario: string;
    authority_tier: string;
    provenance_type: string;
    source_module: string;
  };
  authority_metrics: {
    authority_tier: string;
    authority_gate_mode: 'ALLOW' | 'CLASS_LEVEL_ONLY' | 'HARD_BLOCK';
    fallback_present: boolean;
    fallback_excluded_from_scoring: boolean;
    helper_contamination_guard_applied: boolean;
    helper_contamination_blocked_modalities_count: number;
    provenance_required_passed: boolean;
    authority_integrity_score: number;
  };
  parity_metrics: {
    observed_qc_cap_applied: boolean;
    observed_qc_nonpass_count: number;
    axis_fallback_applied: boolean;
    parity_confidence_ceiling: number;
    parity_state: 'PARITY_OK' | 'PARITY_DEGRADED' | 'PARITY_BLOCKED';
    parity_drift_index: number;
  };
  verdict_metrics: {
    overall: 'PASS' | 'WARN' | 'FAIL' | 'INCONCLUSIVE';
    status: 'PASS' | 'FAIL' | 'PARTIAL' | 'INCONCLUSIVE';
    confidence_score: number;
    coverage_score: number;
    veto_count: number;
    fail_count: number;
    warn_count: number;
    skip_count: number;
    not_evaluated_count: number;
    metadata_only_rule_count: number;
    metadata_influence_penalty: number;
  };
  incident_taxonomy: DriftTelemetryIncident[];
  coverage_metrics: {
    total_rules: number;
    implemented_evaluators: number;
    missing_evaluators: number;
    metadata_only_rules: number;
    scientific_rules_without_evaluator: number;
  };
  drift_signals: {
    confidence_delta_vs_baseline: number;
    coverage_delta_vs_baseline: number;
    fallback_leak_signal: { triggered: boolean; score: number };
    verdict_ceiling_triggered: boolean;
    new_root_cause_classes: string[];
  };
  audit_trace_ref: {
    trace_id: string;
    artifact_hashes: Record<string, string>;
    processing_trace_version: string;
  };
}

export interface TelemetryRuleDigest {
  rule_id: string;
  status: RuleEvalStatus;
  why?: string;
  suggested_action?: string;
  metadata_only: boolean;
  evidence_ref: string;
  authority_tier: string;
}
