/**
 * J Coupling Type Definitions
 */

import { CouplingType, BondClass, JEdge } from '@/lib/types/nmr-simulation';

// ============================================================================
// COUPLING PATH TYPES
// ============================================================================

export interface CouplingPath {
  proton1Idx: number;
  proton2Idx: number;
  pathLength: number;           // Bağ sayısı
  pathAtomIndices: number[];    // Yol üzerindeki atom indeksleri
  couplingType: CouplingType;   // 2J, 3J, 4J, 5J
}

export interface DihedralInfo {
  atomIndices: [number, number, number, number];  // H1-C1-C2-H2
  angleDeg: number;
  conformerId: number;
}

// ============================================================================
// BOND CLASS DETERMINATION
// ============================================================================

export interface BondClassInput {
  atom1Hybridization: 'sp' | 'sp2' | 'sp3';
  atom2Hybridization: 'sp' | 'sp2' | 'sp3';
  isAromatic: boolean;
  bondType: 'single' | 'double' | 'triple' | 'aromatic';
  hasHeteroNeighbor: boolean;
  heteroNeighborElement?: string;
  
  // Vinilik için
  isVinylic?: boolean;
  vinylGeometry?: 'cis' | 'trans' | 'gem';
  
  // Aromatik için
  aromaticPosition?: 'ortho' | 'meta' | 'para';
}

// ============================================================================
// KARPLUS PARAMETER SETS
// ============================================================================

export interface KarplusParams {
  A: number;
  B: number;
  C: number;
  description: string;
  validRange?: [number, number];  // Geçerli J aralığı
}

/**
 * Bağ sınıfına göre Karplus parametreleri
 * 3J = A·cos²φ + B·cosφ + C
 */
export const KARPLUS_PARAMETER_SETS: Record<BondClass, KarplusParams> = {
  'sp3_sp3': {
    A: 7.0,
    B: -1.0,
    C: 5.0,
    description: 'Standard alkane H-C-C-H',
    validRange: [0, 14],
  },
  'sp2_sp3': {
    A: 6.0,
    B: -1.5,
    C: 4.5,
    description: 'Allylic/benzylic systems',
    validRange: [0, 12],
  },
  'sp2_sp2_cis': {
    A: 7.0,
    B: -1.0,
    C: 5.0,
    description: 'Vinyl cis (typically 6-12 Hz)',
    validRange: [6, 12],
  },
  'sp2_sp2_trans': {
    A: 10.0,
    B: -1.0,
    C: 6.0,
    description: 'Vinyl trans (typically 12-18 Hz)',
    validRange: [12, 18],
  },
  'aromatic_ortho': {
    A: 0, B: 0, C: 8.0,  // Topolojik, Karplus kullanılmaz
    description: 'Aromatic ortho coupling',
    validRange: [6, 10],
  },
  'aromatic_meta': {
    A: 0, B: 0, C: 2.0,
    description: 'Aromatic meta coupling',
    validRange: [1.5, 3],
  },
  'aromatic_para': {
    A: 0, B: 0, C: 0.5,
    description: 'Aromatic para coupling (usually not resolved)',
    validRange: [0, 1],
  },
  'hetero_adjacent': {
    A: 5.5,
    B: -1.0,
    C: 4.0,
    description: 'Adjacent to heteroatom (O, N)',
    validRange: [0, 12],
  },
};

// ============================================================================
// SUBSTITUENT CORRECTION FACTORS
// ============================================================================

/**
 * Haasnoot-Altona benzeri substituent düzeltmeleri
 */
export interface SubstituentCorrection {
  element: string;
  position: 'alpha' | 'beta';  // α = C1/C2 üzerinde, β = komşu
  correction: number;          // Hz düzeltme
}

