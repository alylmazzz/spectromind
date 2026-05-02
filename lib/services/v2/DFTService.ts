/**
 * DFT (Density Functional Theory) Verification Service
 * 
 * Provides quantum mechanical verification of NMR shifts
 * using xTB (semi-empirical) or ORCA (DFT)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPythonPath } from '@/lib/utils/pythonPath';

const execAsync = promisify(exec);

export interface DFTShift {
  atomIndex: number;
  shift: number;              // δ ppm (calculated)
  shielding: number;          // σ (shielding constant)
  method: string;             // 'xTB' | 'ORCA' | 'Gaussian'
  confidence: number;         // 0-1
}

export interface DFTVerificationResult {
  success: boolean;
  shifts: DFTShift[];
  method: string;
  computationTime: number;    // seconds
  optimized?: boolean;        // Geometri optimize edildi mi?
  linearScaling?: boolean;    // Lineer ölçekleme kullanıldı mı?
  warnings?: string[];
  error?: string;
}

export type DFTMethod = 'xtb' | 'orca' | 'gaussian';

export interface DFTOptions {
  method?: DFTMethod;
  level?: string;             // e.g., 'B3LYP/6-31G*' for ORCA
  optimizeGeometry?: boolean;
  calculateShielding?: boolean;
  useLinearScaling?: boolean;  // Lineer ölçekleme kullanılsın mı?
}

/**
 * Verify NMR shifts using DFT calculations
 * 
 * Note: This requires xTB or ORCA to be installed and configured
 */
export async function verifyDFT(
  smiles: string,
  options: DFTOptions = {}
): Promise<DFTVerificationResult> {
  const {
    method = 'xtb',
    level = 'B3LYP/6-31G*',
    optimizeGeometry = true,
    calculateShielding = true,
    useLinearScaling = true
  } = options;

  const startTime = Date.now();

  try {
    console.log(`🔬 DFT Verification v2.0: ${smiles.substring(0, 50)}...`);
    console.log(`   Method: ${method}`);
    console.log(`   Optimize Geometry: ${optimizeGeometry}`);
    console.log(`   Linear Scaling: ${useLinearScaling}`);

    // Use the advanced Python XTB NMR engine module
    const result = await calculateAdvancedDFTShifts(smiles, method, optimizeGeometry, useLinearScaling);

    if (result.error) {
      return {
        success: false,
        shifts: [],
        method: method.toUpperCase(),
        computationTime: (Date.now() - startTime) / 1000,
        optimized: optimizeGeometry,
        linearScaling: useLinearScaling,
        error: result.error
      };
    }

    // Convert Python result to TypeScript format
    const shifts: DFTShift[] = (result.shifts || []).map((shift_data: any) => ({
      atomIndex: shift_data.atomIndex,
      shift: shift_data.shift,
      shielding: shift_data.shielding,
      method: shift_data.method || result.method,
      element: shift_data.element,
      confidence: shift_data.confidence || 0.9
    }));

    const computationTime = (Date.now() - startTime) / 1000;

    console.log(`✅ DFT Verification complete: ${shifts.length} shifts (${computationTime.toFixed(2)}s)`);

    return {
      success: true,
      shifts,
      method: result.method || `GFN2-xTB + GIAO`,
      computationTime,
      optimized: optimizeGeometry,
      linearScaling: useLinearScaling,
      warnings: result.warning ? [result.warning] : undefined
    };

  } catch (error) {
    const computationTime = (Date.now() - startTime) / 1000;
    console.error('❌ DFT Verification error:', error);
    return {
      success: false,
      shifts: [],
      method: method,
      computationTime,
      optimized: optimizeGeometry,
      linearScaling: useLinearScaling,
      error: error instanceof Error ? error.message : 'DFT verification failed'
    };
  }
}

/**
 * Check if DFT method is available
 */
