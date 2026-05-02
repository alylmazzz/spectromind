/**
 * RDKit Structure Elucidation API Route
 *
 * @module api/rdkit/elucidation
 * @description De novo molecular structure determination from NMR peak data
 * using RDKit Python library. Spawns Python subprocess to perform analysis.
 *
 * @author Spectromind Team
 * @version 19.0
 *
 * @endpoint POST /api/rdkit/elucidation
 *
 * @example
 * // Request:
 * POST /api/rdkit/elucidation
 * {
 *   "peaks": [
 *     {"shift": 9.8, "integ": 1, "mult": "s"},
 *     {"shift": 2.4, "integ": 2, "mult": "q"}
 *   ],
 *   "formula": "C4H8O"
 * }
 *
 * // Response:
 * {
 *   "success": true,
 *   "fragments": [...],
 *   "candidates": [...],
 *   "best": {
 *     "name": "Butanal",
 *     "smiles": "CCCC=O",
 *     "score": 87.0
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ElucidationRequest {
  peaks: NMRPeak[];
  formula?: string;
}

interface NMRPeak {
  shift: number;
  integ: number;
  mult: string;
  coupling?: number;
}

interface ElucidationResponse {
  success: boolean;
  fragments?: Fragment[];
  candidates?: Candidate[];
  best?: Candidate | null;
  peak_count?: number;
  target_formula?: string;
  error?: string;
  stderr?: string;
}

interface Fragment {
  type: string;
  reasoning: string;
  priority: number;
}

interface Candidate {
  smiles: string;
  name: string;
  iupac?: string;
  formula: string;
  score: number;
  reasoning: string;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * POST handler for structure elucidation
 *
 * Validates input, spawns Python RDKit script, and returns structural analysis.
 *
 * @param request - Next.js request object
 * @returns JSON response with elucidation results or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body: ElucidationRequest = await request.json();
    const { peaks, formula } = body;

    if (!peaks || !Array.isArray(peaks) || peaks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Peak data is required (non-empty array)',
        },
        { status: 400 }
      );
    }

    // Log analysis start
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 RDKit Structure Elucidation Starting...');
    console.log(`📊 Input peaks: ${peaks.length}`);
    console.log(`🔬 Target formula: ${formula || 'Not specified'}`);
    console.log('═══════════════════════════════════════════════════════');

    // Execute Python script
    const result = await executePythonElucidation(peaks, formula);

    // Log results
    if (result.success) {
      console.log('✅ RDKit analysis completed successfully');
      console.log(`📌 Best candidate: ${result.best?.name || 'None found'}`);
      console.log(`🧩 Detected fragments: ${result.fragments?.length || 0}`);
      console.log(`🎯 Total candidates: ${result.candidates?.length || 0}`);
    } else {
      console.error('❌ RDKit analysis failed:', result.error);
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
 * Execute Python RDKit script as subprocess
 *
 * Spawns Python process in virtual environment, passes NMR data as arguments,
 * and captures JSON output.
 *
 * @param peaks - Array of NMR peaks
 * @param formula - Optional molecular formula
 * @returns Promise resolving to elucidation result
 *
 * @throws Will not throw - errors returned in result object
 */
async function executePythonElucidation(
  peaks: NMRPeak[],
  formula?: string
): Promise<ElucidationResponse> {
  return new Promise((resolve) => {
    // Prepare arguments
    const scriptPath = path.join(process.cwd(), 'scripts', 'rdkit_elucidation.py');
    const peaksJson = JSON.stringify(peaks);
    const args = [scriptPath, peaksJson];

    if (formula) {
      args.push(formula);
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
        const result: ElucidationResponse = JSON.parse(stdoutData);
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
