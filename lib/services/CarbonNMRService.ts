/**
 * Carbon-13 NMR Analysis Service
 *
 * Provides 13C NMR analysis capabilities integrated with existing architecture
 * Uses RDKit for molecular structure analysis and AI for peak identification
 */

import type { Carbon13Peak } from '@/lib/types';
import { estimateShiftFromType, validateShiftRange } from '@/lib/utils/carbon13ShiftCalculator';

export interface Carbon13AnalysisContext {
  peaks: Carbon13Peak[];
  solvent: string;
  frequency: number;
  mode?: 'standard' | 'DEPT-135' | 'DEPT-90' | 'DEPT-45';
}

// Solvent peaks for 13C NMR (Pavia Section 6.14)
export const CARBON13_SOLVENTS: Record<string, Array<{ ppm: number; multiplicity: string; label: string }>> = {
  'CDCl3': [{ ppm: 77.16, multiplicity: 't', label: 'CDCl3 (1:1:1 triplet)' }],
  'DMSO': [{ ppm: 39.52, multiplicity: 'septet', label: 'DMSO-d6 ((CD3)2SO)' }],
  'Acetone': [
    { ppm: 29.84, multiplicity: 'septet', label: 'Acetone-d6 (CD3)' },
    { ppm: 206.26, multiplicity: 's', label: 'Acetone-d6 (C=O)' }
  ],
  'MeOD': [{ ppm: 49.00, multiplicity: 'septet', label: 'MeOD (CD3)' }],
  'C6D6': [{ ppm: 128.06, multiplicity: 't', label: 'C6D6 (aromatic)' }],
  'D2O': [], // No carbon peaks
  'CD2Cl2': [{ ppm: 53.84, multiplicity: 'quintet', label: 'CD2Cl2' }],
  'CD3CN': [{ ppm: 1.32, multiplicity: 'septet', label: 'CD3CN (CD3)' }, { ppm: 118.26, multiplicity: 's', label: 'CD3CN (CN)' }],
  'THF-d8': [{ ppm: 25.31, multiplicity: 'm', label: 'THF-d8 (CH2)' }, { ppm: 67.21, multiplicity: 'm', label: 'THF-d8 (OCH2)' }]
};

/**
 * Build 13C NMR analysis context from user peaks
 */
export function buildCarbon13Context(
  peaks: Carbon13Peak[],
  solvent: string,
  frequency: number
): string {
  const peakDescriptions = peaks.map((peak, idx) => {
    const parts: string[] = [
      `δ ${peak.ppm.toFixed(2)} ppm`
    ];

    if (peak.carbonType) {
      parts.push(`(${peak.carbonType})`);
    }

    if (peak.multiplicity) {
      parts.push(`${peak.multiplicity}`);
    }

    if (peak.assignment) {
      parts.push(`→ ${peak.assignment}`);
    }

    return `Peak ${idx + 1}: ${parts.join(' ')}`;
  }).join('\n');

  // Get solvent information
  const solventPeaks = CARBON13_SOLVENTS[solvent] || [];
  const solventInfo = solventPeaks.length > 0
    ? `\n🔬 Solvent Peaks (${solvent}):\n${solventPeaks.map(s => `  - ${s.ppm} ppm ${s.multiplicity}: ${s.label}`).join('\n')}`
    : `\n🔬 Solvent: ${solvent} (no carbon peaks)`;

  return `📊 13C NMR Spectrum Analysis (${frequency} MHz)
${solventInfo}

📈 User Peaks (${peaks.length} total):
${peakDescriptions}

🎯 Analysis Task:
1. Identify the molecular structure from these 13C NMR peaks
2. Assign each peak to specific carbons in the structure
3. Validate peak assignments using:
   - Chemical shift ranges (aliphatic 0-50, heteroatom 50-100, unsaturated 100-160, carbonyl 160-220)
   - Carbon type consistency (CH3, CH2, CH, Cq)
   - Solvent peak filtering
4. Consider DEPT information if carbonType is provided`;
}

/**
 * Validate 13C peaks to prevent AI hallucination
 */
