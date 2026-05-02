/**
 * Self-Correction Loop API
 * 
 * Agentic workflow: Generator -> Simulator -> Evaluator -> Critic
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPythonPath } from '@/lib/utils/pythonPath';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { peaks, formula, spectrum_type = '1H', max_retries = 5 } = body;

    if (!peaks || !Array.isArray(peaks) || peaks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Peaks array required' },
        { status: 400 }
      );
    }

    if (!formula) {
      return NextResponse.json(
        { success: false, error: 'Molecular formula required' },
        { status: 400 }
      );
    }

    // Call Python self-correction loop
    const pythonPath = getPythonPath();
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'services', 'self-correction', 'self_correction_loop.py');

    const pythonScript = `
import sys
import json
sys.path.insert(0, '${projectRoot.replace(/\\/g, '/')}/services/self-correction')

from self_correction_loop import self_correction_loop

peaks = ${JSON.stringify(peaks)}
formula = "${formula}"
spectrum_type = "${spectrum_type}"
max_retries = ${max_retries}

result = self_correction_loop(peaks, formula, spectrum_type, max_retries)
print(json.dumps(result))
`;

    const tempScriptPath = path.join(os.tmpdir(), `self_correction_${Date.now()}.py`);
    await fs.promises.writeFile(tempScriptPath, pythonScript);

    const { stdout, stderr } = await execAsync(
      `"${pythonPath}" "${tempScriptPath}"`,
      {
        timeout: 120000, // 2 minutes
        maxBuffer: 50 * 1024 * 1024,
        cwd: projectRoot
      }
    );

    await fs.promises.unlink(tempScriptPath);

    const result = JSON.parse(stdout);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Self-correction loop failed',
          result: result
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        smiles: result.smiles,
        confidence: result.confidence,
        rmsd: result.rmsd,
        iterations: result.iterations,
        theoretical_peaks: result.theoretical_peaks,
        note: result.note
      }
    });

  } catch (error) {
    console.error('Self-correction loop error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Self-correction failed'
      },
      { status: 500 }
    );
  }
}

