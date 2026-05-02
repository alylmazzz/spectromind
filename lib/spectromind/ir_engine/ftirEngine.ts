/**
 * FTIR Prediction Engine
 * Main orchestrator for theoretical IR spectrum calculation
 *
 * Pipeline:
 * 1. Parse SMILES → Molecular Graph
 * 2. Assign hybridization
 * 3. Detect symmetry & equivalent atoms
 * 4. Calculate normal modes
 * 5. Generate IR spectrum
 */

import { parseSMILES } from '../parser/smilesParser';
import { assignHybridization } from '../precompute/hybridizationAssigner';
import { assignSymmetryGroups } from '../symmetry/equivalenceDetector';
import { calculateNormalModes } from './normalModeSolver';
import { MolecularGraph, IRPeak } from '../core/types';
import {
  hasAromaticRingInStructure,
  V33_IR_AROMATIC_BANDS,
} from '@/lib/utils/v33SpectrumRules';

export interface FTIRPredictionResult {
  success: boolean;
  peaks: IRPeak[];
  molecularFormula: string;
  smiles: string;
  warnings: string[];
}

/**
 * Main FTIR prediction function
 * Takes SMILES string, returns theoretical IR spectrum
 */
export async function predictFTIR(smiles: string): Promise<FTIRPredictionResult> {
  const warnings: string[] = [];

  try {
    // Step 1: Parse SMILES → Molecular Graph
    console.log('📐 Parsing SMILES...');
    const graph = await parseSMILES(smiles);

    // Step 2: Assign hybridization
    console.log('🔬 Assigning hybridization...');
    assignHybridization(graph);

    // Step 3: Detect symmetry
    console.log('⚛️ Analyzing symmetry...');
    assignSymmetryGroups(graph);

    // Step 4: Calculate normal modes
    console.log('🌊 Calculating vibrational modes...');
    let irPeaks = calculateNormalModes(graph);

    // v33 IR aromatik iskelet bantları (1450–1600 cm⁻¹): Ar C=C skeletal/overtone
    const aromaticC =
      graph.atoms.filter((a) => a.aromaticity && a.symbol === 'C').length ||
      (graph.smiles?.match(/c/g) || []).length;
    const hasAromatic =
      hasAromaticRingInStructure(aromaticC, graph.smiles || smiles);
    const hasArCCBand = irPeaks.some(
      (p) =>
        (p.wavenumber >= 1450 && p.wavenumber <= 1600) &&
        /Ar C=C|skeletal|overtone|C=C.*[Rr]ing/.test(p.assignment)
    );
    if (hasAromatic && !hasArCCBand) {
      for (const band of V33_IR_AROMATIC_BANDS) {
        irPeaks.push({
          wavenumber: band.freq,
          intensity: 50,
          type: 'medium',
          assignment: band.assign,
          mode: 'stretch',
        });
      }
    }

    // Step 5: Validate spectrum
    validateSpectrum(irPeaks, graph, warnings);

    // Step 6: Sort by wavenumber (descending)
    irPeaks.sort((a, b) => b.wavenumber - a.wavenumber);

    console.log(`✅ FTIR prediction complete: ${irPeaks.length} peaks`);

    return {
      success: true,
      peaks: irPeaks,
      molecularFormula: graph.formula,
      smiles: graph.smiles || smiles,
      warnings
    };

  } catch (error) {
    console.error('❌ FTIR prediction failed:', error);
    return {
      success: false,
      peaks: [],
      molecularFormula: '',
      smiles,
      warnings: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Validate predicted spectrum against chemical rules
 */
function validateSpectrum(peaks: IRPeak[], graph: MolecularGraph, warnings: string[]): void {
  // Check 1: Spectrum should have peaks in standard regions
  const hasHighFreq = peaks.some(p => p.wavenumber > 2500); // O-H, N-H, C-H
  const hasMidFreq = peaks.some(p => p.wavenumber >= 1500 && p.wavenumber <= 2500); // C=O, C=C
  const hasFingerprint = peaks.some(p => p.wavenumber < 1500); // Fingerprint region

  if (!hasHighFreq && !hasMidFreq && !hasFingerprint) {
    warnings.push('Unusual spectrum: no peaks detected in standard regions');
  }

  // Check 2: C=O should be strong if present
  const carbonylPeaks = peaks.filter(p =>
    p.assignment.includes('C=O') && p.wavenumber >= 1650 && p.wavenumber <= 1750
  );

  if (carbonylPeaks.length > 0 && carbonylPeaks.every(p => p.type === 'weak')) {
    warnings.push('C=O peak unexpectedly weak - check conjugation');
  }

  // Check 3: O-H should be broad and strong if present
  const hydroxylPeaks = peaks.filter(p =>
    p.assignment.includes('O-H') && p.wavenumber >= 3200 && p.wavenumber <= 3600
  );

  if (hydroxylPeaks.length > 0) {
    warnings.push('O-H peak may be broadened by H-bonding (not modeled in intensity)');
  }

  // Check 4: Peak count sanity check
  if (peaks.length > 30) {
    warnings.push('Large number of peaks - some may be overtones or combinations');
  }

  if (peaks.length < 3) {
    warnings.push('Very few peaks detected - highly symmetric molecule or incomplete analysis');
  }

  // Check 5: Molecular formula consistency
  const hasCarbon = graph.atoms.some(a => a.symbol === 'C');
  const hasCHPeaks = peaks.some(p => p.assignment.includes('C-H'));

  if (hasCarbon && !hasCHPeaks) {
    warnings.push('Molecule contains carbon but no C-H stretches detected');
  }
}

/**
 * Export spectrum to common formats
 */
export function exportToJCAMP(result: FTIRPredictionResult): string {
  // TODO: Implement JCAMP-DX format export
  return '';
}

export function exportToCSV(result: FTIRPredictionResult): string {
  let csv = 'Wavenumber (cm⁻¹),Intensity,Type,Assignment,Mode\n';

  result.peaks.forEach(peak => {
    csv += `${peak.wavenumber},${peak.intensity},${peak.type},${peak.assignment},${peak.mode}\n`;
  });

  return csv;
}
