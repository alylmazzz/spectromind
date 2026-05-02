/**
 * MS (Mass Spectrometry) Prediction Service v2.0
 * 
 * Provides in-silico fragmentation and MS spectrum prediction
 * using BDE (Bond Dissociation Energy) based algorithm with
 * diagnostic ion detection (Tropylium, Iminium, McLafferty, etc.)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPythonPath } from '@/lib/utils/pythonPath';
import type { MSPeak, DiagnosticIon, McLaffertyRearrangement } from '@/lib/types/v2';

const execAsync = promisify(exec);

export interface MSPredictionResult {
  success: boolean;
  molecularIon: number;   // M+ mass
  peaks: MSPeak[];
  method: string;
  formula?: string;
  diagnosticIons?: DiagnosticIon[];
  mclaffertyRearrangements?: McLaffertyRearrangement[];
  parameters?: {
    collision_energy: number;
    ionization: string;
    depth_limit: number;
  };
  warnings?: string[];
  error?: string;
}

export type IonizationMethod = 'EI' | 'ESI' | 'MALDI' | 'APCI';

export interface MSPredictionOptions {
  ionization?: IonizationMethod;
  energy?: number;         // eV for EI, collision energy for ESI
  charge?: number;         // Charge state (for ESI/MALDI)
  includeIsotopes?: boolean;
}

/**
 * Predict MS spectrum from SMILES string using advanced BDE-based algorithm
 * 
 * This function uses the enhanced Python MS predictor module that includes:
 * - BDE (Bond Dissociation Energy) based probabilistic fragmentation
 * - Recursive fragmentation tree
 * - Diagnostic ion detection (Tropylium, Iminium, McLafferty, etc.)
 * - Isotopic distribution calculation
 */
export async function predictMS(
  smiles: string,
  options: MSPredictionOptions = {}
): Promise<MSPredictionResult> {
  const {
    ionization = 'EI',
    energy = 30.0,
    charge = 1,
    includeIsotopes = true
  } = options;

  try {
    console.log(`🔬 MS Prediction v2.0: ${smiles.substring(0, 50)}...`);
    console.log(`   Ionization: ${ionization}, Energy: ${energy} eV`);

    // Use the advanced Python MS predictor module
    const result = await generateAdvancedSpectrum(smiles, ionization, energy);

    if (result.error) {
      return {
        success: false,
        molecularIon: 0,
        peaks: [],
        method: 'BDE-based Fragmentation',
        error: result.error
      };
    }

    // Convert Python result to TypeScript format
    const peaks: MSPeak[] = result.peaks.map((peak: any) => ({
      mz: peak['m/z'],
      intensity: peak.intensity,
      assignment: peak.type,
      type: peak.type,
      charge: charge
    }));

    // Add isotopic peaks if requested
    if (includeIsotopes && result.molecular_weight) {
      const isotopePeaks = await calculateIsotopicDistribution(
        result.molecular_weight,
        smiles
      );
      peaks.push(...isotopePeaks);
      peaks.sort((a, b) => a.mz - b.mz);
      normalizeIntensities(peaks);
    }

    console.log(`✅ MS Prediction complete: ${peaks.length} peaks`);
    if (result.diagnostic_ions && result.diagnostic_ions.length > 0) {
      console.log(`   🎯 Detected ${result.diagnostic_ions.length} diagnostic ions`);
    }

    return {
      success: true,
      molecularIon: result.molecular_weight,
      peaks,
      method: result.method || `BDE-based Fragmentation (${ionization})`,
      formula: result.formula,
      diagnosticIons: result.diagnostic_ions || [],
      mclaffertyRearrangements: result.mclafferty_rearrangements || [],
      parameters: result.parameters
    };

  } catch (error) {
    console.error('❌ MS Prediction error:', error);
    return {
      success: false,
      molecularIon: 0,
      peaks: [],
      method: 'BDE-based Fragmentation',
      error: error instanceof Error ? error.message : 'MS prediction failed'
    };
  }
}

