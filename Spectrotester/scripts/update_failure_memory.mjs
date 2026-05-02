#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const telemetryPath = join(root, 'artifacts', 'governance', 'governance_telemetry.jsonl');
const memoryPath = join(root, 'lib', 'spectra', 'library', 'failure_memory_v1.json');
const policyPath = join(root, 'config', 'orchestrator', 'failure_memory_policy.json');
const outDir = join(root, 'artifacts', 'governance');
const outPath = join(outDir, 'failure_memory_delta.json');

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function main() {
  if (!existsSync(telemetryPath) || !existsSync(memoryPath) || !existsSync(policyPath)) {
    console.error('FAIL: required files missing');
    process.exit(1);
  }
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  const memory = JSON.parse(readFileSync(memoryPath, 'utf8'));
  const events = readFileSync(telemetryPath, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const entries = Array.isArray(memory.entries) ? memory.entries : [];
  const index = new Map(entries.map((e, i) => [`${e.incident_code}::${e.root_cause_class}`, i]));
  const deltas = [];

  for (const e of events) {
    const incidents = Array.isArray(e.incident_taxonomy) ? e.incident_taxonomy : [];
    for (const inc of incidents) {
      const key = `${inc.incident_code}::${inc.root_cause_class}`;
      const now = new Date().toISOString();
      if (!index.has(key)) {
        const created = {
          root_cause_class: inc.root_cause_class,
          incident_code: inc.incident_code,
          domain: inc.domain,
          first_seen_ts: now,
          last_seen_ts: now,
          occurrence_count: 1,
          severity_peak: inc.severity,
          paired_subagents: [],
          mitigation_action: inc.suggested_action || 'TBD',
          mitigation_effectiveness: policy.mitigation_effectiveness.initial,
          open: true
        };
        entries.push(created);
        index.set(key, entries.length - 1);
        deltas.push({ type: 'created', key });
      } else {
        const idx = index.get(key);
        const old = entries[idx];
        old.last_seen_ts = now;
        old.occurrence_count += 1;
        old.severity_peak = old.severity_peak === 'CRITICAL' ? 'CRITICAL' : inc.severity;
        old.mitigation_effectiveness = clamp(
          old.mitigation_effectiveness - policy.mitigation_effectiveness.decrease_step,
          policy.mitigation_effectiveness.min,
          policy.mitigation_effectiveness.max
        );
        old.open = true;
        deltas.push({ type: 'updated', key, occurrence_count: old.occurrence_count });
      }
    }
  }

  memory.memory_version = '1.0.0';
  memory.updated_at = new Date().toISOString();
  memory.entries = entries;
  writeFileSync(memoryPath, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      updated_entries: deltas.length,
      deltas
    }, null, 2)}\n`,
    'utf8'
  );
  console.log('PASS: failure memory updated');
}

main();
