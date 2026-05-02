/**
 * UltraThink Service - TypeScript Wrapper
 * 
 * ULTRATHINK dokümanına dayalı kapsamlı teorik spektrum tahmin servisi
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPythonPath, getPythonCommand } from '@/lib/utils/pythonPath';
import { NMRPeak, Carbon13Peak, FTIRPeak } from '@/lib/types';

const execAsync = promisify(exec);

export interface UltraThinkProperties {
  formula: string;
  molecularWeight: number;
  doB: number;
  symmetry: string;
  chiralCenters: number;
  rotatableBonds: number;
  heteroatomRatio: number;
}

export interface UltraThinkResult {
  success: boolean;
  h1NMR: NMRPeak[];
  c13NMR: Carbon13Peak[];
  ftir: FTIRPeak[];
  properties: UltraThinkProperties;
  confidence: number;
  warnings: string[];
  method: string;
  error?: string;
}

export interface UltraThinkOptions {
  solvent?: string;
  temperature?: number;
  frequency?: number;
}

/**
 * UltraThink Comprehensive Theoretical Spectrum Prediction
 * 
 * SMILES string'den başlayarak tüm spektrumları (1H, 13C, FTIR)
 * ULTRATHINK kurallarına göre tahmin eder.
 */
export async function predictUltraThinkSpectrum(
  smiles: string,
  options: UltraThinkOptions = {}
): Promise<UltraThinkResult> {
  const startTime = Date.now();

  try {
    // Try to get Python path from venv, fallback to system Python
    let pythonPath: string;
    try {
      pythonPath = getPythonPath();
      // Check if path exists
      if (!fs.existsSync(pythonPath)) {
        throw new Error('Venv Python not found');
      }
    } catch {
      // Fallback to system Python
      pythonPath = getPythonCommand();
    }
    
    const projectRoot = process.cwd();
    const ultrathinkServicePath = path.join(projectRoot, 'services', 'ultrathink-service');

    // Create a temporary script to run the prediction
    const directPythonScript = `
import sys
import os
import json

project_root = r"${projectRoot.replace(/\\/g, '/')}"
sys.path.insert(0, os.path.join(project_root, 'services', 'ultrathink-service'))

try:
    from ultrathink_engine import predict_ultrathink_spectrum
    
    smiles = "${smiles.replace(/"/g, '\\"')}"
    result = predict_ultrathink_spectrum(smiles)
    
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}))
`;

    const tempScriptPath = path.join(os.tmpdir(), `ultrathink_script_${Date.now()}.py`);
    await fs.promises.writeFile(tempScriptPath, directPythonScript);

    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" "${tempScriptPath}"`,
      {
        timeout: 120000, // 2 minutes
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        cwd: projectRoot
      }
    );

    await fs.promises.unlink(tempScriptPath); // Clean up

    const result = JSON.parse(stdout);

    if (!result.success) {
      console.error('Python UltraThink Error:', result.error);
      console.error('Python Traceback:', result.traceback);
      return {
        success: false,
        h1NMR: [],
        c13NMR: [],
        ftir: [],
        properties: {
          formula: '',
          molecularWeight: 0,
          doB: 0,
          symmetry: 'C1',
          chiralCenters: 0,
          rotatableBonds: 0,
          heteroatomRatio: 0
        },
        confidence: 0,
        warnings: [result.error || 'Prediction failed'],
        method: 'UltraThink Engine',
        error: result.error
      };
    }

    // Convert Python result to TypeScript format
    return {
      success: true,
      h1NMR: (result.h1NMR || []).map((p: any) => ({
        shift: p.shift,
        integ: p.integration || 1,
        mult: p.multiplicity || 's',
        label: p.assignment || 'H',
        coupling: undefined
      })),
      c13NMR: (result.c13NMR || []).map((p: any) => ({
        ppm: p.shift,
        intensity: p.intensity || 1.0,
        assignment: p.assignment || 'C',
        label: p.assignment || 'C'
      })),
      ftir: (result.ftir || []).map((p: any) => ({
        wavenumber: p.wavenumber,
        intensity: p.intensity || 50,
        assignment: p.assignment || 'Unknown',
        type: p.type || 'medium'
      })),
      properties: {
        formula: result.properties?.formula || '',
        molecularWeight: result.properties?.molecularWeight || 0,
        doB: result.properties?.doB || 0,
        symmetry: result.properties?.symmetry || 'C1',
        chiralCenters: result.properties?.chiralCenters || 0,
        rotatableBonds: result.properties?.rotatableBonds || 0,
        heteroatomRatio: result.properties?.heteroatomRatio || 0
      },
      confidence: result.confidence || 0.85,
      warnings: result.warnings || [],
      method: result.method || 'UltraThink Comprehensive Prediction Engine v1.0'
    };

  } catch (error) {
    console.error('❌ UltraThink prediction error:', error);
    return {
      success: false,
      h1NMR: [],
      c13NMR: [],
      ftir: [],
      properties: {
        formula: '',
        molecularWeight: 0,
        doB: 0,
        symmetry: 'C1',
        chiralCenters: 0,
        rotatableBonds: 0,
        heteroatomRatio: 0
      },
      confidence: 0,
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
      method: 'UltraThink Engine',
      error: error instanceof Error ? error.message : 'Prediction failed'
    };
  }
}

