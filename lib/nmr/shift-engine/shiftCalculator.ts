/**
 * Shift Calculator - Ana Hesaplayıcı
 * 
 * Tüm katmanları birleştirerek nihai δ hesaplar:
 * δ_final = δ_base + Δδ_topology + Δδ_electronic + Δδ_3D
 * 
 * 3D düzeltmeler: π-anizotropi + H-bond + through-space
 */

import {
  Proton,
  Conformer,
  ShiftLayerContribution,
  ShiftProvenance,
  Solvent,
  ProtonType,
} from '@/lib/types/nmr-simulation';

import { getBaseShift, classifyProtonType, ProtonClassificationInput } from './baseShift';
import { calculateTopologyCorrection, SubstituentAtPosition } from './topologyCorrections';
import { calculateElectronicCorrection, ElectronicCorrectionInput } from './electronicCorrections';
import { calculateTotalPiAnisotropy, Coordinate3D } from './piAnisotropy';
import { calculateHBondShiftCorrection, detectHBond, HBondInfo } from './hbondCorrections';
import { calculateTotalThroughSpaceEffect } from './throughSpaceCorrections';

// ============================================================================
// SHIFT CALCULATION OPTIONS
// ============================================================================

export interface ShiftCalculationOptions {
  usePiAnisotropy: boolean;
  useHBondCorrection: boolean;
  useThroughSpace: boolean;
  useChargeCorrection: boolean;
  solvent: Solvent;
}

export const DEFAULT_SHIFT_OPTIONS: ShiftCalculationOptions = {
  usePiAnisotropy: true,
  useHBondCorrection: true,
  useThroughSpace: true,
  useChargeCorrection: true,
  solvent: 'CDCl3',
};

// ============================================================================
// MOLECULAR CONTEXT
// ============================================================================

export interface MolecularContext {
  // Proton bilgisi
  protonIndex: number;
  heavyAtomIndex: number;
  protonType: ProtonType;
  isExchangeable: boolean;
  
  // Topoloji
  substituents: SubstituentAtPosition[];
  
  // Elektronik
  partialCharge: number;
  referenceCharge: number;
  
  // 3D (konformer bazlı)
  protonCoord: Coordinate3D;
  aromaticRings: Array<{ atomCoords: Coordinate3D[]; ringType: string }>;
  carbonyls: Array<{ cCoord: Coordinate3D; oCoord: Coordinate3D }>;
  hbondCandidates: Array<{
    donorCoord: Coordinate3D;
    hydrogenCoord: Coordinate3D;
    acceptorCoord: Coordinate3D;
    acceptorElement: string;
    isIntramolecular: boolean;
  }>;
  nearbyHeteroatoms: Array<{
    coord: Coordinate3D;
    element: string;
    isBonded: boolean;
    bondDistance: number;
  }>;
}

// ============================================================================
// SINGLE CONFORMER SHIFT CALCULATION
// ============================================================================

/**
 * Tek bir konformer için protonun δ değerini hesapla
 */
