/**
 * J Calculator - Ana J Hesaplama Modülü
 * 
 * Tüm bileşenleri birleştirerek J coupling değerlerini hesaplar
 */

import { JEdge, CouplingType, BondClass, Conformer, Coordinate3D } from '@/lib/types/nmr-simulation';
import {
  CouplingPath,
  J_MOTIFS,
  JMotif,
  calculateJConfidence,
} from './couplingTypes';
import {
  calculateKarplusForBondClass,
  calculateExtendedKarplus,
  applyGaucheCorrection,
  calculateBoltzmannWeightedJ,
  ConformerJData,
} from './karplusEngine';
import {
  getAromaticJ,
  getVinylJ,
  getGeminalJ,
  getLongRangeJ,
  isJValueReasonable,
} from './jLibrary';
import {
  determineBondClass,
  analyzeCouplingPath,
  getCouplingTypeFromPathLength,
  AtomInfo,
  BondInfo,
} from './bondClassifier';

// ============================================================================
// MAIN J CALCULATION
// ============================================================================

export interface JCalculationInput {
  proton1Id: string;
  proton2Id: string;
  proton1Idx: number;
  proton2Idx: number;
  pathAtomIndices: number[];     // Coupling yolu atom indeksleri
  atoms: AtomInfo[];
  bonds: BondInfo[];
  conformers?: Conformer[];      // 3D konformerler (opsiyonel)
  jMinHz?: number;               // Minimum J eşiği (default: 0.7 Hz)
}

export interface JCalculationResult {
  edge: JEdge;
  conformerData?: ConformerJData[];
  warnings: string[];
}

/**
 * İki proton arasındaki J coupling değerini hesapla
 */
export function calculateJCoupling(
  input: JCalculationInput
): JCalculationResult | null {
  const {
    proton1Id,
    proton2Id,
    proton1Idx,
    proton2Idx,
    pathAtomIndices,
    atoms,
    bonds,
    conformers,
    jMinHz = 0.7,
  } = input;
  
  const warnings: string[] = [];
  
  // Yol uzunluğundan coupling tipini belirle
  const pathLength = pathAtomIndices.length - 1;  // Bağ sayısı
  const couplingType = getCouplingTypeFromPathLength(pathLength);
  
  if (!couplingType) {
    return null;  // Geçersiz yol uzunluğu
  }
  
  // Çok uzak coupling'leri atla
  if (pathLength > 5) {
    return null;
  }
  
  // Bağ sınıfı analizi
  const pathAnalysis = analyzeCouplingPath(pathAtomIndices, atoms, bonds);
  const bondClass = pathAnalysis.bondClass;
  
  let jHz: number;
  let source: 'karplus' | 'library' | 'motif' | 'estimated';
  let dihedralAngle: number | undefined;
  let conformerData: ConformerJData[] | undefined;
  
  // Hesaplama stratejisi seç
  if (pathAnalysis.isAromatic && pathAnalysis.aromaticPosition) {
    // Aromatik: kütüphaneden
    jHz = getAromaticJ(pathAnalysis.aromaticPosition);
    source = 'library';
    
  } else if (couplingType === '3J' && pathLength === 3) {
    // 3J vicinal: Karplus veya konformer bazlı
    
    if (conformers && conformers.length > 0) {
      // Konformer bazlı hesaplama
      const result = calculateJFromConformers(
        pathAtomIndices,
        conformers,
        bondClass,
        pathAnalysis.heteroNeighbors
      );
      
      jHz = result.Javg;
      conformerData = result.conformerData;
      dihedralAngle = result.avgDihedral;
      source = 'karplus';
      
      if (result.Jstd > 2) {
        warnings.push(`High J variance across conformers: σ=${result.Jstd.toFixed(1)} Hz`);
      }
      
    } else {
      // 3D yok - tahmini değer
      jHz = estimateVicinalJ(bondClass, pathAnalysis.heteroNeighbors);
      source = 'estimated';
      warnings.push('3D coordinates unavailable; J estimated from topology');
    }
    
  } else if (couplingType === '2J') {
    // Geminal coupling
    jHz = calculateGeminalJ(pathAtomIndices, atoms);
    source = 'library';
    
  } else if (couplingType === '4J' || couplingType === '5J') {
    // Long-range coupling - motif tespiti
    const motifResult = detectLongRangeMotif(pathAtomIndices, atoms, bonds);
    
    if (motifResult) {
      jHz = motifResult.j;
      source = 'motif';
    } else {
      // Varsayılan küçük değer
      jHz = couplingType === '4J' ? 1.0 : 0.5;
      source = 'estimated';
    }
  } else {
    // Bilinmeyen durum
    jHz = 5.0;  // Varsayılan
    source = 'estimated';
    warnings.push('Unknown coupling type, using default value');
  }
  
  // Minimum eşik kontrolü
  if (jHz < jMinHz) {
    return null;  // Çok küçük, dahil etme
  }
  
  // Makul aralık kontrolü
  const validationResult = isJValueReasonable(jHz, couplingType, bondClass);
  if (!validationResult.isValid) {
    warnings.push(validationResult.warning!);
  } else if (validationResult.warning) {
    warnings.push(validationResult.warning);
  }
  
  // Confidence hesapla
  const confidence = calculateJConfidence(
    source,
    dihedralAngle !== undefined,
    pathAnalysis.bondClass !== 'sp3_sp3'  // Default olmayan sınıf daha kesin
  );
  
  // JEdge oluştur
  const edge: JEdge = {
    proton1Id,
    proton2Id,
    couplingType,
    bondClass,
    jHz: Math.round(jHz * 100) / 100,  // 2 ondalık
    dihedralAngle,
    confidence,
    source,
  };
  
  return {
    edge,
    conformerData,
    warnings,
  };
}

