import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPythonPath, getPythonCommand } from '@/lib/utils/pythonPath';
import { RDKitAuthorityService } from '@/lib/services/v2/RDKitAuthorityService';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * RDKit SMILES Parser API
 * Parses SMILES and returns molecular graph
 */
export async function POST(request: NextRequest) {
  try {
    const { smiles } = await request.json();

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string required' },
        { status: 400 }
      );
    }

    console.log('🔬 Parsing SMILES:', smiles);

    // Call Python RDKit script
    const pythonScript = `
import sys
import json
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors
from rdkit.Chem import rdDepictor

smiles = "${smiles.replace(/"/g, '\\"')}"
# ✅ Parse Isomeric SMILES (stereochemistry preserved automatically)
# Chem.MolFromSmiles() automatically parses @ and @@ stereochemistry markers
mol = Chem.MolFromSmiles(smiles)

if mol is None:
    print(json.dumps({"error": "Invalid SMILES"}))
    exit(1)

# ✅ Verify stereochemistry is preserved
chiral_centers = Chem.FindMolChiralCenters(mol, includeUnassigned=False)
chiral_centers_list = []
if len(chiral_centers) > 0:
    print(f"✅ Stereochemistry detected: {len(chiral_centers)} chiral centers", file=sys.stderr)
    print(f"   Chiral centers: {chiral_centers}", file=sys.stderr)
    chiral_centers_list = [[idx, "unknown"] for idx, _ in chiral_centers]

# ============================================================================
# 2D COORDINATES (for depiction)
# ============================================================================
# Generate 2D coordinates using rdDepictor (for visualization)
mol_2d = Chem.Mol(mol)
rdDepictor.Compute2DCoords(mol_2d)
conf_2d = mol_2d.GetConformer()

coords_2d = []
for atom in mol_2d.GetAtoms():
    pos = conf_2d.GetAtomPosition(atom.GetIdx())
    coords_2d.append({
        "x": pos.x,
        "y": pos.y
    })

# ============================================================================
# 3D COORDINATES (for geometry calculations)
# ============================================================================
# Add explicit hydrogens for accurate 3D geometry
mol_h = Chem.AddHs(mol)

# ✅ Generate 3D coordinates with stereochemistry preservation
# Use ETKDG with enforceChirality=True for complex molecules like Paclitaxel
params = AllChem.ETKDGv3()
params.randomSeed = 42
params.enforceChirality = True  # 🔥 KEY: Preserve stereochemistry from Isomeric SMILES
result = AllChem.EmbedMolecule(mol_h, params)
if result != 0:
    # Fallback: Try without enforceChirality if it fails
    AllChem.EmbedMolecule(mol_h, randomSeed=42)
AllChem.UFFOptimizeMolecule(mol_h)

# Extract 3D coordinates
coords_3d = []
conf_3d = mol_h.GetConformer()
for atom in mol_h.GetAtoms():
    pos = conf_3d.GetAtomPosition(atom.GetIdx())
    coords_3d.append({
        "x": pos.x,
        "y": pos.y,
        "z": pos.z
    })

# Extract atoms (topology - use 2D mol for atom info, but keep 3D coords separate)
atoms = []
for atom in mol_2d.GetAtoms():
    atoms.append({
        "symbol": atom.GetSymbol(),
        "formalCharge": atom.GetFormalCharge(),
        "implicitHydrogens": atom.GetTotalNumHs(includeNeighbors=False),
        "isAromatic": atom.GetIsAromatic(),
        "hybridization": str(atom.GetHybridization())
    })

# Extract bonds
bonds = []
for bond in mol_2d.GetBonds():
    bonds.append({
        "beginAtomIdx": bond.GetBeginAtomIdx(),
        "endAtomIdx": bond.GetEndAtomIdx(),
        "bondOrder": int(bond.GetBondTypeAsDouble()),
        "bondType": str(bond.GetBondType()),
        "isAromatic": bond.GetIsAromatic()
    })

# Molecular formula
formula = Descriptors.rdMolDescriptors.CalcMolFormula(mol)
canonical_smiles = Chem.MolToSmiles(mol, isomericSmiles=True)

result = {
    "atoms": atoms,
    "bonds": bonds,
    "formula": formula,
    "smiles": smiles,
    "canonical_smiles": canonical_smiles,
    "coords2d": coords_2d,
    "coords3d": coords_3d,
    "chiral_centers": chiral_centers_list
}

print(json.dumps(result))
`;

    // Use proper path without escaping (execAsync handles it)
    let pythonPath = getPythonPath();
    let usingVenv = true;
    
    // ✅ Eğer venv yoksa, system python'u kullan
    if (!fs.existsSync(pythonPath)) {
      console.warn(`⚠️ Virtual environment not found at ${pythonPath}, trying system Python`);
      pythonPath = getPythonCommand();
      usingVenv = false;
      
      // ✅ System Python'da RDKit olup olmadığını kontrol et
      try {
        const checkCmd = `"${pythonPath}" -c "import rdkit; print('OK')"`;
        await execAsync(checkCmd, { timeout: 5000 });
        console.log(`✅ System Python'da RDKit bulundu: ${pythonPath}`);
      } catch (checkError) {
        // RDKit yoksa, venv path'ini tekrar dene veya hata ver
        const venvPath = getPythonPath();
        if (fs.existsSync(venvPath)) {
          pythonPath = venvPath;
          usingVenv = true;
          console.log(`✅ Virtual environment bulundu: ${venvPath}`);
        } else {
          return NextResponse.json(
            {
              success: false,
              error: `RDKit modülü bulunamadı. Lütfen virtual environment'ı kurun:\n1. python -m venv venv_rdkit\n2. venv_rdkit\\Scripts\\activate (Windows) veya source venv_rdkit/bin/activate (Mac/Linux)\n3. pip install rdkit\n\nMevcut Python: ${pythonPath}\nBeklenen venv: ${venvPath}`
            },
            { status: 500 }
          );
        }
      }
    } else {
      console.log(`✅ Virtual environment bulundu: ${pythonPath}`);
    }

    // ✅ Windows'ta string literal sorununu önlemek için geçici dosya kullan
    const tempDir = os.tmpdir();
    const tempScriptPath = path.join(tempDir, `rdkit_parse_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    
    try {
      // Python script'ini geçici dosyaya yaz
      fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
      
      // Python script'ini çalıştır
      const { stdout, stderr } = await execAsync(
        `"${pythonPath}" "${tempScriptPath}"`,
        { timeout: 30000 } // 30 second timeout
      );

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      const result = JSON.parse(stdout);

      if (result.error) {
        throw new Error(result.error);
      }

      console.log('✅ SMILES parsed successfully');
      console.log(`Atoms: ${result.atoms.length}, Bonds: ${result.bonds.length}`);

      return NextResponse.json({
        success: true,
        ...result,
        canonical_molecule: RDKitAuthorityService.fromParseSmiles(smiles, result),
      });
    } finally {
      // ✅ Geçici dosyayı temizle
      try {
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Geçici dosya temizlenemedi:', cleanupError);
      }
    }

  } catch (error) {
    console.error('❌ SMILES parsing error:', error);

    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Parsing failed'
      },
      { status: 500 }
    );
  }
}
