#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'artifacts', 'governance');
const cycleOut = join(outDir, 'orchestrator_cycle_report.json');
const telemetryPath = join(outDir, 'governance_telemetry.jsonl');
const dashboardPath = join(outDir, 'governance_dashboard.json');
const pairingPolicyPath = join(root, 'config', 'orchestrator', 'subagent_pairing_policy.json');
const triggerRulesPath = join(root, 'config', 'orchestrator', 'trigger_rules.json');
const loopPolicyPath = join(root, 'config', 'orchestrator', 'phase4_loop_policy.json');

function runNodeScript(scriptName) {
  const scriptPath = join(root, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with code ${result.status}`);
  }
}

function parseEvents(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function main() {
  if (!existsSync(telemetryPath) || !existsSync(dashboardPath)) {
    throw new Error('Phase3 telemetry artifacts not found. Run phase3 first.');
  }

  runNodeScript('tune_triggers_from_telemetry.mjs');
  runNodeScript('optimize_subagent_pairings.mjs');
  runNodeScript('update_failure_memory.mjs');

  const events = parseEvents(telemetryPath);
  const dashboard = JSON.parse(readFileSync(dashboardPath, 'utf8'));
  const pairingPolicy = JSON.parse(readFileSync(pairingPolicyPath, 'utf8'));
  const triggerRules = JSON.parse(readFileSync(triggerRulesPath, 'utf8'));
  const loopPolicy = JSON.parse(readFileSync(loopPolicyPath, 'utf8'));

  const coverageGaps = [];
  const qualityRisks = [];
  if ((dashboard.forbidden_state_hit_count ?? 0) > 0) coverageGaps.push('forbidden-state incidents still present');
  if ((dashboard.parity_domain_mismatch_count ?? 0) > 0) qualityRisks.push('parity domain mismatch detected');
  if ((dashboard.authority_tier_mismatch_count ?? 0) > 0) qualityRisks.push('authority tier mismatch detected');

  const decisions = [
    {
      category: 'trigger_tuning',
      action: 'thresholds adjusted from telemetry',
      reason: 'phase4 continuity loop'
    },
    {
      category: 'pairing_optimization',
      action: 'pairing decisions emitted',
      reason: 'domain drift signal alignment'
    },
    {
      category: 'failure_memory',
      action: 'failure memory updated',
      reason: 'incident recurrence tracking'
    }
  ];

  const activeSubagents = Array.from(
    new Set(
      Object.values(pairingPolicy.task_classes || {})
        .flatMap((p) => [p.primary, ...(p.secondary || [])])
        .filter(Boolean)
    )
  );

  const acceptancePass =
    (dashboard.forbidden_state_hit_count ?? 0) <= (loopPolicy.quality_gates?.max_blocker_incidents ?? 0);

  const report = {
    schema_version: '1.0.0',
    task_class: 'authority_parity_verdict_governance',
    active_subagent_set: activeSubagents,
    prompt_reinforcement: triggerRules.rules.map((r) => r.id),
    coverage_gaps: coverageGaps,
    quality_risks: qualityRisks,
    decisions,
    telemetry_events: events.length,
    final_quality_verdict: acceptancePass ? 'STRONG' : 'REWORK',
    acceptance_status: acceptancePass ? 'PASS' : 'FAIL'
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(cycleOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  runNodeScript('validate_orchestrator_outputs.mjs');
  console.log('PASS: Phase 4 orchestrator self-improvement cycle completed');
}

main();