// ============================================================================
// CONFORMER-BASED J CALCULATION
// ============================================================================

interface ConformerJResult {
  Javg: number;
  Jstd: number;
  avgDihedral: number;
  conformerData: ConformerJData[];
}

function calculateJFromConformers(
  pathAtomIndices: number[],
  conformers: Conformer[],
  bondClass: BondClass,
  heteroNeighbors: string[]
): ConformerJResult {
  const conformerData: ConformerJData[] = [];
  
  for (const conf of conformers) {
    // Dihedral açıyı hesapla
    const dihedralDeg = calculateDihedralAngle(pathAtomIndices, conf.atoms);
    
    if (dihedralDeg === null) continue;
    
    // Karplus hesapla
    let J: number;
    
    if (heteroNeighbors.length > 0) {
      // Extended Karplus (substituent düzeltmeleriyle)
      const result = calculateExtendedKarplus({
        dihedralDeg,
        bondClass,
        substituentsOnC1: heteroNeighbors.slice(0, Math.ceil(heteroNeighbors.length / 2)),
        substituentsOnC2: heteroNeighbors.slice(Math.ceil(heteroNeighbors.length / 2)),
      });
      J = result.J;
    } else {
      J = calculateKarplusForBondClass(dihedralDeg, bondClass);
    }
    
    // Gauche düzeltme
    J = applyGaucheCorrection(J, dihedralDeg, heteroNeighbors.length > 0);
    
    conformerData.push({
      conformerId: conf.id,
      weight: conf.weight,
      dihedralDeg,
      J,
    });
  }
  
  // Boltzmann ortalaması
  const { Javg, Jstd } = calculateBoltzmannWeightedJ(conformerData);
  
  // Ortalama dihedral
  const totalWeight = conformerData.reduce((sum, c) => sum + c.weight, 0);
  const avgDihedral = conformerData.reduce(
    (sum, c) => sum + c.dihedralDeg * (c.weight / totalWeight),
    0
  );
  
  return {
    Javg,
    Jstd,
    avgDihedral,
    conformerData,
  };
}

