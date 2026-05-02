function severityFromStatus(status) {
    if (status === 'FATAL')
        return 'CRITICAL';
    if (status === 'ERROR')
        return 'ERROR';
    if (status === 'FAIL')
        return 'ERROR';
    if (status === 'WARN' || status === 'INCONCLUSIVE')
        return 'WARN';
    return 'INFO';
}
function domainFromRule(ruleId) {
    if (ruleId.startsWith('OBS_'))
        return 'PARITY';
    if (ruleId.startsWith('GLOBAL_'))
        return 'AUTHORITY';
    if (ruleId.startsWith('HSQC_') || ruleId.startsWith('COSY_') || ruleId.startsWith('HMBC_') || ruleId.startsWith('NOESY_'))
        return 'MODALITY';
    return 'VERDICT';
}
function incidentCodeFromRule(ruleId, status) {
    if (ruleId === 'GLOBAL_PROVENANCE_REQUIRED' && (status === 'ERROR' || status === 'FATAL')) {
        return 'INC_AUTH_PROVENANCE_MISSING';
    }
    if (ruleId === 'GLOBAL_FALLBACK_NOT_AUTHORITATIVE' && status !== 'PASS') {
        return 'INC_AUTH_FALLBACK_POLICY_BREACH';
    }
    if (ruleId === 'GLOBAL_SCORE_EXCLUDES_DISPLAY_FALLBACK' && status !== 'PASS') {
        return 'INC_VERDICT_FALLBACK_SCORE_LEAK';
    }
    if (ruleId.startsWith('OBS_') && status !== 'PASS') {
        return 'INC_PARITY_OBSERVED_QC_DEGRADED';
    }
    return `INC_${ruleId}_${status}`;
}
export function mapRuleDigestToIncident(digest) {
    if (digest.status === 'PASS' || digest.status === 'INFO' || digest.status === 'SKIP' || digest.status === 'NOT_APPLICABLE') {
        return null;
    }
    return {
        incident_code: incidentCodeFromRule(digest.rule_id, digest.status),
        severity: severityFromStatus(digest.status),
        domain: domainFromRule(digest.rule_id),
        rule_id: digest.rule_id,
        root_cause_class: String(digest.rule_id.split('_')[0] || 'UNKNOWN'),
        authority_tier: digest.authority_tier,
        source_module: 'spectrotester/core/verify',
        why: digest.why ?? 'rule non-pass',
        suggested_action: digest.suggested_action ?? 'Rule evidence ve provenance zincirini inceleyin.',
        evidence_ref: digest.evidence_ref,
    };
}
