import * as path from 'path';
import * as os from 'os';

/**
 * Get Python executable path for RDKit
 * Supports Windows, macOS, and Linux
 */
export function getPythonPath(): string {
  const platform = os.platform();
  const cwd = process.cwd();

  if (platform === 'win32') {
    // Windows: venv_rdkit\Scripts\python.exe
    const pythonPath = path.join(cwd, 'venv_rdkit', 'Scripts', 'python.exe');
    console.log(`🐍 Windows Python path: ${pythonPath}`);
    return pythonPath;
  } else {
    // macOS/Linux: venv_rdkit/bin/python3
    const pythonPath = path.join(cwd, 'venv_rdkit', 'bin', 'python3');
    console.log(`🐍 Unix Python path: ${pythonPath}`);
    return pythonPath;
  }
}

/**
 * Get Python command (for exec/spawn)
 * Falls back to system python if venv not found
 */
export function getPythonCommand(): string {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return 'python'; // Windows: try system python
  } else {
    return 'python3'; // Unix: try system python3
  }
}

