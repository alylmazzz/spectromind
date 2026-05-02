/**
 * π-Anisotropy Module - Katman 4A
 * 
 * Aromatik ring current ve karbonil anizotropi etkisi
 * Bu katman 3D konformer bazlıdır.
 * 
 * Ring current / alken anizotropisi: resveratrol gibi konjuge sistemlerde kritik
 */

import { Coordinate3D, ConformerAtom } from '@/lib/types/nmr-simulation';
export type { Coordinate3D };

// ============================================================================
// ANISOTROPY CONSTANTS
// ============================================================================

/**
 * π-anizotropi katsayıları (ppm·Å³)
 * Ring current'ın şiddeti halka türüne göre değişir
 */
export const PI_ANISOTROPY_CONSTANTS: Record<string, number> = {
  'benzene': 12.0,
  'naphthalene': 14.0,
  'anthracene': 16.0,
  'pyridine': 10.0,
  'pyrrole': 8.0,
  'furan': 6.0,
  'thiophene': 7.0,
  'imidazole': 7.5,
  'pyrimidine': 9.0,
  'indole': 13.0,
  'quinoline': 13.0,
  'carbonyl': 4.0,  // C=O anizotropisi
  'alkene': 2.5,    // C=C anizotropisi
};

/**
 * Shielding cone geometrisi
 * θ = 0° (üstünde): shielded (upfield)
 * θ = 90° (yanında): deshielded (downfield)
 */
export interface AnisotropyZone {
  zone: 'shielded' | 'deshielded' | 'neutral';
  strength: number;  // 0-1 arası
}

// ============================================================================
// GEOMETRY HELPER FUNCTIONS
// ============================================================================

/**
 * 3D vektör işlemleri
 */
