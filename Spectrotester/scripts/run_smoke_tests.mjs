#!/usr/bin/env node
/**
 * HMBC alpha-H gating smoke test runner.
 * Reads smoke_tests_hmbc_alpha_h_gating.json and runs minimal heuristic:
 * carbonyl + alpha C-H presence => HMBC carbonyl required.
 * Neden: Tek testle regresyon yakalanmaz; gating kritik doğrulama katmanı.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, '..', 'lib', 'spectra', 'library');
const SMOKE_FILE = join(LIB, 'smoke_tests_hmbc_alpha_h_gating.json');
const RULESET_FILE = join(LIB, 'ruleset.json');
const HTML_FILE = join(__dirname, '..', 'Spectromasterv0.2tester.html');

/**
 * Minimal heuristic: SMILES'te karbonil var mı? Alpha C–H var mı?
 * - Karbonil: C=O, C(=O)
 * - Asit-only (alpha C–H yok): C(=O)O, c...C(=O)O, FC(F)(F)C(=O)O, O=CO
 * - Ester/keton/amid/aldehit + alpha: CC(=O), C(=O)OC, C(=O)N, C=O (formil H)
 */
function hasAlphaHForCarbonyl(smiles) {
  const s = (smiles || '').replace(/\s/g, '');
  if (!s) return false;
  const hasCarbonyl = /C=O|C\(=O\)/.test(s);
  if (!hasCarbonyl) return false;
  if (/C\(=O\)O[H]?(\s|$)|C\(=O\)O\)/.test(s) && !/C\(=O\)O[C]/.test(s)) return false;
  if (/O=CO/.test(s)) return false;
  if (/FC\(F\)F?C\(=O\)|C\(F\)F?C\(=O\)O/.test(s)) return false;
  if (/c1ccccc1C\(=O\)O(\s|$)/.test(s)) return false;
  return true;
}

function main() {
  let data;
  try {
    data = JSON.parse(readFileSync(SMOKE_FILE, 'utf8'));
  } catch (e) {
    console.error('FAIL: Could not read', SMOKE_FILE, e.message);
    process.exit(1);
  }

  const cases = data.test_cases || [];
  const ruleset = JSON.parse(readFileSync(RULESET_FILE, 'utf8'));
  const html = readFileSync(HTML_FILE, 'utf8');
  let passed = 0;
  let failed = 0;

  console.log('HMBC alpha-H gating smoke tests');
  console.log('Rule:', data.rule_id);
  console.log('');

  for (const tc of cases) {
    const got = hasAlphaHForCarbonyl(tc.smiles);
    const okAlpha = got === tc.expected_has_alpha_h_for_carbonyl;
    const okRequired = (tc.expected_hmbc_carbonyl_required === undefined) || (got === tc.expected_hmbc_carbonyl_required);
    const ok = okAlpha && okRequired;

    if (ok) {
      passed++;
      console.log(`  PASS ${tc.id} ${tc.smiles}`);
    } else {
      failed++;
      console.log(`  FAIL ${tc.id} ${tc.smiles}`);
      console.log(`       expected_has_alpha_h: ${tc.expected_has_alpha_h_for_carbonyl}, got: ${got}`);
    }
  }

  console.log('');
  console.log(`Total: ${passed} passed, ${failed} failed`);
  console.log('');

  // Final-repair regression guards (acceptance-style smoke)
  const requiredRuleIds = [
    'GLOBAL_PROVENANCE_REQUIRED',
    'GLOBAL_FALLBACK_NOT_AUTHORITATIVE',
    'GLOBAL_SCORE_EXCLUDES_DISPLAY_FALLBACK',
    'GLOBAL_FILE_PROTOCOL_GRAPH_FALLBACK_REQUIRED',
    'H1_NO_SYNTHETIC_PATCH_PEAK',
    'HSQC_EXCHANGEABLE_REASON_ONLY_FOR_TRUE_XH',
    'NOESY_MIXTIME_MISSING_NOTE_ONLY',
    'MS_ISOTOPE_COMPANION_NOT_MASS_ERROR',
    'IR_BAND_ABSENT_VS_UNRESOLVED_SEPARATED',
    'LIBRARY_COVERAGE_EVIDENCE_WEIGHTED'
  ];
  const present = new Set((ruleset.rules || []).map(r => r.rule_id));
  for (const rid of requiredRuleIds) {
    if (!present.has(rid)) {
      failed++;
      console.log(`  FAIL missing rule: ${rid}`);
    }
  }

  const forbiddenTexts = [
    'Broad Aliphatic Hump (patch)',
    'Proton is on O or N (exchangeable)',
    'fingerprint_match ? 0.99 : 0.75'
  ];
  for (const bad of forbiddenTexts) {
    if (html.includes(bad)) {
      failed++;
      console.log(`  FAIL forbidden text present: ${bad}`);
    } else {
      passed++;
      console.log(`  PASS forbidden text absent: ${bad}`);
    }
  }

  const expectedMarkers = [
    'classifyMissingHSQCCause',
    'missing_authoritative_data',
    'isotope companion',
    'formula_consensus',
    'parser_consensus_override',
    'C30H48O3'
  ];
  for (const marker of expectedMarkers) {
    if (!html.includes(marker)) {
      failed++;
      console.log(`  FAIL expected marker missing: ${marker}`);
    } else {
      passed++;
      console.log(`  PASS expected marker present: ${marker}`);
    }
  }
  if (JSON.stringify(ruleset.meta || {}).includes('display_fallback_score_contribution')) {
    passed++;
    console.log('  PASS expected marker present: display_fallback_score_contribution(meta)');
  } else {
    failed++;
    console.log('  FAIL expected marker missing: display_fallback_score_contribution(meta)');
  }

  console.log('');
  console.log(`Grand Total: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
