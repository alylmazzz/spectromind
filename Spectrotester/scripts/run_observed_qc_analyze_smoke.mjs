#!/usr/bin/env node
/**
 * Analyze-flow regression smoke:
 * - Observed QC fail olsa bile analiz çalışmalı (success=true).
 * - Sonuç PASS olarak şişmemeli; downgraded/inconclusive kalmalı.
 * - observed QC cap veya authority ceiling uygulanmalı (confidence <= 65 veya <=35).
 *
 * Çalıştırma:
 *   node Spectrotester/scripts/run_observed_qc_analyze_smoke.mjs
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, '..', 'dist');
const indexPath = join(distRoot, 'core', 'index.js');
const nodeLoaderPath = join(distRoot, 'core', 'library', 'nodeLoader.js');

if (!existsSync(indexPath)) {
  console.error('FAIL: Core build missing. Run: npx tsc -p Spectrotester/tsconfig.json');
  process.exit(1);
}

const { run } = await import(pathToFileURL(indexPath).href);
const { getDefaultLibraryPath, createNodeLoader } = await import(pathToFileURL(nodeLoaderPath).href);

function minimalBenzeneGraph() {
  const atoms = [];
  for (let i = 0; i < 6; i++) {
    atoms.push({
      index: i,
      symbol: 'C',
      formalCharge: 0,
      implicitHydrogens: 1,
      isAromatic: true,
      hybridization: 'sp2',
    });
  }

  const bonds = [];
  for (let i = 0; i < 6; i++) {
    bonds.push({
      beginAtomIdx: i,
      endAtomIdx: (i + 1) % 6,
      bondOrder: 1,
      bondType: 'AROMATIC',
      isAromatic: true,
    });
  }

  return {
    canonicalSmiles: 'c1ccccc1',
    atoms,
    bonds,
    formula: 'C6H6',
    atomCounts: { C: 6, H: 6 },
    dbe: 4,
    source: 'smoke_qc_guard',
  };
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    if (details !== undefined) {
      console.error(`FAIL: ${message}`, details);
    } else {
      console.error(`FAIL: ${message}`);
    }
    process.exit(1);
  }
}

async function main() {
  const libraryPath = getDefaultLibraryPath();
  const loadJson = createNodeLoader(libraryPath);

  const result = await run({
    precomputedGraph: minimalBenzeneGraph(),
    loadJson,
    libraryPath,
    engineId: 'spectrotester',
    context: {
      provenance_type: 'observed',
      authority_tier: 'DISPLAY_ONLY_FALLBACK',
      // OBS_* QC regressions to force downgrade path without parser failure:
      raw_complex_fid_present: false, // OBS_FID_COMPLEX_DATA_PRESENT => INCONCLUSIVE
      snr_class: 'lowSNR', // OBS_SNR_MIN_FOR_ASSIGNMENT => WARN
      // Keep fallback guards healthy; we are testing QC downgrade, not fallback contamination.
      fallback_excluded_from_scoring: true,
      has_fallback: true,
    },
  });

  assert(result.success === true, 'analysis should execute even when observed QC fails', {
    parseError: result.parseError,
    root_cause_code: result.root_cause_code,
  });

  const report = result.verification_report ?? {};
  const status = String(report.status ?? '');
  const overall = String(report.overall ?? '');
  const confidence = Number(report.confidence_score ?? NaN);
  const qcSummary = (report.qc_summary ?? {});
  const qcCapApplied = Boolean(qcSummary.observed_qc_cap_applied);
  const authorityGateMode = String(report.trace?.authority_gate_mode ?? '');

  // No silent PASS inflation contract:
  assert(status !== 'PASS', 'status must not remain PASS when observed QC fails', { status, overall, confidence });
  assert(overall !== 'PASS', 'overall must not remain PASS when observed QC fails', { status, overall, confidence });
  assert(
    qcCapApplied === true || authorityGateMode === 'CLASS_LEVEL_ONLY' || authorityGateMode === 'HARD_BLOCK',
    'observed QC cap or authority ceiling must be applied',
    { qcSummary, authorityGateMode }
  );
  assert(
    Number.isFinite(confidence) && (confidence <= 65 || confidence <= 35),
    'confidence must be capped (<=65 observed QC or <=35 authority ceiling)',
    { confidence, authorityGateMode, qcCapApplied }
  );

  // Downgraded/inconclusive release-gate expectation:
  const acceptedStatuses = new Set(['PARTIAL', 'INCONCLUSIVE', 'FAIL']);
  assert(acceptedStatuses.has(status), 'status must be downgraded/inconclusive under observed QC fail', { status, overall });

  console.log('PASS: observed QC fail keeps analysis executable and blocks silent PASS inflation');
}

main().catch((error) => {
  console.error('FAIL: unexpected exception', error);
  process.exit(1);
});
