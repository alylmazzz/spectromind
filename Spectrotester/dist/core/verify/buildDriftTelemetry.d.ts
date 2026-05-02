import type { RuleEvalResult } from './evaluateRules.js';
import type { ScoringResult } from './scoring.js';
import type { DriftTelemetryV1 } from './telemetryTypes.js';
interface BuildDriftTelemetryInput {
    ruleResults: RuleEvalResult[];
    scoring: ScoringResult;
    status: 'PASS' | 'FAIL' | 'PARTIAL' | 'INCONCLUSIVE';
    analysisSot?: Record<string, unknown>;
    context?: Record<string, unknown>;
    trace?: Record<string, unknown>;
    artifactHashes?: Record<string, string>;
    engineId: string;
    scenario?: string;
    rulesetVersion?: string;
}
export declare function buildDriftTelemetry(inp: BuildDriftTelemetryInput): DriftTelemetryV1;
export {};
