/**
 * Bond Classifier - Bağ Sınıfı Belirleme
 * 
 * H-C1-C2-H yolu için uygun coupling sınıfını belirler
 */

import { BondClass } from '@/lib/types/nmr-simulation';
import { BondClassInput } from './couplingTypes';

// ============================================================================
// BOND CLASS DETERMINATION
// ============================================================================

/**
 * Bağ sınıfını belirle
 * Bu, hangi Karplus parametre setinin kullanılacağını belirler
 */
export function determineBondClass(input: BondClassInput): BondClass {
  const {
    atom1Hybridization,
    atom2Hybridization,
    isAromatic,
    bondType,
    hasHeteroNeighbor,
    isVinylic,
    vinylGeometry,
    aromaticPosition,
  } = input;
  
  // Aromatik sistem
  if (isAromatic && aromaticPosition) {
    switch (aromaticPosition) {
      case 'ortho': return 'aromatic_ortho';
      case 'meta': return 'aromatic_meta';
      case 'para': return 'aromatic_para';
    }
  }
  
  // Vinilik sistem
  if (isVinylic || (atom1Hybridization === 'sp2' && atom2Hybridization === 'sp2' && bondType === 'double')) {
    if (vinylGeometry === 'cis') return 'sp2_sp2_cis';
    if (vinylGeometry === 'trans') return 'sp2_sp2_trans';
    // Default trans (daha yaygın)
    return 'sp2_sp2_trans';
  }
  
  // Allylic/Benzylic (sp2-sp3)
  if ((atom1Hybridization === 'sp2' && atom2Hybridization === 'sp3') ||
      (atom1Hybridization === 'sp3' && atom2Hybridization === 'sp2')) {
    return 'sp2_sp3';
  }
  
  // Heteroatom komşuluğu
  if (hasHeteroNeighbor && atom1Hybridization === 'sp3' && atom2Hybridization === 'sp3') {
    return 'hetero_adjacent';
  }
  
  // Standart alifatik
  if (atom1Hybridization === 'sp3' && atom2Hybridization === 'sp3') {
    return 'sp3_sp3';
  }
  
  // Default
  return 'sp3_sp3';
}

// ============================================================================
// COUPLING PATH ANALYSIS
// ============================================================================

export interface AtomInfo {
  index: number;
  element: string;
  hybridization: 'sp' | 'sp2' | 'sp3';
  isAromatic: boolean;
  neighbors: number[];  // Komşu atom indeksleri
}

export interface BondInfo {
  atom1Idx: number;
  atom2Idx: number;
  order: number;        // 1, 1.5, 2, 3
  isAromatic: boolean;
}

/**
 * H-H coupling yolu için bağ sınıfını analiz et
 */
export function analyzeCouplingPath(
  pathAtomIndices: number[],  // [H1, C1, C2, H2] için [idx1, idx2, idx3, idx4]
  atoms: AtomInfo[],
  bonds: BondInfo[]
): {
  bondClass: BondClass;
  isAromatic: boolean;
  heteroNeighbors: string[];
  vinylGeometry?: 'cis' | 'trans' | 'gem';
  aromaticPosition?: 'ortho' | 'meta' | 'para';
} {
  if (pathAtomIndices.length < 4) {
    // 2J (geminal) - aynı karbon üzerinde
    return {
      bondClass: 'sp3_sp3',  // Geminal için özel işlem gerekir
      isAromatic: false,
      heteroNeighbors: [],
    };
  }
  
  // 3J için: H1-C1-C2-H2
  const c1Idx = pathAtomIndices[1];
  const c2Idx = pathAtomIndices[2];
  
  const c1 = atoms.find(a => a.index === c1Idx);
  const c2 = atoms.find(a => a.index === c2Idx);
  
  if (!c1 || !c2) {
    return {
      bondClass: 'sp3_sp3',
      isAromatic: false,
      heteroNeighbors: [],
    };
  }
  
  // Aromatik kontrol
  const isAromatic = c1.isAromatic && c2.isAromatic;
  
  // Heteroatom komşuları bul
  const heteroNeighbors: string[] = [];
  for (const neighborIdx of [...c1.neighbors, ...c2.neighbors]) {
    const neighbor = atoms.find(a => a.index === neighborIdx);
    if (neighbor && neighbor.element !== 'C' && neighbor.element !== 'H') {
      heteroNeighbors.push(neighbor.element);
    }
  }
  
  // C1-C2 bağını bul
  const c1c2Bond = bonds.find(
    b => (b.atom1Idx === c1Idx && b.atom2Idx === c2Idx) ||
         (b.atom1Idx === c2Idx && b.atom2Idx === c1Idx)
  );
  
  const bondOrder = c1c2Bond?.order ?? 1;
  const bondIsAromatic = c1c2Bond?.isAromatic ?? false;
  
  // Aromatik pozisyon (ortho/meta/para)
  let aromaticPosition: 'ortho' | 'meta' | 'para' | undefined;
  if (isAromatic) {
    const pathLength = pathAtomIndices.length - 1;  // Bağ sayısı
    if (pathLength === 3) aromaticPosition = 'ortho';
    else if (pathLength === 4) aromaticPosition = 'meta';
    else if (pathLength === 5) aromaticPosition = 'para';
  }
  
  // Bağ sınıfını belirle
  const bondClass = determineBondClass({
    atom1Hybridization: c1.hybridization,
    atom2Hybridization: c2.hybridization,
    isAromatic: bondIsAromatic,
    bondType: bondOrder === 2 ? 'double' : bondOrder === 1.5 ? 'aromatic' : 'single',
    hasHeteroNeighbor: heteroNeighbors.length > 0,
    isVinylic: bondOrder === 2 && !bondIsAromatic,
    aromaticPosition,
  });
  
  return {
    bondClass,
    isAromatic: bondIsAromatic || isAromatic,
    heteroNeighbors,
    aromaticPosition,
  };
}

