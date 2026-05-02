/**
 * GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED – Deterministic parse + standardize.
 * RDKit: Parse → Sanitize → Canonicalize → MoleculeGraph.
 * Fail → INCONCLUSIVE with root_cause (PARSER_FAIL:*).
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getPythonPath, getPythonCommand } from '@/lib/utils/pythonPath';
import { ROOT_CAUSE_CODES } from '@/lib/verification/constants';
import type { ParseAndStandardizeResult, MoleculeGraph } from '@/lib/verification/types';

const execAsync = promisify(exec);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidAtom(atom: any): boolean {
  return (
    atom &&
    Number.isInteger(atom.index) &&
    atom.index >= 0 &&
    /^[A-Z][a-z]?$/.test(String(atom.symbol || '')) &&
    Number.isInteger(atom.formalCharge) &&
    Number.isInteger(atom.implicitHydrogens) &&
    typeof atom.isAromatic === 'boolean'
  );
}

function isValidBond(bond: any, atomIndexes: Set<number>): boolean {
  const order = Number(bond?.bondOrder);
  return (
    bond &&
    Number.isInteger(bond.beginAtomIdx) &&
    Number.isInteger(bond.endAtomIdx) &&
    bond.beginAtomIdx !== bond.endAtomIdx &&
    atomIndexes.has(bond.beginAtomIdx) &&
    atomIndexes.has(bond.endAtomIdx) &&
    [1, 1.5, 2, 3].includes(order) &&
    isNonEmptyString(bond.bondType) &&
    typeof bond.isAromatic === 'boolean'
  );
}

function validateStrictMoleculeGraph(graph: any): { ok: boolean; reason?: string } {
  if (!graph || typeof graph !== 'object') return { ok: false, reason: 'moleculeGraph must be object' };
  if (!isNonEmptyString(graph.canonicalSmiles)) return { ok: false, reason: 'canonicalSmiles required' };
  if (!Array.isArray(graph.atoms) || graph.atoms.length === 0) return { ok: false, reason: 'atoms required' };
  if (!Array.isArray(graph.bonds)) return { ok: false, reason: 'bonds required' };
  if (!isNonEmptyString(graph.formula)) return { ok: false, reason: 'formula required' };
  if (!graph.atomCounts || typeof graph.atomCounts !== 'object') return { ok: false, reason: 'atomCounts required' };
  if (!['rdkit', 'js_fallback'].includes(String(graph.source || ''))) return { ok: false, reason: 'source invalid' };
  if (!Number.isFinite(Number(graph.dbe)) || Number(graph.dbe) < 0 || Number(graph.dbe) > 80) {
    return { ok: false, reason: 'dbe invalid' };
  }
  const atomIndexes = new Set<number>();
  for (const atom of graph.atoms) {
    if (!isValidAtom(atom)) return { ok: false, reason: 'invalid atom entry' };
    if (atomIndexes.has(atom.index)) return { ok: false, reason: 'duplicate atom index' };
    atomIndexes.add(atom.index);
  }
  for (const bond of graph.bonds) {
    if (!isValidBond(bond, atomIndexes)) return { ok: false, reason: 'invalid bond entry' };
  }
  return { ok: true };
}

const PY_SCRIPT = `
import sys
import json
try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdDepictor
except ImportError:
    print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:RDKIT_UNAVAILABLE", "message": "RDKit not installed"}))
    sys.exit(0)

raw = sys.argv[1] if len(sys.argv) > 1 else ""
if not raw:
    print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:INVALID_SMILES", "message": "Empty SMILES"}))
    sys.exit(0)

try:
    mol = Chem.MolFromSmiles(raw)
    if mol is None:
        print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:INVALID_SMILES", "message": "MolFromSmiles returned None"}))
        sys.exit(0)
    Chem.SanitizeMol(mol)
except Chem.rdchem.KekulizeException as e:
    print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:SANITIZE", "message": str(e)[:200]}))
    sys.exit(0)
except Exception as e:
    msg = str(e).lower()
    if "valence" in msg or "valence" in str(type(e)).lower():
        print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:VALENCE_ERROR", "message": str(e)[:200]}))
    elif "stereo" in msg:
        print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:STEREO_CONFLICT", "message": str(e)[:200]}))
    else:
        print(json.dumps({"success": False, "rootCause": "PARSER_FAIL:SANITIZE", "message": str(e)[:200]}))
    sys.exit(0)

canonical_smiles = Chem.MolToSmiles(mol, isomericSmiles=True)
formula = Descriptors.rdMolDescriptors.CalcMolFormula(mol)

atom_counts = {}
total_implicit_h = 0
for a in mol.GetAtoms():
    s = a.GetSymbol()
    atom_counts[s] = atom_counts.get(s, 0) + 1
    total_implicit_h += a.GetTotalNumHs(includeNeighbors=False)
atom_counts["H"] = atom_counts.get("H", 0) + total_implicit_h

total_formal_charge = sum(a.GetFormalCharge() for a in mol.GetAtoms())
exact_mass = Descriptors.ExactMolWt(mol)

atoms = []
ring_info = mol.GetRingInfo()
for atom in mol.GetAtoms():
    ri = atom.GetIdx()
    ring_size = 0
    for ring in ring_info.AtomRings():
        if ri in ring:
            ring_size = len(ring)
            break
    atoms.append({
        "index": ri,
        "symbol": atom.GetSymbol(),
        "formalCharge": atom.GetFormalCharge(),
        "implicitHydrogens": atom.GetTotalNumHs(includeNeighbors=False),
        "isAromatic": atom.GetIsAromatic(),
        "hybridization": str(atom.GetHybridization()),
        "ringSize": ring_size if ring_size > 0 else None,
        "ringCount": ring_info.NumAtomRings(ri)
    })

bonds = []
for bond in mol.GetBonds():
    bonds.append({
        "beginAtomIdx": bond.GetBeginAtomIdx(),
        "endAtomIdx": bond.GetEndAtomIdx(),
        "bondOrder": int(bond.GetBondTypeAsDouble()),
        "bondType": str(bond.GetBondType()),
        "isAromatic": bond.GetIsAromatic()
    })

chiral = []
try:
    for idx, _ in Chem.FindMolChiralCenters(mol, includeUnassigned=False):
        chiral.append({"atomIdx": idx, "type": "unknown"})
except Exception:
    pass

nC = atom_counts.get("C", 0)
nH = atom_counts.get("H", 0)
nN = atom_counts.get("N", 0)
nP = atom_counts.get("P", 0)
nX = atom_counts.get("F",0)+atom_counts.get("Cl",0)+atom_counts.get("Br",0)+atom_counts.get("I",0)
dbe = nC - nH/2.0 - nX/2.0 + (nN + nP)/2.0 + total_formal_charge/2.0 + 1 if nC > 0 else 0

out = {
    "success": True,
    "canonicalSmiles": canonical_smiles,
    "moleculeGraph": {
        "canonicalSmiles": canonical_smiles,
        "inputSmiles": raw,
        "atoms": atoms,
        "bonds": bonds,
        "formula": formula,
        "formulaHill": formula,
        "atomCounts": atom_counts,
        "dbe": dbe,
        "exactMass": exact_mass,
        "formalCharge": total_formal_charge,
        "source": "rdkit",
        "chiralCenters": chiral
    }
}
print(json.dumps(out))
`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const smiles = typeof body.smiles === 'string' ? body.smiles.trim() : '';

    if (!smiles || smiles.includes('\u0000')) {
      const result: ParseAndStandardizeResult = {
        success: false,
        rootCause: ROOT_CAUSE_CODES.PARSER_FAIL_INVALID_SMILES,
        message: 'SMILES string required',
      };
      return NextResponse.json(result, { status: 200 });
    }
    if (smiles.length > 4096) {
      const result: ParseAndStandardizeResult = {
        success: false,
        rootCause: ROOT_CAUSE_CODES.PARSER_FAIL_INVALID_SMILES,
        message: 'SMILES too long',
      };
      return NextResponse.json(result, { status: 200 });
    }

    let pythonPath = getPythonPath();
    if (!fs.existsSync(pythonPath)) {
      pythonPath = getPythonCommand();
    }
    const tempDir = os.tmpdir();
    const scriptPath = path.join(tempDir, `parse_std_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`);
    const scriptContent = PY_SCRIPT.replace('raw = sys.argv[1] if len(sys.argv) > 1 else ""', `raw = ${JSON.stringify(smiles)}`);
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');

    try {
      const { stdout } = await execAsync(`"${pythonPath}" "${scriptPath}"`, { timeout: 15000 });
      let data: ParseAndStandardizeResult & { moleculeGraph?: MoleculeGraph; canonicalSmiles?: string };
      try {
        data = JSON.parse(stdout) as ParseAndStandardizeResult & { moleculeGraph?: MoleculeGraph; canonicalSmiles?: string };
      } catch {
        return NextResponse.json(
          {
            success: false,
            rootCause: ROOT_CAUSE_CODES.PARSER_FAIL_SANITIZE,
            message: 'Invalid parser JSON output',
          } satisfies ParseAndStandardizeResult,
          { status: 200 }
        );
      }

      if (data.success && data.moleculeGraph) {
        const graphCheck = validateStrictMoleculeGraph(data.moleculeGraph);
        const topCanonical = data.canonicalSmiles ?? data.moleculeGraph.canonicalSmiles;
        if (!graphCheck.ok || !isNonEmptyString(topCanonical) || topCanonical !== data.moleculeGraph.canonicalSmiles) {
          return NextResponse.json(
            {
              success: false,
              rootCause: ROOT_CAUSE_CODES.PARSER_FAIL_SANITIZE,
              message: graphCheck.reason ?? 'canonicalSmiles mismatch',
            } satisfies ParseAndStandardizeResult,
            { status: 200 }
          );
        }
        const response: ParseAndStandardizeResult = {
          success: true,
          canonicalSmiles: topCanonical,
          moleculeGraph: data.moleculeGraph as MoleculeGraph,
        };
        return NextResponse.json(response);
      }

      const failResponse: ParseAndStandardizeResult = {
        success: false,
        rootCause: data.rootCause ?? ROOT_CAUSE_CODES.PARSER_FAIL_INVALID_SMILES,
        message: data.message ?? 'Parse failed',
      };
      return NextResponse.json(failResponse, { status: 200 });
    } finally {
      try { if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath); } catch (_) {}
    }
  } catch (err) {
    const result: ParseAndStandardizeResult = {
      success: false,
      rootCause: ROOT_CAUSE_CODES.PARSER_FAIL_INVALID_SMILES,
      message: err instanceof Error ? err.message : 'Parse and standardize failed',
    };
    return NextResponse.json(result, { status: 200 });
  }
}
