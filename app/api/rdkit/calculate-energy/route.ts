/**
 * RDKit Conformer Energy Calculation API Route
 *
 * @module api/rdkit/calculate-energy
 * @description Calculates MMFF94 force field energies for molecular conformers
 * using RDKit Python library. Used for Boltzmann weighting in theoretical NMR.
 *
 * @author Spectromind Team
 * @version 1.0
 *
 * @endpoint POST /api/rdkit/calculate-energy
 *
 * @example
 * // Request:
 * POST /api/rdkit/calculate-energy
 * {
 *   "smiles": "CCCC=O",
 *   "temperature": 298.15
 * }
 *
 * // Response:
 * {
 *   "success": true,
 *   "smiles": "CCCC=O",
 *   "conformers": [
 *     {
 *       "id": 0,
 *       "energy": 12.34,
 *       "boltzmann_weight": 0.45
 *     }
 *   ],
 *   "lowest_energy": 12.34,
 *   "temperature": 298.15
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EnergyRequest {
  smiles: string;
  temperature?: number;
}

interface Conformer {
  id: number;
  energy: number;
  boltzmann_weight: number;
}

interface EnergyResponse {
  success: boolean;
  smiles?: string;
  conformers?: Conformer[];
  lowest_energy?: number;
  temperature?: number;
  RT?: number;
  method?: string;
  error?: string;
  stderr?: string;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST handler for energy calculation
 *
 * Validates SMILES input, spawns Python RDKit script, and returns conformer energies.
 *
 * @param request - Next.js request object
 * @returns JSON response with energies and Boltzmann weights or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body: EnergyRequest = await request.json();
    const { smiles, temperature } = body;

    if (!smiles || typeof smiles !== 'string' || smiles.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid SMILES string is required',
        },
        { status: 400 }
      );
    }

    // Log calculation start
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚡ RDKit Energy Calculation Starting...');
    console.log(`📐 SMILES: ${smiles}`);
    console.log(`🌡️  Temperature: ${temperature || 298.15} K`);
    console.log('═══════════════════════════════════════════════════════');

    // Execute Python script
    const result = await executePythonEnergyCalculation(smiles, temperature);

    // Log results
    if (result.success) {
      console.log('✅ Energy calculation completed successfully');
      console.log(`🔬 Method: ${result.method || 'MMFF94'}`);
      console.log(`📊 Conformers: ${result.conformers?.length || 0}`);
      console.log(`⚡ Lowest energy: ${result.lowest_energy?.toFixed(2)} kcal/mol`);
    } else {
      console.error('❌ Energy calculation failed:', result.error);
    }

    console.log('═══════════════════════════════════════════════════════\n');

    // Return result
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });

  } catch (error: any) {
    console.error('❌ API Route Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error occurred',
        hint: 'Check Python installation and RDKit availability',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PYTHON SUBPROCESS EXECUTION
// ============================================================================

/**
 * Execute Python RDKit energy calculation script as subprocess
 *
 * Spawns Python process in virtual environment, passes SMILES as argument,
 * and captures JSON output with conformer energies.
 *
 * @param smiles - SMILES string of molecule
 * @param temperature - Temperature in Kelvin (optional, default 298.15)
 * @returns Promise resolving to energy calculation result
 *
 * @throws Will not throw - errors returned in result object
 */
async function executePythonEnergyCalculation(
  smiles: string,
  temperature?: number
): Promise<EnergyResponse> {
  return new Promise((resolve) => {
    // Prepare arguments
    const scriptPath = path.join(process.cwd(), 'scripts', 'rdkit_energy_calculator.py');
    const args = [scriptPath, smiles];

    if (temperature !== undefined && temperature > 0) {
      args.push(temperature.toString());
    }

    // Use virtual environment Python
    const venvPythonPath = path.join(process.cwd(), 'venv_rdkit', 'bin', 'python3');

    console.log(`🐍 Spawning Python: ${venvPythonPath}`);
    console.log(`📄 Script: ${scriptPath}`);

    const python = spawn(venvPythonPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    // Capture stdout
    python.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Capture stderr
    python.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Handle process completion
    python.on('close', (exitCode) => {
      // Non-zero exit code = error
      if (exitCode !== 0) {
        console.error(`⚠️  Python exited with code ${exitCode}`);
        console.error(`📄 stderr: ${stderrData.substring(0, 500)}`);

        resolve({
          success: false,
          error: `Python script failed (exit code ${exitCode})`,
          stderr: stderrData,
        });
        return;
      }

      // Parse JSON output
      try {
        const result: EnergyResponse = JSON.parse(stdoutData);
        resolve(result);
      } catch (parseError: any) {
        console.error('❌ JSON parse error:', parseError.message);
        console.error(`📄 stdout (first 500 chars): ${stdoutData.substring(0, 500)}`);

        resolve({
          success: false,
          error: 'Failed to parse Python output as JSON',
          stderr: `Parse error: ${parseError.message}\nOutput: ${stdoutData.substring(0, 200)}`,
        });
      }
    });

    // Handle process spawn errors
    python.on('error', (err) => {
      console.error('❌ Failed to spawn Python process:', err);

      resolve({
        success: false,
        error: 'Failed to execute Python script',
        stderr: `Spawn error: ${err.message}. Is Python installed?`,
      });
    });
  });
}
