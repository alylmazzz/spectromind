#!/usr/bin/env node
/**
 * Phase 3 forbidden-state hard gate.
 * Blocks release when critical scientific forbidden states are detected.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, '..', 'dist');
const indexPath = join(distRoot, 'core', 'index.js');
const nodeLoaderPath = join(distRoot, 'core', 'library', 'nodeLoader.js');
const outDir = join(__dirname, '..', 'artifacts', 'governance');
const outFile = join(outDir, 'forbidden_state_gate.json');

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
    source: 'phase3_forbidden_gate',
  };
}

function assertCase(name, ok, detail) {
  return { name, ok, detail };
}

async function main() {
  if (!existsSync(indexPath)) {
    console.error('FAIL: Core build missing. Run: npm run build:spectrotester');
    process.exit(1);
  }

  const { run } = await import(pathToFileURL(indexPath).href);
  const { getDefaultLibraryPath, createNodeLoader } = await import(pathToFileURL(nodeLoaderPath).href);
  const libraryPath = getDefaultLibraryPath();
  const loadJson = createNodeLoader(libraryPath);

  const cases = [];

  // Forbidden #1 + #4: helper/fallback contamination & fallback-only strong verdict.
  const fallbackRun = await run({
    precomputedGraph: minimalBenzeneGraph(),
    loadJson,
    libraryPath,
    engineId: 'spectrotester',
    context: {
      provenance_type: 'hybrid',
      authority_tier: 'DISPLAY_ONLY_FALLBACK',
      fallback_excluded_from_scoring: true,
      has_fallback: true,
      source_package_complete: false,
      axis_fallback_applied: true,
    },
    observedSpectra: {
      h1: { peaks: [{ ppm: 7.26, integral: 1, mult: 's' }] },
      hsqcPeaks: [{ f1: 120, f2: 7.26, intensity: 1 }],
    },
  });
  const fallbackReport = fallbackRun.verification_report ?? {};
  const fallbackStatus = String(fallbackReport.status ?? '');
  const fallbackOverall = String(fallbackReport.overall ?? '');
  const fallbackConf = Number(fallbackReport.confidence_score ?? NaN);
  cases.push(assertCase(
    'FORBIDDEN_FALLBACK_ONLY_STRONG_VERDICT',
    fallbackStatus !== 'PASS' && fallbackOverall !== 'PASS' && Number.isFinite(fallbackConf) && fallbackConf <= 35,
    { fallbackStatus, fallbackOverall, fallbackConf }
  ));

  // Forbidden #3: formula mismatch silent pass must not happen.
  const formulaRun = await run({
    precomputedGraph: minimalBenzeneGraph(),
    loadJson,
    libraryPath,
    engineId: 'spectrotester',
    formula: 'C7H8', // bilerek mismatch
    context: {
      provenance_type: 'observed',
      authority_tier: 'OBSERVED_PROCESSED_FID',
      fallback_excluded_from_scoring: true,
      has_fallback: false,
    },
  });
  const formulaReport = formulaRun.verification_report ?? {};
  const formulaOverall = String(formulaReport.overall ?? '');
  cases.push(assertCase(
    'FORBIDDEN_FORMULA_MISMATCH_SILENT_PASS',
    formulaOverall !== 'PASS',
    { formulaOverall }
  ));

  // Forbidden #5: title/body/summary parity mismatch.
  const parityRun = await run({
    precomputedGraph: minimalBenzeneGraph(),
    loadJson,
    libraryPath,
    engineId: 'spectrotester',
    context: {
      provenance_type: 'observed',
      authority_tier: 'OBSERVED_PROCESSED_FID',
      fallback_excluded_from_scoring: true,
      has_fallback: false,
    },
  });
  const parityReport = parityRun.verification_report ?? {};
  const titleSource = String(parityReport.title_source ?? '');
  const bodySource = String(parityReport.body_source ?? '');
  const summarySource = String(parityReport.summary_source ?? '');
  cases.push(assertCase(
    'FORBIDDEN_TITLE_BODY_SUMMARY_MISMATCH',
    titleSource === bodySource && bodySource === summarySource,
    { titleSource, bodySource, summarySource }
  ));

  const failedCases = cases.filter((c) => !c.ok);
  const payload = {
    ts: new Date().toISOString(),
    gate: 'forbidden',
    total: cases.length,
    failed: failedCases.length,
    status: failedCases.length === 0 ? 'PASS' : 'FAIL',
    cases,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  if (failedCases.length > 0) {
    console.error('FAIL: Forbidden-state gate blocked release.');
    for (const c of failedCases) {
      console.error(` - ${c.name}`, c.detail);
    }
    process.exit(1);
  }

  console.log(`PASS: Forbidden-state gate (${cases.length} checks)`);
}

main().catch((err) => {
  console.error('FAIL: forbidden-state gate exception', err);
  process.exit(1);
});