async function checkMethodAvailability(method: DFTMethod): Promise<boolean> {
  try {
    if (method === 'xtb') {
      // Check if xTB is available
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('xtb --version', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    } else if (method === 'orca') {
      // Check if ORCA is available
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('orca --version', { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Calculate empirical shifts as placeholder
 */
async function calculateEmpiricalShifts(smiles: string): Promise<DFTShift[]> {
  const pythonScript = `
from rdkit import Chem
from rdkit.Chem import Descriptors
import json
import sys

smiles = sys.argv[1]

mol = Chem.MolFromSmiles(smiles)
if not mol:
    print("[]")
    sys.exit(0)

mol = Chem.AddHs(mol)

shifts = []

for atom in mol.GetAtoms():
    if atom.GetSymbol() != 'H':
        continue
    
    atom_idx = atom.GetIdx()
    parent = atom.GetNeighbors()[0] if atom.GetNeighbors() else None
    
    if not parent:
        continue
    
    # Empirical shift estimation
    hybrid = parent.GetHybridization()
    
    if hybrid == Chem.HybridizationType.SP3:
        shift = 1.0
        shielding = 30.0  # Approximate TMS reference
    elif hybrid == Chem.HybridizationType.SP2:
        if parent.GetIsAromatic():
            shift = 7.2
            shielding = 23.0
        else:
            shift = 5.5
            shielding = 26.0
    else:
        shift = 2.0
        shielding = 29.0
    
    shifts.append({
        "atomIndex": atom_idx,
        "shift": round(shift, 2),
        "shielding": round(shielding, 2),
        "method": "Empirical",
        "confidence": 0.6
    })

print(json.dumps(shifts))
`;

  try {
    const pythonPath = getPythonPath();
    const tempScriptPath = path.join(os.tmpdir(), `dft_empirical_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    
    fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
    
    try {
      const { stdout } = await execAsync(`"${pythonPath}" "${tempScriptPath}" "${smiles}"`, {
        timeout: 30000
      });
      
      const shifts = JSON.parse(stdout.trim());
      return shifts || [];
    } finally {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  } catch (error) {
    console.error('Empirical shift calculation error:', error);
    return [];
  }
}

/**
 * Calculate advanced DFT shifts using Python XTB_NMR_Engine module
 */
async function calculateAdvancedDFTShifts(
  smiles: string,
  method: string,
  optimizeGeometry: boolean,
  useLinearScaling: boolean
): Promise<any> {
  const pythonScript = `
import sys
import os
import json

# Add project root to path
project_root = r"${process.cwd().replace(/\\/g, '/')}"
sys.path.insert(0, os.path.join(project_root, 'services', 'dft-service'))

try:
    from xtb_nmr_engine import XTB_NMR_Engine
    
    smiles = "${smiles.replace(/"/g, '\\"')}"
    optimize = ${optimizeGeometry}
    use_linear_scaling = ${useLinearScaling}
    
    engine = XTB_NMR_Engine(xtb_path="xtb")
    result = engine.predict_shifts(smiles, optimize=optimize, use_linear_scaling=use_linear_scaling)
    
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
`;

  try {
    const pythonPath = getPythonPath();
    const tempScriptPath = path.join(
      os.tmpdir(),
      `dft_advanced_${Date.now()}_${Math.random().toString(36).substring(7)}.py`
    );
    
    // Get the project root directory
    const projectRoot = process.cwd();
    const dftServicePath = path.join(projectRoot, 'services', 'dft-service');
    
    // Check if xtb_nmr_engine.py exists
    const enginePath = path.join(dftServicePath, 'xtb_nmr_engine.py');
    if (!fs.existsSync(enginePath)) {
      throw new Error('XTB NMR engine module not found. Please ensure xtb_nmr_engine.py exists in services/dft-service/');
    }

    fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
    
    try {
      const { stdout, stderr } = await execAsync(
        `"${pythonPath}" "${tempScriptPath}"`,
        {
          timeout: 600000,  // 10 minutes timeout (QM calculations can be slow)
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
    console.error('Advanced DFT calculation error:', error);
    return {
      error: error instanceof Error ? error.message : 'DFT calculation failed'
    };
  }
}

