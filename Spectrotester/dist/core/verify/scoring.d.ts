/**
 * Aggregate rule results into overall status and confidence.
 *
 * Key design decisions:
 * - NOT_EVALUATED rules are tracked separately and reduce coverage
 * - Confidence and coverage are separate metrics
 * - Penalty weights align with ruleset.json scoring_policy
 * - Veto logic uses dedicated scale (not collapsed into confidence)
 */
import type { RuleEvalResult } from './evaluateRules.js';
export interface ScoringResult {
    overall: 'PASS' | 'WARN' | 'FAIL' | 'INCONCLUSIVE';
    confidenceScore: number;
    coverageScore: number;
    vetoCount: number;
    warnCount: number;
    failCount: number;
    skipCount: number;
    notEvaluatedCount: number;
    passCount: number;
    totalRules: number;
    evaluatedRules: number;
    metadataPenalty: number;
    observedQcCapApplied: boolean;
}
export interface ScoringPolicy {
    base_score?: number;
    penalties?: Record<string, number>;
}
export declare function aggregateScoring(results: RuleEvalResult[], policy?: ScoringPolicy): ScoringResult;
