/**
 * Electronic Corrections Module - Katman 3
 * 
 * 2D → "yarı-elektronik" düzeltme
 * Gasteiger partial charge proxy kullanarak δ düzeltmesi
 * 
 * Gerçek elektron yoğunluğu yok → proxy kullanılır
 */

// ============================================================================
// ELECTRONIC CORRECTION TYPES
// ============================================================================

export interface ElectronicCorrectionInput {
  atomIndex: number;
  heavyAtomPartialCharge: number;  // Gasteiger partial charge
  protonPartialCharge?: number;     // H'nin kendi partial charge'ı (varsa)
  referenceCharge?: number;         // Referans değer (nötr karbon ~0)
}

export interface ElectronicCorrectionResult {
  correction: number;
  chargeEffect: 'deshielding' | 'shielding' | 'neutral';
  confidence: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Partial charge → δ dönüşüm katsayısı
 * Pozitif (elektron fakir) → deshielding → downfield
 * Negatif (elektron zengin) → shielding → upfield
 */
const CHARGE_COEFFICIENT = 1.5; // ppm per electron (yaklaşık)

/**
 * Referans partial charge değerleri (nötr ortam)
 */
const REFERENCE_CHARGES: Record<string, number> = {
  'C_sp3': 0.0,
  'C_sp2': 0.05,
  'C_sp': 0.1,
  'C_aromatic': 0.02,
  'N_sp3': -0.3,
  'N_sp2': -0.2,
  'O_sp3': -0.4,
  'O_sp2': -0.35,
};

// ============================================================================
// ELECTRONIC CORRECTION FUNCTIONS
// ============================================================================

/**
 * Gasteiger partial charge'dan δ düzeltmesi hesapla
 * 
 * Formül: Δδ_charge = k_q × (q_ref - q_atom)
 * 
 * - Elektron fakir karbon → downfield (pozitif düzeltme)
 * - Elektron zengin karbon → upfield (negatif düzeltme)
 */
export function calculateElectronicCorrection(
  input: ElectronicCorrectionInput
): ElectronicCorrectionResult {
  const {
    heavyAtomPartialCharge,
    referenceCharge = 0.0,
  } = input;
  
  // Partial charge farkı
  const chargeDelta = heavyAtomPartialCharge - referenceCharge;
  
  // Düzeltme hesapla
  // Pozitif charge → deshielding (downfield) → pozitif düzeltme
  const correction = chargeDelta * CHARGE_COEFFICIENT;
  
  // Etki yönünü belirle
  let chargeEffect: ElectronicCorrectionResult['chargeEffect'];
  if (Math.abs(correction) < 0.05) {
    chargeEffect = 'neutral';
  } else if (correction > 0) {
    chargeEffect = 'deshielding';
  } else {
    chargeEffect = 'shielding';
  }
  
  // Confidence: büyük değişimler daha az güvenilir
  const confidence = Math.max(0.5, 1 - Math.abs(correction) / 5);
  
  return {
    correction,
    chargeEffect,
    confidence,
  };
}

/**
 * Atom tipi ve hibritleşmeye göre referans charge al
 */
export function getReferenceCharge(
  element: string,
  hybridization: 'sp' | 'sp2' | 'sp3',
  isAromatic: boolean = false
): number {
  if (element === 'C') {
    if (isAromatic) return REFERENCE_CHARGES['C_aromatic'];
    return REFERENCE_CHARGES[`C_${hybridization}`] ?? 0;
  }
  if (element === 'N') {
    return REFERENCE_CHARGES[`N_${hybridization}`] ?? -0.25;
  }
  if (element === 'O') {
    return REFERENCE_CHARGES[`O_${hybridization}`] ?? -0.35;
  }
  return 0;
}

/**
 * Birden fazla heteroatom etkisini birleştir
 * Polifonksiyonel moleküllerde kullanılır
 */
export function combineElectronicEffects(
  effects: ElectronicCorrectionResult[]
): ElectronicCorrectionResult {
  if (effects.length === 0) {
    return { correction: 0, chargeEffect: 'neutral', confidence: 1.0 };
  }
  
  // Toplam düzeltme
  const totalCorrection = effects.reduce((sum, e) => sum + e.correction, 0);
  
  // Ortalama confidence
  const avgConfidence = effects.reduce((sum, e) => sum + e.confidence, 0) / effects.length;
  
  // Birleşik etki yönü
  let chargeEffect: ElectronicCorrectionResult['chargeEffect'];
  if (Math.abs(totalCorrection) < 0.05) {
    chargeEffect = 'neutral';
  } else if (totalCorrection > 0) {
    chargeEffect = 'deshielding';
  } else {
    chargeEffect = 'shielding';
  }
  
  // Çoklu etki birleşince confidence düşer
  const combinedConfidence = avgConfidence * Math.pow(0.9, effects.length - 1);
  
  return {
    correction: totalCorrection,
    chargeEffect,
    confidence: combinedConfidence,
  };
}

/**
 * Elektronegatiflik farkından yaklaşık partial charge tahmin et
 * (RDKit olmadığında fallback)
 */
export function estimatePartialChargeFromElectronegativity(
  element: string,
  neighbors: string[],
  hybridization: 'sp' | 'sp2' | 'sp3'
): number {
  // Pauling elektronegativiteleri
  const electronegativities: Record<string, number> = {
    'H': 2.20,
    'C': 2.55,
    'N': 3.04,
    'O': 3.44,
    'F': 3.98,
    'S': 2.58,
    'Cl': 3.16,
    'Br': 2.96,
    'I': 2.66,
    'P': 2.19,
    'Si': 1.90,
  };
  
  const centralEN = electronegativities[element] ?? 2.5;
  
  // Komşularla elektronegatiflik farkı
  let chargeDelta = 0;
  for (const neighbor of neighbors) {
    const neighborEN = electronegativities[neighbor] ?? 2.5;
    // Her komşu ile fark
    chargeDelta += (neighborEN - centralEN) * 0.1; // Scaled
  }
  
  // Hibritleşme etkisi: sp > sp2 > sp3 (s-karakteri arttıkça EN artar)
  const sCharacterBonus: Record<string, number> = {
    'sp3': 0,
    'sp2': 0.02,
    'sp': 0.05,
  };
  
  return chargeDelta + (sCharacterBonus[hybridization] ?? 0);
}
