/**
 * Load ruleset.json and validate with rule_schema (minimal validation in schemas.ts).
 */

import { validateRuleset } from './schemas.js';
import type { LibraryLoader } from './loadLibrary.js';

export interface RulesetMeta {
  version?: string;
  meta?: Record<string, unknown>;
}

export interface RuleEntry {
  rule_id: string;
  modality: string;
  hardness: string;
  title?: string;
  short_description?: string;
  scientific_rationale?: string;
  prerequisites?: string[];
  priority?: number;
  status_on_fail?: string;
  status_on_skip?: string;
  rule_version?: string;
  applies_to_engines?: string[];
  confidence_impact?: number;
  thresholds?: Record<string, unknown>;
  evidence_capture?: string[];
  why_narrative?: string;
  suggested_action?: string;
  severity?: string;
  scenario_modifiers?: Record<string, unknown>;
  validator_notes?: string;
  tags?: string[];
  references?: Array<{ type: string; value: string }>;
  autofix?: { patch_type?: string; patch_hint?: string } | null;
  authority_scope?: 'OBSERVED_ONLY' | 'AUTHORITATIVE' | 'ANY';
  fallback_policy?: 'IGNORE' | 'NOTE_ONLY' | 'DOWNGRADE' | 'BLOCK';
  modality_required?: boolean;
  metadata_required?: string[];
  metadata_only?: boolean;
  enforcement_mode?: 'scientific' | 'metadata_only';
  authority_tier_required?: string[];
  root_cause_class?: 'DATA_MISSING' | 'PROVENANCE_ERROR' | 'SCIENTIFIC_CONFLICT' | 'THRESHOLD_FRICTION' | 'LIBRARY_GAP';
  autofix_patch_type?: string;
  audit_trace_fields?: string[];
  [key: string]: unknown;
}

export interface RulesetData {
  rules: RuleEntry[];
  version?: string;
  meta?: Record<string, unknown>;
}

const defaultLibraryPath = '../../lib/spectra/library';

function normalizeRule(rule: RuleEntry): RuleEntry {
  const metadataOnly = rule.metadata_only === true;
  return {
    ...rule,
    enforcement_mode: rule.enforcement_mode ?? (metadataOnly ? 'metadata_only' : 'scientific'),
    status_on_skip: rule.status_on_skip ?? 'SKIP',
    status_on_fail: rule.status_on_fail ?? 'FAIL',
  };
}

export async function loadRules(options: {
  libraryPath?: string;
  loadJson?: LibraryLoader;
} = {}): Promise<{ data: RulesetData | null; error?: string }> {
  const base = options.libraryPath ?? defaultLibraryPath;
  const path = `${base}/ruleset.json`.replace(/\/+/g, '/');
  const loader = options.loadJson;
  if (!loader) return { data: null, error: 'loadJson required' };
  try {
    const raw = await loader(path);
    const v = validateRuleset(raw);
    if (!v.ok) return { data: null, error: v.error };
    const d = raw as RulesetData;
    d.rules = d.rules.map(normalizeRule);
    return { data: d };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'loadRules failed' };
  }
}
