import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getPythonPath } from '@/lib/utils/pythonPath';

/**
 * HOSE NMR Predictor API
 *
 * Predicts 1H NMR spectrum from SMILES using HOSE-based approach
 * Fast, offline prediction without AI
 *
 * Input: SMILES
 * Output: Predicted chemical shifts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES required' },
        { status: 400 }
      );
    }

    console.log(`🧪 HOSE Predictor: Predicting NMR for SMILES: "${smiles}"`);

    // Path to Python script; use getPythonPath() for cross-platform venv
    const scriptPath = path.join(process.cwd(), 'lib', 'engines', 'predictor', 'hose.py');
    const venvPythonPath = getPythonPath();

    console.log(`🐍 Spawning Python: ${venvPythonPath}`);
    console.log(`📄 Script: ${scriptPath}`);
    console.log(`🧬 SMILES: ${smiles}`);

    // Execute Python HOSE predictor
    const result = await new Promise<any>((resolve, reject) => {
      const pythonProcess = spawn(venvPythonPath, [scriptPath, smiles]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('HOSE predictor error:', stderr);
          reject(new Error(`Python script failed: ${stderr}`));
          return;
        }

        try {
          const output = JSON.parse(stdout);
          resolve(output);
        } catch (parseError) {
          console.error('Failed to parse HOSE output:', stdout);
          reject(new Error('Invalid JSON output from HOSE predictor'));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('HOSE predictor timeout'));
      }, 10000);
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'HOSE prediction failed' },
        { status: 500 }
      );
    }

    console.log(`✅ HOSE Predictor: Predicted ${result.num_protons} protons`);
    console.log(`   Shifts: [${result.predicted_shifts.slice(0, 5).map((s: number) => s.toFixed(2)).join(', ')}...]`);

    return NextResponse.json({
      success: true,
      smiles,
      predicted_shifts: result.predicted_shifts,
      num_protons: result.num_protons,
      molecule_class: result.molecule_class,
      method: 'HOSE'
    });

  } catch (error) {
    console.error('HOSE predictor API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'HOSE predictor unavailable'
      },
      { status: 500 }
    );
  }
}
