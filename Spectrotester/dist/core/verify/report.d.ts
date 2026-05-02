/**
 * Build teyit_raporu_schema-compliant report with artifact_hashes, trace, engine_used.
 */
import type { RuleEvalResult } from './evaluateRules.js';
import type { ScoringResult } from './scoring.js';
import type { GraphFeatures } from '../graph/features.js';
import type { DriftTelemetryV1 } from './telemetryTypes.js';
export interface ReportInput {
    status: 'PASS' | 'FAIL' | 'PARTIAL' | 'INCONCLUSIVE';
    overall: 'PASS' | 'WARN' | 'FAIL' | 'BELIRSIZ';
    summary: string;
    confidence_score: number;
    ruleResults: RuleEvalResult[];
    scoring: ScoringResult;
    root_cause_code?: string;
    recommended_action?: string;
    evidence?: unknown[];
    veto_flags?: unknown[];
    warnings?: unknown[];
    inputs_echo?: Record<string, unknown>;
    timings_ms?: Record<string, number>;
    artifact_hashes?: Record<string, string>;
    trace?: Record<string, unknown>;
    feature_snapshot?: Record<string, unknown>;
    engine_used?: string;
    analysis_sot?: Record<string, unknown>;
    drift_telemetry?: DriftTelemetryV1;
}
export declare function buildReport(inp: ReportInput): Record<string, unknown>;
export declare function featureSnapshotFromGraph(f: GraphFeatures): Record<string, unknown>;
export declare function buildArtifactHashes(payload: {
    inputSmiles?: string;
    configSnapshot?: Record<string, unknown>;
    rulesetVersion?: string;
    libraryVersion?: string;
}): Record<string, string>;
