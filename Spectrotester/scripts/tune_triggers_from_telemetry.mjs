#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const telemetryPath = join(root, 'artifacts', 'governance', 'governance_telemetry.jsonl');
const thresholdPath = join(root, 'config', 'orchestrator', 'trigger_thresholds.json');
const outDir = join(root, 'artifacts', 'governance');
const outPath = join(outDir, 'trigger_tuning_snapshot.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  if (!existsSync(telemetryPath) || !existsSync(thresholdPath)) {
    console.error('FAIL: telemetry or thresholds missing');
    process.exit(1);
  }
  const lines = readFileSync(telemetryPath, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const events = lines.map((l) => JSON.parse(l));
  const cfg = readJson(thresholdPath);
  const prev = { ...cfg.thresholds };

  const parityAvg =
    events.length > 0
      ? events.reduce((acc, e) => acc + Number(e.parity_metrics?.parity_drift_index ?? 0), 0) / events.length
      : 0;
  const authorityMin =
    events.length > 0
      ? Math.min(...events.map((e) => Number(e.authority_metrics?.authority_integrity_score ?? 100)))
      : 100;
  const forbiddenHits = events.reduce((acc, e) => {
    const arr = Array.isArray(e.incident_taxonomy) ? e.incident_taxonomy : [];
    return acc + arr.filter((i) => String(i.incident_code || '').includes('FALLBACK') || String(i.incident_code || '').includes('PROVENANCE')).length;
  }, 0);

  let nextParity = prev.parity_drift_index_max;
  if (parityAvg > prev.parity_drift_index_max * 0.8) nextParity = Math.max(0.05, Number((prev.parity_drift_index_max - 0.02).toFixed(3)));
  else if (parityAvg < prev.parity_drift_index_max * 0.4) nextParity = Math.min(0.5, Number((prev.parity_drift_index_max + 0.01).toFixed(3)));

  let nextAuthority = prev.authority_integrity_min;
  if (authorityMin < prev.authority_integrity_min) nextAuthority = Math.min(95, prev.authority_integrity_min + 2);
  if (forbiddenHits === 0 && authorityMin > prev.authority_integrity_min + 10) nextAuthority = Math.max(60, prev.authority_integrity_min - 1);

  const updated = {
    ...cfg,
    thresholds: {
      ...cfg.thresholds,
      parity_drift_index_max: nextParity,
      authority_integrity_min: nextAuthority
    }
  };
  writeFileSync(thresholdPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      telemetry_events: events.length,
      previous: prev,
      tuned: updated.thresholds,
      signals: { parityAvg, authorityMin, forbiddenHits }
    }, null, 2)}\n`,
    'utf8'
  );
  console.log('PASS: trigger tuning snapshot emitted');
}

main();
