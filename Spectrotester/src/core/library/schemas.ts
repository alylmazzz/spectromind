/**
 * Schema validation for library and report. Uses minimal checks (no Ajv dependency)
 * so core stays lightweight; optional Ajv can be added later for full JSON Schema.
 */

export function validateRuleShape(rule: unknown): { ok: boolean; error?: string } {
  if (!rule || typeof rule !== 'object') return { ok: false, error: 'rule must be object' };
  const r = rule as Record<string, unknown>;
  if (typeof r.rule_id !== 'string' || r.rule_id.length < 5) return { ok: false, error: 'rule_id required (min 5)' };
  if (!['HARD', 'SOFT', 'INFO'].includes(r.hardness as string)) return { ok: false, error: 'hardness must be HARD|SOFT|INFO' };
  if (r.status_on_fail !== undefined && !['FAIL', 'WARN', 'INCONCLUSIVE', 'ERROR', 'FATAL'].includes(r.status_on_fail as string)) {
    return { ok: false, error: 'status_on_fail invalid' };
  }
  if (r.status_on_skip !== undefined && !['SKIP', 'NOT_APPLICABLE', 'INCONCLUSIVE'].includes(r.status_on_skip as string)) {
    return { ok: false, error: 'status_on_skip invalid' };
  }
  if (r.authority_scope !== undefined && !['OBSERVED_ONLY', 'AUTHORITATIVE', 'ANY'].includes(r.authority_scope as string)) {
    return { ok: false, error: 'authority_scope invalid' };
  }
  if (r.fallback_policy !== undefined && !['IGNORE', 'NOTE_ONLY', 'DOWNGRADE', 'BLOCK'].includes(r.fallback_policy as string)) {
    return { ok: false, error: 'fallback_policy invalid' };
  }
  if (r.root_cause_class !== undefined && !['DATA_MISSING', 'PROVENANCE_ERROR', 'SCIENTIFIC_CONFLICT', 'THRESHOLD_FRICTION', 'LIBRARY_GAP'].includes(r.root_cause_class as string)) {
    return { ok: false, error: 'root_cause_class invalid' };
  }
  if (r.metadata_only !== undefined && typeof r.metadata_only !== 'boolean') {
    return { ok: false, error: 'metadata_only must be boolean' };
  }
  if (r.enforcement_mode !== undefined && !['scientific', 'metadata_only'].includes(r.enforcement_mode as string)) {
    return { ok: false, error: 'enforcement_mode invalid' };
  }
  return { ok: true };
}

export function validateRuleset(data: unknown): { ok: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { ok: false, error: 'ruleset must be object' };
  const d = data as Record<string, unknown>;
  const rules = d.rules;
  if (!Array.isArray(rules)) return { ok: false, error: 'ruleset.rules must be array' };
  for (let i = 0; i < rules.length; i++) {
    const v = validateRuleShape(rules[i]);
    if (!v.ok) return { ok: false, error: `rules[${i}]: ${v.error}` };
  }
  return { ok: true };
}

export function validateReportShape(report: unknown): { ok: boolean; error?: string } {
  if (!report || typeof report !== 'object') return { ok: false, error: 'report must be object' };
  const r = report as Record<string, unknown>;
  const status = r.status;
  if (!['PASS', 'FAIL', 'PARTIAL', 'INCONCLUSIVE'].includes(status as string)) return { ok: false, error: 'status must be PASS|FAIL|PARTIAL|INCONCLUSIVE' };
  if (typeof r.overall !== 'string') return { ok: false, error: 'overall required' };
  if (typeof r.summary !== 'string') return { ok: false, error: 'summary required' };
  if (typeof r.confidence_score !== 'number') return { ok: false, error: 'confidence_score required (number)' };
  return { ok: true };
}
