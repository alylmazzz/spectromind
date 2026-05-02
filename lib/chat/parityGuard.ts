import type { StructuredEvidenceObject } from '@/lib/chat/contracts';

export interface ParityGuardResult {
  parity_ok: boolean;
  reasons: string[];
}

const POLYMER_LABEL = /(bilinmeyen|unknown|polysacchar|polymer|chitosan)/i;

export function enforceParityGuard(evidence: StructuredEvidenceObject): ParityGuardResult {
  const reasons: string[] = [];
  const is = evidence.identity_surface;
  if (is?.exact_id_active && /oleanolic acid/i.test(is.display_molecule)) {
    if (POLYMER_LABEL.test(is.display_iupac) || POLYMER_LABEL.test(String(is.display_smiles || ''))) {
      reasons.push('STRUCTURE_CARD_SOURCE_PARITY_FAILURE');
    }
    if (is.display_formula && !/^C30H48O3$/i.test(String(is.display_formula).trim())) {
      reasons.push('STRUCTURE_CARD_SOURCE_PARITY_FAILURE');
    }
    if (is.verdict_mode && /INCONCLUSIVE/i.test(is.verdict_mode)) {
      reasons.push('FINAL_VERDICT_RESOLVER_MISMATCH');
    }
    if (is.display_verification_status === 'INCONCLUSIVE') {
      reasons.push('FINAL_VERDICT_RESOLVER_MISMATCH');
    }
  }
  if (evidence.title_source !== evidence.body_source || evidence.body_source !== evidence.summary_source) {
    reasons.push('TITLE_BODY_SUMMARY_CONTRADICTION');
  }
  if (
    evidence.title_source !== evidence.export_source ||
    evidence.body_source !== evidence.export_source ||
    evidence.summary_source !== evidence.export_source
  ) {
    reasons.push('PARITY_VIOLATION');
  }
  if (
    evidence.structure_card_source !== evidence.export_source ||
    evidence.depiction_source !== evidence.export_source ||
    evidence.formula_source !== evidence.export_source ||
    evidence.iupac_source !== evidence.export_source ||
    evidence.smiles_source !== evidence.export_source
  ) {
    reasons.push('STRUCTURE_CARD_SOURCE_PARITY_VIOLATION');
  }
  if (!evidence.export_basis || !evidence.value_basis) {
    reasons.push('EXPORT_VALUE_BASIS_MISSING');
  }
  if (evidence.authority_tier === 'DISPLAY_ONLY_FALLBACK' && evidence.confidence_ceiling > 60) {
    reasons.push('CONFIDENCE_CEILING_BREACH');
  }
  return {
    parity_ok: reasons.length === 0,
    reasons,
  };
}
