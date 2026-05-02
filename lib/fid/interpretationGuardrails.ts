import type { AIAnalysisResult } from '@/lib/types';

export interface ObservedQcRule {
  id: string;
  passed: boolean;
  severity: 'info' | 'warn' | 'fatal';
  message: string;
}

export interface ObservedQcOverlayLike {
  interpretationBlocked?: boolean;
  qcRules?: ObservedQcRule[];
}

export interface GuardrailAdjustment {
  adjustedResult: AIAnalysisResult;
  blocked: boolean;
  appliedRules: string[];
  notes: string[];
}

const REFERENCE_FAIL_RULE_IDS = new Set([
  'OBSERVED_H1_REFERENCE_LOCK_REQUIRED',
  'OBS_REFERENCE_ALIGNMENT_WITH_STANDARD',
]);

const PHASE_BASELINE_FAIL_RULE_IDS = new Set([
  'OBSERVED_H1_PHASE_BASELINE_PROVENANCE_REQUIRED',
  'OBS_PHASE_BASELINE_CHAIN_COMPLETE',
]);

const HELPER_CONTAMINATION_RULE_IDS = new Set([
  'OBSERVED_H1_HELPER_CONTAMINATION_FATAL',
]);

function clampConfidence(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function applyObservedQcGuardrails(
  result: AIAnalysisResult,
  observedOverlay: ObservedQcOverlayLike | null | undefined
): GuardrailAdjustment {
  const qcRules = observedOverlay?.qcRules ?? [];
  const failedRules = qcRules.filter((r) => !r.passed);
  const failedRuleIds = failedRules.map((r) => r.id);
  const failedRuleSet = new Set(failedRuleIds);

  let confidence = clampConfidence(result.confidence ?? 0);
  const notes: string[] = [];

  const hasAnyObservedFailure = failedRules.length > 0;
  if (hasAnyObservedFailure) {
    confidence *= 0.8;
    notes.push('Observed QC fail nedeniyle sınıf seviyesi confidence düşürüldü.');
  }

  const hasReferenceFailure = failedRuleIds.some((id) => REFERENCE_FAIL_RULE_IDS.has(id));
  if (hasReferenceFailure) {
    confidence *= 0.85;
    notes.push('Reference QC fail nedeniyle ppm-tabanlı yorum etkisi zayıflatıldı.');
  }

  const hasPhaseBaselineFailure = failedRuleIds.some((id) => PHASE_BASELINE_FAIL_RULE_IDS.has(id));
  if (hasPhaseBaselineFailure) {
    confidence *= 0.85;
    notes.push('Phase/Baseline QC fail nedeniyle multiplicity/integral güveni düşürüldü.');
  }

  const hasHelperContamination = failedRuleIds.some((id) => HELPER_CONTAMINATION_RULE_IDS.has(id));
  const blockedByFatal = Boolean(observedOverlay?.interpretationBlocked);
  const blocked = blockedByFatal || hasHelperContamination;
  if (blocked) {
    confidence = Math.min(confidence, 30);
    notes.push('Observed QC fatal/helper contamination nedeniyle verdict INCONCLUSIVE olarak sınırlandı.');
    notes.push('Authoritative observed QC başarısız olduğundan yapısal yorum güveni düşük seviyede tutuldu.');
  }

  const verificationStatus: AIAnalysisResult['verificationStatus'] = blocked
    ? 'INCONCLUSIVE'
    : hasAnyObservedFailure
      ? 'WARN'
      : 'PASS';

  const inconclusivePrefix = blocked
    ? 'INCONCLUSIVE: Observed QC fatal kural ihlali nedeniyle sonuç yalnızca düşük güvenli yönlendirici yorum olarak sunulur.'
    : '';
  const adjustedReasoningSuffix = notes.length
    ? `\n\n[Observed QC Guardrail]\n- Failed rules: ${failedRuleIds.join(', ') || 'none'}\n- ${notes.join('\n- ')}`
    : '';

  const adjustedResult: AIAnalysisResult = {
    ...result,
    confidence: Math.round(clampConfidence(confidence)),
    reasoning: `${inconclusivePrefix ? `${inconclusivePrefix}\n\n` : ''}${result.reasoning || ''}${adjustedReasoningSuffix}`.trim(),
    verificationStatus,
    verificationNotes: notes,
    verificationRuleIds: failedRuleIds,
    alternatives: result.alternatives?.map((alt) => ({
      ...alt,
      confidence: blocked
        ? Math.min(alt.confidence, 35)
        : Math.min(alt.confidence, Math.round(clampConfidence(confidence + 10))),
    })),
  };

  if (blocked && !failedRuleSet.has('INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL')) {
    notes.push('INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL kuralı aktif kabul edildi.');
  }

  return {
    adjustedResult,
    blocked,
    appliedRules: failedRuleIds,
    notes,
  };
}