export function calculateShiftForConformer(
  context: MolecularContext,
  options: ShiftCalculationOptions = DEFAULT_SHIFT_OPTIONS
): ShiftLayerContribution {
  // Katman 1: Base shift
  const baseShift = getBaseShift(context.protonType);
  
  // Katman 2: Topology corrections
  const topoResult = calculateTopologyCorrection(context.substituents);
  const topologyCorrection = topoResult.totalCorrection;
  
  // Katman 3: Electronic corrections
  let electronicCorrection = 0;
  if (options.useChargeCorrection) {
    const elecInput: ElectronicCorrectionInput = {
      atomIndex: context.heavyAtomIndex,
      heavyAtomPartialCharge: context.partialCharge,
      referenceCharge: context.referenceCharge,
    };
    const elecResult = calculateElectronicCorrection(elecInput);
    electronicCorrection = elecResult.correction;
  }
  
  // Katman 4A: π-Anisotropy
  let piAnisotropyCorrection = 0;
  if (options.usePiAnisotropy) {
    const piResult = calculateTotalPiAnisotropy(
      context.protonCoord,
      context.aromaticRings,
      context.carbonyls
    );
    piAnisotropyCorrection = piResult.totalCorrection;
  }
  
  // Katman 4B: H-bond corrections
  let hbondCorrection = 0;
  if (options.useHBondCorrection && context.isExchangeable) {
    // En güçlü H-bağını bul
    let strongestHBond: HBondInfo | null = null;
    let isIntramolecular = false;
    
    for (const candidate of context.hbondCandidates) {
      const hbInfo = detectHBond({
        donorCoord: candidate.donorCoord,
        hydrogenCoord: candidate.hydrogenCoord,
        acceptorCoord: candidate.acceptorCoord,
        acceptorElement: candidate.acceptorElement,
      });
      
      if (hbInfo.exists && (!strongestHBond || hbInfo.strengthScore > strongestHBond.strengthScore)) {
        strongestHBond = hbInfo;
        isIntramolecular = candidate.isIntramolecular;
      }
    }
    
    if (strongestHBond) {
      // Proton tipini belirle
      let hbProtonType: 'OH' | 'NH' | 'NH2' | 'COOH' = 'OH';
      if (context.protonType === 'nh') hbProtonType = 'NH';
      else if (context.protonType === 'nh2') hbProtonType = 'NH2';
      else if (context.protonType === 'cooh') hbProtonType = 'COOH';
      
      const hbResult = calculateHBondShiftCorrection({
        protonType: hbProtonType,
        hbondInfo: strongestHBond,
        solvent: options.solvent,
        isIntramolecular,
      });
      hbondCorrection = hbResult.deltaCorrection;
    }
  }
  
  // Katman 4C: Through-space corrections
  let throughSpaceCorrection = 0;
  if (options.useThroughSpace) {
    const tsResult = calculateTotalThroughSpaceEffect(
      context.protonCoord,
      context.nearbyHeteroatoms
    );
    throughSpaceCorrection = tsResult.totalCorrection;
  }
  
  // Toplam
  const total = baseShift + 
    topologyCorrection + 
    electronicCorrection + 
    piAnisotropyCorrection + 
    hbondCorrection + 
    throughSpaceCorrection;
  
  return {
    base: baseShift,
    topology: topologyCorrection,
    electronic: electronicCorrection,
    pi_anisotropy: piAnisotropyCorrection,
    hbond: hbondCorrection,
    throughSpace: throughSpaceCorrection,
    total,
  };
}

// ============================================================================
// BOLTZMANN WEIGHTED SHIFT
// ============================================================================

export interface ConformerShiftData {
  conformerId: number;
  weight: number;           // Boltzmann ağırlığı
  layers: ShiftLayerContribution;
}

/**
 * Konformer ansambli için Boltzmann ağırlıklı ortalama δ hesapla
 * 
 * δ_final = Σ(w_i × δ_i)
 */
export function calculateBoltzmannWeightedShift(
  conformerShifts: ConformerShiftData[]
): ShiftLayerContribution {
  if (conformerShifts.length === 0) {
    return {
      base: 0,
      topology: 0,
      electronic: 0,
      pi_anisotropy: 0,
      hbond: 0,
      throughSpace: 0,
      total: 0,
    };
  }
  
  if (conformerShifts.length === 1) {
    return conformerShifts[0].layers;
  }
  
  // Ağırlıkları normalize et
  const totalWeight = conformerShifts.reduce((sum, cs) => sum + cs.weight, 0);
  
  // Her katman için ağırlıklı ortalama
  let base = 0;
  let topology = 0;
  let electronic = 0;
  let pi_anisotropy = 0;
  let hbond = 0;
  let throughSpace = 0;
  
  for (const cs of conformerShifts) {
    const normalizedWeight = cs.weight / totalWeight;
    base += cs.layers.base * normalizedWeight;
    topology += cs.layers.topology * normalizedWeight;
    electronic += cs.layers.electronic * normalizedWeight;
    pi_anisotropy += cs.layers.pi_anisotropy * normalizedWeight;
    hbond += cs.layers.hbond * normalizedWeight;
    throughSpace += cs.layers.throughSpace * normalizedWeight;
  }
  
  const total = base + topology + electronic + pi_anisotropy + hbond + throughSpace;
  
  return {
    base,
    topology,
    electronic,
    pi_anisotropy,
    hbond,
    throughSpace,
    total,
  };
}

// ============================================================================
// VARIANCE CALCULATION
// ============================================================================

