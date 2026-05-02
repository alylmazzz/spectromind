#!/usr/bin/env node
/**
 * Phase 3 drift telemetry emitter.
 * Collects authority/parity/verdict signals into JSONL for dashboard ingestion.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, '..', 'dist');
const indexPath = join(distRoot, 'core', 'index.js');
const nodeLoaderPath = join(distRoot, 'core', 'library', 'nodeLoader.js');
const outDir = join(__dirname, '..', 'artifacts', 'governance');
const telemetryJsonl = join(outDir, 'governance_telemetry.jsonl');
const summaryJson = join(outDir, 'governance_dashboard.json');
const forbiddenGateFile = join(outDir, 'forbidden_state_gate.json');

function minimalGraph(smiles, formula) {
  if (smiles === 'c1ccccc1') {
    const atoms = [];
    for (let i = 0; i < 6; i++) {
      atoms.push({ index: i, symbol: 'C', formalCharge: 0, implicitHydrogens: 1, isAromatic: true, hybridization: 'sp2' });
    }
    const bonds = [];
    for (let i = 0; i < 6; i++) {
      bonds.push({ beginAtomIdx: i, endAtomIdx: (i + 1) % 6, bondOrder: 1, bondType: 'AROMATIC', isAromatic: true });
    }
    return { canonicalSmiles: smiles, atoms, bonds, formula, atomCounts: { C: 6, H: 6 }, dbe: 4, source: 'telemetry' };
  }
  return {
    canonicalSmiles: smiles,
    atoms: [
      { index: 0, symbol: 'C', formalCharge: 0, implicitHydrogens: 3, isAromatic: false, hybridization: 'sp3' },
      { index: 1, symbol: 'O', formalCharge: 0, implicitHydrogens: 1, isAromatic: false, hybridization: 'sp3' },
    ],
    bonds: [{ beginAtomIdx: 0, endAtomIdx: 1, bondOrder: 1, bondType: 'SINGLE', isAromatic: false }],
    formula,
    atomCounts: { C: 1, H: 4, O: 1 },
    dbe: 0,
    source: 'telemetry',
  };
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

  const scenarios = [
    {
      name: 'authority_ok_observed',
      runInput: {
        precomputedGraph: minimalGraph('c1ccccc1', 'C6H6'),
        context: { provenance_type: 'observed', authority_tier: 'OBSERVED_PROCESSED_FID', fallback_excluded_from_scoring: true, has_fallback: false },
      },
    },
    {
      name: 'parity_degraded_axis_fallback',
      runInput: {
        precomputedGraph: minimalGraph('c1ccccc1', 'C6H6'),
        context: { provenance_type: 'observed', authority_tier: 'OBSERVED_PROCESSED_FID', axis_fallback_applied: true, fallback_excluded_from_scoring: true, has_fallback: false },
      },
    },
    {
      name: 'verdict_ceiling_fallback_only',
      runInput: {
        precomputedGraph: minimalGraph('c1ccccc1', 'C6H6'),
        context: { provenance_type: 'hybrid', authority_tier: 'DISPLAY_ONLY_FALLBACK', fallback_excluded_from_scoring: true, has_fallback: true, source_package_complete: false },
        observedSpectra: { h1: { peaks: [{ ppm: 7.26, integral: 1, mult: 's' }] } },
      },
    },
  ];

  const lines = [];
  const events = [];
  for (const scenario of scenarios) {
    const result = await run({
      ...scenario.runInput,
      loadJson,
      libraryPath,
      engineId: 'spectrotester',
      scenario: scenario.name,
    });
    const report = result.verification_report ?? {};
    const drift = report.drift_telemetry ?? null;
    if (drift) {
      lines.push(JSON.stringify(drift));
      events.push(drift);
    }
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(telemetryJsonl, `${lines.join('\n')}\n`, 'utf8');

  const forbiddenGate = existsSync(forbiddenGateFile)
    ? JSON.parse(readFileSync(forbiddenGateFile, 'utf8'))
    : null;
  const dashboard = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    total_events: events.length,
    drift_rate_by_type: {
      authority: events.filter((e) => e.authority_metrics?.authority_gate_mode !== 'ALLOW').length,
      parity: events.filter((e) => e.parity_metrics?.parity_state !== 'PARITY_OK').length,
      verdict: events.filter((e) => e.verdict_metrics?.overall !== 'PASS').length,
    },
    forbidden_state_hit_count: forbiddenGate?.failed ?? 0,
    authority_tier_mismatch_count: events.filter((e) => e.authority_metrics?.authority_tier === 'UNKNOWN').length,
    parity_domain_mismatch_count: events.filter((e) => e.parity_metrics?.axis_fallback_applied === true).length,
    verdict_ceiling_breach_count: events.filter((e) => e.verdict_metrics?.confidence_score > 65 && e.parity_metrics?.observed_qc_cap_applied).length,
  };
  writeFileSync(summaryJson, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8');
  console.log(`PASS: Governance telemetry emitted (${events.length} events)`);
}

main().catch((err) => {
  console.error('FAIL: telemetry emitter exception', err);
  process.exit(1);
});
