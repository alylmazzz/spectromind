/**
 * Karplus Engine - Dihedral'den J Hesaplama
 * 
 * 3J = A·cos²φ + B·cosφ + C
 * 
 * Parametreler bağ sınıfına göre seçilir
 */

import { BondClass } from '@/lib/types/nmr-simulation';
import { KARPLUS_PARAMETER_SETS, KarplusParams, SUBSTITUENT_J_CORRECTIONS, SubstituentCorrection } from './couplingTypes';

// ============================================================================
// BASIC KARPLUS CALCULATION
// ============================================================================

/**
 * Temel Karplus hesaplaması
 * @param dihedralDeg Dihedral açı (derece)
 * @param params Karplus parametreleri
 */
export function calculateBasicKarplus(
  dihedralDeg: number,
  params: KarplusParams
): number {
  // Derece → radyan
  const phi = (dihedralDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  
  // J = A·cos²φ + B·cosφ + C
  const J = params.A * cosPhi * cosPhi + params.B * cosPhi + params.C;
  
  return Math.max(0, J);  // Negatif J olmamalı (büyüklük olarak)
}

/**
 * Bağ sınıfına göre Karplus hesapla
 */
export function calculateKarplusForBondClass(
  dihedralDeg: number,
  bondClass: BondClass
): number {
  const params = KARPLUS_PARAMETER_SETS[bondClass];
  if (!params) {
    console.warn(`Unknown bond class: ${bondClass}, using sp3_sp3 defaults`);
    return calculateBasicKarplus(dihedralDeg, KARPLUS_PARAMETER_SETS['sp3_sp3']);
  }
  
  return calculateBasicKarplus(dihedralDeg, params);
}

// ============================================================================
// EXTENDED KARPLUS (HAASNOOT-ALTONA)
// ============================================================================

export interface ExtendedKarplusInput {
  dihedralDeg: number;
  bondClass: BondClass;
  substituentsOnC1: string[];   // C1 üzerindeki heteroatomlar
  substituentsOnC2: string[];   // C2 üzerindeki heteroatomlar
  betaSubstituents?: string[];  // β pozisyondaki heteroatomlar
}

/**
 * Genişletilmiş Karplus hesaplaması (substituent düzeltmeleriyle)
 */
export function calculateExtendedKarplus(
  input: ExtendedKarplusInput
): { J: number; baseJ: number; corrections: number } {
  // Temel Karplus değeri
  const baseJ = calculateKarplusForBondClass(input.dihedralDeg, input.bondClass);
  
  // Substituent düzeltmeleri
  let corrections = 0;
  
  // α-substituent etkileri (C1 üzerinde)
  for (const sub of input.substituentsOnC1) {
    const correction = SUBSTITUENT_J_CORRECTIONS.find(
      c => c.element === sub && c.position === 'alpha'
    );
    if (correction) {
      corrections += correction.correction;
    }
  }
  
  // α-substituent etkileri (C2 üzerinde)
  for (const sub of input.substituentsOnC2) {
    const correction = SUBSTITUENT_J_CORRECTIONS.find(
      c => c.element === sub && c.position === 'alpha'
    );
    if (correction) {
      corrections += correction.correction;
    }
  }
  
  // β-substituent etkileri
  if (input.betaSubstituents) {
    for (const sub of input.betaSubstituents) {
      const correction = SUBSTITUENT_J_CORRECTIONS.find(
        c => c.element === sub && c.position === 'beta'
      );
      if (correction) {
        corrections += correction.correction;
      }
    }
  }
  
  const J = Math.max(0, baseJ + corrections);
  
  return { J, baseJ, corrections };
}

// ============================================================================
// GAUCHE EFFECT
// ============================================================================

/**
 * Gauche konformasyonunda ek düzeltme
 * |φ| ~ 60° civarında özel davranış
 */
export function applyGaucheCorrection(
  J: number,
  dihedralDeg: number,
  hasElectronegativeSubstituent: boolean
): number {
  // Normalize açı (-180 to 180)
  let phi = dihedralDeg;
  while (phi > 180) phi -= 360;
  while (phi < -180) phi += 360;
  
  const absPhi = Math.abs(phi);
  
  // Gauche (60° civarı) veya anti (180° civarı)
  const isGauche = absPhi > 40 && absPhi < 80;
  const isAnti = absPhi > 160;
  
  if (isGauche && hasElectronegativeSubstituent) {
    // Gauche efekt: elektronegatif substituent varsa J azalabilir
    return J * 0.85;
  }
  
  if (isAnti) {
    // Anti konformasyon: tipik olarak maksimum J
    return J * 1.05;
  }
  
  return J;
}

// ============================================================================
// BOLTZMANN WEIGHTED J
// ============================================================================

export interface ConformerJData {
  conformerId: number;
  weight: number;
  dihedralDeg: number;
  J: number;
}

/**
 * Konformer ansambli için Boltzmann ağırlıklı ortalama J
 */
export function calculateBoltzmannWeightedJ(
  conformerData: ConformerJData[]
): { Javg: number; Jstd: number; conformerCount: number } {
  if (conformerData.length === 0) {
    return { Javg: 0, Jstd: 0, conformerCount: 0 };
  }
  
  if (conformerData.length === 1) {
    return { Javg: conformerData[0].J, Jstd: 0, conformerCount: 1 };
  }
  
  // Ağırlıkları normalize et
  const totalWeight = conformerData.reduce((sum, c) => sum + c.weight, 0);
  
  // Ağırlıklı ortalama
  let Javg = 0;
  for (const c of conformerData) {
    const normalizedWeight = c.weight / totalWeight;
    Javg += c.J * normalizedWeight;
  }
  
  // Ağırlıklı standart sapma
  let variance = 0;
  for (const c of conformerData) {
    const normalizedWeight = c.weight / totalWeight;
    const diff = c.J - Javg;
    variance += normalizedWeight * diff * diff;
  }
  const Jstd = Math.sqrt(variance);
  
  return {
    Javg,
    Jstd,
    conformerCount: conformerData.length,
  };
}

// ============================================================================
// DIHEDRAL ANGLE UTILITIES
// ============================================================================

/**
 * Dihedral açıyı normalize et (-180 to 180)
 */
export function normalizeDihedralAngle(angleDeg: number): number {
  let phi = angleDeg;
  while (phi > 180) phi -= 360;
  while (phi < -180) phi += 360;
  return phi;
}

/**
 * Dihedral açının hangi bölgede olduğunu belirle
 */
export function classifyDihedralRegion(
  angleDeg: number
): 'gauche_plus' | 'gauche_minus' | 'anti' | 'syn' | 'intermediate' {
  const phi = normalizeDihedralAngle(angleDeg);
  const absPhi = Math.abs(phi);
  
  if (absPhi < 30) return 'syn';
  if (absPhi > 150) return 'anti';
  if (phi > 30 && phi < 90) return 'gauche_plus';
  if (phi < -30 && phi > -90) return 'gauche_minus';
  return 'intermediate';
}

/**
 * Dihedral açıdan beklenen J aralığını tahmin et
 * (Karplus olmadan, hızlı tahmin için)
 */
export function estimateJRangeFromDihedral(
  angleDeg: number
): { min: number; max: number; typical: number } {
  const region = classifyDihedralRegion(angleDeg);
  
  switch (region) {
    case 'syn':      // φ ~ 0°
      return { min: 8, max: 12, typical: 10 };
    case 'anti':     // φ ~ 180°
      return { min: 9, max: 14, typical: 11 };
    case 'gauche_plus':
    case 'gauche_minus':  // φ ~ ±60°
      return { min: 2, max: 6, typical: 4 };
    case 'intermediate':
    default:
      return { min: 3, max: 9, typical: 6 };
  }
}
