/**
 * Topology Corrections Module - Katman 2
 * 
 * α/β/γ substituent etkileri (Shoolery modernize)
 * İndüktif (-I/+I) ve rezonans (+M/-M) ayrımı
 * 
 * Bu katman hâlâ 2D-topolojik; konformer gerekmez.
 */

import { TopologyCorrection } from '@/lib/types/nmr-simulation';

// ============================================================================
// SUBSTITUENT EFFECT CONSTANTS
// ============================================================================

/**
 * Substituent etki katsayıları
 * alpha: doğrudan bağlı atom
 * beta: 2 bağ ötede
 * gamma: 3 bağ ötede
 */
export const SUBSTITUENT_EFFECTS: Record<string, TopologyCorrection> = {
  // Halojenler (güçlü -I)
  '-F': { group: '-F', alpha: 3.10, beta: 0.60, gamma: 0.20, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-Cl': { group: '-Cl', alpha: 2.53, beta: 0.50, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-Br': { group: '-Br', alpha: 2.33, beta: 0.40, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-I': { group: '-I', alpha: 1.82, beta: 0.30, gamma: 0.10, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  
  // Oksijen grupları
  '-OH': { group: '-OH', alpha: 2.56, beta: 0.55, gamma: 0.18, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-OR': { group: '-OR', alpha: 2.36, beta: 0.50, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-OAc': { group: '-OAc', alpha: 3.13, beta: 0.45, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-OPh': { group: '-OPh', alpha: 2.94, beta: 0.55, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-O-': { group: '-O-', alpha: 1.80, beta: 0.40, gamma: 0.10, inductiveEffect: 'EDG', resonanceEffect: '+M' },
  
  // Azot grupları
  '-NH2': { group: '-NH2', alpha: 1.57, beta: 0.40, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-NHR': { group: '-NHR', alpha: 1.60, beta: 0.42, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-NR2': { group: '-NR2', alpha: 1.57, beta: 0.40, gamma: 0.10, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-NHAc': { group: '-NHAc', alpha: 2.20, beta: 0.50, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-NO2': { group: '-NO2', alpha: 3.36, beta: 0.65, gamma: 0.20, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-N+R3': { group: '-N+R3', alpha: 2.60, beta: 0.55, gamma: 0.18, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  
  // Kükürt grupları
  '-SH': { group: '-SH', alpha: 1.23, beta: 0.30, gamma: 0.08, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-SR': { group: '-SR', alpha: 1.25, beta: 0.32, gamma: 0.08, inductiveEffect: 'EWG', resonanceEffect: '+M' },
  '-SOR': { group: '-SOR', alpha: 1.80, beta: 0.45, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-SO2R': { group: '-SO2R', alpha: 2.10, beta: 0.55, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  
  // Karbonil ve ilgili gruplar
  '-CHO': { group: '-CHO', alpha: 1.10, beta: 0.80, gamma: 0.25, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-COR': { group: '-COR', alpha: 1.70, beta: 0.75, gamma: 0.22, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-COOH': { group: '-COOH', alpha: 1.10, beta: 0.70, gamma: 0.20, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-COOR': { group: '-COOR', alpha: 1.15, beta: 0.65, gamma: 0.18, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-CONR2': { group: '-CONR2', alpha: 1.10, beta: 0.60, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-COO-': { group: '-COO-', alpha: 0.80, beta: 0.35, gamma: 0.10, inductiveEffect: 'EDG', resonanceEffect: '+M' },
  
  // Siyanür ve üçlü bağ
  '-CN': { group: '-CN', alpha: 1.70, beta: 0.55, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-C#CH': { group: '-C#CH', alpha: 1.44, beta: 0.45, gamma: 0.12, inductiveEffect: 'neutral', resonanceEffect: 'none' },
  
  // Karbon grupları
  '-C=C': { group: '-C=C', alpha: 1.32, beta: 0.65, gamma: 0.20, inductiveEffect: 'neutral', resonanceEffect: 'none' },
  '-Ph': { group: '-Ph', alpha: 1.85, beta: 0.70, gamma: 0.25, inductiveEffect: 'neutral', resonanceEffect: 'none' },
  '-R': { group: '-R', alpha: 0.47, beta: 0.15, gamma: 0.05, inductiveEffect: 'EDG', resonanceEffect: 'none' },
  
  // Özel gruplar
  '-CF3': { group: '-CF3', alpha: 1.10, beta: 0.75, gamma: 0.30, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-N3': { group: '-N3', alpha: 1.75, beta: 0.50, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-NCO': { group: '-NCO', alpha: 1.80, beta: 0.50, gamma: 0.15, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-SCN': { group: '-SCN', alpha: 1.65, beta: 0.45, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: 'none' },
  '-ONO2': { group: '-ONO2', alpha: 3.40, beta: 0.70, gamma: 0.20, inductiveEffect: 'EWG', resonanceEffect: '-M' },
  '-SiR3': { group: '-SiR3', alpha: -0.10, beta: 0.05, gamma: 0.00, inductiveEffect: 'EDG', resonanceEffect: 'none' },
  '-PR2': { group: '-PR2', alpha: 0.80, beta: 0.25, gamma: 0.08, inductiveEffect: 'neutral', resonanceEffect: 'none' },
  '-POR2': { group: '-POR2', alpha: 1.20, beta: 0.40, gamma: 0.12, inductiveEffect: 'EWG', resonanceEffect: 'none' },
};

// ============================================================================
// TOPOLOGY ANALYSIS INTERFACE
// ============================================================================

export interface SubstituentAtPosition {
  group: string;               // Grup adı (SUBSTITUENT_EFFECTS key)
  position: 'alpha' | 'beta' | 'gamma';
  multiplicity: number;        // Aynı pozisyonda kaç tane (genelde 1)
}

export interface TopologyCorrectionResult {
  totalCorrection: number;
  breakdown: Array<{
    group: string;
    position: 'alpha' | 'beta' | 'gamma';
    contribution: number;
  }>;
  inductiveSum: number;
  resonanceSum: number;
}

// ============================================================================
// TOPOLOGY CORRECTION FUNCTIONS
// ============================================================================

/**
 * Tek bir substituent'ın pozisyona göre etkisini al
 */
export function getSubstituentEffect(
  group: string,
  position: 'alpha' | 'beta' | 'gamma'
): number {
  const effect = SUBSTITUENT_EFFECTS[group];
  if (!effect) return 0;
  
  switch (position) {
    case 'alpha': return effect.alpha;
    case 'beta': return effect.beta;
    case 'gamma': return effect.gamma;
    default: return 0;
  }
}

/**
 * Tüm substituent'ların toplam topolojik etkisini hesapla
 * 
 * Formül:
 * Δδ_topology = Σ(Δδ_s^α) + Σ(Δδ_s^β) + Σ(Δδ_s^γ)
 */
export function calculateTopologyCorrection(
  substituents: SubstituentAtPosition[]
): TopologyCorrectionResult {
  let totalCorrection = 0;
  let inductiveSum = 0;
  let resonanceSum = 0;
  const breakdown: TopologyCorrectionResult['breakdown'] = [];
  
  for (const sub of substituents) {
    const effect = SUBSTITUENT_EFFECTS[sub.group];
    if (!effect) continue;
    
    let contribution = 0;
    switch (sub.position) {
      case 'alpha':
        contribution = effect.alpha;
        break;
      case 'beta':
        contribution = effect.beta;
        break;
      case 'gamma':
        contribution = effect.gamma;
        break;
    }
    
    // Multiplicity'yi uygula
    contribution *= sub.multiplicity;
    
    // İndüktif ve rezonans katkılarını takip et
    if (effect.inductiveEffect === 'EWG') {
      inductiveSum += contribution * 0.6; // Rough estimate
    } else if (effect.inductiveEffect === 'EDG') {
      inductiveSum -= contribution * 0.3;
    }
    
    if (effect.resonanceEffect === '-M') {
      resonanceSum += contribution * 0.4;
    } else if (effect.resonanceEffect === '+M') {
      resonanceSum -= contribution * 0.2;
    }
    
    totalCorrection += contribution;
    breakdown.push({
      group: sub.group,
      position: sub.position,
      contribution,
    });
  }
  
  return {
    totalCorrection,
    breakdown,
    inductiveSum,
    resonanceSum,
  };
}

/**
 * Shoolery kuralı: X-CH₂-Y için δ hesapla
 * δ = 0.23 + σ_X + σ_Y
 */
export function calculateShooleryShift(
  substituentX: string,
  substituentY: string,
  baseValue: number = 0.23
): number {
  const sigmaX = SUBSTITUENT_EFFECTS[substituentX]?.alpha ?? 0;
  const sigmaY = SUBSTITUENT_EFFECTS[substituentY]?.alpha ?? 0;
  
  // Sterik düzeltme: iki güçlü substituent varsa
  let stericCorrection = 0;
  if (substituentX !== '-R' && substituentY !== '-R') {
    stericCorrection = -0.5; // Sterik sıkışma
  }
  
  return baseValue + sigmaX + sigmaY + stericCorrection;
}

// ============================================================================
// AROMATIC SUBSTITUENT EFFECTS (CURPHY-MORRISON)
// ============================================================================

/**
 * Curphy-Morrison sabitleri (aromatik protonlar için)
 * δ = 7.27 + Σ(S_ortho + S_meta + S_para)
 */
export const AROMATIC_SUBSTITUENT_EFFECTS: Record<string, {
  ortho: number;
  meta: number;
  para: number;
}> = {
  '-CH3': { ortho: -0.17, meta: -0.09, para: -0.18 },
  '-C2H5': { ortho: -0.15, meta: -0.06, para: -0.18 },
  '-iPr': { ortho: -0.14, meta: -0.05, para: -0.20 },
  '-tBu': { ortho: 0.02, meta: -0.08, para: -0.21 },
  '-CH=CH2': { ortho: 0.06, meta: -0.03, para: -0.10 },
  '-C#CH': { ortho: 0.15, meta: 0.00, para: -0.01 },
  '-Ph': { ortho: 0.18, meta: 0.00, para: -0.04 },
  
  // Halojenler
  '-F': { ortho: -0.30, meta: -0.02, para: -0.22 },
  '-Cl': { ortho: 0.02, meta: -0.06, para: -0.04 },
  '-Br': { ortho: 0.22, meta: -0.13, para: -0.03 },
  '-I': { ortho: 0.40, meta: -0.26, para: -0.03 },
  
  // Oksijen
  '-OH': { ortho: -0.50, meta: -0.14, para: -0.40 },
  '-OMe': { ortho: -0.43, meta: -0.09, para: -0.37 },
  '-OAc': { ortho: -0.21, meta: 0.02, para: -0.13 },
  
  // Azot
  '-NH2': { ortho: -0.75, meta: -0.24, para: -0.63 },
  '-NMe2': { ortho: -0.60, meta: -0.10, para: -0.62 },
  '-NHAc': { ortho: 0.12, meta: -0.07, para: -0.28 },
  '-NO2': { ortho: 0.95, meta: 0.17, para: 0.33 },
  
  // Karbonil
  '-CHO': { ortho: 0.58, meta: 0.21, para: 0.27 },
  '-COCH3': { ortho: 0.64, meta: 0.09, para: 0.30 },
  '-COOH': { ortho: 0.80, meta: 0.14, para: 0.20 },
  '-COOCH3': { ortho: 0.74, meta: 0.07, para: 0.20 },
  '-CN': { ortho: 0.27, meta: 0.11, para: 0.30 },
};

/**
 * Aromatik proton için substituent etkisini hesapla
 */
export function calculateAromaticShift(
  substituent: string,
  position: 'ortho' | 'meta' | 'para',
  baseValue: number = 7.27
): number {
  const effects = AROMATIC_SUBSTITUENT_EFFECTS[substituent];
  if (!effects) return baseValue;
  
  return baseValue + effects[position];
}

/**
 * Çoklu substituent'lı aromatik için toplam düzeltme
 */
export function calculateAromaticMultipleSubstituents(
  substituents: Array<{ group: string; position: 'ortho' | 'meta' | 'para' }>,
  baseValue: number = 7.27
): number {
  let shift = baseValue;
  
  for (const sub of substituents) {
    const effects = AROMATIC_SUBSTITUENT_EFFECTS[sub.group];
    if (!effects) continue;
    shift += effects[sub.position];
  }
  
  return shift;
}

// ============================================================================
// OLEFINIC SUBSTITUENT EFFECTS (TOBEY-SIMON)
// ============================================================================

/**
 * Tobey-Simon sabitleri (olefinik protonlar için)
 * δ = 5.25 + Z_gem + Z_cis + Z_trans
 */
export const OLEFINIC_SUBSTITUENT_EFFECTS: Record<string, {
  gem: number;
  cis: number;
  trans: number;
}> = {
  '-R': { gem: 0.45, cis: -0.22, trans: -0.28 },
  '-Ph': { gem: 1.38, cis: 0.36, trans: -0.07 },
  '-OMe': { gem: 1.22, cis: -1.07, trans: -1.21 },
  '-OAc': { gem: 2.11, cis: -0.35, trans: -0.64 },
  '-COOR': { gem: 0.80, cis: 1.18, trans: 0.55 },
  '-CHO': { gem: 1.02, cis: 0.95, trans: 1.17 },
  '-COR': { gem: 1.10, cis: 1.12, trans: 0.87 },
  '-Cl': { gem: 1.08, cis: 0.18, trans: 0.13 },
  '-Br': { gem: 1.07, cis: 0.45, trans: 0.55 },
  '-I': { gem: 1.14, cis: 0.81, trans: 0.88 },
  '-CN': { gem: 0.27, cis: 0.75, trans: 0.55 },
  '-NO2': { gem: 1.80, cis: 1.30, trans: 1.00 },
  '-NR2': { gem: 0.80, cis: -1.26, trans: -1.21 },
  '-SR': { gem: 1.11, cis: -0.06, trans: -0.25 },
  '-SO2R': { gem: 1.55, cis: 1.00, trans: 0.95 },
};

/**
 * Olefinik proton için δ hesapla
 */
export function calculateOlefinicShift(
  substituent1: string,
  substituent2: string,
  geometry: 'cis' | 'trans' | 'gem',
  baseValue: number = 5.25
): number {
  const effects1 = OLEFINIC_SUBSTITUENT_EFFECTS[substituent1];
  const effects2 = OLEFINIC_SUBSTITUENT_EFFECTS[substituent2];
  
  if (!effects1 || !effects2) return baseValue;
  
  let z1: number, z2: number;
  
  switch (geometry) {
    case 'gem':
      z1 = effects1.gem;
      z2 = effects2.gem;
      break;
    case 'cis':
      z1 = effects1.cis;
      z2 = effects2.cis;
      break;
    case 'trans':
      z1 = effects1.trans;
      z2 = effects2.trans;
      break;
  }
  
  return baseValue + z1 + z2;
}
