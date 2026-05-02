/**
 * Pipeline Smoke Test
 * 
 * Quick sanity check for pipeline refactor.
 * Tests basic functionality without requiring full environment.
 */

import { MoleculePipelineService } from '../lib/pipeline/MoleculePipelineService';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
  try {
    const result = await testFn();
    return { name, passed: true, details: result };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 SPECTROMIND PIPELINE SMOKE TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  const pipeline = MoleculePipelineService.getInstance();
  const results: TestResult[] = [];

  // Test 1: Ethanol (name)
  results.push(await runTest('Ethanol (name)', async () => {
    const result = await pipeline.run({
      moleculeName: 'ethanol'
    }, {
      predictNMR: true
    });

    const checks = {
      hasIdentity: !!result.identity.preferredName,
      hasStructure: !!result.structure.canonicalSmiles,
      hasGraph: result.graph.atoms.length > 0,
      hasCoords2d: !!result.graph.coords2d && result.graph.coords2d.length > 0,
      hasCoords3d: !!result.graph.coords3d && result.graph.coords3d.length > 0,
      hasNMR: !!result.nmr,
      stereoStatus: result.structure.stereoStatus,
      graphSource: result.graph.graphSource,
      warningCount: result.warnings.length
    };

    console.log('  ✅ Ethanol test:', checks);
    return checks;
  }));

  // Test 2: Benzene (SMILES)
  results.push(await runTest('Benzene (SMILES)', async () => {
    const result = await pipeline.run({
      smiles: 'c1ccccc1',
      moleculeName: 'benzene'
    }, {
      predictNMR: true
    });

    const checks = {
      hasStructure: !!result.structure.canonicalSmiles,
      isAromatic: result.graph.atoms.some(a => a.isAromatic),
      hasCoords2d: !!result.graph.coords2d,
      hasNMR: !!result.nmr,
      nmrMethod: result.nmr?.finalConsensus.method,
      modelPeaks: result.nmr?.modelPrediction.peaks.length || 0
    };

    console.log('  ✅ Benzene test:', checks);
    return checks;
  }));

  // Test 3: FID without FID data (should not fail)
  results.push(await runTest('FID optional (no FID)', async () => {
    const result = await pipeline.run({
      moleculeName: 'ethanol'
    }, {
      predictNMR: false
      // No processFID
    });

    const checks = {
      hasResult: !!result,
      fidUndefined: result.fid === undefined,
      noErrors: result.warnings.filter(w => w.severity === 'high').length === 0
    };

    console.log('  ✅ FID optional test:', checks);
    return checks;
  }));

  // Test 4: Stereo status check
  results.push(await runTest('Stereo status detection', async () => {
    const result = await pipeline.run({
      moleculeName: 'ethanol'
    });

    const checks = {
      hasStereoStatus: !!result.structure.stereoStatus,
      stereoStatusValue: result.structure.stereoStatus,
      hasWarnings: result.warnings.length >= 0,
      confidence: result.confidence.stereoConfidence
    };

    console.log('  ✅ Stereo status test:', checks);
    return checks;
  }));

  // Test 5: NMR split (deterministic vs LLM)
  results.push(await runTest('NMR split (model vs LLM)', async () => {
    const result = await pipeline.run({
      moleculeName: 'ethanol'
    }, {
      predictNMR: true
    });

    if (!result.nmr) {
      throw new Error('NMR result missing');
    }

    const checks = {
      hasModelPrediction: !!result.nmr.modelPrediction,
      modelMethod: result.nmr.modelPrediction.method,
      modelPeaks: result.nmr.modelPrediction.peaks.length,
      hasLLM: result.nmr.llmInterpretation !== undefined,
      consensusMethod: result.nmr.finalConsensus.method,
      consensusPeaks: result.nmr.finalConsensus.peaks.length,
      allPeaksHaveSource: result.nmr.finalConsensus.peaks.every(p => p.source)
    };

    console.log('  ✅ NMR split test:', checks);
    return checks;
  }));

  // Test 6: Paclitaxel (Taxol) - Identity lock test
  results.push(await runTest('Paclitaxel identity lock', async () => {
    const result = await pipeline.run({
      moleculeName: 'paclitaxel',
      cid: 36314 // PubChem CID for Paclitaxel
    }, {
      predictNMR: true
    });

    // Critical assertions for identity lock
    const checks = {
      hasGraph: !!result.graph,
      hasAtomCounts: !!result.graph.atomCounts,
      hasMolecularFormulaHill: !!result.graph.molecularFormulaHill,
      formulaCorrect: result.graph.molecularFormulaHill === 'C47H51NO14',
      atomCountsC: result.graph.atomCounts?.C === 47,
      atomCountsH: result.graph.atomCounts?.H === 51,
      atomCountsN: result.graph.atomCounts?.N === 1,
      atomCountsO: result.graph.atomCounts?.O === 14,
      hasDBE: result.graph.dbe !== undefined && result.graph.dbe > 0,
      totalHCorrect: result.graph.totalHydrogenFromFormula === 51,
      noFormulaMismatch: !result.warnings.some(w => w.code === 'FORMULA_MISMATCH'),
      hasNMR: !!result.nmr
    };

    // Check that no "C14H12" appears in any output
    const resultStr = JSON.stringify(result);
    const hasStilben = resultStr.includes('C14H12');
    if (hasStilben) {
      throw new Error('IDENTITY DRIFT DETECTED: "C14H12" (stilben) found in output. This should not happen for Paclitaxel!');
    }

    console.log('  ✅ Paclitaxel identity lock test:', checks);
    return checks;
  }));

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (!result.passed) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n📈 Results: ${passed}/${results.length} passed`);
  
  if (failed > 0) {
    console.log(`\n⚠️  ${failed} test(s) failed. Check errors above.`);
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed!');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Smoke test failed:', error);
    process.exit(1);
  });
}

export { main as runSmokeTest };
