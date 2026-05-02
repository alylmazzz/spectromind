/**
 * Through-Space Corrections Module - Katman 4C
 * 
 * Bağlı olmayan ama yakın (<4 Å) heteroatomların etkisi
 * Bu katman 3D konformer bazlıdır.
 */

import { Coordinate3D } from '@/lib/types/nmr-simulation';
import { vectorSubtract, vectorLength } from './piAnisotropy';

// ============================================================================
// THROUGH-SPACE CONSTANTS
// ============================================================================

/**
 * Through-space etki katsayıları
 * Elektronegatiflik ve boyuta göre etki
 */
export const THROUGH_SPACE_COEFFICIENTS: Record<string, {
  effectiveZ: number;      // Etkin elektron çekici güç
  cutoffDistance: number;  // Etki mesafesi (Å)
  shielding: boolean;      // true: upfield, false: downfield
}> = {
  'O': { effectiveZ: 3.5, cutoffDistance: 4.0, shielding: false },
  'N': { effectiveZ: 3.0, cutoffDistance: 4.0, shielding: false },
  'F': { effectiveZ: 4.0, cutoffDistance: 3.5, shielding: false },
  'Cl': { effectiveZ: 3.0, cutoffDistance: 4.5, shielding: false },
  'Br': { effectiveZ: 2.8, cutoffDistance: 5.0, shielding: false },
  'I': { effectiveZ: 2.5, cutoffDistance: 5.5, shielding: true },  // I "heavy atom" effect
  'S': { effectiveZ: 2.5, cutoffDistance: 4.5, shielding: false },
};

/**
 * Mesafe kategorileri
 */
export const DISTANCE_CATEGORIES = {
  veryClose: { max: 3.0, multiplier: 1.0 },   // Çok güçlü
  close: { max: 4.0, multiplier: 0.5 },       // Orta
  medium: { max: 5.0, multiplier: 0.2 },      // Zayıf
  far: { max: 6.0, multiplier: 0.05 },        // Çok zayıf
};

// ============================================================================
// THROUGH-SPACE CALCULATION
// ============================================================================

export interface ThroughSpaceInput {
  protonCoord: Coordinate3D;
  heteroatomCoord: Coordinate3D;
  heteroatomElement: string;
  isBonded: boolean;           // Bağlı mı? (bağlıysa through-space değil)
  bondDistance: number;        // Bağ mesafesi (kaç bağ uzaklıkta)
}

export interface ThroughSpaceResult {
  deltaCorrection: number;
  distance: number;
  category: 'very_close' | 'close' | 'medium' | 'far' | 'none';
  effect: 'deshielding' | 'shielding' | 'none';
  confidence: number;
}

/**
 * Tek bir heteroatom için through-space etkisini hesapla
 * 
 * Formül: Δδ_TS ∝ Z_eff / r²
 */
export function calculateThroughSpaceEffect(
  input: ThroughSpaceInput
): ThroughSpaceResult {
  const {
    protonCoord,
    heteroatomCoord,
    heteroatomElement,
    isBonded,
    bondDistance,
  } = input;
  
  // Bağlı atomlar veya çok yakın bağ mesafesindekiler through-space değil
  if (isBonded || bondDistance <= 2) {
    return {
      deltaCorrection: 0,
      distance: 0,
      category: 'none',
      effect: 'none',
      confidence: 1.0,
    };
  }
  
  // 3D mesafe hesapla
  const vector = vectorSubtract(heteroatomCoord, protonCoord);
  const distance = vectorLength(vector);
  
  // Heteroatom katsayıları
  const coeffs = THROUGH_SPACE_COEFFICIENTS[heteroatomElement];
  if (!coeffs) {
    return {
      deltaCorrection: 0,
      distance,
      category: 'none',
      effect: 'none',
      confidence: 0.5,
    };
  }
  
  // Mesafe kontrolü
  if (distance > coeffs.cutoffDistance) {
    return {
      deltaCorrection: 0,
      distance,
      category: 'none',
      effect: 'none',
      confidence: 0.8,
    };
  }
  
  // Mesafe kategorisi
  let category: ThroughSpaceResult['category'];
  let multiplier: number;
  
  if (distance < DISTANCE_CATEGORIES.veryClose.max) {
    category = 'very_close';
    multiplier = DISTANCE_CATEGORIES.veryClose.multiplier;
  } else if (distance < DISTANCE_CATEGORIES.close.max) {
    category = 'close';
    multiplier = DISTANCE_CATEGORIES.close.multiplier;
  } else if (distance < DISTANCE_CATEGORIES.medium.max) {
    category = 'medium';
    multiplier = DISTANCE_CATEGORIES.medium.multiplier;
  } else {
    category = 'far';
    multiplier = DISTANCE_CATEGORIES.far.multiplier;
  }
  
  // Düzeltme hesapla: Z_eff / r²
  const rawCorrection = (coeffs.effectiveZ * multiplier) / Math.pow(distance, 2);
  
  // Shielding vs deshielding
  const effect: ThroughSpaceResult['effect'] = coeffs.shielding ? 'shielding' : 'deshielding';
  const deltaCorrection = coeffs.shielding ? -rawCorrection : rawCorrection;
  
  // Confidence: mesafe arttıkça düşer
  const confidence = Math.max(0.5, 1 - distance / coeffs.cutoffDistance);
  
  return {
    deltaCorrection,
    distance,
    category,
    effect,
    confidence,
  };
}

