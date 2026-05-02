/**
 * SpectroMind v2.0 - Validation Suite v2
 * 
 * Yapısal tutarlılık testleri:
 * - δ penceresi tutarlılığı
 * - Aromatik pattern kontrolü
 * - DBE + fonksiyonel grup uyumu
 * - J-pattern tutarlılığı
 * - İntegral rationing
 */

import {
  ValidationIssue,
  ValidationResult,
  ValidationSeverity,
  ValidationPatch,
  WindowExpectation,
  NMRPeakSimulated,
} from '@/lib/types/nmr-simulation';

// ============================================================================
// VALIDATION ISSUE CODES
// ============================================================================

export const VALIDATION_CODES = {
  // Window checks
  ESTER_OCH_MISSING: 'ESTER_OCH_MISSING',
  ALDEHYDE_PEAK_MISSING: 'ALDEHYDE_PEAK_MISSING',
  CARBOXYLIC_PEAK_MISSING: 'CARBOXYLIC_PEAK_MISSING',
  AROMATIC_PEAK_MISSING: 'AROMATIC_PEAK_MISSING',
  AROMATIC_EXCESS_INTEGRAL: 'AROMATIC_EXCESS_INTEGRAL',
  VINYLIC_PEAK_MISSING: 'VINYLIC_PEAK_MISSING',
  
  // J-pattern checks
  TRANS_VINYL_J_LOW: 'TRANS_VINYL_J_LOW',
  CIS_VINYL_J_HIGH: 'CIS_VINYL_J_HIGH',
  AROMATIC_ORTHO_J_MISSING: 'AROMATIC_ORTHO_J_MISSING',
  
  // DBE consistency
  HIGH_DBE_NO_UNSAT: 'HIGH_DBE_NO_UNSAT',
  
  // Integral checks
  INTEGRAL_MISMATCH: 'INTEGRAL_MISMATCH',
  FRACTIONAL_INTEGRAL: 'FRACTIONAL_INTEGRAL',
  
  // Structure checks
  FORMULA_MISMATCH: 'FORMULA_MISMATCH',
  H_COUNT_MISMATCH: 'H_COUNT_MISMATCH',
};

// ============================================================================
// WINDOW EXPECTATIONS
// ============================================================================

export const WINDOW_EXPECTATIONS: WindowExpectation[] = [
  {
    id: 'ESTER_OCH',
    requiredSubstructures: ['[#6]-C(=O)-O-[#6]'],  // Ester SMARTS
    windows: [{
      ppmMin: 3.5,
      ppmMax: 4.5,
      minIntegral: 1,
      tag: 'O-CH',
      strength: 'strong',
    }],
  },
  {
    id: 'ALDEHYDE',
    requiredSubstructures: ['[CX3H1](=O)'],  // Aldehyde SMARTS
    windows: [{
      ppmMin: 9.0,
      ppmMax: 10.5,
      minIntegral: 1,
      tag: 'CHO',
      strength: 'strong',
    }],
  },
  {
    id: 'CARBOXYLIC_ACID',
    requiredSubstructures: ['[CX3](=O)[OX2H1]'],  // COOH
    windows: [{
      ppmMin: 10.0,
      ppmMax: 13.0,
      minIntegral: 1,
      tag: 'COOH',
      strength: 'medium',
    }],
    allowAbsenceIf: ['D2O_solvent'],  // D2O'da görünmez
  },
  {
    id: 'AROMATIC',
    requiredSubstructures: ['c1ccccc1'],  // Benzene ring
    windows: [{
      ppmMin: 6.5,
      ppmMax: 8.5,
      minIntegral: 1,
      tag: 'Ar-H',
      strength: 'strong',
    }],
  },
  {
    id: 'VINYL',
    requiredSubstructures: ['[CX3]=[CX3]'],  // C=C
    windows: [{
      ppmMin: 4.5,
      ppmMax: 6.8,
      minIntegral: 1,
      tag: 'Vinyl-H',
      strength: 'medium',
    }],
  },
];

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export interface ValidationInput {
  peaks: NMRPeakSimulated[];
  structure: {
    smiles: string;
    formula: string;
    dbe: number;
    totalH: number;
    hasAldehyde?: boolean;
    hasEster?: boolean;
    hasCarboxylicAcid?: boolean;
    hasAromatic?: boolean;
    hasAlkene?: boolean;
    aromaticHCount?: number;
    vinylHCount?: number;
  };
  jEdges?: Array<{
    bondClass: string;
    jHz: number;
    proton1Id: string;
    proton2Id: string;
  }>;
  solvent?: string;
}

