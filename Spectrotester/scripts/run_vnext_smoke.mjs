#!/usr/bin/env node
import { readFileSync } from 'fs';

const rulesetPath = new URL('../lib/spectra/library/ruleset.json', import.meta.url);
const ruleset = JSON.parse(readFileSync(rulesetPath, 'utf8'));

const required = [
  'OBS_FID_COMPLEX_DATA_PRESENT',
  'FORMULA_EXACT_MASS_MATCH_WITH_ADDUCT',
  'GLOBAL_REFERENCE_STANDARD_REQUIRED',
  'H1_ALDEHYDIC_PROTON_REGION_IF_ALDEHYDE',
  'C13_O_ALKYL_REGION_IF_O_SP3_C_PRESENT',
  'HSQC_QUATERNARY_CARBON_MUST_NOT_APPEAR',
  'COSY_TERTBUTYL_SHOULD_NOT_FORM_NETWORK',
  'HMBC_IMPOSSIBLE_ONE_BOND_CONTAMINATION_FLAG',
  'NOESY_MIXING_TIME_DECLARED',
  'IR_WATER_CO2_CONTAMINATION_EXCLUSION_WINDOWS',
  'MS_EXACT_MASS_PPM_WITHIN_LIMIT',
];

const ids = new Set((ruleset.rules || []).map((r) => r.rule_id));
const missing = required.filter((id) => !ids.has(id));

const familyCounts = (ruleset.rules || []).reduce((acc, r) => {
  acc[r.modality] = (acc[r.modality] || 0) + 1;
  return acc;
}, {});

const summary = {
  version: ruleset.version,
  total_rules: (ruleset.rules || []).length,
  families: familyCounts,
  missing_required_rules: missing,
};

console.log(JSON.stringify(summary, null, 2));
if (missing.length) process.exit(1);
