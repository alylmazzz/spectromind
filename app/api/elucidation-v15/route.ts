/**
 * SpectroMind v1.5 "Singularity" API Endpoint
 *
 * Full-featured structure elucidation with all 7 engines:
 * 1. Mixture Detection
 * 2. Solvent Physics
 * 3. Carbon Skeleton (13C NMR)
 * 4. 2D Correlations (NOESY/HMBC)
 * 5. Fragment Detection (RDKit)
 * 6. Forward Prediction (HOSE)
 * 7. Certified Validator
 *
 * @module api/elucidation-v15
 * @version 1.5.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import type { ElucidationInput } from '@/lib/types/spectrum';
import type { ElucidationResult } from '@/lib/types/molecule';

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request
    const input: ElucidationInput = await request.json();

    const { spectral_data, chemical_context, meta_parameters } = input;

    // Validation
    if (!spectral_data || (!spectral_data.proton_nmr && !spectral_data.carbon_nmr)) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least proton or carbon NMR data required',
        },
        { status: 400 }
      );
    }

    // Log start
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 SpectroMind v1.5 "Singularity" API Request');
    console.log(`📊 Proton peaks: ${spectral_data.proton_nmr?.length || 0}`);
    console.log(`📊 Carbon peaks: ${spectral_data.carbon_nmr?.length || 0}`);
    console.log(`🔬 Solvent: ${chemical_context.solvent}`);
    console.log('═══════════════════════════════════════════════════════');

    // Execute Python pipeline
    const result = await executePythonPipeline(input);

    // Log completion
    if (result.success) {
      console.log('✅ v1.5 Pipeline completed successfully');
      console.log(`📌 Decision: ${result.decision}`);
      console.log(`🎯 Confidence: ${result.confidence_score?.toFixed(3) || 'N/A'}`);
    } else {
      console.error('❌ v1.5 Pipeline failed:', result.error);
    }

    console.log('═══════════════════════════════════════════════════════\n');

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });

  } catch (error: any) {
    console.error('❌ API Route Error:', error);

    return NextResponse.json(
      {
        success: false,
        version: '1.5.0',
        error: error.message || 'Unknown error occurred',
        hint: 'Check Python installation and all v1.5 engines',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PYTHON PIPELINE EXECUTION
// ============================================================================

async function executePythonPipeline(
  input: ElucidationInput
): Promise<ElucidationResult> {
  return new Promise((resolve) => {
    // Prepare script path
    const scriptPath = path.join(process.cwd(), 'scripts', 'elucidation_v15.py');

    // Convert input to JSON string
    const inputJson = JSON.stringify(input);

    // Use virtual environment Python
    const venvPythonPath = path.join(process.cwd(), 'venv_rdkit', 'bin', 'python3');

    console.log(`🐍 Spawning Python: ${venvPythonPath}`);
    console.log(`📄 Script: elucidation_v15.py`);

    // Spawn Python process with JSON input via stdin
    const python = spawn(venvPythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    // Send input via stdin
    python.stdin.write(inputJson);
    python.stdin.end();

    // Capture stdout
    python.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Capture stderr (includes print statements)
    python.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      // Also log stderr to console for debugging
      if (chunk.includes('Engine')) {
        console.log(chunk.trim());
      }
    });

    // Handle process completion
    python.on('close', (exitCode) => {
      if (exitCode !== 0) {
        console.error(`⚠️  Python exited with code ${exitCode}`);
        console.error(`📄 stderr: ${stderrData.substring(0, 500)}`);

        resolve({
          success: false,
          version: '1.5.0',
          decision: 'REJECTED',
          error: `Python script failed (exit code ${exitCode})`,
          stderr: stderrData,
        } as ElucidationResult);
        return;
      }

      // Parse JSON output
      try {
        // Extract JSON from output (it's at the end after all logs)
        const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in output');
        }

        const result: ElucidationResult = JSON.parse(jsonMatch[0]);
        resolve(result);
      } catch (parseError: any) {
        console.error('❌ JSON parse error:', parseError.message);
        console.error(`📄 stdout (first 500 chars): ${stdoutData.substring(0, 500)}`);

        resolve({
          success: false,
          version: '1.5.0',
          decision: 'REJECTED',
          error: 'Failed to parse Python output as JSON',
          stderr: `Parse error: ${parseError.message}\\nOutput: ${stdoutData.substring(0, 200)}`,
        } as ElucidationResult);
      }
    });

    // Handle process spawn errors
    python.on('error', (err) => {
      console.error('❌ Failed to spawn Python process:', err);

      resolve({
        success: false,
        version: '1.5.0',
        decision: 'REJECTED',
        error: 'Failed to execute Python script',
        stderr: `Spawn error: ${err.message}. Is Python installed?`,
      } as ElucidationResult);
    });
  });
}
