/**
 * Aggregate rule results into overall status and confidence.
 *
 * Key design decisions:
 * - NOT_EVALUATED rules are tracked separately and reduce coverage
 * - Confidence and coverage are separate metrics
 * - Penalty weights align with ruleset.json scoring_policy
 * - Veto logic uses dedicated scale (not collapsed into confidence)
 */

import type { RuleEvalResult, RuleEvalStatus } from './evaluateRules.js';

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

const DEFAULT_PENALTIES: Record<string, number> = {
  FATAL: 100,
  ERROR: 8,
  FAIL: 15,
  WARN: 3,
  INFO: 0,
  SKIP: 0,
  NOT_APPLICABLE: 0,
  INCONCLUSIVE: 6,
  PASS: 0,
  NOT_EVALUATED: 0,
};

export interface ScoringPolicy {
  base_score?: number;
  penalties?: Record<string, number>;
}

export function aggregateScoring(
  results: RuleEvalResult[],
  policy?: ScoringPolicy
): ScoringResult {
  const penalties = { ...DEFAULT_PENALTIES, ...policy?.penalties };
  const baseScore = policy?.base_score ?? 100;

  let vetoCount = 0;
  let warnCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let notEvaluatedCount = 0;
  let passCount = 0;
  let penalty = 0;
  let metadataPenalty = 0;
  let observedQcCapApplied = false;
  let fallbackGuardFailed = false;

  for (const r of results) {
    const st = r.status as string;
    const metadataOnly =
      r.evidence?.metadata_only === true ||
      r.evidence?.metadata_only_unenforced === true;
    const isObservedQc = r.rule_id.startsWith('OBS_');
    const isGlobalMeta = r.rule_id.startsWith('GLOBAL_');
    if (st === 'FATAL' || st === 'ERROR') {
      vetoCount++;
      if (!metadataOnly) penalty += penalties[st] ?? penalties['ERROR'];
      if (isObservedQc) observedQcCapApplied = true;
    } else if (st === 'FAIL') {
      failCount++;
      if (!metadataOnly) penalty += penalties['FAIL'];
      if (isObservedQc) observedQcCapApplied = true;
    } else if (st === 'WARN') {
      warnCount++;
      if (!metadataOnly) penalty += penalties['WARN'];
      if (isObservedQc) observedQcCapApplied = true;
    } else if (st === 'SKIP') {
      skipCount++;
    } else if (st === 'NOT_APPLICABLE') {
      skipCount++;
    } else if (st === 'INCONCLUSIVE') {
      notEvaluatedCount++;
      if (!metadataOnly) penalty += penalties['INCONCLUSIVE'];
      if (isObservedQc) observedQcCapApplied = true;
    } else if (st === 'NOT_EVALUATED') {
      notEvaluatedCount++;
    } else if (st === 'PASS') {
      passCount++;
    }

    if (!metadataOnly && isGlobalMeta && (st === 'WARN' || st === 'INCONCLUSIVE' || st === 'FAIL')) {
      metadataPenalty += 2;
    }

    if (
      (r.rule_id === 'GLOBAL_FALLBACK_NOT_AUTHORITATIVE' ||
        r.rule_id === 'GLOBAL_SCORE_EXCLUDES_DISPLAY_FALLBACK') &&
      (st === 'ERROR' || st === 'FAIL' || st === 'WARN' || st === 'INCONCLUSIVE')
    ) {
      fallbackGuardFailed = true;
    }
  }

  const totalRules = results.length;
  const evaluatedRules = totalRules - skipCount - notEvaluatedCount;

  const score = Math.max(0, baseScore - penalty - metadataPenalty);

  let confidenceScore: number;
  if (vetoCount > 0) {
    confidenceScore = Math.min(30, score) * 0.3;
  } else {
    confidenceScore = Math.min(100, score);
  }
  if (observedQcCapApplied) confidenceScore = Math.min(confidenceScore, 65);
  if (fallbackGuardFailed) confidenceScore = Math.min(confidenceScore, 35);

  const coverageScore = totalRules > 0
    ? (evaluatedRules / totalRules) * 100
    : 0;

  let overall: ScoringResult['overall'] = 'PASS';
  if (vetoCount > 0) overall = 'FAIL';
  else if (failCount > 0) overall = 'FAIL';
  else if (fallbackGuardFailed) overall = 'INCONCLUSIVE';
  else if (notEvaluatedCount > evaluatedRules * 0.5) overall = 'INCONCLUSIVE';
  else if (warnCount > 0) overall = 'WARN';

  return {
    overall,
    confidenceScore,
    coverageScore,
    vetoCount,
    warnCount,
    failCount,
    skipCount,
    notEvaluatedCount,
    passCount,
    totalRules,
    evaluatedRules,
    metadataPenalty,
    observedQcCapApplied,
  };
}
