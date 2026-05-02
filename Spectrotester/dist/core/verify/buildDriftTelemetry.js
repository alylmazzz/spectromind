import { mapRuleDigestToIncident } from './telemetryTaxonomy.js';
function makeEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function clamp01(v) {
    if (!Number.isFinite(v))
        return 0;
    if (v < 0)
        return 0;
    if (v > 1)
        return 1;
    return v;
}
export function buildDriftTelemetry(inp) {
    const authorityTier = String(inp.context?.authority_tier ?? inp.analysisSot?.authority_source ?? 'UNKNOWN');
    const authorityGateMode = String(inp.trace?.authority_gate_mode ?? 'ALLOW');
    const fallbackPresent = Boolean(inp.context?.has_fallback || inp.context?.fallback_present);
    const fallbackExcluded = inp.context?.fallback_excluded_from_scoring !== false;
    const helperGuard = Boolean(inp.context?.helper_contamination_guard_applied ?? inp.trace?.helper_contamination_guard_applied);
    const blockedModalities = Array.isArray(inp.context?.helper_contamination_blocked_modalities)
        ? inp.context?.helper_contamination_blocked_modalities
        : [];
    const provenanceRequired = inp.ruleResults.find((r) => r.rule_id === 'GLOBAL_PROVENANCE_REQUIRED');
    const provenanceRequiredPassed = provenanceRequired ? provenanceRequired.status === 'PASS' : false;
    const observedQcNonPassCount = inp.ruleResults.filter((r) => r.rule_id.startsWith('OBS_') && r.status !== 'PASS').length;
    const axisFallbackApplied = Boolean(inp.context?.axis_fallback_applied);
    const parityState = authorityGateMode === 'HARD_BLOCK'
        ? 'PARITY_BLOCKED'
        : observedQcNonPassCount > 0 || axisFallbackApplied
            ? 'PARITY_DEGRADED'
            : 'PARITY_OK';
    const metadataOnlyCount = inp.ruleResults.filter((r) => r.evidence?.metadata_only === true || r.evidence?.metadata_only_unenforced === true).length;
    const digests = inp.ruleResults.map((r) => ({
        rule_id: r.rule_id,
        status: r.status,
        why: r.why,
        suggested_action: r.suggested_action,
        metadata_only: r.evidence?.metadata_only === true || r.evidence?.metadata_only_unenforced === true,
        evidence_ref: `${r.rule_id}:${r.status}`,
        authority_tier: authorityTier,
    }));
    const incidentTaxonomy = digests
        .map((d) => mapRuleDigestToIncident(d))
        .filter((d) => d !== null);
    const missingEvaluators = inp.ruleResults.filter((r) => r.status === 'INCONCLUSIVE' && r.evidence?.metadata_only_unenforced !== true).length;
    return {
        schema_version: '1.0.0',
        event_id: makeEventId(),
        event_ts: new Date().toISOString(),
        run_context: {
            engine_id: inp.engineId,
            ruleset_version: inp.rulesetVersion ?? 'unknown',
            scenario: inp.scenario ?? 'default',
            authority_tier: authorityTier,
            provenance_type: String(inp.context?.provenance_type ?? 'unknown'),
            source_module: 'spectrotester/core/engine',
        },
        authority_metrics: {
            authority_tier: authorityTier,
            authority_gate_mode: authorityGateMode,
            fallback_present: fallbackPresent,
            fallback_excluded_from_scoring: fallbackExcluded,
            helper_contamination_guard_applied: helperGuard,
            helper_contamination_blocked_modalities_count: blockedModalities.length,
            provenance_required_passed: provenanceRequiredPassed,
            authority_integrity_score: Math.max(0, 100 -
                (authorityGateMode === 'HARD_BLOCK' ? 60 : authorityGateMode === 'CLASS_LEVEL_ONLY' ? 30 : 0) -
                (provenanceRequiredPassed ? 0 : 25) -
                (fallbackExcluded ? 0 : 20)),
        },
        parity_metrics: {
            observed_qc_cap_applied: inp.scoring.observedQcCapApplied,
            observed_qc_nonpass_count: observedQcNonPassCount,
            axis_fallback_applied: axisFallbackApplied,
            parity_confidence_ceiling: inp.scoring.observedQcCapApplied ? 65 : 100,
            parity_state: parityState,
            parity_drift_index: clamp01((observedQcNonPassCount + (axisFallbackApplied ? 1 : 0)) / 6),
        },
        verdict_metrics: {
            overall: inp.scoring.overall,
            status: inp.status,
            confidence_score: inp.scoring.confidenceScore,
            coverage_score: inp.scoring.coverageScore,
            veto_count: inp.scoring.vetoCount,
            fail_count: inp.scoring.failCount,
            warn_count: inp.scoring.warnCount,
            skip_count: inp.scoring.skipCount,
            not_evaluated_count: inp.scoring.notEvaluatedCount,
            metadata_only_rule_count: metadataOnlyCount,
            metadata_influence_penalty: inp.scoring.metadataPenalty,
        },
        incident_taxonomy: incidentTaxonomy,
        coverage_metrics: {
            total_rules: inp.scoring.totalRules,
            implemented_evaluators: inp.scoring.evaluatedRules,
            missing_evaluators: inp.scoring.notEvaluatedCount,
            metadata_only_rules: metadataOnlyCount,
            scientific_rules_without_evaluator: missingEvaluators,
        },
        drift_signals: {
            confidence_delta_vs_baseline: inp.scoring.confidenceScore - 100,
            coverage_delta_vs_baseline: inp.scoring.coverageScore - 100,
            fallback_leak_signal: {
                triggered: incidentTaxonomy.some((i) => i.incident_code === 'INC_VERDICT_FALLBACK_SCORE_LEAK'),
                score: incidentTaxonomy.some((i) => i.incident_code === 'INC_VERDICT_FALLBACK_SCORE_LEAK') ? 1 : 0,
            },
            verdict_ceiling_triggered: inp.scoring.observedQcCapApplied || authorityGateMode !== 'ALLOW',
            new_root_cause_classes: Array.from(new Set(incidentTaxonomy.map((i) => i.root_cause_class))).slice(0, 20),
        },
        audit_trace_ref: {
            trace_id: String(inp.trace?.trace_id ?? inp.trace?.run_id ?? 'trace_unknown'),
            artifact_hashes: inp.artifactHashes ?? {},
            processing_trace_version: 'phase3-v1',
        },
    };
}
