import type { AuthorityGateResult, StructuredEvidenceObject } from '@/lib/chat/contracts';

const AUTHORITATIVE_TIERS = new Set(['OBSERVED_PROCESSED_FID', 'AUTHORITATIVE_OBSERVED']);

export function evaluateAuthorityGate(evidence: StructuredEvidenceObject): AuthorityGateResult {
  const reasons: string[] = [];
  const authoritative = AUTHORITATIVE_TIERS.has(evidence.authority_tier);
  let allowed = true;
  let downgraded = false;
  let ceiling = evidence.confidence_ceiling;

  if (!authoritative) {
    downgraded = true;
    ceiling = Math.min(ceiling, 45);
    reasons.push('AUTHORITY_NOT_AUTHORITATIVE_OBSERVED');
  }

  if (evidence.qc_status === 'FAIL_WITH_CONFIDENCE_CEILING') {
    downgraded = true;
    ceiling = Math.min(ceiling, 35);
    reasons.push('QC_FAIL_CONFIDENCE_CEILING');
  }

  if (!evidence.processing_trace.length || !evidence.source_module) {
    allowed = false;
    reasons.push('PROVENANCE_GAP');
  }

  return {
    allowed,
    downgraded,
    effective_confidence_ceiling: ceiling,
    reason_codes: reasons,
  };
}
