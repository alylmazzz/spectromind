#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const telemetryPath = join(root, 'artifacts', 'governance', 'governance_telemetry.jsonl');
const matrixPath = join(root, 'config', 'orchestrator', 'pairing_matrix.json');
const outDir = join(root, 'artifacts', 'governance');
const outPath = join(outDir, 'pairing_decisions.json');

function parseEvents() {
  if (!existsSync(telemetryPath)) return [];
  return readFileSync(telemetryPath, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function main() {
  if (!existsSync(matrixPath)) {
    console.error('FAIL: pairing matrix missing');
    process.exit(1);
  }
  const events = parseEvents();
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
  const decisions = [];

  const authorityIssues = events.filter((e) => Number(e.authority_metrics?.authority_integrity_score ?? 100) < 70).length;
  const parityIssues = events.filter((e) => String(e.parity_metrics?.parity_state ?? 'PARITY_OK') !== 'PARITY_OK').length;

  for (const row of matrix.matrix || []) {
    if (row.task_class === 'authority_parity_verdict_governance') {
      decisions.push({
        task_class: row.task_class,
        selected_pairing:
          authorityIssues > 0
            ? [row.primary, ...(row.secondary || [])]
            : [row.primary],
        reason: authorityIssues > 0 ? 'authority drift detected' : 'steady state'
      });
    } else if (row.task_class === 'chart_parity_focus') {
      decisions.push({
        task_class: row.task_class,
        selected_pairing:
          parityIssues > 0
            ? [row.primary, ...(row.secondary || [])]
            : [],
        reason: parityIssues > 0 ? 'parity drift detected' : 'no parity drift'
      });
    }
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      authorityIssues,
      parityIssues,
      decisions
    }, null, 2)}\n`,
    'utf8'
  );
  console.log('PASS: pairing decisions emitted');
}

main();