/**
 * 4 atomdan dihedral açı hesapla
 */
function calculateDihedralAngle(
  pathAtomIndices: number[],
  conformerAtoms: Conformer['atoms']
): number | null {
  if (pathAtomIndices.length < 4) return null;
  
  const [idx1, idx2, idx3, idx4] = pathAtomIndices;
  
  const a1 = conformerAtoms.find(a => a.atomIndex === idx1);
  const a2 = conformerAtoms.find(a => a.atomIndex === idx2);
  const a3 = conformerAtoms.find(a => a.atomIndex === idx3);
  const a4 = conformerAtoms.find(a => a.atomIndex === idx4);
  
  if (!a1 || !a2 || !a3 || !a4) return null;
  
  // Vektörler
  const v1 = {
    x: a2.coords.x - a1.coords.x,
    y: a2.coords.y - a1.coords.y,
    z: a2.coords.z - a1.coords.z,
  };
  const v2 = {
    x: a3.coords.x - a2.coords.x,
    y: a3.coords.y - a2.coords.y,
    z: a3.coords.z - a2.coords.z,
  };
  const v3 = {
    x: a4.coords.x - a3.coords.x,
    y: a4.coords.y - a3.coords.y,
    z: a4.coords.z - a3.coords.z,
  };
  
  // Cross products (normal vektörler)
  const n1 = cross(v1, v2);
  const n2 = cross(v2, v3);
  
  // Normalize
  const len1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z);
  const len2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z);
  
  if (len1 === 0 || len2 === 0) return null;
  
  n1.x /= len1; n1.y /= len1; n1.z /= len1;
  n2.x /= len2; n2.y /= len2; n2.z /= len2;
  
  // Dot product → açı
  const dot = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
  
  // İşaret belirleme
  const crossN = cross(n1, n2);
  const sign = (v2.x * crossN.x + v2.y * crossN.y + v2.z * crossN.z) >= 0 ? 1 : -1;
  
  return sign * (angleRad * 180 / Math.PI);
}

function cross(a: Coordinate3D, b: Coordinate3D): Coordinate3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// ============================================================================
// FALLBACK ESTIMATIONS
// ============================================================================

/**
 * 3D olmadan vicinal J tahmini
 */
function estimateVicinalJ(
  bondClass: BondClass,
  heteroNeighbors: string[]
): number {
  // Bağ sınıfına göre ortalama değer
  const averageValues: Record<BondClass, number> = {
    'sp3_sp3': 7.0,
    'sp2_sp3': 6.5,
    'sp2_sp2_cis': 10.0,
    'sp2_sp2_trans': 16.0,
    'aromatic_ortho': 8.0,
    'aromatic_meta': 2.2,
    'aromatic_para': 0.5,
    'hetero_adjacent': 6.0,
  };
  
  let j = averageValues[bondClass] ?? 7.0;
  
  // Heteroatom düzeltmesi
  for (const hetero of heteroNeighbors) {
    if (hetero === 'O') j += 0.5;
    if (hetero === 'N') j += 0.3;
  }
  
  return j;
}

/**
 * Geminal (2J) hesaplama
 */
function calculateGeminalJ(
  pathAtomIndices: number[],
  atoms: AtomInfo[]
): number {
  // Aynı karbon üzerindeki iki H
  // pathAtomIndices = [H1, C, H2]
  
  if (pathAtomIndices.length !== 3) {
    return 12.5;  // Default
  }
  
  const carbonIdx = pathAtomIndices[1];
  const carbon = atoms.find(a => a.index === carbonIdx);
  
  if (!carbon) return 12.5;
  
  // Karbon ortamına göre
  if (carbon.isAromatic) {
    return 0;  // Aromatik C'de geminal yok
  }
  
  // Komşu heteroatom kontrolü
  const hasO = carbon.neighbors.some(
    nIdx => atoms.find(a => a.index === nIdx)?.element === 'O'
  );
  const hasN = carbon.neighbors.some(
    nIdx => atoms.find(a => a.index === nIdx)?.element === 'N'
  );
  const hasCO = carbon.neighbors.some(nIdx => {
    const neighbor = atoms.find(a => a.index === nIdx);
    return neighbor?.element === 'C' && neighbor.hybridization === 'sp2';
  });
  
  if (hasCO) return 16.5;  // α-karbonil
  if (hasO) return 10.5;
  if (hasN) return 12.0;
  
  return 12.5;  // Standart CH2
}