export const SUBSTITUENT_J_CORRECTIONS: SubstituentCorrection[] = [
  // α-heteroatom etkileri (C1 veya C2 üzerinde)
  { element: 'O', position: 'alpha', correction: 0.8 },
  { element: 'N', position: 'alpha', correction: 0.5 },
  { element: 'F', position: 'alpha', correction: 1.2 },
  { element: 'Cl', position: 'alpha', correction: 0.6 },
  { element: 'Br', position: 'alpha', correction: 0.4 },
  
  // β-heteroatom etkileri
  { element: 'O', position: 'beta', correction: 0.3 },
  { element: 'N', position: 'beta', correction: 0.2 },
  { element: 'F', position: 'beta', correction: 0.4 },
];

// ============================================================================
// MOTIF-BASED J VALUES
// ============================================================================

/**
 * Özel motifler için sabit J değerleri
 * Bu motifler tespit edilirse doğrudan bu değerler kullanılır
 */
export interface JMotif {
  name: string;
  smarts?: string;
  description: string;
  jRange: [number, number];
  typicalJ: number;
  couplingType: CouplingType;
}

export const J_MOTIFS: JMotif[] = [
  // Vinilik
  {
    name: 'vinyl_trans',
    description: 'Trans vinyl coupling',
    jRange: [12, 18],
    typicalJ: 16,
    couplingType: '3J',
  },
  {
    name: 'vinyl_cis',
    description: 'Cis vinyl coupling',
    jRange: [6, 12],
    typicalJ: 10,
    couplingType: '3J',
  },
  {
    name: 'vinyl_gem',
    description: 'Geminal vinyl (=CH2)',
    jRange: [0, 3],
    typicalJ: 2,
    couplingType: '2J',
  },
  
  // Aromatik
  {
    name: 'aromatic_ortho',
    description: 'Aromatic ortho coupling',
    jRange: [6, 10],
    typicalJ: 8,
    couplingType: '3J',
  },
  {
    name: 'aromatic_meta',
    description: 'Aromatic meta coupling',
    jRange: [1.5, 3],
    typicalJ: 2.2,
    couplingType: '4J',
  },
  {
    name: 'aromatic_para',
    description: 'Aromatic para coupling (weak)',
    jRange: [0, 1],
    typicalJ: 0.5,
    couplingType: '5J',
  },
  
  // Uzak coupling
  {
    name: 'allylic_4j',
    description: 'Allylic long-range coupling',
    jRange: [0.5, 3],
    typicalJ: 1.5,
    couplingType: '4J',
  },
  {
    name: 'w_coupling',
    description: 'W-coupling (rigid systems)',
    jRange: [0.5, 2.5],
    typicalJ: 1.2,
    couplingType: '4J',
  },
  {
    name: 'homoallylic',
    description: 'Homoallylic coupling',
    jRange: [0, 2],
    typicalJ: 1.0,
    couplingType: '5J',
  },
  
  // Aldehit
  {
    name: 'aldehyde_alpha',
    description: 'Aldehyde to alpha-H coupling',
    jRange: [1, 3],
    typicalJ: 2.0,
    couplingType: '3J',
  },
];

// ============================================================================
// J EDGE BUILDER
// ============================================================================

export interface JEdgeBuilderInput {
  proton1Id: string;
  proton2Id: string;
  couplingPath: CouplingPath;
  bondClass: BondClass;
  dihedralAngle?: number;      // Derece
  substituents?: SubstituentCorrection[];
  motifMatch?: JMotif;
}

/**
 * J edge confidence hesaplama kriterleri
 */
export function calculateJConfidence(
  source: 'karplus' | 'library' | 'motif' | 'estimated',
  hasDihedral: boolean,
  bondClassCertain: boolean
): number {
  let confidence = 0.5;
  
  switch (source) {
    case 'karplus':
      confidence = hasDihedral ? 0.85 : 0.6;
      break;
    case 'library':
      confidence = 0.9;
      break;
    case 'motif':
      confidence = 0.95;
      break;
    case 'estimated':
      confidence = 0.4;
      break;
  }
  
  if (!bondClassCertain) {
    confidence *= 0.8;
  }
  
  return confidence;
}
