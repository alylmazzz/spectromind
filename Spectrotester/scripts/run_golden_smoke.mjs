#!/usr/bin/env node
/**
 * Golden smoke tests: Resveratrol, Quercetin, Catechin.
 * Asserts: formula, DBE, aromatic count, carbonyl from MoleculeGraph (RDKit).
 * Run: node Spectrotester/scripts/run_golden_smoke.mjs
 * Requires: Next.js dev server (npm run dev) for API, or Python+RDKit for standalone.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, '..', 'lib', 'spectra', 'library');
const SMOKE_FILE = join(LIB, 'smoke_tests_golden_aromatic.json');

function parseWithPython(smiles) {
  const script = `import sys, json
try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors
except ImportError:
    print(json.dumps({"success": False, "error": "RDKit not installed"}))
    sys.exit(0)
raw = ${JSON.stringify(smiles)}
mol = Chem.MolFromSmiles(raw)
if mol is None:
    print(json.dumps({"success": False, "error": "MolFromSmiles None"}))
    sys.exit(0)
Chem.SanitizeMol(mol)
formula = Descriptors.rdMolDescriptors.CalcMolFormula(mol)
atom_counts = {}
for a in mol.GetAtoms():
    s = a.GetSymbol()
    atom_counts[s] = atom_counts.get(s, 0) + 1
    if s != "H":
        atom_counts["H"] = atom_counts.get("H", 0) + a.GetTotalNumHs()
atoms = []
for atom in mol.GetAtoms():
    atoms.append({
        "index": atom.GetIdx(),
        "symbol": atom.GetSymbol(),
        "implicitHydrogens": atom.GetTotalNumHs(includeNeighbors=False),
        "isAromatic": atom.GetIsAromatic(),
        "hybridization": str(atom.GetHybridization())
    })
bonds = []
for bond in mol.GetBonds():
    bonds.append({
        "beginAtomIdx": bond.GetBeginAtomIdx(),
        "endAtomIdx": bond.GetEndAtomIdx(),
        "bondOrder": int(bond.GetBondTypeAsDouble()),
        "isAromatic": bond.GetIsAromatic()
    })
n_heavy = sum(atom_counts.get(s, 0) for s in ["C","N","P"])
n_h = atom_counts.get("H", 0)
n_hal = atom_counts.get("F",0)+atom_counts.get("Cl",0)+atom_counts.get("Br",0)+atom_counts.get("I",0)
dbe = (2 + 2*atom_counts.get("C",0) + atom_counts.get("N",0) + atom_counts.get("P",0) - n_h - n_hal) // 2 if n_heavy else 0
nC_aromatic = sum(1 for a in atoms if a["symbol"]=="C" and a["isAromatic"])
nC_carbonyl = 0
for b in bonds:
    if b["bondOrder"] >= 2:
        a1, a2 = atoms[b["beginAtomIdx"]], atoms[b["endAtomIdx"]]
        if (a1["symbol"]=="C" and a2["symbol"]=="O") or (a1["symbol"]=="O" and a2["symbol"]=="C"):
            nC_carbonyl += 1
out = {"success": True, "formula": formula, "atomCounts": atom_counts, "dbe": dbe, "nC_aromatic": nC_aromatic, "nC_carbonyl": nC_carbonyl}
print(json.dumps(out))
`;
  const scriptPath = join(tmpdir(), `golden_smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`);
  try {
    writeFileSync(scriptPath, script, 'utf8');
    const stdout = execSync(`python "${scriptPath}"`, { encoding: 'utf8', timeout: 10000 });
    return JSON.parse(stdout.trim());
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { if (existsSync(scriptPath)) unlinkSync(scriptPath); } catch (_) {}
  }
}

async function parseWithAPI(smiles) {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/parse_and_standardize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles }),
    });
    const data = await res.json();
    if (!data.success || !data.moleculeGraph) return { success: false };
    const mg = data.moleculeGraph;
    let nC_aromatic = 0, nC_carbonyl = 0;
    for (const a of mg.atoms || []) {
      if (a.symbol === 'C' && a.isAromatic) nC_aromatic++;
    }
    for (const b of mg.bonds || []) {
      const order = b.bondOrder || (b.isAromatic ? 1.5 : 1);
      if (order >= 2) {
        const a1 = (mg.atoms || [])[b.beginAtomIdx];
        const a2 = (mg.atoms || [])[b.endAtomIdx];
        if (a1?.symbol === 'C' && a2?.symbol === 'O') nC_carbonyl++;
        if (a1?.symbol === 'O' && a2?.symbol === 'C') nC_carbonyl++;
      }
    }
    return {
      success: true,
      formula: mg.formula,
      atomCounts: mg.atomCounts,
      dbe: mg.dbe,
      nC_aromatic,
      nC_carbonyl,
    };
  } catch (_) {
    return { success: false };
  }
}

async function runTests(parseFn) {
  let data;
  try {
    data = JSON.parse(readFileSync(SMOKE_FILE, 'utf8'));
  } catch (e) {
    console.error('FAIL: Could not read', SMOKE_FILE, e.message);
    process.exit(1);
  }

  const cases = data.test_cases || [];
  let passed = 0;
  let failed = 0;

  console.log('Golden aromatic/carbonyl/formula smoke tests');
  console.log('Rule:', data.rule_id);
  console.log('');

  for (const tc of cases) {
    const result = await Promise.resolve(parseFn(tc.smiles));

    if (!result.success) {
      failed++;
      console.log(`  FAIL ${tc.id} ${tc.smiles} - parse failed: ${result.error || 'unknown'}`);
      continue;
    }

    const formulaOk = !tc.expected_formula || result.formula === tc.expected_formula;
    const dbeOk = tc.expected_dbe === undefined || result.dbe === tc.expected_dbe;
    const aromaticOk = tc.expected_aromatic_c_min === undefined || (result.nC_aromatic || 0) >= tc.expected_aromatic_c_min;
    const carbonylOk = tc.expected_carbonyl === undefined || (tc.expected_carbonyl ? (result.nC_carbonyl || 0) >= 1 : true);

    if (formulaOk && dbeOk && aromaticOk && carbonylOk) {
      passed++;
      console.log(`  PASS ${tc.id} ${tc.smiles} formula=${result.formula} DBE=${result.dbe} aromC=${result.nC_aromatic} carbonyl=${result.nC_carbonyl}`);
    } else {
      failed++;
      console.log(`  FAIL ${tc.id} ${tc.smiles}`);
      if (!formulaOk) console.log(`       formula: expected ${tc.expected_formula}, got ${result.formula}`);
      if (!dbeOk) console.log(`       DBE: expected ${tc.expected_dbe}, got ${result.dbe}`);
      if (!aromaticOk) console.log(`       aromatic C: expected >=${tc.expected_aromatic_c_min}, got ${result.nC_aromatic}`);
      if (!carbonylOk) console.log(`       carbonyl: expected ${tc.expected_carbonyl}, got nC_carbonyl=${result.nC_carbonyl}`);
    }
  }

  console.log('');
  console.log(`Total: ${passed} passed, ${failed} failed`);
  return failed;
}

async function main() {
  let failed;
  const apiResult = await parseWithAPI('CCO');
  if (apiResult.success) {
    console.log('Using parse_and_standardize API (localhost:3000)\n');
    failed = await runTests(parseWithAPI);
  } else {
    console.log('API unavailable, using Python+RDKit\n');
    const pyResult = parseWithPython('CCO');
    if (!pyResult.success) {
      console.error('FAIL: Python/RDKit not available:', pyResult.error);
      process.exit(1);
    }
    failed = await runTests(parseWithPython);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
