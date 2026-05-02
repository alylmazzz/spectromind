/**
 * Load ruleset.json and validate with rule_schema (minimal validation in schemas.ts).
 */
import { validateRuleset } from './schemas.js';
const defaultLibraryPath = '../../lib/spectra/library';
function normalizeRule(rule) {
    const metadataOnly = rule.metadata_only === true;
    return {
        ...rule,
        enforcement_mode: rule.enforcement_mode ?? (metadataOnly ? 'metadata_only' : 'scientific'),
        status_on_skip: rule.status_on_skip ?? 'SKIP',
        status_on_fail: rule.status_on_fail ?? 'FAIL',
    };
}
export async function loadRules(options = {}) {
    const base = options.libraryPath ?? defaultLibraryPath;
    const path = `${base}/ruleset.json`.replace(/\/+/g, '/');
    const loader = options.loadJson;
    if (!loader)
        return { data: null, error: 'loadJson required' };
    try {
        const raw = await loader(path);
        const v = validateRuleset(raw);
        if (!v.ok)
            return { data: null, error: v.error };
        const d = raw;
        d.rules = d.rules.map(normalizeRule);
        return { data: d };
    }
    catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'loadRules failed' };
    }
}
