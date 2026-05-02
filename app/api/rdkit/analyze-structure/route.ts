/**
 * RDKit Structure Analysis API Route
 *
 * @module api/rdkit/analyze-structure
 * @description Analyzes molecular structure to generate 2D/3D coordinates,
 * detect point group symmetry, and calculate molecular descriptors.
 *
 * @author Spectromind Team
 * @version 1.0
 *
 * @endpoint POST /api/rdkit/analyze-structure
 *
 * @example
 * // Request:
 * POST /api/rdkit/analyze-structure
 * {
 *   "smiles": "c1ccccc1"
 * }
 *
 * // Response:
 * {
 *   "success": true,
 *   "smiles": "c1ccccc1",
 *   "molecular_formula": "C6H6",
 *   "coords_2d": [...],
 *   "coords_3d": [...],
 *   "point_group": "D6h",
 *   "symmetry_elements": ["E", "C6", "σh"],
 *   "descriptors": {...}
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface StructureRequest {
  smiles: string;
}

interface Atom2D {
  element: string;
  x: number;
  y: number;
}

interface Atom3D {
  element: string;
  x: number;
  y: number;
  z: number;
}

interface MolecularDescriptors {
  num_atoms: number;
  num_heavy_atoms: number;
  num_aromatic_atoms: number;
  num_rotatable_bonds: number;
  num_h_donors: number;
  num_h_acceptors: number;
  logP: number;
  tpsa: number;
  num_rings: number;
  num_aromatic_rings: number;
}

interface StructureResponse {
  success: boolean;
  smiles?: string;
  canonical_smiles?: string;
  molecular_formula?: string;
  molecular_weight?: number;
  coords_2d?: Atom2D[];
  coords_3d?: Atom3D[];
  point_group?: string;
  symmetry_elements?: string[];
  descriptors?: MolecularDescriptors;
  error?: string;
  stderr?: string;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST handler for structure analysis
 *
 * Validates SMILES input, spawns Python RDKit script, and returns structure data.
 *
 * @param request - Next.js request object
 * @returns JSON response with 2D/3D coords, symmetry, descriptors or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body: StructureRequest = await request.json();
    const { smiles } = body;

    if (!smiles || typeof smiles !== 'string' || smiles.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid SMILES string is required',
        },
        { status: 400 }
      );
    }

    // Log analysis start
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔬 RDKit Structure Analysis Starting...');
    console.log(`📐 SMILES: ${smiles}`);
    console.log('═══════════════════════════════════════════════════════');

    // Execute Python script
    const result = await executePythonStructureAnalysis(smiles);

    // Log results
    if (result.success) {
      console.log('✅ Structure analysis completed successfully');
      console.log(`🧪 Formula: ${result.molecular_formula}`);
      console.log(`⚛️  Atoms: ${result.descriptors?.num_atoms || 'N/A'}`);
      console.log(`🔷 Point Group: ${result.point_group || 'Unknown'}`);
      console.log(`📊 2D coords: ${result.coords_2d?.length || 0} atoms`);
      console.log(`📊 3D coords: ${result.coords_3d?.length || 0} atoms`);
    } else {
      console.error('❌ Structure analysis failed:', result.error);
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
 * Execute Python RDKit structure analysis script as subprocess
 *
 * Spawns Python process in virtual environment, passes SMILES as argument,
 * and captures JSON output with 2D/3D coords and symmetry data.
 *
 * @param smiles - SMILES string of molecule
 * @returns Promise resolving to structure analysis result
 *
 * @throws Will not throw - errors returned in result object
 */
async function executePythonStructureAnalysis(
  smiles: string
): Promise<StructureResponse> {
  return new Promise((resolve) => {
    // Prepare arguments
    const scriptPath = path.join(process.cwd(), 'scripts', 'rdkit_structure_analyzer.py');
    const args = [scriptPath, smiles];

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
        const result: StructureResponse = JSON.parse(stdoutData);
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
