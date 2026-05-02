/**
 * Base Shift Module - Katman 1
 * 
 * Atom tipi + hibritleşme + aromatik duruma göre temel δ değeri.
 * Bu katman sadece 2D grafa bakar, konformer gerekmez.
 */

import { ProtonType, BaseShiftConstant } from '@/lib/types/nmr-simulation';

// ============================================================================
// BASE SHIFT CONSTANTS TABLE
// ============================================================================

export const BASE_SHIFT_TABLE: Record<ProtonType, BaseShiftConstant> = {
  // Alkyl protonları
  'alkyl_ch3': { protonType: 'alkyl_ch3', baseShift: 0.9, rangeMin: 0.7, rangeMax: 1.2 },
  'alkyl_ch2': { protonType: 'alkyl_ch2', baseShift: 1.3, rangeMin: 1.1, rangeMax: 1.6 },
  'alkyl_ch': { protonType: 'alkyl_ch', baseShift: 1.7, rangeMin: 1.4, rangeMax: 2.0 },
  
  // Allylic / Benzylic
  'allylic': { protonType: 'allylic', baseShift: 2.0, rangeMin: 1.7, rangeMax: 2.3 },
  'benzylic': { protonType: 'benzylic', baseShift: 2.5, rangeMin: 2.2, rangeMax: 3.0 },
  
  // Vinylic protonları
  'vinylic_cis': { protonType: 'vinylic_cis', baseShift: 5.1, rangeMin: 4.5, rangeMax: 5.8 },
  'vinylic_trans': { protonType: 'vinylic_trans', baseShift: 5.3, rangeMin: 4.5, rangeMax: 5.8 },
  'vinylic_gem': { protonType: 'vinylic_gem', baseShift: 5.0, rangeMin: 4.5, rangeMax: 5.5 },
  
  // Aromatik protonlar
  'aromatic': { protonType: 'aromatic', baseShift: 7.27, rangeMin: 6.5, rangeMax: 8.5 },
  
  // Aldehit
  'aldehyde': { protonType: 'aldehyde', baseShift: 9.7, rangeMin: 9.0, rangeMax: 10.5 },
  
  // O-attached protonlar
  'o_ch': { protonType: 'o_ch', baseShift: 3.7, rangeMin: 3.3, rangeMax: 4.5 },
  'o_ch2': { protonType: 'o_ch2', baseShift: 3.9, rangeMin: 3.5, rangeMax: 4.3 },
  'o_ch3': { protonType: 'o_ch3', baseShift: 3.5, rangeMin: 3.2, rangeMax: 4.0 },
  
  // N-attached protonlar
  'n_ch': { protonType: 'n_ch', baseShift: 2.8, rangeMin: 2.4, rangeMax: 3.5 },
  'n_ch2': { protonType: 'n_ch2', baseShift: 2.6, rangeMin: 2.2, rangeMax: 3.2 },
  'n_ch3': { protonType: 'n_ch3', baseShift: 2.3, rangeMin: 2.0, rangeMax: 2.8 },
  
  // Exchangeable protonlar - çok değişken, solvent ve H-bond'a bağlı
  'oh': { protonType: 'oh', baseShift: 3.0, rangeMin: 1.0, rangeMax: 6.0 },
  'nh': { protonType: 'nh', baseShift: 2.5, rangeMin: 1.0, rangeMax: 5.0 },
  'nh2': { protonType: 'nh2', baseShift: 2.0, rangeMin: 0.5, rangeMax: 4.5 },
  'cooh': { protonType: 'cooh', baseShift: 11.5, rangeMin: 10.0, rangeMax: 13.0 },
  
  // Diğer
  'other': { protonType: 'other', baseShift: 2.0, rangeMin: 0.0, rangeMax: 12.0 },
};

// ============================================================================
// PROTON TYPE CLASSIFICATION
// ============================================================================

export interface ProtonClassificationInput {
  atomIndex: number;
  heavyAtomSymbol: string;       // Bağlı olduğu ağır atom (C, N, O)
  heavyAtomHybridization: 'sp' | 'sp2' | 'sp3';
  isAromatic: boolean;
  neighborHeteroatoms: string[]; // Komşu heteroatomlar (O, N, S, halojen)
  isExchangeable: boolean;       // OH, NH, COOH
  connectedToDoubleBond: boolean;
  connectedToTripleBond: boolean;
  connectedToAromatic: boolean;
  totalHOnCarbon: number;        // CH3=3, CH2=2, CH=1
  functionalGroup?: string;      // Opsiyonel fonksiyonel grup bilgisi
}

