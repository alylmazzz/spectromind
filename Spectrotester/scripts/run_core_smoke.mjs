#!/usr/bin/env node
/**
 * Core engine smoke test: run() with precomputed graph + Node loader.
 * Run after build: npm run build:spectrotester && node Spectrotester/scripts/run_core_smoke.mjs
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, '..', 'dist');
const indexPath = join(distRoot, 'core', 'index.js');
const nodeLoaderPath = join(distRoot, 'core', 'library', 'nodeLoader.js');

if (!existsSync(indexPath)) {
  console.error('Core not built. Run: npx tsc -p Spectrotester/tsconfig.json');
  process.exit(1);
}

const { run } = await import(pathToFileURL(indexPath).href);
const { getDefaultLibraryPath, createNodeLoader } = await import(pathToFileURL(nodeLoaderPath).href);

/** Minimal benzene graph (6 aromatic C, 6 H) */
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
    source: 'js_fallback',
  };
}

async function main() {
  const loadJson = createNodeLoader(getDefaultLibraryPath());
  const graph = minimalBenzeneGraph();

  const result = await run({
    precomputedGraph: graph,
    loadJson,
    libraryPath: getDefaultLibraryPath(),
    engineId: 'spectrotester',
  });

  if (!result.success) {
    console.error('FAIL: run() returned success: false', result.parseError || result.root_cause_code);
    process.exit(1);
  }
  if (!result.verification_report) {
    console.error('FAIL: missing verification_report');
    process.exit(1);
  }
  const r = result.verification_report;
  if (!r.artifact_hashes || typeof r.artifact_hashes !== 'object') {
    console.error('FAIL: report missing artifact_hashes');
    process.exit(1);
  }
  if (!r.feature_snapshot) {
    console.error('FAIL: report missing feature_snapshot');
    process.exit(1);
  }
  if (r.feature_snapshot.aromatic_atom_count !== 6) {
    console.error('FAIL: expected aromatic_atom_count 6, got', r.feature_snapshot.aromatic_atom_count);
    process.exit(1);
  }

  console.log('PASS: core smoke (benzene graph, artifact_hashes, feature_snapshot)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
