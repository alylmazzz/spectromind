/**
 * DBE Block Post-Process Smoke Test
 * 
 * Tests that DBE analysis block is correctly replaced with locked formula
 * even when AI generates wrong formula and DBE calculation.
 */

import { renderDBEBlock, normalizeFormula, parseFormulaToAtomCounts, computeDBE } from '../lib/chem/formula';

interface TestCase {
  name: string;
  lockedFormula: string;
  aiReasoning: string;
  expectedFormula: string;
  expectedDBE: number;
}

const testCases: TestCase[] = [
  {
    name: 'Paclitaxel - AI generates C10H10O',
    lockedFormula: 'C47H51NO14',
    aiReasoning: `**0. DBE Analizi (ZORUNLU!):**
- Formül: C10H10O
- DBE Hesabı: DBE = 10 - 10/2 + 1 = 7
- DBE Yorumu: İki benzen halkası (DBE=4) ve bir karbonil grubu (DBE=1) bekleniyor.
- NMR Doğrulaması: δ 7-8 ppm aromatik sinyaller var ✓, karbonil peak'i var ✓

**1. Peak Analizi (Her peak için):**
- δ 8.13 ppm: (d, 2H, J=7.2 Hz) → Aromatik protonlar`,
    expectedFormula: 'C47H51NO14',
    expectedDBE: 23 // 47 - 51/2 + 1/2 + 1 = 47 - 25.5 + 0.5 + 1 = 23
  },
  {
    name: 'Ethanol - AI generates wrong formula',
    lockedFormula: 'C2H6O',
    aiReasoning: `**0. DBE Analizi (ZORUNLU!):**
- Formül: C3H8O
- DBE Hesabı: DBE = 3 - 8/2 + 1 = 0
- DBE Yorumu: Doymuş zincir

**1. Peak Analizi:**`,
    expectedFormula: 'C2H6O',
    expectedDBE: 0 // 2 - 6/2 + 1 = 0
  },
  {
    name: 'Benzene - No DBE block in AI response',
    lockedFormula: 'C6H6',
    aiReasoning: `**1. Peak Analizi:**
- δ 7.2 ppm: (m, 6H) → Aromatik protonlar`,
    expectedFormula: 'C6H6',
    expectedDBE: 4 // 6 - 6/2 + 1 = 4
  },
  {
    name: 'Placeholder replacement',
    lockedFormula: 'C9H8O4',
    aiReasoning: `<<DBE_BLOCK_INSERTED_BY_APP>>

**1. Peak Analizi:**`,
    expectedFormula: 'C9H8O4',
    expectedDBE: 6 // 9 - 8/2 + 1 = 6
  }
];

function replaceDBEBlock(reasoning: string, lockedFormula: string): string {
  if (!lockedFormula) return reasoning;
  
  const normalizedFormula = normalizeFormula(lockedFormula);
  const dbeBlock = renderDBEBlock(normalizedFormula);
  
  if (!dbeBlock) return reasoning;
  
  // Replace existing DBE block if present
  const dbeBlockPattern = /\*\*0\.\s*DBE\s*Analizi[\s\S]*(\*\*[^0]|\n\n\*\*|$)/;
  
  if (dbeBlockPattern.test(reasoning)) {
    // Replace existing DBE block
    reasoning = reasoning.replace(
      dbeBlockPattern,
      (match) => {
        // Find the end of the DBE block (before next "**" header)
        const nextHeaderIndex = match.indexOf('\n\n**', match.indexOf('**0'));
        if (nextHeaderIndex > 0) {
          return dbeBlock + match.substring(nextHeaderIndex);
        }
        return dbeBlock;
      }
    );
  } else {
    // Insert DBE block at the beginning (before "**1." or at start)
    const firstSectionIndex = reasoning.indexOf('**1.');
    if (firstSectionIndex > 0) {
      reasoning = dbeBlock + '\n\n' + reasoning.substring(firstSectionIndex);
    } else {
      reasoning = dbeBlock + '\n\n' + reasoning;
    }
  }
  
  // Replace placeholder if present
  reasoning = reasoning.replace(/<<DBE_BLOCK_INSERTED_BY_APP>>/g, dbeBlock);
  
  return reasoning;
}

function runTest(testCase: TestCase): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Replace DBE block
  const processedReasoning = replaceDBEBlock(testCase.aiReasoning, testCase.lockedFormula);
  
  // Check 1: DBE block contains correct formula
  const formulaMatch = processedReasoning.match(/- Formül:\s*([^\n]+)/);
  if (!formulaMatch) {
    errors.push(`❌ DBE block missing formula line`);
  } else {
    const foundFormula = normalizeFormula(formulaMatch[1].trim());
    const expectedFormula = normalizeFormula(testCase.expectedFormula);
    if (foundFormula !== expectedFormula) {
      errors.push(`❌ Formula mismatch: expected "${expectedFormula}", found "${foundFormula}"`);
    }
  }
  
  // Check 2: DBE calculation is correct
  const dbeMatch = processedReasoning.match(/DBE\s*=\s*([^\n=]+)\s*=\s*([\d.]+)/);
  if (!dbeMatch) {
    errors.push(`❌ DBE calculation line missing or malformed`);
  } else {
    const foundDBE = parseFloat(dbeMatch[2]);
    if (Math.abs(foundDBE - testCase.expectedDBE) > 0.01) {
      errors.push(`❌ DBE value mismatch: expected ${testCase.expectedDBE}, found ${foundDBE}`);
    }
  }
  
  // Check 3: No wrong formula references remain (except in warning)
  const normalizedWrongFormula = normalizeFormula('C10H10O');
  const wrongFormulaPattern = new RegExp(
    `(?!⚠️|WARNING)[^\\n]*${normalizedWrongFormula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*`,
    'gi'
  );
  const wrongFormulaMatches = processedReasoning.match(wrongFormulaPattern);
  if (wrongFormulaMatches && wrongFormulaMatches.length > 0) {
    // Allow in warning lines
    const nonWarningMatches = wrongFormulaMatches.filter(m => 
      !m.includes('⚠️') && !m.includes('WARNING')
    );
    if (nonWarningMatches.length > 0) {
      errors.push(`❌ Wrong formula "${normalizedWrongFormula}" still appears in reasoning (outside warnings)`);
    }
  }
  
  // Check 4: DBE block is present
  if (!processedReasoning.includes('**0. DBE Analizi')) {
    errors.push(`❌ DBE block header missing`);
  }
  
  return {
    passed: errors.length === 0,
    errors
  };
}

async function main() {
  console.log('🧪 DBE Block Post-Process Smoke Test\n');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const results: Array<{ testCase: TestCase; result: { passed: boolean; errors: string[] } }> = [];
  
  for (const testCase of testCases) {
    console.log(`📋 Test: ${testCase.name}`);
    console.log(`   Locked Formula: ${testCase.lockedFormula}`);
    console.log(`   Expected DBE: ${testCase.expectedDBE}`);
    
    const result = runTest(testCase);
    results.push({ testCase, result });
    
    if (result.passed) {
      console.log('   ✅ PASSED\n');
    } else {
      console.log('   ❌ FAILED');
      result.errors.forEach(error => console.log(`   ${error}`));
      console.log('');
    }
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const passed = results.filter(r => r.result.passed).length;
  const failed = results.filter(r => !r.result.passed).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter(r => !r.result.passed)
      .forEach(({ testCase, result }) => {
        console.log(`\n   ${testCase.name}:`);
        result.errors.forEach(error => console.log(`   ${error}`));
      });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { runTest, replaceDBEBlock };
