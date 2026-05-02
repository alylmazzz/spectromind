/**
 * Spin System Type Definitions
 */

import { SpinSystemType, SpinLine, JEdge } from '@/lib/types/nmr-simulation';

// ============================================================================
// SPIN SYSTEM INPUT
// ============================================================================

export interface SpinInput {
  id: string;
  protonId: string;
  shiftHz: number;         // Hz cinsinden kayma (δ × fieldMHz)
  shiftPPM: number;        // ppm cinsinden
  integral: number;        // Eşdeğer proton sayısı
}

export interface SpinSystemInput {
  spins: SpinInput[];
  jEdges: JEdge[];         // Coupling'ler
  fieldMHz: number;        // Manyetik alan (örn. 400 MHz)
}

// ============================================================================
// R-VALUE CALCULATION
// ============================================================================

/**
 * Second-order davranış kriteri: R = |Δν| / J
 * R < 10 → second-order belirtileri başlar
 * R < 3 → belirgin second-order
 * R < 1 → güçlü coupling
 */
export interface RValueResult {
  spin1Id: string;
  spin2Id: string;
  deltaHz: number;        // Frekans farkı
  jHz: number;            // Coupling sabiti
  R: number;              // |Δν| / J
  regime: 'first_order' | 'borderline' | 'second_order' | 'strong_coupling';
}

export function calculateRValue(
  shift1Hz: number,
  shift2Hz: number,
  jHz: number
): RValueResult['regime'] {
  if (jHz === 0) return 'first_order';
  
  const R = Math.abs(shift1Hz - shift2Hz) / Math.abs(jHz);
  
  if (R >= 10) return 'first_order';
  if (R >= 3) return 'borderline';
  if (R >= 1) return 'second_order';
  return 'strong_coupling';
}

// ============================================================================
// SPIN SYSTEM CLASSIFICATION RESULTS
// ============================================================================

export interface SpinSystemClassification {
  type: SpinSystemType;
  spinIds: string[];
  rValues: RValueResult[];
  solver: 'quick' | 'hamiltonian' | 'hybrid';
  description: string;
  warnings: string[];
}

// ============================================================================
// MULTIPLET PATTERNS
// ============================================================================

export const MULTIPLET_NAMES: Record<number, string> = {
  1: 's',       // singlet
  2: 'd',       // doublet
  3: 't',       // triplet
  4: 'q',       // quartet
  5: 'quin',    // quintet
  6: 'sex',     // sextet
  7: 'sep',     // septet
  8: 'oct',     // octet
  9: 'non',     // nonet
};

export function getMultipletName(n: number): string {
  if (n === 1) return 's';
  if (MULTIPLET_NAMES[n]) return MULTIPLET_NAMES[n];
  return 'm';  // multiplet for complex patterns
}

/**
 * Pascal üçgeni katsayıları (n+1 kuralı için)
 */
export function getPascalCoefficients(n: number): number[] {
  const coeffs: number[] = [1];
  for (let i = 1; i <= n; i++) {
    coeffs.push(coeffs[i - 1] * (n - i + 1) / i);
  }
  return coeffs;
}

// ============================================================================
// AB SYSTEM CONSTANTS
// ============================================================================

/**
 * AB sistemi için çizgi yoğunluk formülleri
 */
export interface ABSystemResult {
  lines: SpinLine[];
  nuPlus: number;    // (νA + νB) / 2
  nuMinus: number;   // (νA - νB) / 2
  D: number;         // √[(Δν)² + J²]
  cos2theta: number; // Karışım açısı
}

// ============================================================================
// SPIN HAMILTONIAN TYPES
// ============================================================================

export interface HamiltonianInput {
  spins: SpinInput[];
  jMatrix: number[][];    // N × N coupling matrisi
  fieldMHz: number;
}

export interface EigenState {
  index: number;
  energy: number;         // Energy eigenvalue
  vector: number[];       // Eigenvector
  mQuantum: number;       // Total m quantum number
}

export interface Transition {
  fromState: number;
  toState: number;
  frequencyHz: number;
  intensity: number;
  label?: string;
}