/**
 * Tüm validasyon testlerini çalıştır
 */
export function runValidation(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  let totalPenalty = 0;
  
  // 1. Window checks
  issues.push(...validateWindows(input));
  
  // 2. J-pattern checks
  issues.push(...validateJPatterns(input));
  
  // 3. DBE consistency
  issues.push(...validateDBEConsistency(input));
  
  // 4. Integral checks
  issues.push(...validateIntegrals(input));
  
  // 5. H count check
  issues.push(...validateHCount(input));
  
  // Toplam penalty
  for (const issue of issues) {
    totalPenalty += issue.confidencePenalty ?? 0;
  }
  
  const hasVeto = issues.some(i => i.severity === 'VETO');
  
  return {
    passed: !hasVeto,
    issues,
    confidenceAdjustment: -totalPenalty,
    finalConfidence: Math.max(0.3, 1 - totalPenalty),
  };
}

// ============================================================================
// WINDOW VALIDATION
// ============================================================================

function validateWindows(input: ValidationInput): ValidationIssue[] {
  const { peaks, structure } = input;
  const issues: ValidationIssue[] = [];
  
  // Aldehyde check
  if (structure.hasAldehyde) {
    const aldehydeIntegral = sumIntegralInWindow(peaks, 9.0, 10.5);
    if (aldehydeIntegral < 0.8) {
      issues.push({
        code: VALIDATION_CODES.ALDEHYDE_PEAK_MISSING,
        severity: 'WARN',
        message: 'Aldehyde group present but no peak at 9.0-10.5 ppm',
        evidence: { expected: 1, found: aldehydeIntegral },
        confidencePenalty: 0.1,
      });
    }
  }
  
  // Ester O-CH check
  if (structure.hasEster) {
    const ochIntegral = sumIntegralInWindow(peaks, 3.5, 4.5);
    // Not: tBu ester gibi durumlarda O üzerinde H olmayabilir
    // Bu kontrolü daha sofistike yapmak gerekir
    if (ochIntegral < 0.5) {
      issues.push({
        code: VALIDATION_CODES.ESTER_OCH_MISSING,
        severity: 'WARN',
        message: 'Ester group present but weak signal at 3.5-4.5 ppm',
        evidence: { found: ochIntegral },
        confidencePenalty: 0.05,
        suggestedAction: 'Check if ester has O-CH protons (not tBu ester)',
      });
    }
  }
  
  // Aromatic check
  if (structure.hasAromatic && structure.aromaticHCount && structure.aromaticHCount > 0) {
    const arIntegral = sumIntegralInWindow(peaks, 6.5, 8.5);
    const expectedArH = structure.aromaticHCount;
    
    if (arIntegral < expectedArH * 0.7) {
      issues.push({
        code: VALIDATION_CODES.AROMATIC_PEAK_MISSING,
        severity: 'WARN',
        message: `Expected ~${expectedArH} aromatic H but found integral ${arIntegral.toFixed(1)}`,
        evidence: { expected: expectedArH, found: arIntegral },
        confidencePenalty: 0.1,
      });
    }
  }
  
  // Vinyl check
  if (structure.hasAlkene && structure.vinylHCount && structure.vinylHCount > 0) {
    const vinylIntegral = sumIntegralInWindow(peaks, 4.5, 6.8);
    
    if (vinylIntegral < structure.vinylHCount * 0.5) {
      issues.push({
        code: VALIDATION_CODES.VINYLIC_PEAK_MISSING,
        severity: 'WARN',
        message: `Expected vinyl H but found integral ${vinylIntegral.toFixed(1)}`,
        evidence: { expected: structure.vinylHCount, found: vinylIntegral },
        confidencePenalty: 0.08,
      });
    }
  }
  
  return issues;
}

