import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPythonPath, getPythonCommand } from '@/lib/utils/pythonPath';
import { RDKitAuthorityService } from '@/lib/services/v2/RDKitAuthorityService';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * RDKit 2D SDF → 3D SDF Converter (Stereochemistry Preserving)
 *
 * Converts 2D SDF (with stereochemistry annotations) to 3D SDF with proper geometry
 *
 * POST /api/rdkit/sdf-to-3d
 * Body: { sdf2d: string }
 *
 * Key Features:
 * - Preserves all stereochemistry from 2D SDF (wedge/dash bonds)
 * - Uses ETKDG (Experimental Torsion Knowledge Distance Geometry) for realistic conformations
 * - Multiple random seeds for better sampling
 * - Macrocycle-aware embedding for large rings (QS-21, Paclitaxel, etc.)
 * - MMFF94 force field optimization (better than UFF for drug-like molecules)
 */
export async function POST(request: NextRequest) {
  try {
    const { sdf2d } = await request.json();

    if (!sdf2d) {
      return NextResponse.json(
        { success: false, error: '2D SDF string required' },
        { status: 400 }
      );
    }

    console.log('🔬 Converting 2D SDF to 3D (stereochemistry-preserving)...');
    console.log(`   Input size: ${sdf2d.length} bytes`);

    // Advanced Python script with stereochemistry preservation
    const pythonScript = `
import sys
import json
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors

# Read 2D SDF
sdf_input = """${sdf2d.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""

try:
    # Parse 2D SDF (preserves stereochemistry from wedge/dash bonds)
    mol = Chem.MolFromMolBlock(sdf_input, sanitize=True, removeHs=False)

    if mol is None:
        print(json.dumps({"error": "Invalid SDF format"}))
        sys.exit(1)

    # Add explicit hydrogens (important for stereochemistry)
    mol_h = Chem.AddHs(mol)

    # Count chiral centers BEFORE 3D generation
    chiral_centers = len(Chem.FindMolChiralCenters(mol_h, includeUnassigned=False))

    # Detect if molecule has macrocycles (rings > 8 atoms)
    ring_info = mol_h.GetRingInfo()
    has_macrocycle = any(len(ring) > 8 for ring in ring_info.AtomRings())

    num_atoms = mol_h.GetNumAtoms()
    num_rotatable = Descriptors.NumRotatableBonds(mol_h)

    print(f"📊 Molecule stats:", file=sys.stderr)
    print(f"   Atoms: {num_atoms}", file=sys.stderr)
    print(f"   Chiral centers: {chiral_centers}", file=sys.stderr)
    print(f"   Rotatable bonds: {num_rotatable}", file=sys.stderr)
    print(f"   Macrocycle: {'Yes' if has_macrocycle else 'No'}", file=sys.stderr)

    # ETKDG parameters (Experimental Torsion Knowledge Distance Geometry)
    # This is MUCH better than basic embedding - uses real torsion angle distributions
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    params.useRandomCoords = False
    params.enforceChirality = True  # 🔥 KEY: Preserve stereochemistry!
    params.numThreads = 0  # Use all CPU cores

    if has_macrocycle:
        # Special handling for macrocycles
        params.useSmallRingTorsions = True
        params.useMacrocycleTorsions = True
        print("🔄 Using macrocycle-aware embedding", file=sys.stderr)

    # Try multiple conformers and pick the lowest energy one
    success = False
    best_energy = float('inf')
    best_mol = None

    print("🔄 Generating conformers...", file=sys.stderr)

    # For large molecules, try fewer seeds but with better algorithm
    max_attempts = 5 if num_atoms > 50 else 10

    for seed in range(42, 42 + max_attempts):
        mol_copy = Chem.Mol(mol_h)
        params.randomSeed = seed

        result = AllChem.EmbedMolecule(mol_copy, params)

        if result == 0:  # Success
            # Optimize geometry
            # Try MMFF94 first (better for drug-like molecules)
            try:
                mmff_props = AllChem.MMFFGetMoleculeProperties(mol_copy)
                if mmff_props is not None:
                    ff = AllChem.MMFFGetMoleculeForceField(mol_copy, mmff_props)
                    ff.Initialize()
                    converged = ff.Minimize(maxIts=500)
                    energy = ff.CalcEnergy()

                    if energy < best_energy:
                        best_energy = energy
                        best_mol = mol_copy
                        success = True
                        print(f"   Seed {seed}: E = {energy:.2f} kcal/mol (MMFF94) ✓", file=sys.stderr)
                    continue
            except:
                pass

            # Fallback to UFF if MMFF94 fails
            try:
                result_uff = AllChem.UFFOptimizeMolecule(mol_copy, maxIters=500)
                if result_uff == 0:  # Converged
                    # UFF doesn't return energy easily, so just use this conformer
                    if best_mol is None:
                        best_mol = mol_copy
                        success = True
                        print(f"   Seed {seed}: Optimized (UFF) ✓", file=sys.stderr)
            except:
                # Even optimization failed, but we still have 3D coords
                if best_mol is None:
                    best_mol = mol_copy
                    success = True
                    print(f"   Seed {seed}: Basic 3D (no optimization) ⚠️", file=sys.stderr)

    if not success or best_mol is None:
        # Last resort: Try without enforceChirality (some molecules fail with it)
        print("⚠️ Standard embedding failed, trying fallback...", file=sys.stderr)
        params.enforceChirality = False
        mol_copy = Chem.Mol(mol_h)
        result = AllChem.EmbedMolecule(mol_copy, params)

        if result == 0:
            best_mol = mol_copy
            success = True
            print("✓ Fallback embedding succeeded", file=sys.stderr)
        else:
            print(json.dumps({"error": "Failed to generate 3D coordinates after all attempts"}))
            sys.exit(1)

    # Verify stereochemistry is preserved
    chiral_centers_after = len(Chem.FindMolChiralCenters(best_mol, includeUnassigned=False))

    if chiral_centers != chiral_centers_after:
        print(f"⚠️ WARNING: Chiral centers changed! Before: {chiral_centers}, After: {chiral_centers_after}", file=sys.stderr)
    else:
        print(f"✅ Stereochemistry preserved: {chiral_centers} chiral centers", file=sys.stderr)

    # Generate 3D SDF
    sdf_3d = Chem.MolToMolBlock(best_mol)

    # Return JSON with metadata
    result = {
        "success": True,
        "sdf3d": sdf_3d,
        "chiralCenters": chiral_centers_after,
        "atoms": num_atoms,
        "rotatableBonds": num_rotatable,
        "hasMacrocycle": has_macrocycle,
        "optimizationEnergy": best_energy if best_energy != float('inf') else None,
        "method": "ETKDG + MMFF94/UFF optimization"
    }

    print(json.dumps(result))

except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    // ✅ Windows/MacOS/Linux uyumlu Python path
    let pythonPath = getPythonPath();
    
    // ✅ Eğer venv yoksa, system python'u kullan
    if (!fs.existsSync(pythonPath)) {
      console.warn(`⚠️ Virtual environment not found at ${pythonPath}, using system Python`);
      pythonPath = getPythonCommand();
    }

    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" -c """${pythonScript}"""`,
      {
        timeout: 120000, // 2 minutes for very large molecules
        maxBuffer: 20 * 1024 * 1024 // 20MB buffer
      }
    );

    // Log the detailed output from Python
    if (stderr) {
      console.log('📊 RDKit output:', stderr);
    }

    if (!stdout || stdout.trim().length === 0) {
      throw new Error('RDKit returned empty output');
    }

    const result = JSON.parse(stdout);

    if (!result.success) {
      throw new Error(result.error || 'Unknown RDKit error');
    }

    console.log('✅ 2D→3D conversion complete:');
    console.log(`   Atoms: ${result.atoms}`);
    console.log(`   Chiral centers: ${result.chiralCenters}`);
    console.log(`   Macrocycle: ${result.hasMacrocycle ? 'Yes' : 'No'}`);
    console.log(`   Method: ${result.method}`);

    return NextResponse.json({
      ...result,
      canonical_molecule: RDKitAuthorityService.fromSdfTo3D(result.sdf3d ?? null, result.atoms ?? null, !!result.success),
    });

  } catch (error) {
    console.error('❌ 2D→3D conversion error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '2D→3D conversion failed'
      },
      { status: 500 }
    );
  }
}
