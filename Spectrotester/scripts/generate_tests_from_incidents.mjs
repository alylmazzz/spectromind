#!/usr/bin/env node
/**
 * Incident taxonomy -> auto test generation cycle.
 * Uses governance telemetry incidents and maps them to deterministic fixtures.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const telemetryFile = join(__dirname, '..', 'artifacts', 'governance', 'governance_telemetry.jsonl');
const taxonomyFile = join(__dirname, '..', 'config', 'incident-taxonomy.json');
const outDir = join(__dirname, '..', 'lib', 'spectra', 'library');
const outFile = join(outDir, 'generated_incident_tests.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  if (!existsSync(taxonomyFile)) {
    console.error('FAIL: incident taxonomy missing', taxonomyFile);
    process.exit(1);
  }
  if (!existsSync(telemetryFile)) {
    console.error('FAIL: telemetry missing; run telemetry emitter first');
    process.exit(1);
  }

  const taxonomy = readJson(taxonomyFile);
  const telemetryLines = readFileSync(telemetryFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const incidents = telemetryLines.flatMap((t) => Array.isArray(t.incident_taxonomy) ? t.incident_taxonomy : []);
  const generated = [];

  for (const incident of incidents) {
    const mapped = taxonomy.mappings?.[incident.incident_code];
    if (!mapped) continue;
    generated.push({
      id: `${incident.incident_code}_${incident.rule_id}`,
      root_cause_class: incident.root_cause_class,
      incident_code: incident.incident_code,
      severity: incident.severity,
      fixture_type: mapped.fixture_type,
      required_assertions: mapped.required_assertions,
      suggested_input: mapped.suggested_input,
    });
  }

  const unique = [];
  const seen = new Set();
  for (const g of generated) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    unique.push(g);
  }

  const payload = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source: 'incident-taxonomy-phase3',
    cases: unique,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`PASS: incident tests generated (${unique.length}) -> ${outFile}`);
}

main();