/**
 * Konformerler arası δ varyansını hesapla
 * Bu, exchange rejimi kararı için kullanılır
 */
export function calculateShiftVariance(
  conformerShifts: ConformerShiftData[]
): number {
  if (conformerShifts.length <= 1) return 0;
  
  // Ağırlıklı ortalama
  const totalWeight = conformerShifts.reduce((sum, cs) => sum + cs.weight, 0);
  const mean = conformerShifts.reduce(
    (sum, cs) => sum + cs.layers.total * (cs.weight / totalWeight),
    0
  );
  
  // Ağırlıklı varyans
  const variance = conformerShifts.reduce((sum, cs) => {
    const diff = cs.layers.total - mean;
    return sum + (cs.weight / totalWeight) * diff * diff;
  }, 0);
  
  return variance;
}

/**
 * Konformer bazlı δ dağılımını iki kümeye ayır
 * (H-bond var/yok gibi durumlar için)
 */
export function clusterConformerShifts(
  conformerShifts: ConformerShiftData[],
  clusterThreshold: number = 0.15  // ppm
): {
  singleCluster: boolean;
  clusters: Array<{
    centerShift: number;
    totalWeight: number;
    members: ConformerShiftData[];
  }>;
} {
  if (conformerShifts.length === 0) {
    return { singleCluster: true, clusters: [] };
  }
  
  // Basit 1D clustering: δ değerlerine göre sırala
  const sorted = [...conformerShifts].sort((a, b) => a.layers.total - b.layers.total);
  
  // Gap-based clustering
  const clusters: Array<{
    centerShift: number;
    totalWeight: number;
    members: ConformerShiftData[];
  }> = [];
  
  let currentCluster: ConformerShiftData[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].layers.total - sorted[i - 1].layers.total;
    
    if (gap > clusterThreshold) {
      // Yeni küme başlat
      const totalWeight = currentCluster.reduce((sum, cs) => sum + cs.weight, 0);
      const centerShift = currentCluster.reduce(
        (sum, cs) => sum + cs.layers.total * cs.weight,
        0
      ) / totalWeight;
      
      clusters.push({
        centerShift,
        totalWeight,
        members: currentCluster,
      });
      
      currentCluster = [sorted[i]];
    } else {
      currentCluster.push(sorted[i]);
    }
  }
  
  // Son kümeyi ekle
  if (currentCluster.length > 0) {
    const totalWeight = currentCluster.reduce((sum, cs) => sum + cs.weight, 0);
    const centerShift = currentCluster.reduce(
      (sum, cs) => sum + cs.layers.total * cs.weight,
      0
    ) / totalWeight;
    
    clusters.push({
      centerShift,
      totalWeight,
      members: currentCluster,
    });
  }
  
  return {
    singleCluster: clusters.length === 1,
    clusters,
  };
}

// ============================================================================
// PROVENANCE
// ============================================================================

/**
 * Tam provenance bilgisi oluştur
 */
export function createShiftProvenance(
  protonId: string,
  conformerShifts: ConformerShiftData[],
  finalLayers: ShiftLayerContribution
): ShiftProvenance {
  const warnings: string[] = [];
  
  // Varyans kontrolü
  const variance = calculateShiftVariance(conformerShifts);
  const stdDev = Math.sqrt(variance);
  
  if (stdDev > 0.3) {
    warnings.push(`High shift variance across conformers: σ=${stdDev.toFixed(2)} ppm`);
  }
  
  // Büyük düzeltme kontrolü
  if (Math.abs(finalLayers.pi_anisotropy) > 1.0) {
    warnings.push(`Strong π-anisotropy effect: ${finalLayers.pi_anisotropy.toFixed(2)} ppm`);
  }
  
  if (Math.abs(finalLayers.hbond) > 2.0) {
    warnings.push(`Strong H-bond effect: ${finalLayers.hbond.toFixed(2)} ppm`);
  }
  
  // Confidence hesapla
  let confidence = 0.8;
  if (stdDev > 0.5) confidence -= 0.1;
  if (conformerShifts.length < 3) confidence -= 0.1;
  confidence = Math.max(0.3, confidence);
  
  return {
    protonId,
    conformerId: -1,  // Boltzmann ortalaması için -1
    layers: finalLayers,
    confidence,
    warnings,
  };
}