export function vectorSubtract(a: Coordinate3D, b: Coordinate3D): Coordinate3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vectorLength(v: Coordinate3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vectorNormalize(v: Coordinate3D): Coordinate3D {
  const len = vectorLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vectorDot(a: Coordinate3D, b: Coordinate3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vectorCross(a: Coordinate3D, b: Coordinate3D): Coordinate3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Halka merkezi hesapla
 */
export function calculateRingCenter(atomCoords: Coordinate3D[]): Coordinate3D {
  if (atomCoords.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  
  const sum = atomCoords.reduce(
    (acc, coord) => ({
      x: acc.x + coord.x,
      y: acc.y + coord.y,
      z: acc.z + coord.z,
    }),
    { x: 0, y: 0, z: 0 }
  );
  
  return {
    x: sum.x / atomCoords.length,
    y: sum.y / atomCoords.length,
    z: sum.z / atomCoords.length,
  };
}

/**
 * Halka normal vektörünü hesapla (düzlemine dik)
 * İlk 3 atomdan düzlem oluşturup normal bul
 */
export function calculateRingNormal(atomCoords: Coordinate3D[]): Coordinate3D {
  if (atomCoords.length < 3) {
    return { x: 0, y: 0, z: 1 }; // Default z-ekseni
  }
  
  // İlk 3 atomdan iki vektör oluştur
  const v1 = vectorSubtract(atomCoords[1], atomCoords[0]);
  const v2 = vectorSubtract(atomCoords[2], atomCoords[0]);
  
  // Cross product → normal
  const normal = vectorCross(v1, v2);
  return vectorNormalize(normal);
}

// ============================================================================
// RING CURRENT EFFECT
// ============================================================================

export interface RingCurrentInput {
  protonCoord: Coordinate3D;
  ringAtomCoords: Coordinate3D[];  // Halka atomlarının koordinatları
  ringType: string;                // benzene, pyridine, etc.
}

export interface RingCurrentResult {
  deltaCorrection: number;         // ppm düzeltmesi
  distance: number;                // proton-ring center mesafesi
  angleDeg: number;                // proton vektörü ile ring normal arası açı
  zone: AnisotropyZone;
}

/**
 * Ring current etkisini hesapla
 * 
 * Formül: Δδ_π = K_π × cos(θ) / r³
 * 
 * r: proton → ring center mesafesi
 * θ: ring normal ile proton vektörü arasındaki açı
 * K_π: halka türüne göre katsayı
 */
export function calculateRingCurrentEffect(
  input: RingCurrentInput
): RingCurrentResult {
  const { protonCoord, ringAtomCoords, ringType } = input;
  
  // Halka merkezi ve normal
  const ringCenter = calculateRingCenter(ringAtomCoords);
  const ringNormal = calculateRingNormal(ringAtomCoords);
  
  // Proton → ring center vektörü
  const protonVector = vectorSubtract(protonCoord, ringCenter);
  const distance = vectorLength(protonVector);
  
  // Mesafe çok yakın veya çok uzak ise efekt yok
  if (distance < 0.5 || distance > 8.0) {
    return {
      deltaCorrection: 0,
      distance,
      angleDeg: 0,
      zone: { zone: 'neutral', strength: 0 },
    };
  }
  
  // Açı hesapla (normal ile proton vektörü arası)
  const protonNorm = vectorNormalize(protonVector);
  const cosTheta = Math.abs(vectorDot(protonNorm, ringNormal));
  const angleRad = Math.acos(Math.min(1, Math.max(-1, cosTheta)));
  const angleDeg = (angleRad * 180) / Math.PI;
  
  // K_π katsayısı
  const K_pi = PI_ANISOTROPY_CONSTANTS[ringType] ?? 10.0;
  
  // Ring current düzeltmesi
  // Δδ = K × cos(θ) / r³
  // cosTheta > 0.7 (θ < 45°): shielded (üstte)
  // cosTheta < 0.3 (θ > 72°): deshielded (yanda)
  
  const rawCorrection = (K_pi * cosTheta) / Math.pow(distance, 3);
  
  // Zone belirleme ve işaret
  let zone: AnisotropyZone;
  let deltaCorrection: number;
  
  if (cosTheta > 0.7) {
    // Shielded zone (halka üstünde) → upfield (negatif δ)
    zone = { zone: 'shielded', strength: cosTheta };
    deltaCorrection = -rawCorrection;
  } else if (cosTheta < 0.3) {
    // Deshielded zone (halka yanında) → downfield (pozitif δ)
    zone = { zone: 'deshielded', strength: 1 - cosTheta };
    deltaCorrection = rawCorrection * 0.5; // Deshielding daha zayıf
  } else {
    // Geçiş bölgesi
    zone = { zone: 'neutral', strength: 0.5 };
    deltaCorrection = rawCorrection * (cosTheta - 0.5);
  }
  
  return {
    deltaCorrection,
    distance,
    angleDeg,
    zone,
  };
}

// ============================================================================
// CARBONYL ANISOTROPY
// ============================================================================

export interface CarbonylAnisotropyInput {
  protonCoord: Coordinate3D;
  carbonylCCoord: Coordinate3D;    // C=O'nun C atomu
  carbonylOCoord: Coordinate3D;    // C=O'nun O atomu
}

export interface CarbonylAnisotropyResult {
  deltaCorrection: number;
  distance: number;
  zone: AnisotropyZone;
}

/**
 * Karbonil anizotropi etkisini hesapla
 * 
 * C=O ekseni boyunca → deshielding
 * Yanlarda → shielding (zayıf)
 */
export function calculateCarbonylAnisotropy(
  input: CarbonylAnisotropyInput
): CarbonylAnisotropyResult {
  const { protonCoord, carbonylCCoord, carbonylOCoord } = input;
  
  // C=O merkezi
  const coCenter: Coordinate3D = {
    x: (carbonylCCoord.x + carbonylOCoord.x) / 2,
    y: (carbonylCCoord.y + carbonylOCoord.y) / 2,
    z: (carbonylCCoord.z + carbonylOCoord.z) / 2,
  };
  
  // C→O ekseni (karbonil yönü)
  const coAxis = vectorNormalize(vectorSubtract(carbonylOCoord, carbonylCCoord));
  
  // Proton → C=O merkezi vektörü
  const protonVector = vectorSubtract(protonCoord, coCenter);
  const distance = vectorLength(protonVector);
  
  // Mesafe kontrolü
  if (distance < 0.5 || distance > 6.0) {
    return {
      deltaCorrection: 0,
      distance,
      zone: { zone: 'neutral', strength: 0 },
    };
  }
  
  // Proton vektörünün C=O ekseniyle açısı
  const protonNorm = vectorNormalize(protonVector);
  const cosAngle = Math.abs(vectorDot(protonNorm, coAxis));
  
  // K katsayısı
  const K_co = PI_ANISOTROPY_CONSTANTS['carbonyl'];
  
  // Düzeltme hesapla
  // Eksen boyunca (cosAngle ~1): deshielding
  // Yanlarda (cosAngle ~0): shielding (zayıf)
  const rawCorrection = (K_co * (1 - cosAngle)) / Math.pow(distance, 2);
  
  let zone: AnisotropyZone;
  let deltaCorrection: number;
  
  if (cosAngle > 0.7) {
    // C=O ekseni boyunca → deshielding
    zone = { zone: 'deshielded', strength: cosAngle };
    deltaCorrection = rawCorrection;
  } else if (cosAngle < 0.3) {
    // Yanlarda → hafif shielding
    zone = { zone: 'shielded', strength: 1 - cosAngle };
    deltaCorrection = -rawCorrection * 0.3;
  } else {
    zone = { zone: 'neutral', strength: 0.5 };
    deltaCorrection = rawCorrection * (cosAngle - 0.5);
  }
  
  return {
    deltaCorrection,
    distance,
    zone,
  };
}

// ============================================================================
// COMBINED PI ANISOTROPY
// ============================================================================

export interface PiAnisotropyResult {
  totalCorrection: number;
  ringContributions: RingCurrentResult[];
  carbonylContributions: CarbonylAnisotropyResult[];
  dominantEffect: 'ring_shielding' | 'ring_deshielding' | 'carbonyl' | 'mixed' | 'none';
}

/**
 * Tüm π-anizotropi etkilerini birleştir
 */
export function calculateTotalPiAnisotropy(
  protonCoord: Coordinate3D,
  aromaticRings: Array<{ atomCoords: Coordinate3D[]; ringType: string }>,
  carbonyls: Array<{ cCoord: Coordinate3D; oCoord: Coordinate3D }>
): PiAnisotropyResult {
  const ringContributions: RingCurrentResult[] = [];
  const carbonylContributions: CarbonylAnisotropyResult[] = [];
  
  // Ring current etkileri
  for (const ring of aromaticRings) {
    const result = calculateRingCurrentEffect({
      protonCoord,
      ringAtomCoords: ring.atomCoords,
      ringType: ring.ringType,
    });
    ringContributions.push(result);
  }
  
  // Karbonil etkileri
  for (const co of carbonyls) {
    const result = calculateCarbonylAnisotropy({
      protonCoord,
      carbonylCCoord: co.cCoord,
      carbonylOCoord: co.oCoord,
    });
    carbonylContributions.push(result);
  }
  
  // Toplam düzeltme
  const ringTotal = ringContributions.reduce((sum, r) => sum + r.deltaCorrection, 0);
  const coTotal = carbonylContributions.reduce((sum, c) => sum + c.deltaCorrection, 0);
  const totalCorrection = ringTotal + coTotal;
  
  // Dominant etki belirleme
  let dominantEffect: PiAnisotropyResult['dominantEffect'];
  
  if (Math.abs(totalCorrection) < 0.05) {
    dominantEffect = 'none';
  } else if (Math.abs(ringTotal) > Math.abs(coTotal) * 2) {
    dominantEffect = ringTotal < 0 ? 'ring_shielding' : 'ring_deshielding';
  } else if (Math.abs(coTotal) > Math.abs(ringTotal) * 2) {
    dominantEffect = 'carbonyl';
  } else {
    dominantEffect = 'mixed';
  }
  
  return {
    totalCorrection,
    ringContributions,
    carbonylContributions,
    dominantEffect,
  };
}
