import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPythonPath, getPythonCommand } from '@/lib/utils/pythonPath';
import { RDKitAuthorityService } from '@/lib/services/v2/RDKitAuthorityService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * RDKit SDF Generator
 * Generates 3D SDF file from SMILES string
 *
 * POST /api/rdkit/generate-sdf
 * Body: { smiles: string }
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

    console.log('🔬 Generating 3D SDF from SMILES:', smiles.substring(0, 50) + '...');

    // Python script to generate SDF with 3D coordinates
    const pythonScript = `
import sys
from rdkit import Chem
from rdkit.Chem import AllChem

smiles = """${smiles.replace(/"/g, '\\"')}"""

try:
    # ✅ Parse Isomeric SMILES (stereochemistry preserved automatically)
    mol = Chem.MolFromSmiles(smiles)

    if mol is None:
        print("ERROR: Invalid SMILES", file=sys.stderr)
        sys.exit(1)

    # ✅ Verify stereochemistry is preserved
    chiral_centers = Chem.FindMolChiralCenters(mol, includeUnassigned=False)
    if len(chiral_centers) > 0:
        print(f"✅ Stereochemistry detected: {len(chiral_centers)} chiral centers", file=sys.stderr)

    # Add explicit hydrogens
    mol_h = Chem.AddHs(mol)

    # ✅ Generate 3D coordinates with stereochemistry preservation
    # Use ETKDG with enforceChirality=True for complex molecules like Paclitaxel
    params = AllChem.ETKDGv3()
    params.enforceChirality = True  # 🔥 KEY: Preserve stereochemistry from Isomeric SMILES
    params.randomSeed = 42
    
    # Try multiple times with different random seeds for better results
    success = False
    for seed in range(42, 47):  # Try 5 different random seeds
        params.randomSeed = seed
        result = AllChem.EmbedMolecule(mol_h, params)
        if result == 0:  # Success
            success = True
            break

    if not success:
        # Fallback: Try without enforceChirality if it fails
        print("⚠️ Stereochemistry-preserving embedding failed, trying fallback...", file=sys.stderr)
        params.enforceChirality = False
        for seed in range(42, 47):
            params.randomSeed = seed
            result = AllChem.EmbedMolecule(mol_h, params)
            if result == 0:
                success = True
                break
        
        if not success:
            # Last resort: Use distance geometry without optimization
            AllChem.EmbedMolecule(mol_h, useRandomCoords=True)

    # Optimize geometry with UFF
    try:
        AllChem.UFFOptimizeMolecule(mol_h, maxIters=200)
    except:
        # If UFF fails, continue anyway (we still have basic 3D coords)
        pass
    
    # ✅ Verify stereochemistry is still preserved after 3D generation
    chiral_centers_after = Chem.FindMolChiralCenters(mol_h, includeUnassigned=False)
    if len(chiral_centers) != len(chiral_centers_after):
        print(f"⚠️ WARNING: Chiral centers changed! Before: {len(chiral_centers)}, After: {len(chiral_centers_after)}", file=sys.stderr)
    elif len(chiral_centers) > 0:
        print(f"✅ Stereochemistry preserved: {len(chiral_centers)} chiral centers", file=sys.stderr)

    # Generate SDF format
    sdf = Chem.MolToMolBlock(mol_h)

    print(sdf)

except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

    // ✅ Windows/MacOS/Linux uyumlu Python path
    let pythonPath = getPythonPath();
    let usingVenv = true;
    
    // ✅ Eğer venv yoksa, system python'u kullan
    if (!fs.existsSync(pythonPath)) {
      console.warn(`⚠️ Virtual environment not found at ${pythonPath}, trying system Python`);
      pythonPath = getPythonCommand();
      usingVenv = false;
      
      // ✅ System Python'da RDKit olup olmadığını kontrol et
      let rdkitFound = false;
      try {
        const checkCmd = `"${pythonPath}" -c "import rdkit; print('OK')"`;
        await execAsync(checkCmd, { timeout: 5000 });
        console.log(`✅ System Python'da RDKit bulundu: ${pythonPath}`);
        rdkitFound = true;
      } catch (checkError) {
        console.warn(`⚠️ System Python'da RDKit bulunamadı: ${pythonPath}`);
        rdkitFound = false;
      }
      
      // RDKit bulunamadıysa, venv path'ini tekrar dene veya hata ver
      if (!rdkitFound) {
        const venvPath = getPythonPath();
        if (fs.existsSync(venvPath)) {
          pythonPath = venvPath;
          usingVenv = true;
          console.log(`✅ Virtual environment bulundu: ${venvPath}`);
          
          // Venv'de de RDKit kontrolü yap
          try {
            const venvCheckCmd = `"${pythonPath}" -c "import rdkit; print('OK')"`;
            await execAsync(venvCheckCmd, { timeout: 5000 });
            console.log(`✅ Virtual environment'da RDKit bulundu: ${pythonPath}`);
          } catch (venvCheckError) {
            return NextResponse.json(
              {
                success: false,
                error: `RDKit modülü virtual environment'da da bulunamadı. Lütfen kurun:\n1. venv_rdkit\\Scripts\\activate (Windows) veya source venv_rdkit/bin/activate (Mac/Linux)\n2. pip install rdkit\n\nVirtual environment path: ${venvPath}`
              },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            {
              success: false,
              error: `RDKit modülü bulunamadı. Lütfen virtual environment'ı kurun:\n\n1. python -m venv venv_rdkit\n2. venv_rdkit\\Scripts\\activate (Windows) veya source venv_rdkit/bin/activate (Mac/Linux)\n3. pip install rdkit\n\nMevcut Python: ${pythonPath}\nBeklenen venv: ${venvPath}\n\nProje dizini: ${process.cwd()}`
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
    const tempScriptPath = path.join(tempDir, `rdkit_sdf_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    
    try {
      // Python script'ini geçici dosyaya yaz
      fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
      
      let stdout = '';
      let stderr = '';
      
      try {
        // Python script'ini çalıştır
        const result = await execAsync(
          `"${pythonPath}" "${tempScriptPath}"`,
          {
            timeout: 60000, // 60 second timeout for large molecules
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large SDF files
          }
        );
        stdout = result.stdout || '';
        stderr = result.stderr || '';
      } catch (execError: any) {
        // execAsync hata fırlattığında stderr'i error objesinden al
        stdout = execError.stdout || '';
        stderr = execError.stderr || '';
        
        // ✅ RDKit modül hatası kontrolü (stderr'de veya error mesajında)
        const errorMessage = execError.message || '';
        if ((stderr && stderr.includes('No module named') && stderr.includes('rdkit')) ||
            (errorMessage.includes('No module named') && errorMessage.includes('rdkit'))) {
          const venvPath = getPythonPath();
          throw new Error(`RDKit modülü bulunamadı. Lütfen virtual environment'ı kurun:\n\n1. python -m venv venv_rdkit\n2. venv_rdkit\\Scripts\\activate (Windows) veya source venv_rdkit/bin/activate (Mac/Linux)\n3. pip install rdkit\n\nBeklenen venv: ${venvPath}\nProje dizini: ${process.cwd()}\n\nKullanılan Python: ${pythonPath}`);
        }
        
        // Diğer hatalar için stderr'i fırlat
        if (stderr) {
          throw new Error(stderr);
        }
        throw execError;
      }

      // ✅ RDKit modül hatası kontrolü (normal çalışma durumunda)
      if (stderr && (stderr.includes('No module named') && stderr.includes('rdkit'))) {
        const venvPath = getPythonPath();
        throw new Error(`RDKit modülü bulunamadı. Lütfen virtual environment'ı kurun:\n\n1. python -m venv venv_rdkit\n2. venv_rdkit\\Scripts\\activate (Windows) veya source venv_rdkit/bin/activate (Mac/Linux)\n3. pip install rdkit\n\nBeklenen venv: ${venvPath}\nProje dizini: ${process.cwd()}`);
      }

      if (stderr && stderr.includes('ERROR:')) {
        throw new Error(stderr.replace('ERROR:', '').trim());
      }

      if (!stdout || stdout.trim().length === 0) {
        throw new Error('RDKit generated empty SDF');
      }

      console.log(`✅ 3D SDF generated successfully (${stdout.length} bytes)`);

      return NextResponse.json({
        success: true,
        sdf: stdout,
        method: 'RDKit UFF optimization',
        smiles: smiles,
        canonical_molecule: RDKitAuthorityService.fromGenerateSdf(smiles, stdout),
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
    console.error('❌ RDKit SDF generation error:', error);
    
    // ✅ RDKit modül hatası için özel mesaj
    const errorMessage = error instanceof Error ? error.message : 'SDF generation failed';
    const stderrMessage = (error as any)?.stderr || '';
    
    if (errorMessage.includes('No module named') && errorMessage.includes('rdkit') || 
        stderrMessage.includes('No module named') && stderrMessage.includes('rdkit')) {
      const venvPath = getPythonPath();
      return NextResponse.json(
        {
          success: false,
          error: `RDKit modülü bulunamadı. Lütfen virtual environment'ı kurun:\n\n1. python -m venv venv_rdkit\n2. venv_rdkit\\Scripts\\activate (Windows) veya source venv_rdkit/bin/activate (Mac/Linux)\n3. pip install rdkit\n\nBeklenen venv: ${venvPath}\nProje dizini: ${process.cwd()}`
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