/**
 * Long-range motif tespiti
 */
function detectLongRangeMotif(
  pathAtomIndices: number[],
  atoms: AtomInfo[],
  bonds: BondInfo[]
): { motif: JMotif; j: number } | null {
  // Allylic kontrol (H-C-C=C-H)
  // W-coupling kontrol
  
  for (const motif of J_MOTIFS) {
    if (motif.couplingType !== '4J' && motif.couplingType !== '5J') continue;
    
    // Basit heuristik: yol üzerinde çift bağ varsa allylic olabilir
    let hasDoubleBond = false;
    for (let i = 0; i < pathAtomIndices.length - 1; i++) {
      const bond = bonds.find(
        b => (b.atom1Idx === pathAtomIndices[i] && b.atom2Idx === pathAtomIndices[i + 1]) ||
             (b.atom2Idx === pathAtomIndices[i] && b.atom1Idx === pathAtomIndices[i + 1])
      );
      if (bond && bond.order === 2) {
        hasDoubleBond = true;
        break;
      }
    }
    
    if (hasDoubleBond && motif.name === 'allylic_4j') {
      return { motif, j: motif.typicalJ };
    }
  }
  
  return null;
}

// ============================================================================
// BATCH J CALCULATION
// ============================================================================

export interface JGraphInput {
  protons: Array<{ id: string; atomIndex: number }>;
  atoms: AtomInfo[];
  bonds: BondInfo[];
  conformers?: Conformer[];
  jMinHz?: number;
  maxCouplingDistance?: number;  // Maksimum bağ mesafesi
}

/**
 * Tüm proton çiftleri için J grafı oluştur
 */
export function buildJGraph(
  input: JGraphInput
): { edges: JEdge[]; warnings: string[] } {
  const {
    protons,
    atoms,
    bonds,
    conformers,
    jMinHz = 0.7,
    maxCouplingDistance = 4,
  } = input;
  
  const edges: JEdge[] = [];
  const allWarnings: string[] = [];
  
  // Her proton çifti için
  for (let i = 0; i < protons.length; i++) {
    for (let j = i + 1; j < protons.length; j++) {
      const p1 = protons[i];
      const p2 = protons[j];
      
      // Coupling yolu bul
      const path = findShortestPath(p1.atomIndex, p2.atomIndex, atoms, maxCouplingDistance + 1);
      
      if (!path || path.length - 1 > maxCouplingDistance) continue;
      
      // J hesapla
      const result = calculateJCoupling({
        proton1Id: p1.id,
        proton2Id: p2.id,
        proton1Idx: p1.atomIndex,
        proton2Idx: p2.atomIndex,
        pathAtomIndices: path,
        atoms,
        bonds,
        conformers,
        jMinHz,
      });
      
      if (result) {
        edges.push(result.edge);
        allWarnings.push(...result.warnings);
      }
    }
  }
  
  return { edges, warnings: allWarnings };
}

/**
 * BFS ile en kısa yol
 */
function findShortestPath(
  start: number,
  end: number,
  atoms: AtomInfo[],
  maxLength: number
): number[] | null {
  const queue: Array<{ current: number; path: number[] }> = [
    { current: start, path: [start] }
  ];
  const visited = new Set<number>([start]);
  
  while (queue.length > 0) {
    const { current, path } = queue.shift()!;
    
    if (current === end) {
      return path;
    }
    
    if (path.length >= maxLength) continue;
    
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
  
  return null;
}
