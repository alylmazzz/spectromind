/**
 * Build teyit_raporu_schema-compliant report with artifact_hashes, trace, engine_used.
 */
import { validateReportShape } from '../library/schemas.js';
import { artifactHashes } from '../util/hash.js';
export function buildReport(inp) {
    const report = {
        status: inp.status,
        overall: inp.overall,
        summary: inp.summary,
        confidence_score: inp.confidence_score,
        engine_used: inp.engine_used ?? 'spectrotester',
        inputs_echo: inp.inputs_echo ?? {},
        timings_ms: inp.timings_ms ?? {},
        artifact_hashes: inp.artifact_hashes ?? {},
        trace: inp.trace ?? {},
        feature_snapshot: inp.feature_snapshot,
        analysis_sot: inp.analysis_sot ?? {},
        drift_telemetry: inp.drift_telemetry ?? null,
        title_source: inp.analysis_sot?.title_source ?? 'verification_report',
        body_source: inp.analysis_sot?.body_source ?? 'verification_report',
        summary_source: inp.analysis_sot?.summary_source ?? 'verification_report',
        root_cause_code: inp.root_cause_code,
        recommended_action: inp.recommended_action,
        evidence: inp.evidence ?? [],
        veto_flags: inp.veto_flags ?? [],
        warnings: inp.warnings ?? [],
        root_cause_analysis: inp.ruleResults
            .filter((r) => r.status === 'FAIL' || r.status === 'FATAL' || r.status === 'ERROR')
            .map((r) => ({
            error_code: r.rule_id,
            what_failed: r.why,
            why: r.why,
            evidence: r.evidence,
            autofix: r.autofix,
        })),
        skipped_rules_summary: inp.ruleResults
            .filter((r) => r.status === 'SKIP' || r.status === 'NOT_APPLICABLE')
            .map((r) => ({
            rule_id: r.rule_id,
            status: r.status,
            reason: r.evidence?.reason ?? null,
        })),
        modality_confidence_breakdown: Object.entries(inp.ruleResults.reduce((acc, r) => {
            const modality = r.evidence?.modality ??
                r.rule_id.split('_')[0];
            if (!acc[modality])
                acc[modality] = { total: 0, pass: 0, warnOrWorse: 0 };
            acc[modality].total += 1;
            if (r.status === 'PASS' || r.status === 'INFO')
                acc[modality].pass += 1;
            else if (r.status !== 'SKIP' && r.status !== 'NOT_APPLICABLE')
                acc[modality].warnOrWorse += 1;
            return acc;
        }, {})).map(([modality, v]) => ({
            modality,
            total_rules: v.total,
            pass_like: v.pass,
            warn_or_worse: v.warnOrWorse,
        })),
        provenance_summary: {
            provenance_type: inp.inputs_echo?.provenance_type ?? null,
            authority_tier: inp.analysis_sot?.authority_source ?? null,
            engine_used: inp.engine_used ?? 'spectrotester',
            source_module: 'spectrotester/core/engine',
            processing_trace: inp.trace ?? {},
            confidence_basis: {
                confidence_score: inp.confidence_score,
                observed_qc_cap_applied: inp.scoring.observedQcCapApplied,
            },
        },
        qc_summary: {
            observed_qc_flags: inp.ruleResults.filter((r) => r.rule_id.startsWith('OBS_') && r.status !== 'PASS').length,
            observed_qc_cap_applied: inp.scoring.observedQcCapApplied,
        },
        autofix_recommendations: inp.ruleResults
            .filter((r) => r.autofix && (r.status === 'FAIL' || r.status === 'WARN' || r.status === 'ERROR' || r.status === 'FATAL'))
            .map((r) => ({ rule_id: r.rule_id, autofix: r.autofix })),
    };
    const valid = validateReportShape(report);
    if (!valid.ok)
        report._validationError = valid.error;
    return report;
}
export function featureSnapshotFromGraph(f) {
    return {
        aromatic_atom_count: f.nC_aromatic,
        aromatic_CH_count: f.nH_aromatic,
        sp2_count: f.nC_sp2_non_aromatic + f.nC_aromatic,
        sp3_count: f.nC_total - f.nC_aromatic - f.nC_sp2_non_aromatic - f.nC_carbonyl,
        CH_count: f.nCH,
        CH2_count: f.nCH2,
        CH3_count: f.nCH3,
        quaternary_count: f.nC_quaternary,
        has_carbonyl: f.has_carbonyl,
        has_nitrile: f.has_nitrile,
        has_halogen: f.has_halogen,
        expected_unique_C: f.expected_unique_carbons_approx,
        nH_exchangeable: f.nH_exchangeable,
        nC_protonated: f.nC_protonated,
    };
}
export function buildArtifactHashes(payload) {
    return artifactHashes(payload);
}
