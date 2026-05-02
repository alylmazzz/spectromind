/**
 * 3D Conformer Generation and Boltzmann Weighting Service
 * 
 * Generates 3D conformer ensembles using RDKit ETKDGv3 algorithm
 * and applies Boltzmann weighting for thermodynamic averaging
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPythonPath } from '@/lib/utils/pythonPath';

const execAsync = promisify(exec);

export interface Conformer {
  id: number;
  energy: number;              // kcal/mol
  weight: number;             // Boltzmann weight (0-1)
  coordinates: Array<{         // 3D coordinates
    atomIndex: number;
    element: string;
    x: number;
    y: number;
    z: number;
  }>;
  dihedralAngles?: Array<{     // Dihedral angles for coupling calculations
    atom1: number;
    atom2: number;
    atom3: number;
    atom4: number;
    angle: number;             // degrees
  }>;
}

import type { ConformerAnalysisResult, VicinalCoupling } from '@/lib/types/v2';

export interface ConformerOptions {
  numConformers?: number;      // Default: 50
  temperature?: number;        // K, default: 298.15
  forceField?: 'MMFF94' | 'UFF';
  optimizeGeometry?: boolean;  // Default: true
}

const R = 8.314; // J/(mol·K) - Gas constant

/**
 * Generate conformer ensemble and apply Boltzmann weighting
 */
export async function analyzeConformers(
  smiles: string,
  options: ConformerOptions = {}
): Promise<ConformerAnalysisResult> {
  const {
    numConformers = 50,
    temperature = 298.15,
    forceField = 'MMFF94',
    optimizeGeometry = true
  } = options;

  try {
    console.log(`🔬 Conformer Analysis: ${smiles.substring(0, 50)}...`);
    console.log(`   Number of conformers: ${numConformers}`);
    console.log(`   Temperature: ${temperature} K`);
    console.log(`   Force field: ${forceField}`);

    // Use the advanced Python conformer engine module
    const result = await generateAdvancedConformers(smiles, numConformers, temperature);

    if (result.error) {
      return {
        success: false,
        conformers: [],
        weightedAverage: {},
        method: 'ETKDGv3 + MMFF94',
        error: result.error
      };
    }

    // Convert Python result to TypeScript format
    const conformers: Conformer[] = (result.conformers || []).map((conf: any) => ({
      id: conf.id,
      energy: conf.energy,
      weight: conf.weight,
      probability: result.ensembleSummary?.find((s: any) => s.id === conf.id)?.probability,
      coordinates: conf.coordinates
    }));

    // Calculate weighted averages from vicinal couplings
    const weightedAverage = calculateWeightedAveragesFromVicinal(result.vicinalCouplings || []);

    console.log(`✅ Conformer analysis complete: ${conformers.length} conformers`);
    if (result.vicinalCouplings && result.vicinalCouplings.length > 0) {
      console.log(`   🎯 Detected ${result.vicinalCouplings.length} vicinal coupling pairs`);
    }

    return {
      success: true,
      conformers,
      weightedAverage,
      method: result.method || `ETKDGv3 + MMFF94 + Boltzmann weighting`,
      smiles: result.smiles,
      totalConfsGenerated: result.totalConfsGenerated,
      significantConfs: result.significantConfs,
      globalMinEnergy: result.globalMinEnergy,
      vicinalCouplings: result.vicinalCouplings || [],
      topConformerMolBlock: result.topConformerMolBlock,
      ensembleSummary: result.ensembleSummary,
      warnings: result.warning ? [result.warning] : undefined
    };

  } catch (error) {
    console.error('❌ Conformer analysis error:', error);
    return {
      success: false,
      conformers: [],
      weightedAverage: {},
      method: 'RDKit ETKDGv3',
      error: error instanceof Error ? error.message : 'Conformer analysis failed'
    };
  }
}

/**
 * Generate advanced conformers using Python ConformerEngine module
 */
