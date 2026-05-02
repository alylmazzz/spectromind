/**
 * H-Bond Corrections Module - Katman 4B
 * 
 * OH/NH/COOH için H-bağı kaynaklı δ düzeltmesi
 * Bu katman 3D konformer bazlıdır.
 * 
 * H-bağı varsa: OH/NH downfield kayar + linewidth artar
 */

import { Coordinate3D, Solvent, SOLVENT_PRESETS } from '@/lib/types/nmr-simulation';
import { vectorSubtract, vectorLength, vectorNormalize, vectorDot } from './piAnisotropy';

// ============================================================================
// H-BOND CONSTANTS
// ============================================================================

/**
 * H-bağı geometrik kriterleri
 */
export const HBOND_CRITERIA = {
  maxDistanceHA: 2.5,        // H...A maksimum mesafe (Å)
  minAngleDHA: 135,          // D-H...A minimum açı (derece)
  optimalDistanceHA: 1.8,    // Optimal H...A mesafesi
  optimalAngleDHA: 180,      // Optimal açı (lineer)
};

/**
 * H-bağı δ etki katsayıları (ppm)
 * Güçlü H-bağı → daha fazla downfield kayma
 */
export const HBOND_SHIFT_EFFECTS: Record<string, { weak: number; medium: number; strong: number }> = {
  'OH': { weak: 0.5, medium: 1.5, strong: 3.0 },
  'NH': { weak: 0.3, medium: 1.0, strong: 2.0 },
  'NH2': { weak: 0.2, medium: 0.8, strong: 1.5 },
  'COOH': { weak: 0.5, medium: 1.5, strong: 2.5 },
};

/**
 * Solvent H-bağı etkisi çarpanları
 */
export const SOLVENT_HBOND_MULTIPLIERS: Record<string, number> = {
  'CDCl3': 0.8,       // Zayıf H-bağı kabul edici
  'DMSO-d6': 1.5,     // Güçlü H-bağı kabul edici
  'CD3OD': 1.2,       // Orta
  'D2O': 1.0,         // Exchange olur, görünmez
  'Acetone-d6': 1.1,
  'Benzene-d6': 0.7,  // Zayıf
  'CD2Cl2': 0.8,
};

// ============================================================================
// H-BOND DETECTION
// ============================================================================

export interface HBondDetectionInput {
  donorCoord: Coordinate3D;       // D (N veya O)
  hydrogenCoord: Coordinate3D;    // H
  acceptorCoord: Coordinate3D;    // A (O, N, F, Cl, etc.)
  acceptorElement: string;
}

export interface HBondInfo {
  exists: boolean;
  distanceHA: number;            // H...A mesafesi
  angleDHA: number;              // D-H...A açısı (derece)
  strength: 'none' | 'weak' | 'medium' | 'strong';
  strengthScore: number;         // 0-1 arası
}

/**
 * H-bağı varlığını ve gücünü tespit et
 */
export function detectHBond(input: HBondDetectionInput): HBondInfo {
  const { donorCoord, hydrogenCoord, acceptorCoord, acceptorElement } = input;
  
  // H...A mesafesi
  const vectorHA = vectorSubtract(acceptorCoord, hydrogenCoord);
  const distanceHA = vectorLength(vectorHA);
  
  // D-H vektörü
  const vectorDH = vectorSubtract(hydrogenCoord, donorCoord);
  
  // D-H...A açısı hesapla
  const dhNorm = vectorNormalize(vectorDH);
  const haNorm = vectorNormalize(vectorHA);
  const cosAngle = vectorDot(dhNorm, haNorm);
  const angleRad = Math.acos(Math.min(1, Math.max(-1, cosAngle)));
  const angleDHA = (angleRad * 180) / Math.PI;
  
  // H-bağı var mı kontrol et
  if (distanceHA > HBOND_CRITERIA.maxDistanceHA || angleDHA < HBOND_CRITERIA.minAngleDHA) {
    return {
      exists: false,
      distanceHA,
      angleDHA,
      strength: 'none',
      strengthScore: 0,
    };
  }
  
  // Güç hesapla
  // Mesafe faktörü: optimal 1.8 Å, 2.5 Å'da sıfır
  const distanceFactor = Math.max(0, 1 - (distanceHA - HBOND_CRITERIA.optimalDistanceHA) / 
    (HBOND_CRITERIA.maxDistanceHA - HBOND_CRITERIA.optimalDistanceHA));
  
  // Açı faktörü: 180°'de maksimum, 135°'de minimum
  const angleFactor = Math.max(0, (angleDHA - HBOND_CRITERIA.minAngleDHA) / 
    (HBOND_CRITERIA.optimalAngleDHA - HBOND_CRITERIA.minAngleDHA));
  
  // Akseptör elementi faktörü
  const acceptorFactors: Record<string, number> = {
    'O': 1.0,
    'N': 0.9,
    'F': 0.8,
    'Cl': 0.5,
    'S': 0.4,
  };
  const acceptorFactor = acceptorFactors[acceptorElement] ?? 0.5;
  
  // Toplam güç skoru
  const strengthScore = distanceFactor * angleFactor * acceptorFactor;
  
  // Güç sınıflandırma
  let strength: HBondInfo['strength'];
  if (strengthScore > 0.7) {
    strength = 'strong';
  } else if (strengthScore > 0.4) {
    strength = 'medium';
  } else if (strengthScore > 0.1) {
    strength = 'weak';
  } else {
    strength = 'none';
  }
  
  return {
    exists: strengthScore > 0.1,
    distanceHA,
    angleDHA,
    strength,
    strengthScore,
  };
}

