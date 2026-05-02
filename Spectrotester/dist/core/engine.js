/**
 * Spectrotester core orchestrator.
 * run({ smiles?, formula?, context, observedSpectra, scenario }) => { predicted, verification_report, coverage_report }
 */
import { parseSmiles } from './graph/parseSmiles.js';
import { computeGraphFeatures } from './graph/features.js';
import { loadRules } from './library/loadRules.js';
import { evaluateRules } from './verify/evaluateRules.js';
import { aggregateScoring } from './verify/scoring.js';
import { buildReport, featureSnapshotFromGraph, buildArtifactHashes, } from './verify/report.js';
import { buildDriftTelemetry } from './verify/buildDriftTelemetry.js';
import { createTimers } from './util/timers.js';
function resolveAuthorityGateMode(context, sanitized) {
    const authorityTier = String(context?.authority_tier ?? '');
    const sourcePackageComplete = context?.source_package_complete !== false;
    const axisFallbackApplied = context?.axis_fallback_applied === true;
    const fallbackLikeTiers = new Set([
        'FID_DERIVED_HELPER',
        'DISPLAY_ONLY_FALLBACK',
        'SIMULATED_STRUCTURE_MODEL',
    ]);
    if (!sourcePackageComplete && axisFallbackApplied)
        return 'HARD_BLOCK';
    if (fallbackLikeTiers.has(authorityTier))
        return 'CLASS_LEVEL_ONLY';
    if (sanitized.contaminationBlocked)
        return 'CLASS_LEVEL_ONLY';
    return 'ALLOW';
}
function sanitizeObservedSpectraByAuthority(observedSpectra, context) {
    const authorityTier = String(context?.authority_tier ?? '');
    const fallbackLikeTiers = new Set([
        'FID_DERIVED_HELPER',
        'DISPLAY_ONLY_FALLBACK',
        'SIMULATED_STRUCTURE_MODEL',
    ]);
    if (!fallbackLikeTiers.has(authorityTier) || !observedSpectra) {
        return { sanitized: observedSpectra, contaminationBlocked: false, blockedModalities: [] };
    }
    const blockedModalities = [
        'h1',
        'c13Peaks',
        'c13Signals',
        'hsqcPeaks',
        'cosyPeaks',
        'hmbcPeaks',
        'noesyPeaks',
        'ftirPeaks',
        'msPeaks',
    ].filter((key) => key in observedSpectra);
    // Hard isolation: helper/fallback traces can be visualized, but must not drive scientific rules.
    return {
        sanitized: {},
        contaminationBlocked: blockedModalities.length > 0,
        blockedModalities,
    };
}
export async function run(input) {
    const timers = createTimers();
    timers.start('parse');
    const smiles = (input.smiles ?? input.precomputedGraph?.canonicalSmiles)?.trim();
    if (!smiles && !input.precomputedGraph) {
        return {
            success: false,
            parseError: 'SMILES or precomputedGraph required',
            root_cause_code: 'PARSER_FAIL:NO_INPUT',
        };
    }
    const parseResult = await parseSmiles(smiles ?? '', {
        apiBase: input.apiBase,
        precomputedGraph: input.precomputedGraph,
    });
    timers.stop('parse');
    if (!parseResult.success || !parseResult.moleculeGraph) {
        return {
            success: false,
            parseError: parseResult.message,
            root_cause_code: parseResult.rootCause ?? 'PARSER_FAIL',
            verification_report: {
                status: 'INCONCLUSIVE',
                overall: 'BELIRSIZ',
                summary: parseResult.message ?? 'Parse başarısız.',
                confidence_score: 0,
                root_cause_code: parseResult.rootCause,
                recommended_action: 'SMILES doğrulayın veya canonicalize edin.',
                engine_used: input.engineId ?? 'spectrotester',
                inputs_echo: { smiles: input.smiles },
                timings_ms: timers.timers,
                artifact_hashes: {},
                trace: {},
            },
        };
    }
    const graph = parseResult.moleculeGraph;
    const features = computeGraphFeatures(graph);
    const formulaMismatch = typeof input.formula === 'string' &&
        input.formula.trim().length > 0 &&
        input.formula.trim() !== graph.formula;
    if (features.dbe < 0) {
        return {
            success: false,
            root_cause_code: 'FORMULA_DBE_NEGATIVE_FATAL',
            verification_report: {
                status: 'FAIL',
                overall: 'FAIL',
                summary: 'DBE negatif; formül/çekirdek tutarsız.',
                confidence_score: 0,
                root_cause_code: 'FORMULA_DBE_NEGATIVE_FATAL',
                recommended_action: 'Formül ve SMILES tutarlılığını kontrol edin.',
                engine_used: input.engineId ?? 'spectrotester',
                inputs_echo: { smiles: graph.canonicalSmiles, formula: input.formula },
                timings_ms: timers.timers,
                artifact_hashes: buildArtifactHashes({
                    inputSmiles: graph.canonicalSmiles,
                    rulesetVersion: '1.1',
                }),
                trace: {},
                feature_snapshot: featureSnapshotFromGraph(features),
            },
        };
    }
    timers.start('verify');
    const sanitized = sanitizeObservedSpectraByAuthority(input.observedSpectra, input.context);
    const authorityGateMode = resolveAuthorityGateMode(input.context, sanitized);
    const mergedContext = {
        ...(input.context ?? {}),
        helper_contamination_guard_applied: sanitized.contaminationBlocked,
        helper_contamination_blocked_modalities: sanitized.blockedModalities,
        formula_mismatch: formulaMismatch,
    };
    const { data: ruleset } = await loadRules({
        loadJson: input.loadJson,
        libraryPath: input.libraryPath,
    });
    const ruleResults = ruleset
        ? evaluateRules(ruleset.rules, {
            engineId: input.engineId ?? 'spectrotester',
            graphFeatures: features,
            canonicalSmiles: graph.canonicalSmiles,
            dbeValue: features.dbe,
            formulaRef: input.formula ?? graph.formula,
            atomCounts: graph.atomCounts,
            h1: sanitized.sanitized?.h1,
            c13Peaks: sanitized.sanitized?.c13Peaks,
            c13Signals: sanitized.sanitized?.c13Signals,
            hsqcPeaks: sanitized.sanitized?.hsqcPeaks,
            cosyPeaks: sanitized.sanitized?.cosyPeaks,
            hmbcPeaks: sanitized.sanitized?.hmbcPeaks,
            noesyPeaks: sanitized.sanitized?.noesyPeaks,
            ftirPeaks: sanitized.sanitized?.ftirPeaks,
            msPeaks: sanitized.sanitized?.msPeaks,
            solvent: input.context?.solvent_name,
            fieldMHz: input.context?.field_mhz,
            ionMode: input.context?.ion_mode,
            snrClass: input.context?.snr_class,
            thresholdProfile: input.context?.tolerance_profile_id,
            observedSpectra: sanitized.sanitized,
            meta: mergedContext,
        })
        : [];
    const scoring = aggregateScoring(ruleResults);
    timers.stop('verify');
    const mappedStatus = scoring.overall === 'FAIL'
        ? 'FAIL'
        : scoring.overall === 'WARN'
            ? 'PARTIAL'
            : scoring.overall === 'INCONCLUSIVE'
                ? 'INCONCLUSIVE'
                : 'PASS';
    const mappedOverall = scoring.overall === 'FAIL'
        ? 'FAIL'
        : scoring.overall === 'WARN'
            ? 'WARN'
            : scoring.overall === 'INCONCLUSIVE'
                ? 'BELIRSIZ'
                : 'PASS';
    const gatedStatus = authorityGateMode === 'HARD_BLOCK'
        ? 'INCONCLUSIVE'
        : authorityGateMode === 'CLASS_LEVEL_ONLY' && mappedStatus === 'PASS'
            ? 'INCONCLUSIVE'
            : mappedStatus;
    const gatedOverall = authorityGateMode === 'HARD_BLOCK'
        ? 'BELIRSIZ'
        : authorityGateMode === 'CLASS_LEVEL_ONLY' && mappedOverall === 'PASS'
            ? 'BELIRSIZ'
            : mappedOverall;
    const confidenceAfterAuthorityGate = authorityGateMode === 'HARD_BLOCK'
        ? Math.min(scoring.confidenceScore, 20)
        : authorityGateMode === 'CLASS_LEVEL_ONLY'
            ? Math.min(scoring.confidenceScore, 35)
            : scoring.confidenceScore;
    const gatedStatusWithFormula = formulaMismatch && gatedStatus === 'PASS' ? 'INCONCLUSIVE' : gatedStatus;
    const gatedOverallWithFormula = formulaMismatch && gatedOverall === 'PASS' ? 'BELIRSIZ' : gatedOverall;
    const gatedConfidence = formulaMismatch
        ? Math.min(confidenceAfterAuthorityGate, 60)
        : confidenceAfterAuthorityGate;
    const analysisSot = {
        authority_source: String(input.context?.authority_tier ?? 'UNKNOWN'),
        qc_status: scoring.overall,
        confidence_ceiling: gatedConfidence,
        solvent_context: input.context?.solvent_name ?? input.context?.solvent,
        residual_regions: [],
        artifact_regions: [],
        molecule_regions: [],
        candidate_structures_ranked: [],
        contradiction_analysis: authorityGateMode === 'ALLOW' && !formulaMismatch
            ? []
            : [
                ...(authorityGateMode === 'ALLOW'
                    ? []
                    : ['Authority gate active: fallback/helper veya eksik paket nedeniyle exact-ID demote edildi.']),
                ...(formulaMismatch ? ['Formula mismatch: parser formülü ile input formül uyumsuz.'] : []),
            ],
        next_actions: [
            ...(authorityGateMode === 'ALLOW'
                ? []
                : ['Authoritative observed paketi doğrula (fid+procpar+log+text), sonra yorumla.']),
            ...(formulaMismatch ? ['Input formülünü parser/graph formülü ile uzlaştır.'] : []),
        ],
        title_source: 'analysis_sot',
        body_source: 'analysis_sot',
        summary_source: 'analysis_sot',
    };
    const verification_report = buildReport({
        status: gatedStatusWithFormula,
        overall: gatedOverallWithFormula,
        summary: gatedOverallWithFormula === 'FAIL'
            ? `${scoring.vetoCount + scoring.failCount} kural ihlali.`
            : gatedOverallWithFormula === 'WARN'
                ? `${scoring.warnCount} uyarı.`
                : gatedOverallWithFormula === 'BELIRSIZ'
                    ? 'Yorum belirsiz: authority/QC kısıtları nedeniyle sınıf-seviyesi sonuç önerilir.'
                    : 'Teyit kuralları geçti.',
        confidence_score: gatedConfidence,
        ruleResults,
        scoring,
        inputs_echo: {
            smiles: graph.canonicalSmiles,
            formula: input.formula ?? graph.formula,
            scenario: input.scenario,
            provenance_type: input.context?.provenance_type,
        },
        timings_ms: timers.timers,
        artifact_hashes: buildArtifactHashes({
            inputSmiles: graph.canonicalSmiles,
            configSnapshot: { scenario: input.scenario },
            rulesetVersion: ruleset?.version ?? '1.1',
        }),
        trace: {
            parse_summary: 'graph_ok',
            peak_counts: {},
            authority_gate_mode: authorityGateMode,
            helper_contamination_guard_applied: sanitized.contaminationBlocked,
            trace_id: `run_${Date.now()}`,
        },
        feature_snapshot: featureSnapshotFromGraph(features),
        engine_used: input.engineId ?? 'spectrotester',
        analysis_sot: analysisSot,
        drift_telemetry: buildDriftTelemetry({
            ruleResults,
            scoring,
            status: gatedStatusWithFormula,
            analysisSot: analysisSot,
            context: mergedContext,
            trace: {
                authority_gate_mode: authorityGateMode,
                helper_contamination_guard_applied: sanitized.contaminationBlocked,
            },
            artifactHashes: buildArtifactHashes({
                inputSmiles: graph.canonicalSmiles,
                configSnapshot: { scenario: input.scenario },
                rulesetVersion: ruleset?.version ?? '1.1',
            }),
            engineId: input.engineId ?? 'spectrotester',
            scenario: input.scenario,
            rulesetVersion: ruleset?.version ?? '1.1',
        }),
    });
    return {
        success: true,
        verification_report,
        coverage_report: {},
        feature_snapshot: featureSnapshotFromGraph(features),
    };
}