export function validateCarbon13Peaks(
  peaks: Carbon13Peak[],
  expectedFormula?: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Range validation
  for (const peak of peaks) {
    if (peak.ppm < -10 || peak.ppm > 230) {
      errors.push(`Peak at ${peak.ppm.toFixed(2)} ppm is outside valid range (-10 to 230 ppm)`);
    }
  }

  // 2. Carbon type consistency
  for (const peak of peaks) {
    if (peak.carbonType) {
      const hybridization = peak.ppm > 90 ? 'sp2' : peak.ppm > 60 && peak.ppm < 90 ? 'sp' : 'sp3';
      const validation = validateShiftRange(peak.ppm, peak.carbonType, hybridization);

      if (!validation.valid && validation.warning) {
        warnings.push(`${peak.assignment || `Peak at ${peak.ppm.toFixed(2)} ppm`}: ${validation.warning}`);
      }
    }
  }

  // 3. Check for duplicate peaks (within 0.5 ppm)
  const ppmValues = peaks.map(p => Math.round(p.ppm * 2) / 2);
  const duplicates = ppmValues.filter((val, idx) => ppmValues.indexOf(val) !== idx);
  if (duplicates.length > 0) {
    warnings.push(`Possible duplicate peaks detected: ${[...new Set(duplicates)].join(', ')} ppm`);
  }

  // 4. Formula validation (if provided)
  if (expectedFormula) {
    const carbonMatch = expectedFormula.match(/C(\d+)/);
    if (carbonMatch) {
      const expectedCarbons = parseInt(carbonMatch[1]);
      const nonSolventPeaks = peaks.filter(p => !p.isSolvent);

      if (nonSolventPeaks.length > expectedCarbons) {
        errors.push(
          `Too many peaks (${nonSolventPeaks.length}) for formula ${expectedFormula} (${expectedCarbons} carbons expected)`
        );
      } else if (nonSolventPeaks.length < expectedCarbons * 0.4) {
        warnings.push(
          `Very few peaks (${nonSolventPeaks.length}) for formula ${expectedFormula}. Check for molecular symmetry.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Filter out solvent peaks from analysis
 */
export function filterSolventPeaks(
  peaks: Carbon13Peak[],
  solvent: string,
  tolerance: number = 0.5
): { moleculePeaks: Carbon13Peak[]; solventPeaks: Carbon13Peak[] } {
  const knownSolventPeaks = CARBON13_SOLVENTS[solvent] || [];
  const moleculePeaks: Carbon13Peak[] = [];
  const solventPeaks: Carbon13Peak[] = [];

  for (const peak of peaks) {
    let isSolvent = false;

    for (const solventPeak of knownSolventPeaks) {
      if (Math.abs(peak.ppm - solventPeak.ppm) < tolerance) {
        isSolvent = true;
        solventPeaks.push({
          ...peak,
          isSolvent: true,
          assignment: solventPeak.label
        });
        break;
      }
    }

    if (!isSolvent) {
      moleculePeaks.push(peak);
    }
  }

  return { moleculePeaks, solventPeaks };
}

/**
 * Estimate molecular formula from 13C peaks
 * Uses chemical shift distribution to estimate heteroatoms
 */
export function estimateFormulaFrom13C(peaks: Carbon13Peak[]): {
  formula: string;
  confidence: number;
  reasoning: string;
} {
  const { moleculePeaks } = filterSolventPeaks(peaks, 'CDCl3');

  const carbonCount = moleculePeaks.length;

  // Analyze shift distribution
  const aliphatic = moleculePeaks.filter(p => p.ppm < 50).length;
  const heteroatomSubstituted = moleculePeaks.filter(p => p.ppm >= 50 && p.ppm < 100).length;
  const unsaturated = moleculePeaks.filter(p => p.ppm >= 100 && p.ppm < 160).length;
  const carbonyl = moleculePeaks.filter(p => p.ppm >= 160 && p.ppm < 220).length;

  // Estimate heteroatoms
  const hasOxygen = heteroatomSubstituted > 0 || carbonyl > 0;
  const hasNitrogen = heteroatomSubstituted > carbonyl; // More C-N than C=O
  const hasAromatic = unsaturated > 3; // At least 3-4 aromatic carbons suggests benzene ring

  // Build formula estimate
  let formula = `C${carbonCount}`;
  let reasoning = `Estimated ${carbonCount} carbons from peaks. `;

  // Estimate hydrogen count (very rough)
  const avgHPerC = hasAromatic ? 1.0 : 2.0;
  const estimatedH = Math.round(carbonCount * avgHPerC);
  formula += `H${estimatedH}`;
  reasoning += `~${estimatedH} hydrogens estimated. `;

  if (hasOxygen) {
    const oxygenCount = carbonyl + Math.floor(heteroatomSubstituted / 2);
    formula += `O${oxygenCount}`;
    reasoning += `${oxygenCount} oxygen atoms (from C=O and C-O peaks). `;
  }

  if (hasNitrogen) {
    formula += `N1`;
    reasoning += `Nitrogen suggested by C-N peaks. `;
  }

  const confidence = carbonCount > 5 ? 0.6 : 0.4; // Low confidence for formula estimation

  return { formula, confidence, reasoning };
}

export const CarbonNMRService = {
  buildCarbon13Context,
  validateCarbon13Peaks,
  filterSolventPeaks,
  estimateFormulaFrom13C,
  CARBON13_SOLVENTS
};
