/**
 * J Coupling Library
 * 
 * Bağ tipi ve motiflere göre J değerleri kütüphanesi
 * Karplus hesaplanamadığında veya topolojik J'ler için kullanılır
 */

import { JCouplingLibrary, CouplingType, BondClass, JEdge } from '@/lib/types/nmr-simulation';

// ============================================================================
// STANDARD J COUPLING LIBRARY
// ============================================================================

export const J_COUPLING_LIBRARY: JCouplingLibrary = {
  // Aromatik J değerleri
  aromatic_ortho: { min: 6.0, max: 10.0, typical: 8.0 },
  aromatic_meta: { min: 1.5, max: 3.0, typical: 2.2 },
  aromatic_para: { min: 0.0, max: 1.0, typical: 0.5 },
  
  // Vinilik J değerleri
  vinyl_trans: { min: 12.0, max: 18.0, typical: 16.0 },
  vinyl_cis: { min: 6.0, max: 12.0, typical: 10.0 },
  vinyl_gem: { min: 0.0, max: 3.0, typical: 2.0 },
  
  // Geminal J değerleri
  geminal_ch2: { min: -16.0, max: -10.0, typical: -12.5 },
  geminal_benzylic: { min: -18.0, max: -12.0, typical: -14.5 },
  
  // Long-range J değerleri
  allylic_4j: { min: 0.5, max: 3.0, typical: 1.5 },
  w_coupling: { min: 0.5, max: 2.5, typical: 1.2 },
};

// ============================================================================
// DETAILED J TABLES
// ============================================================================

/**
 * Alifatik 3J değerleri (sp3-sp3)
 * Substituent ve konformasyona bağlı
 */
export const ALIPHATIC_3J_TABLE: Record<string, { gauche: number; anti: number }> = {
  'H-C-C-H': { gauche: 3.5, anti: 11.0 },
  'H-C-C-O': { gauche: 4.0, anti: 10.0 },
  'H-C-C-N': { gauche: 3.5, anti: 10.5 },
  'H-C-C-Cl': { gauche: 4.0, anti: 10.5 },
  'H-C-O-C': { gauche: 5.0, anti: 8.0 },  // Eter
};

/**
 * Geminal (2J) değerleri
 */
export const GEMINAL_2J_TABLE: Record<string, number> = {
  // CH2 tipleri (işaretli, ama büyüklük olarak kullanılır)
  'CH2_alkyl': -12.5,
  'CH2_aldehyde': -2.5,      // R-CO-CH2
  'CH2_ketone': -14.5,
  'CH2_ether': -10.5,        // R-O-CH2
  'CH2_amine': -12.0,
  'CH2_cyclopropane': -4.5,  // Küçük halka etkisi
  'CH2_cyclobutane': -10.5,
  'CH2_cyclopentane': -12.0,
  'CH2_cyclohexane': -12.5,
  
  // Özel durumlar
  'CH2_benzylic': -14.5,
  'CH2_allylic': -13.5,
  'CH2_alpha_carbonyl': -16.5,
};

/**
 * Aromatik J değerleri - substitüsyon deseni etkisi
 */
export const AROMATIC_J_DETAILED: Record<string, Record<string, number>> = {
  // Benzene (unsubstituted)
  'benzene': {
    'ortho': 8.0,
    'meta': 2.2,
    'para': 0.5,
  },
  
  // Electron-donating groups (EDG)
  'phenol': {
    'ortho': 7.8,
    'meta': 2.0,
    'para': 0.4,
  },
  'aniline': {
    'ortho': 7.5,
    'meta': 2.0,
    'para': 0.4,
  },
  
  // Electron-withdrawing groups (EWG)
  'nitrobenzene': {
    'ortho': 8.5,
    'meta': 2.3,
    'para': 0.6,
  },
  'benzaldehyde': {
    'ortho': 8.3,
    'meta': 2.2,
    'para': 0.5,
  },
  
  // Heterocycles
  'pyridine': {
    'ortho': 5.0,
    'meta': 1.5,
    'para': 0.8,
  },
  'furan': {
    '2-3': 1.8,
    '3-4': 3.4,
    '2-4': 0.8,
  },
  'pyrrole': {
    '2-3': 2.5,
    '3-4': 3.5,
    '2-4': 1.4,
  },
  'thiophene': {
    '2-3': 5.0,
    '3-4': 3.5,
    '2-4': 1.0,
  },
};

/**
 * Vinilik J değerleri - substitüent etkisi
 */
export const VINYL_J_DETAILED: Record<string, { cis: number; trans: number; gem: number }> = {
  'ethylene': { cis: 11.5, trans: 19.0, gem: 2.5 },
  'styrene': { cis: 11.0, trans: 17.5, gem: 1.0 },
  'acrylate': { cis: 10.5, trans: 15.5, gem: 1.5 },
  'vinyl_ether': { cis: 6.5, trans: 14.0, gem: 2.0 },
  'enol_ether': { cis: 7.0, trans: 12.5, gem: 1.0 },
};

// ============================================================================
// J LOOKUP FUNCTIONS
// ============================================================================