// ============================================================================
// J-PATTERN VALIDATION
// ============================================================================

function validateJPatterns(input: ValidationInput): ValidationIssue[] {
  const { jEdges, structure } = input;
  const issues: ValidationIssue[] = [];
  
  if (!jEdges) return issues;
  
  // Trans vinyl J check
  for (const edge of jEdges) {
    if (edge.bondClass === 'sp2_sp2_trans') {
      if (edge.jHz < 12) {
        issues.push({
          code: VALIDATION_CODES.TRANS_VINYL_J_LOW,
          severity: 'WARN',
          message: `Trans vinyl J=${edge.jHz.toFixed(1)} Hz is low (expected 12-18 Hz)`,
          evidence: { jHz: edge.jHz, bondClass: edge.bondClass },
          confidencePenalty: 0.1,
        });
      }
    }
    
    if (edge.bondClass === 'sp2_sp2_cis') {
      if (edge.jHz > 13) {
        issues.push({
          code: VALIDATION_CODES.CIS_VINYL_J_HIGH,
          severity: 'WARN',
          message: `Cis vinyl J=${edge.jHz.toFixed(1)} Hz is high (expected 6-12 Hz)`,
          evidence: { jHz: edge.jHz, bondClass: edge.bondClass },
          confidencePenalty: 0.1,
        });
      }
    }
  }
  
  // Aromatic ortho J check
  if (structure.hasAromatic) {
    const hasOrthoJ = jEdges.some(e => 
      e.bondClass === 'aromatic_ortho' && e.jHz >= 6 && e.jHz <= 10
    );
    
    if (!hasOrthoJ && structure.aromaticHCount && structure.aromaticHCount > 1) {
      issues.push({
        code: VALIDATION_CODES.AROMATIC_ORTHO_J_MISSING,
        severity: 'WARN',
        message: 'Aromatic protons present but no ortho coupling detected',
        evidence: { aromaticH: structure.aromaticHCount },
        confidencePenalty: 0.05,
      });
    }
  }
  
  return issues;
}

// ============================================================================
// DBE CONSISTENCY
// ============================================================================

function validateDBEConsistency(input: ValidationInput): ValidationIssue[] {
  const { peaks, structure } = input;
  const issues: ValidationIssue[] = [];
  
  // High DBE check
  if (structure.dbe >= 4) {
    const aromaticIntegral = sumIntegralInWindow(peaks, 6.5, 8.5);
    const vinylIntegral = sumIntegralInWindow(peaks, 4.5, 6.5);
    
    const hasUnsatSignal = aromaticIntegral > 0.5 || vinylIntegral > 0.5;
    
    if (!hasUnsatSignal && !structure.hasAromatic && !structure.hasAlkene) {
      // DBE yüksek ama unsaturation sinyali yok
      // Bu, karbonil veya başka nedenlerden olabilir
      // Sadece uyarı ver
      issues.push({
        code: VALIDATION_CODES.HIGH_DBE_NO_UNSAT,
        severity: 'WARN',
        message: `DBE=${structure.dbe} suggests unsaturation but no aromatic/vinyl signals`,
        evidence: { dbe: structure.dbe, aromaticInt: aromaticIntegral, vinylInt: vinylIntegral },
        confidencePenalty: 0.05,
        suggestedAction: 'Check for carbonyl, nitrile, or other unsaturation',
      });
    }
  }
  
  return issues;
}

// ============================================================================
// INTEGRAL VALIDATION
// ============================================================================