async function generateAdvancedConformers(
  smiles: string,
  numConformers: number,
  temperature: number
): Promise<any> {
  const pythonScript = `
import sys
import os
import json

# Add project root to path
project_root = r"${process.cwd().replace(/\\/g, '/')}"
sys.path.insert(0, os.path.join(project_root, 'services', 'conformer-service'))

try:
    from conformer_engine import ConformerEngine
    
    smiles = "${smiles.replace(/"/g, '\\"')}"
    num_conformers = ${numConformers}
    temperature = ${temperature}
    
    engine = ConformerEngine(n_confs=num_conformers, rmsd_threshold=0.5)
    engine.temperature = temperature
    result = engine.generate_ensemble(smiles)
    
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
`;

  try {
    const pythonPath = getPythonPath();
    const tempScriptPath = path.join(
      os.tmpdir(),
      `conformer_advanced_${Date.now()}_${Math.random().toString(36).substring(7)}.py`
    );
    
    // Get the project root directory
    const projectRoot = process.cwd();
    const conformerServicePath = path.join(projectRoot, 'services', 'conformer-service');
    
    // Check if conformer_engine.py exists
    const enginePath = path.join(conformerServicePath, 'conformer_engine.py');
    if (!fs.existsSync(enginePath)) {
      throw new Error('Conformer engine module not found. Please ensure conformer_engine.py exists in services/conformer-service/');
    }

    fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
    
    try {
      const { stdout, stderr } = await execAsync(
        `"${pythonPath}" "${tempScriptPath}"`,
        {
          timeout: 180000,  // 3 minutes timeout
          maxBuffer: 50 * 1024 * 1024,
          cwd: projectRoot
        }
      );
      
      if (stderr && !stdout) {
        throw new Error(`Python error: ${stderr}`);
      }
      
      const result = JSON.parse(stdout.trim());
      return result;
    } finally {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  } catch (error) {
    console.error('Advanced conformer generation error:', error);
    return {
      error: error instanceof Error ? error.message : 'Conformer generation failed'
    };
  }
}

/**
 * Generate conformers using RDKit ETKDGv3 (Legacy - kept for fallback)
 */
async function generateConformers(
  smiles: string,
  numConformers: number,
  forceField: 'MMFF94' | 'UFF',
  optimizeGeometry: boolean
): Promise<Array<Omit<Conformer, 'weight'>>> {
  const pythonScript = `
from rdkit import Chem
from rdkit.Chem import AllChem, rdMolDescriptors
import json
import sys

smiles = sys.argv[1]
num_conformers = int(sys.argv[2])
force_field = sys.argv[3]
optimize = sys.argv[4] == "True"

mol = Chem.MolFromSmiles(smiles)
if not mol:
    print("[]")
    sys.exit(0)

# Add hydrogens
mol = Chem.AddHs(mol)

# Generate conformers using ETKDGv3
params = AllChem.ETKDGv3()
params.randomSeed = 42
params.numThreads = 1
params.useExpTorsionAnglePrefs = True
params.useBasicKnowledge = True

conformer_ids = AllChem.EmbedMultipleConfs(mol, numConfs=num_conformers, params=params)

if len(conformer_ids) == 0:
    print("[]")
    sys.exit(0)

conformers = []

for conf_id in conformer_ids:
    conf = mol.GetConformer(conf_id)
    
    # Optimize geometry if requested
    if optimize:
        if force_field == "MMFF94":
            try:
                AllChem.MMFFOptimizeMolecule(mol, confId=conf_id)
            except:
                try:
                    AllChem.UFFOptimizeMolecule(mol, confId=conf_id)
                except:
                    pass
        else:
            try:
                AllChem.UFFOptimizeMolecule(mol, confId=conf_id)
            except:
                pass
    
    # Calculate energy
    if force_field == "MMFF94":
        try:
            mp = AllChem.MMFFGetMoleculeProperties(mol)
            ff = AllChem.MMFFGetMoleculeForceField(mol, mp, confId=conf_id)
            energy = ff.CalcEnergy()  # kcal/mol
        except:
            try:
                energy = AllChem.UFFGetMoleculeForceField(mol, confId=conf_id).CalcEnergy()
            except:
                energy = 0.0
    else:
        try:
            energy = AllChem.UFFGetMoleculeForceField(mol, confId=conf_id).CalcEnergy()
        except:
            energy = 0.0
    
    # Extract coordinates
    coordinates = []
    for i in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(i)
        atom = mol.GetAtomWithIdx(i)
        coordinates.append({
            "atomIndex": i,
            "element": atom.GetSymbol(),
            "x": round(pos.x, 4),
            "y": round(pos.y, 4),
            "z": round(pos.z, 4)
        })
    
    conformers.append({
        "id": conf_id,
        "energy": round(energy, 4),
        "coordinates": coordinates
    })

# Sort by energy
conformers.sort(key=lambda x: x["energy"])

print(json.dumps(conformers))
`;

  try {
    const pythonPath = getPythonPath();
    const tempScriptPath = path.join(os.tmpdir(), `conformer_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    
    fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
    
    try {
      const { stdout } = await execAsync(
        `"${pythonPath}" "${tempScriptPath}" "${smiles}" "${numConformers}" "${forceField}" "${optimizeGeometry}"`,
        {
          timeout: 120000, // 2 minutes for conformer generation
          maxBuffer: 50 * 1024 * 1024 // 50MB for large conformer data
        }
      );
      
      const conformers = JSON.parse(stdout.trim());
      return conformers || [];
    } finally {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  } catch (error) {
    console.error('Conformer generation error:', error);
    return [];
  }
}

/**
 * Calculate Boltzmann weights for conformers
 */
function calculateBoltzmannWeights(
  conformers: Array<Omit<Conformer, 'weight'>>,
  temperature: number
): Conformer[] {
  if (conformers.length === 0) return [];
  if (conformers.length === 1) {
    return [{ ...conformers[0], weight: 1.0 }];
  }

  // Convert kcal/mol to J/mol (1 kcal = 4184 J)
  const energiesJ = conformers.map(c => c.energy * 4184);

  // Find minimum energy (reference)
  const E_min = Math.min(...energiesJ);

  // Calculate relative energies
  const relativeEnergies = energiesJ.map(E => E - E_min);

  // Calculate Boltzmann factors
  const boltzmannFactors = relativeEnergies.map(deltaE =>
    Math.exp(-deltaE / (R * temperature))
  );

  // Normalize
  const partition = boltzmannFactors.reduce((sum, f) => sum + f, 0);

  return conformers.map((conf, i) => ({
    ...conf,
    weight: boltzmannFactors[i] / partition
  }));
}

/**
 * Calculate weighted averages from vicinal couplings
 */
function calculateWeightedAveragesFromVicinal(
  vicinalCouplings: VicinalCoupling[]
): { shift?: number; coupling?: number } {
  if (vicinalCouplings.length === 0) {
    return {};
  }
  
  // Calculate average J-coupling from all vicinal pairs
  const totalJ = vicinalCouplings.reduce((sum, vc) => sum + vc.predicted_J_Hz, 0);
  const avgCoupling = totalJ / vicinalCouplings.length;
  
  return {
    coupling: round(avgCoupling, 2)
  };
}

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calculate dihedral angles for coupling constant prediction
 */
export function calculateDihedralAngle(
  coords: Array<{ x: number; y: number; z: number }>,
  atom1: number,
  atom2: number,
  atom3: number,
  atom4: number
): number {
  // Calculate dihedral angle using vector cross products
  // Returns angle in degrees (-180 to 180)
  
  const p1 = coords[atom1];
  const p2 = coords[atom2];
  const p3 = coords[atom3];
  const p4 = coords[atom4];

  // Vectors
  const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
  const v3 = { x: p4.x - p3.x, y: p4.y - p3.y, z: p4.z - p3.z };

  // Cross products
  const n1 = {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  };
  const n2 = {
    x: v2.y * v3.z - v2.z * v3.y,
    y: v2.z * v3.x - v2.x * v3.z,
    z: v2.x * v3.y - v2.y * v3.x
  };

  // Normalize
  const len1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z);
  const len2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z);

  if (len1 === 0 || len2 === 0) return 0;

  n1.x /= len1; n1.y /= len1; n1.z /= len1;
  n2.x /= len2; n2.y /= len2; n2.z /= len2;

  // Dot product
  const dot = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

  // Determine sign using cross product of normals
  const cross = {
    x: n1.y * n2.z - n1.z * n2.y,
    y: n1.z * n2.x - n1.x * n2.z,
    z: n1.x * n2.y - n1.y * n2.x
  };
  const sign = (v2.x * cross.x + v2.y * cross.y + v2.z * cross.z) >= 0 ? 1 : -1;

  return sign * angle;
}