/**
 * Generate advanced MS spectrum using Python MS predictor module
 */
async function generateAdvancedSpectrum(
  smiles: string,
  ionization: string,
  energy: number
): Promise<any> {
  const pythonScript = `
import sys
import os
import json

# Add ms-service directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services', 'ms-service'))

try:
    from ms_predictor import MSPredictor
    
    smiles = sys.argv[1]
    ionization = sys.argv[2]
    energy = float(sys.argv[3])
    
    predictor = MSPredictor()
    result = predictor.generate_spectrum(smiles, ionization, energy)
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

  try {
    const pythonPath = getPythonPath();
    const tempScriptPath = path.join(
      os.tmpdir(),
      `ms_advanced_${Date.now()}_${Math.random().toString(36).substring(7)}.py`
    );
    
    // Get the project root directory
    const projectRoot = process.cwd();
    const msServicePath = path.join(projectRoot, 'services', 'ms-service');
    
    // Check if ms_predictor.py exists
    const msPredictorPath = path.join(msServicePath, 'ms_predictor.py');
    if (!fs.existsSync(msPredictorPath)) {
      throw new Error('MS predictor module not found. Please ensure ms_predictor.py exists in services/ms-service/');
    }

    // Use direct import from ms-service directory
    const directPythonScript = `
import sys
import os
import json

# Add project root to path
project_root = r"${projectRoot.replace(/\\/g, '/')}"
sys.path.insert(0, os.path.join(project_root, 'services', 'ms-service'))

try:
    from ms_predictor import MSPredictor
    
    smiles = "${smiles.replace(/"/g, '\\"')}"
    ionization = "${ionization}"
    energy = ${energy}
    
    predictor = MSPredictor()
    result = predictor.generate_spectrum(smiles, ionization, energy)
    
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
`;

    fs.writeFileSync(tempScriptPath, directPythonScript, 'utf8');
    
    try {
      const { stdout, stderr } = await execAsync(
        `"${pythonPath}" "${tempScriptPath}"`,
        {
          timeout: 60000,  // 60 seconds timeout
          maxBuffer: 10 * 1024 * 1024,
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
    console.error('Advanced spectrum generation error:', error);
    return {
      error: error instanceof Error ? error.message : 'Spectrum generation failed'
    };
  }
}


/**
 * Calculate isotopic distribution (M+1, M+2 peaks)
 */
async function calculateIsotopicDistribution(
  molecularIon: number,
  smiles: string
): Promise<MSPeak[]> {
  // Simplified isotopic distribution calculation
  // For accurate calculation, use pyteomics or similar library
  
  const isotopePeaks: MSPeak[] = [];
  
  // M+1 peak (13C contribution)
  // Approximate: ~1.1% per carbon atom
  const carbonCount = (smiles.match(/[C]/g) || []).length;
  if (carbonCount > 0) {
    isotopePeaks.push({
      mz: molecularIon + 1.0034,
      intensity: carbonCount * 1.1,
      assignment: 'M+1 (13C)',
      formula: '13C'
    });
  }
  
  // M+2 peak (18O, 34S contributions)
  // Simplified: small contribution
  if (smiles.includes('O') || smiles.includes('S')) {
    isotopePeaks.push({
      mz: molecularIon + 2.0042,
      intensity: 0.2,
      assignment: 'M+2',
      formula: '18O/34S'
    });
  }
  
  return isotopePeaks;
}

/**
 * Normalize peak intensities (0-100 scale)
 */
function normalizeIntensities(peaks: MSPeak[]): void {
  if (peaks.length === 0) return;
  
  const maxIntensity = Math.max(...peaks.map(p => p.intensity));
  if (maxIntensity === 0) return;
  
  peaks.forEach(peak => {
    peak.intensity = (peak.intensity / maxIntensity) * 100;
  });
}

