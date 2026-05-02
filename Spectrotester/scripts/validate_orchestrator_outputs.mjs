#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cyclePath = join(root, 'artifacts', 'governance', 'orchestrator_cycle_report.json');

function fail(msg, detail) {
  console.error(`FAIL: ${msg}`, detail ?? '');
  process.exit(1);
}

function main() {
  if (!existsSync(cyclePath)) fail('orchestrator cycle report missing');
  const obj = JSON.parse(readFileSync(cyclePath, 'utf8'));
  const required = [
    'schema_version',
    'task_class',
    'active_subagent_set',
    'coverage_gaps',
    'quality_risks',
    'decisions',
    'final_quality_verdict',
    'acceptance_status'
  ];
  for (const k of required) {
    if (!(k in obj)) fail(`missing required field ${k}`);
  }
  if (!Array.isArray(obj.active_subagent_set)) fail('active_subagent_set must be array');
  if (!Array.isArray(obj.decisions)) fail('decisions must be array');
  if (!['STRONG', 'PARTIAL', 'REWORK'].includes(String(obj.final_quality_verdict))) fail('final_quality_verdict invalid');
  if (!['PASS', 'FAIL'].includes(String(obj.acceptance_status))) fail('acceptance_status invalid');
  console.log('PASS: orchestrator output schema validation');
}

main();