/**
 * Proton tipini sınıflandır
 */
export function classifyProtonType(input: ProtonClassificationInput): ProtonType {
  const {
    heavyAtomSymbol,
    heavyAtomHybridization,
    isAromatic,
    neighborHeteroatoms,
    isExchangeable,
    connectedToDoubleBond,
    connectedToAromatic,
    totalHOnCarbon,
    functionalGroup,
  } = input;
  
  // Exchangeable protonlar (OH, NH, COOH)
  if (isExchangeable) {
    if (heavyAtomSymbol === 'O') {
      if (functionalGroup === 'carboxylic_acid') return 'cooh';
      return 'oh';
    }
    if (heavyAtomSymbol === 'N') {
      if (totalHOnCarbon >= 2) return 'nh2';
      return 'nh';
    }
  }
  
  // Aldehit protonu (CHO)
  if (heavyAtomSymbol === 'C' && 
      heavyAtomHybridization === 'sp2' && 
      neighborHeteroatoms.includes('O') &&
      functionalGroup === 'aldehyde') {
    return 'aldehyde';
  }
  
  // Aromatik protonlar
  if (isAromatic && heavyAtomSymbol === 'C') {
    return 'aromatic';
  }
  
  // Vinilik protonlar (C=C-H)
  if (heavyAtomSymbol === 'C' && heavyAtomHybridization === 'sp2' && connectedToDoubleBond) {
    // Geometriyi belirlemek için 3D gerekir, default olarak cis/trans/gem random
    // Gerçek implementasyonda stereo bilgisine bakılır
    return 'vinylic_cis'; // Placeholder, geometri analizi sonra yapılır
  }
  
  // Heteroatom-attached protonlar
  if (heavyAtomSymbol === 'O') {
    // O-CH, O-CH2, O-CH3 (eter/ester/alkol carbon'u değil, O'ya bağlı C)
    // Bu durumda proton O'ya değil C'ye bağlı ve C, O'ya bağlı
    return 'o_ch';
  }
  
  if (heavyAtomSymbol === 'N') {
    return 'n_ch';
  }
  
  // C üzerindeki proton ve O/N komşusu var
  if (heavyAtomSymbol === 'C' && heavyAtomHybridization === 'sp3') {
    const hasOxygenNeighbor = neighborHeteroatoms.includes('O');
    const hasNitrogenNeighbor = neighborHeteroatoms.includes('N');
    
    if (hasOxygenNeighbor) {
      if (totalHOnCarbon === 3) return 'o_ch3';
      if (totalHOnCarbon === 2) return 'o_ch2';
      return 'o_ch';
    }
    
    if (hasNitrogenNeighbor) {
      if (totalHOnCarbon === 3) return 'n_ch3';
      if (totalHOnCarbon === 2) return 'n_ch2';
      return 'n_ch';
    }
    
    // Benzylic (aromatik halkaya bağlı sp3 C)
    if (connectedToAromatic) {
      return 'benzylic';
    }
    
    // Allylic (C=C'ye komşu sp3 C)
    if (connectedToDoubleBond) {
      return 'allylic';
    }
    
    // Normal alkyl
    if (totalHOnCarbon === 3) return 'alkyl_ch3';
    if (totalHOnCarbon === 2) return 'alkyl_ch2';
    if (totalHOnCarbon === 1) return 'alkyl_ch';
  }
  
  return 'other';
}

/**
 * Base shift değerini al
 */
export function getBaseShift(protonType: ProtonType): number {
  return BASE_SHIFT_TABLE[protonType]?.baseShift ?? 2.0;
}

/**
 * Base shift aralığını al
 */
export function getBaseShiftRange(protonType: ProtonType): [number, number] {
  const entry = BASE_SHIFT_TABLE[protonType];
  if (!entry) return [0, 12];
  return [entry.rangeMin, entry.rangeMax];
}

/**
 * Verilen δ değeri bu proton tipi için makul mü?
 */
export function isShiftInRange(protonType: ProtonType, shift: number): boolean {
  const [min, max] = getBaseShiftRange(protonType);
  return shift >= min && shift <= max;
}