function validateIntegrals(input: ValidationInput): ValidationIssue[] {
  const { peaks, structure } = input;
  const issues: ValidationIssue[] = [];
  
  // Toplam integral kontrolü
  const totalIntegral = peaks.reduce((sum, p) => sum + p.integral, 0);
  const expectedH = structure.totalH;
  
  if (Math.abs(totalIntegral - expectedH) > 1) {
    issues.push({
      code: VALIDATION_CODES.INTEGRAL_MISMATCH,
      severity: 'WARN',
      message: `Total integral ${totalIntegral.toFixed(1)} differs from expected ${expectedH} H`,
      evidence: { total: totalIntegral, expected: expectedH },
      confidencePenalty: 0.1,
      fixPatch: {
        kind: 'ROUND_INTEGRALS',
        payload: { targetSum: expectedH },
      },
    });
  }
  
  // Kesirli integral kontrolü
  for (const peak of peaks) {
    const frac = peak.integral - Math.round(peak.integral);
    if (Math.abs(frac) > 0.2 && Math.abs(frac) < 0.8) {
      issues.push({
        code: VALIDATION_CODES.FRACTIONAL_INTEGRAL,
        severity: 'FIX',
        message: `Peak at ${peak.centerPPM.toFixed(2)} ppm has fractional integral ${peak.integral.toFixed(2)}`,
        evidence: { ppm: peak.centerPPM, integral: peak.integral },
        confidencePenalty: 0.02,
        fixPatch: {
          kind: 'ROUND_INTEGRALS',
          payload: { peakPPM: peak.centerPPM },
        },
      });
    }
  }
  
  return issues;
}

// ============================================================================
// H COUNT VALIDATION
// ============================================================================

function validateHCount(input: ValidationInput): ValidationIssue[] {
  const { peaks, structure } = input;
  const issues: ValidationIssue[] = [];
  
  const peakCount = peaks.length;
  const expectedH = structure.totalH;
  
  // Peak sayısı H sayısından çok fazla olamaz
  if (peakCount > expectedH + 2) {
    issues.push({
      code: VALIDATION_CODES.H_COUNT_MISMATCH,
      severity: 'WARN',
      message: `${peakCount} peaks for ${expectedH} total H seems excessive`,
      evidence: { peaks: peakCount, expectedH },
      confidencePenalty: 0.1,
      suggestedAction: 'Check for impurities or incorrect equivalence grouping',
    });
  }
  
  return issues;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sumIntegralInWindow(
  peaks: NMRPeakSimulated[],
  ppmMin: number,
  ppmMax: number
): number {
  return peaks
    .filter(p => p.centerPPM >= ppmMin && p.centerPPM <= ppmMax)
    .reduce((sum, p) => sum + p.integral, 0);
}

// ============================================================================
// INTEGRAL RATIONING
// ============================================================================

/**
 * İntegralleri tamsayıya yuvarla (balanced)
 */
export function roundIntegralsBalanced(
  integrals: number[],
  targetSum: number
): number[] {
  const rounded = integrals.map(v => Math.round(v));
  let sum = rounded.reduce((a, b) => a + b, 0);
  
  const deltas = integrals.map((v, i) => ({
    i,
    frac: v - Math.floor(v),
  }));
  
  if (sum < targetSum) {
    // Yukarı yuvarlama gereken
    deltas.sort((a, b) => b.frac - a.frac);
    let k = targetSum - sum;
    for (let t = 0; t < deltas.length && k > 0; t++) {
      rounded[deltas[t].i] += 1;
      k--;
    }
  }
  
  if (sum > targetSum) {
    // Aşağı yuvarlama gereken
    deltas.sort((a, b) => a.frac - b.frac);
    let k = sum - targetSum;
    for (let t = 0; t < deltas.length && k > 0; t++) {
      rounded[deltas[t].i] -= 1;
      k--;
    }
  }
  
  return rounded;
}

/**
 * Validasyon patch'lerini uygula
 */
export function applyValidationPatches(
  peaks: NMRPeakSimulated[],
  patches: ValidationPatch[]
): NMRPeakSimulated[] {
  let result = [...peaks];
  
  for (const patch of patches) {
    switch (patch.kind) {
      case 'ROUND_INTEGRALS':
        const targetSum = (patch.payload as any).targetSum ?? 
          result.reduce((sum, p) => sum + Math.round(p.integral), 0);
        
        const currentIntegrals = result.map(p => p.integral);
        const roundedIntegrals = roundIntegralsBalanced(currentIntegrals, targetSum);
        
        result = result.map((p, i) => ({
          ...p,
          integral: roundedIntegrals[i],
        }));
        break;
      
      // Diğer patch türleri eklenebilir
    }
  }
  
  return result;
}