// ============================================================================
// COUPLING PATH FINDER
// ============================================================================

/**
 * İki proton arasındaki en kısa coupling yolunu bul
 */
export function findCouplingPath(
  proton1Idx: number,
  proton2Idx: number,
  atoms: AtomInfo[],
  maxPathLength: number = 5
): number[] | null {
  // BFS ile en kısa yol
  const queue: Array<{ current: number; path: number[] }> = [
    { current: proton1Idx, path: [proton1Idx] }
  ];
  const visited = new Set<number>([proton1Idx]);
  
  while (queue.length > 0) {
    const { current, path } = queue.shift()!;
    
    if (current === proton2Idx) {
      return path;
    }
    
    if (path.length > maxPathLength) {
      continue;
    }
    
    const atom = atoms.find(a => a.index === current);
    if (!atom) continue;
    
    for (const neighborIdx of atom.neighbors) {
      if (!visited.has(neighborIdx)) {
        visited.add(neighborIdx);
        queue.push({
          current: neighborIdx,
          path: [...path, neighborIdx],
        });
      }
    }
  }
  
  return null;  // Yol bulunamadı
}

/**
 * Coupling tipini yol uzunluğundan belirle
 */
export function getCouplingTypeFromPathLength(
  pathLength: number
): '2J' | '3J' | '4J' | '5J' | null {
  // pathLength = bağ sayısı
  switch (pathLength) {
    case 2: return '2J';  // Geminal
    case 3: return '3J';  // Vicinal
    case 4: return '4J';  // Long-range
    case 5: return '5J';  // Very long-range
    default: return null;
  }
}

// ============================================================================
// DIASTEREOTOPIC DETECTION
// ============================================================================

/**
 * CH2 protonlarının diastereotopik olup olmadığını kontrol et
 * Prochiral merkez veya kiral komşuluk varsa diastereotopik
 */
export function isDiastereotopicCH2(
  carbonIdx: number,
  atoms: AtomInfo[],
  hasChiralNeighbor: boolean = false
): boolean {
  const carbon = atoms.find(a => a.index === carbonIdx);
  if (!carbon) return false;
  
  // Karbon üzerinde 2 H olmalı
  const hCount = carbon.neighbors.filter(
    nIdx => atoms.find(a => a.index === nIdx)?.element === 'H'
  ).length;
  
  if (hCount !== 2) return false;
  
  // Komşu kiral merkez varsa diastereotopik
  if (hasChiralNeighbor) return true;
  
  // Prochiral kontrol: karbon üzerindeki 2 substituent farklı mı?
  const nonHNeighbors = carbon.neighbors.filter(
    nIdx => atoms.find(a => a.index === nIdx)?.element !== 'H'
  );
  
  if (nonHNeighbors.length >= 2) {
    // Basit heuristik: iki substituent farklıysa prochiral olabilir
    // Gerçek implementasyonda substituent fingerprint karşılaştırması yapılmalı
    const sub1 = atoms.find(a => a.index === nonHNeighbors[0]);
    const sub2 = atoms.find(a => a.index === nonHNeighbors[1]);
    
    if (sub1 && sub2 && sub1.element !== sub2.element) {
      return true;  // Farklı elementler = diastereotopik
    }
    
    // Aynı element ama farklı ortam (daha detaylı analiz gerekir)
    // Bu basitleştirilmiş versiyon
  }
  
  return false;
}
