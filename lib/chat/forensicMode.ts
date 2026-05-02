import type { AuthorityTier, ForensicRootCauseOutput, StructuredEvidenceObject } from '@/lib/chat/contracts';

const FORENSIC_PATTERN = /why is this happening|root cause|mismatch|contradiction|drift|parity bug|wrong output|kök neden|çelişki|uyumsuz/i;

export function isForensicMessage(message: string): boolean {
  return FORENSIC_PATTERN.test(message);
}

export function buildForensicOutput(
  message: string,
  evidence: StructuredEvidenceObject
): ForensicRootCauseOutput {
  const authority = evidence.authority_tier as AuthorityTier;
  const hasContradiction = evidence.contradiction_analysis.length > 0;
  return {
    symptom: hasContradiction ? evidence.contradiction_analysis[0] : `Soru: ${message}`,
    likely_cause:
      authority === 'DISPLAY_ONLY_FALLBACK'
        ? 'Fallback/helper veriyle yorum yapılmış olabilir.'
        : evidence.qc_status === 'FAIL_WITH_CONFIDENCE_CEILING'
          ? 'Observed QC fail nedeniyle güven ceiling devrede.'
          : 'Kurallar arası parity veya routing drift olabilir.',
    authority_source: authority,
    missing_requirement:
      evidence.title_source !== evidence.summary_source
        ? 'Title/body/summary parity'
        : 'Authoritative observed + provenance completeness',
    next_best_remediation:
      'Authority trace doğrula, contradiction panelini incele, run verification ile tekrar değerlendir.',
  };
}