// ============================================================================
// MULTIPLE THROUGH-SPACE EFFECTS
// ============================================================================

export interface ThroughSpaceSummary {
  totalCorrection: number;
  contributions: ThroughSpaceResult[];
  dominantAtom: string | null;
  confidence: number;
}

/**
 * Birden fazla yakın heteroatom için toplam through-space etkisi
 */
export function calculateTotalThroughSpaceEffect(
  protonCoord: Coordinate3D,
  nearbyAtoms: Array<{
    coord: Coordinate3D;
    element: string;
    isBonded: boolean;
    bondDistance: number;
  }>
): ThroughSpaceSummary {
  const contributions: ThroughSpaceResult[] = [];
  let dominantAtom: string | null = null;
  let maxCorrection = 0;
  
  for (const atom of nearbyAtoms) {
    const result = calculateThroughSpaceEffect({
      protonCoord,
      heteroatomCoord: atom.coord,
      heteroatomElement: atom.element,
      isBonded: atom.isBonded,
      bondDistance: atom.bondDistance,
    });
    
    if (Math.abs(result.deltaCorrection) > 0.01) {
      contributions.push(result);
      
      if (Math.abs(result.deltaCorrection) > Math.abs(maxCorrection)) {
        maxCorrection = result.deltaCorrection;
        dominantAtom = atom.element;
      }
    }
  }
  
  // Toplam düzeltme
  const totalCorrection = contributions.reduce((sum, c) => sum + c.deltaCorrection, 0);
  
  // Ortalama confidence
  const avgConfidence = contributions.length > 0
    ? contributions.reduce((sum, c) => sum + c.confidence, 0) / contributions.length
    : 1.0;
  
  return {
    totalCorrection,
    contributions,
    dominantAtom,
    confidence: avgConfidence,
  };
}

// ============================================================================
// STERIC COMPRESSION EFFECT
// ============================================================================

/**
 * Sterik sıkışma etkisi
 * Çok yakın atomlar varsa ek deshielding
 */
export function calculateStericCompressionEffect(
  protonCoord: Coordinate3D,
  nearbyHeavyAtoms: Array<{ coord: Coordinate3D; element: string }>
): number {
  let compressionEffect = 0;
  
  for (const atom of nearbyHeavyAtoms) {
    const distance = vectorLength(vectorSubtract(atom.coord, protonCoord));
    
    // Van der Waals yarıçapı içindeyse sterik sıkışma
    const vdwRadius = getVanDerWaalsRadius(atom.element);
    const hRadius = 1.20; // H van der Waals
    const sumRadii = vdwRadius + hRadius;
    
    if (distance < sumRadii) {
      // Sıkışma oranına göre deshielding
      const overlap = sumRadii - distance;
      compressionEffect += overlap * 0.3; // ppm / Å overlap
    }
  }
  
  return compressionEffect;
}

/**
 * Van der Waals yarıçapları (Å)
 */
function getVanDerWaalsRadius(element: string): number {
  const radii: Record<string, number> = {
    'H': 1.20,
    'C': 1.70,
    'N': 1.55,
    'O': 1.52,
    'F': 1.47,
    'S': 1.80,
    'Cl': 1.75,
    'Br': 1.85,
    'I': 1.98,
    'P': 1.80,
    'Si': 2.10,
  };
  return radii[element] ?? 1.70;
}