// ============================================================================
// H-BOND SHIFT CORRECTION
// ============================================================================

export interface HBondShiftInput {
  protonType: 'OH' | 'NH' | 'NH2' | 'COOH';
  hbondInfo: HBondInfo;
  solvent: Solvent;
  isIntramolecular: boolean;
}

export interface HBondShiftResult {
  deltaCorrection: number;
  linewidthExtraHz: number;       // Ek genişlik
  isVisible: boolean;             // D2O'da görünür mü?
  confidence: number;
}

/**
 * H-bağı kaynaklı δ düzeltmesi hesapla
 */
export function calculateHBondShiftCorrection(
  input: HBondShiftInput
): HBondShiftResult {
  const { protonType, hbondInfo, solvent, isIntramolecular } = input;
  
  // D2O'da exchangeable protonlar görünmez
  if (SOLVENT_PRESETS[solvent].exchangeableRemoved) {
    return {
      deltaCorrection: 0,
      linewidthExtraHz: 0,
      isVisible: false,
      confidence: 1.0,
    };
  }
  
  // H-bağı yoksa minimal etki
  if (!hbondInfo.exists || hbondInfo.strength === 'none') {
    return {
      deltaCorrection: 0,
      linewidthExtraHz: 2,  // Temel genişlik
      isVisible: true,
      confidence: 0.8,
    };
  }
  
  // Temel δ düzeltmesi
  const effects = HBOND_SHIFT_EFFECTS[protonType] ?? HBOND_SHIFT_EFFECTS['OH'];
  let baseDeltaCorrection = effects[hbondInfo.strength];
  
  // Solvent çarpanı
  const solventMultiplier = SOLVENT_HBOND_MULTIPLIERS[solvent] ?? 1.0;
  baseDeltaCorrection *= solventMultiplier;
  
  // İntramoleküler H-bağı daha güçlü etki
  if (isIntramolecular) {
    baseDeltaCorrection *= 1.3;
  }
  
  // Güç skoruyla ölçekle
  const deltaCorrection = baseDeltaCorrection * hbondInfo.strengthScore;
  
  // Linewidth artışı
  // H-bağı varsa ve güçlüyse çizgi genişler
  const baseLinewidth = 2; // Hz
  let linewidthExtra: number;
  switch (hbondInfo.strength) {
    case 'strong':
      linewidthExtra = 8 + baseLinewidth;
      break;
    case 'medium':
      linewidthExtra = 5 + baseLinewidth;
      break;
    case 'weak':
      linewidthExtra = 3 + baseLinewidth;
      break;
    default:
      linewidthExtra = baseLinewidth;
  }
  
  // DMSO'da daha geniş
  if (SOLVENT_PRESETS[solvent].hbondStrength === 'strong') {
    linewidthExtra *= 1.3;
  }
  
  return {
    deltaCorrection,
    linewidthExtraHz: linewidthExtra,
    isVisible: true,
    confidence: Math.min(0.9, 0.5 + hbondInfo.strengthScore * 0.5),
  };
}

// ============================================================================
// MULTIPLE H-BONDS
// ============================================================================

/**
 * Bir proton için birden fazla potansiyel H-bağını değerlendir
 * En güçlü olanı veya birleşik etkiyi döndür
 */
export function evaluateMultipleHBonds(
  protonType: 'OH' | 'NH' | 'NH2' | 'COOH',
  hbonds: HBondInfo[],
  solvent: Solvent,
  hasIntramolecular: boolean
): HBondShiftResult {
  if (hbonds.length === 0) {
    return {
      deltaCorrection: 0,
      linewidthExtraHz: 2,
      isVisible: !SOLVENT_PRESETS[solvent].exchangeableRemoved,
      confidence: 0.8,
    };
  }
  
  // En güçlü H-bağını bul
  const strongest = hbonds.reduce((max, hb) => 
    hb.strengthScore > max.strengthScore ? hb : max, hbonds[0]);
  
  // Ana düzeltmeyi en güçlü H-bağından hesapla
  const mainResult = calculateHBondShiftCorrection({
    protonType,
    hbondInfo: strongest,
    solvent,
    isIntramolecular: hasIntramolecular,
  });
  
  // Ek H-bağları küçük katkı yapar
  let additionalCorrection = 0;
  let additionalLinewidth = 0;
  
  for (const hb of hbonds) {
    if (hb === strongest) continue;
    if (hb.exists && hb.strengthScore > 0.2) {
      additionalCorrection += 0.2 * hb.strengthScore;
      additionalLinewidth += 1 * hb.strengthScore;
    }
  }
  
  return {
    deltaCorrection: mainResult.deltaCorrection + additionalCorrection,
    linewidthExtraHz: mainResult.linewidthExtraHz + additionalLinewidth,
    isVisible: mainResult.isVisible,
    confidence: mainResult.confidence * 0.95,  // Çoklu H-bağı belirsizlik ekler
  };
}

// ============================================================================
// INTRAMOLECULAR H-BOND DETECTION
// ============================================================================

/**
 * İntramoleküler H-bağı olasılığını tespit et
 * (5-6 üyeli halka oluşturuyorsa daha olası)
 */
export function isLikelyIntramolecularHBond(
  donorIdx: number,
  acceptorIdx: number,
  bondPath: number[]  // Donor'dan acceptor'a bağ yolu
): boolean {
  // 5-6-7 üyeli halka oluşturuyorsa intramoleküler olası
  const pathLength = bondPath.length;
  return pathLength >= 3 && pathLength <= 6;
}
