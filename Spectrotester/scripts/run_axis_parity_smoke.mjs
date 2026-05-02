#!/usr/bin/env node
/**
 * Axis parity smoke gate (Phase 3):
 * 1) Shared authoritative axis resolver must exist.
 * 2) Main chart and preview chart must consume the same resolver.
 * 3) Main chart export must carry axis provenance.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const AXIS_HELPER = join(ROOT, 'lib', 'nmr', 'axisParity.ts');
const MAIN_CHART = join(ROOT, 'components', 'charts', 'NMRChart.tsx');
const PREVIEW_CHART = join(ROOT, 'components', 'fid', 'SpectrumPlot.tsx');

function run() {
  const helper = readFileSync(AXIS_HELPER, 'utf8');
  const main = readFileSync(MAIN_CHART, 'utf8');
  const preview = readFileSync(PREVIEW_CHART, 'utf8');

  let passed = 0;
  let failed = 0;

  const hasResolver =
    helper.includes('resolveAuthoritativeAxisDomain') &&
    helper.includes("source: 'processed_axis'") &&
    helper.includes("source: 'safe_fallback'");
  if (hasResolver) {
    passed++;
    console.log('PASS AXIS_PARITY_SHARED_RESOLVER_PRESENT');
  } else {
    failed++;
    console.log('FAIL AXIS_PARITY_SHARED_RESOLVER_PRESENT');
  }

  const mainUsesResolver =
    main.includes("from '@/lib/nmr/axisParity'") &&
    main.includes('resolveAuthoritativeAxisDomain(');
  const previewUsesResolver =
    preview.includes("from '@/lib/nmr/axisParity'") &&
    preview.includes('resolveAuthoritativeAxisDomain(');
  if (mainUsesResolver && previewUsesResolver) {
    passed++;
    console.log('PASS PREVIEW_MAIN_X_SOURCE_PARITY');
  } else {
    failed++;
    console.log('FAIL PREVIEW_MAIN_X_SOURCE_PARITY');
    console.log(`  details: mainUsesResolver=${mainUsesResolver} previewUsesResolver=${previewUsesResolver}`);
  }

  const exportCarriesAxisSource = main.includes('axisSource: axisResolution.source');
  if (exportCarriesAxisSource) {
    passed++;
    console.log('PASS EXPORT_AXIS_PROVENANCE_PRESENT');
  } else {
    failed++;
    console.log('FAIL EXPORT_AXIS_PROVENANCE_PRESENT');
  }

  console.log('');
  console.log(`Axis parity smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
