import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPythonPath, getPythonCommand } from '@/lib/utils/pythonPath';
import { RDKitAuthorityService } from '@/lib/services/v2/RDKitAuthorityService';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * RDKit 2D Molecule Drawing API
 *
 * Generates high-quality 2D SVG images of molecules from SMILES
 * Uses RDKit's rdMolDraw2D for professional chemical structure rendering
 *
 * Features:
 * - Stereochemistry visualization (wedge/dash bonds)
 * - Atom numbering (optional)
 * - Highlight specific atoms/bonds (optional)
 * - Customizable size and styling
 *
 * Query Parameters:
 * - smiles: SMILES string (required)
 * - width: Image width in pixels (default: 400)
 * - height: Image height in pixels (default: 300)
 * - showAtomNumbers: Show atom indices (default: false)
 * - highlightAtoms: Comma-separated atom indices to highlight (optional)
 */

interface Draw2DRequest {
  smiles: string;
  width?: number;
  height?: number;
  showAtomNumbers?: boolean;
  highlightAtoms?: number[];
}

interface Draw2DResponse {
  success: boolean;
  svg?: string;
  canonical_molecule?: unknown;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: Draw2DRequest = await request.json();
    const { smiles, width = 400, height = 300, showAtomNumbers = false, highlightAtoms = [] } = body;

    console.log('\n🎨 RDKit 2D Drawing Request:');
    console.log(`  SMILES (length: ${smiles.length}): ${smiles}`);
    console.log(`  ✅ SMILES tam olarak gönderildi (kesilmedi)`);
    console.log(`  Size: ${width}x${height}`);
    console.log(`  Show atom numbers: ${showAtomNumbers}`);

    if (!smiles) {
      return NextResponse.json({
        success: false,
        error: 'SMILES string is required'
      } as Draw2DResponse, { status: 400 });
    }

    // Python script for 2D drawing
    const pythonScript = `
import sys
import json
from rdkit import Chem
from rdkit.Chem import Draw
from rdkit.Chem import AllChem

# Parse input
smiles = """${smiles.replace(/"/g, '\\"')}"""
width = ${width}
height = ${height}
show_atom_numbers = ${showAtomNumbers ? 'True' : 'False'}
highlight_atoms = ${JSON.stringify(highlightAtoms)}

try:
    # ✅ Create molecule from SMILES (Isomeric SMILES with stereochemistry preserved)
    # Chem.MolFromSmiles() automatically parses:
    # - @ and @@ symbols (chiral centers, R/S configuration)
    # - / and \ symbols (geometric isomers, E/Z configuration)
    #   * /C=C/ = trans (E) configuration (zigzag shape)
    #   * /C=C\ = cis (Z) configuration (C-shape)
    mol = Chem.MolFromSmiles(smiles)

    if mol is None:
        print(json.dumps({
            "success": False,
            "error": "Invalid SMILES string"
        }))
        sys.exit(1)

    # ✅ Verify stereochemistry is preserved
    chiral_centers = Chem.FindMolChiralCenters(mol, includeUnassigned=False)
    if len(chiral_centers) > 0:
        print(f"✅ Stereochemistry detected: {len(chiral_centers)} chiral centers", file=sys.stderr)
        print(f"   Chiral centers: {chiral_centers}", file=sys.stderr)
    
    # ✅ Check for geometric isomers (double bonds with / and \)
    # Use chr() to avoid escape character issues in template string
    backslash_char = chr(92)  # backslash character
    if '/' in smiles or backslash_char in smiles:
        print(f"✅ Geometric isomerism detected: / and \\ symbols found in SMILES", file=sys.stderr)
        print(f"   This will be drawn with correct bond geometry (trans/cis)", file=sys.stderr)

    # Add hydrogens (optional - shows implicit Hs)
    # mol = Chem.AddHs(mol)

    # ✅ Generate 2D coordinates (stereochemistry preserved automatically)
    AllChem.Compute2DCoords(mol)

    # Drawing options
    drawer = Draw.rdMolDraw2D.MolDraw2DSVG(width, height)

    # Configure drawing options
    draw_options = drawer.drawOptions()

    # Show atom numbers if requested
    if show_atom_numbers:
        for atom in mol.GetAtoms():
            draw_options.atomLabels[atom.GetIdx()] = f"{atom.GetSymbol()}{atom.GetIdx()}"

    # Highlight specific atoms if requested
    if highlight_atoms and len(highlight_atoms) > 0:
        drawer.DrawMolecule(mol, highlightAtoms=highlight_atoms)
    else:
        drawer.DrawMolecule(mol)

    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()

    print(json.dumps({
        "success": True,
        "svg": svg,
        "atom_count": mol.GetNumAtoms(),
        "bond_count": mol.GetNumBonds()
    }))

except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
    sys.exit(1)
`;

    // Execute Python script
    // ✅ Windows/MacOS/Linux uyumlu Python path
    let pythonPath = getPythonPath();
    let usingVenv = true;
    
    // ✅ Eğer venv yoksa, system python'u kullan
    if (!fs.existsSync(pythonPath)) {
      console.warn(`⚠️ Virtual environment not found at ${pythonPath}, trying system Python`);
      console.warn(`   💡 To fix: Run: python -m venv venv_rdkit && venv_rdkit\\Scripts\\activate && pip install rdkit-pypi`);
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
    const tempScriptPath = path.join(tempDir, `rdkit_draw_2d_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    
    try {
      // Python script'ini geçici dosyaya yaz
      fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
      
      // Python script'ini çalıştır
      const { stdout, stderr } = await execAsync(`"${pythonPath}" "${tempScriptPath}"`, {
        timeout: 10000 // 10 second timeout
      });

      if (stderr && !stderr.includes('Warning') && !stderr.includes('Stereochemistry')) {
        console.error('❌ Python stderr:', stderr);
      }

      const result = JSON.parse(stdout.trim());

      if (result.success) {
        console.log(`✅ 2D drawing generated: ${result.atom_count} atoms, ${result.bond_count} bonds`);

        return NextResponse.json({
          success: true,
          svg: result.svg,
          canonical_molecule: RDKitAuthorityService.fromDraw2D(smiles, result.atom_count, result.bond_count),
        } as Draw2DResponse);
      } else {
        console.error(`❌ RDKit drawing failed: ${result.error}`);

        return NextResponse.json({
          success: false,
          error: result.error
        } as Draw2DResponse, { status: 500 });
      }
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
    console.error('❌ 2D drawing error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as Draw2DResponse, { status: 500 });
  }
}