/**
 * Aromatik pozisyona göre J değeri
 */
export function getAromaticJ(
  position: 'ortho' | 'meta' | 'para',
  substituentType?: string
): number {
  const table = substituentType && AROMATIC_J_DETAILED[substituentType]
    ? AROMATIC_J_DETAILED[substituentType]
    : AROMATIC_J_DETAILED['benzene'];
  
  return table[position] ?? J_COUPLING_LIBRARY[`aromatic_${position}`].typical;
}

/**
 * Vinilik geometriye göre J değeri
 */
export function getVinylJ(
  geometry: 'cis' | 'trans' | 'gem',
  substituentType?: string
): number {
  const table = substituentType && VINYL_J_DETAILED[substituentType]
    ? VINYL_J_DETAILED[substituentType]
    : VINYL_J_DETAILED['ethylene'];
  
  return table[geometry];
}

/**
 * Geminal J değeri
 */
export function getGeminalJ(
  ch2Type: string
): number {
  return Math.abs(GEMINAL_2J_TABLE[ch2Type] ?? GEMINAL_2J_TABLE['CH2_alkyl']);
}

/**
 * Long-range J değeri
 */
export function getLongRangeJ(
  type: 'allylic' | 'w_coupling' | 'homoallylic'
): number {
  switch (type) {
    case 'allylic':
      return J_COUPLING_LIBRARY.allylic_4j.typical;
    case 'w_coupling':
      return J_COUPLING_LIBRARY.w_coupling.typical;
    case 'homoallylic':
      return 0.8;
    default:
      return 0;
  }
}

// ============================================================================
// J RANGE VALIDATION
// ============================================================================

/**
 * Hesaplanan J değerinin makul aralıkta olup olmadığını kontrol et
 */
export function isJValueReasonable(
  J: number,
  couplingType: CouplingType,
  bondClass: BondClass
): { isValid: boolean; warning?: string } {
  // Coupling tipine göre genel sınırlar
  const generalLimits: Record<CouplingType, [number, number]> = {
    '2J': [0, 20],
    '3J': [0, 18],
    '4J': [0, 4],
    '5J': [0, 2],
  };
  
  const [min, max] = generalLimits[couplingType] ?? [0, 20];
  
  if (J < min || J > max) {
    return {
      isValid: false,
      warning: `J value ${J.toFixed(1)} Hz is outside expected range for ${couplingType}`,
    };
  }
  
  // Spesifik bağ sınıfı kontrolleri
  if (bondClass === 'sp2_sp2_trans' && J < 12) {
    return {
      isValid: true,  // Geçerli ama uyarı
      warning: `Trans vinyl J=${J.toFixed(1)} Hz is unusually low (expected 12-18 Hz)`,
    };
  }
  
  if (bondClass === 'sp2_sp2_cis' && J > 12) {
    return {
      isValid: true,
      warning: `Cis vinyl J=${J.toFixed(1)} Hz is unusually high (expected 6-12 Hz)`,
    };
  }
  
  return { isValid: true };
}

// ============================================================================
// SPECIAL COUPLING PATTERNS
// ============================================================================

/**
 * AA'BB' spin sistemi için coupling pattern
 * (para-disubstituted benzene gibi)
 */
export interface AABBCoupling {
  Jaa: number;   // J(A-A') - genelde çok küçük
  Jbb: number;   // J(B-B') - genelde çok küçük
  Jab: number;   // J(A-B) ortho
  Jabp: number;  // J(A-B') meta
}

export function getAABBCoupling(substituentType?: string): AABBCoupling {
  // Para-disubstituted benzene için tipik değerler
  const base = AROMATIC_J_DETAILED[substituentType ?? 'benzene'];
  
  return {
    Jaa: 0.5,
    Jbb: 0.5,
    Jab: base?.ortho ?? 8.0,
    Jabp: base?.meta ?? 2.2,
  };
}

/**
 * ABX spin sistemi için coupling set
 */
export interface ABXCoupling {
  Jab: number;   // A-B coupling (geminal)
  Jax: number;   // A-X coupling (vicinal)
  Jbx: number;   // B-X coupling (vicinal)
}

export function getABXCoupling(
  ch2Type: string,
  dihedralAX?: number,
  dihedralBX?: number
): ABXCoupling {
  // Geminal
  const Jab = getGeminalJ(ch2Type);
  
  // Vicinal - dihedral'den tahmin veya default
  let Jax = 7.0;
  let Jbx = 7.0;
  
  if (dihedralAX !== undefined) {
    // Karplus'tan hesapla (basit)
    const phiA = (dihedralAX * Math.PI) / 180;
    Jax = 7 - Math.cos(phiA) + 5 * Math.cos(phiA) * Math.cos(phiA);
  }
  
  if (dihedralBX !== undefined) {
    const phiB = (dihedralBX * Math.PI) / 180;
    Jbx = 7 - Math.cos(phiB) + 5 * Math.cos(phiB) * Math.cos(phiB);
  }
  
  return { Jab, Jax, Jbx };
}
