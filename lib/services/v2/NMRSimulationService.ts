/**
 * SpectroMind v2.0 - NMR Simulation Service
 * 
 * Ana simülasyon servisi - tüm modülleri birleştirir:
 * - Conformer ensemble'dan 3D feature extraction
 * - Katmanlı δ modeli
 * - J coupling engine
 * - Spin system simulation (first/second-order)
 * - Equivalence grouping
 * - Line shape & exchange
 * - Validation
 * - Spectrum rendering
 */

import {
  NMRSimulationConfig,
  DEFAULT_NMR_SIMULATION_CONFIG,
  Conformer,
  Proton,
  JEdge,
  EquivalenceGroup,
  NMRPeakSimulated,
  SpectrumOutput,
  ValidationResult,
  SpinLine,
  ExchangeSite,
  Solvent,
  SOLVENT_PRESETS,
} from '@/lib/types/nmr-simulation';

// Engine imports
import {
  calculateShiftForConformer,
  calculateBoltzmannWeightedShift,
  createShiftProvenance,
} from '@/lib/nmr/shift-engine/shiftCalculator';

import {
  calculateJCoupling,
  buildJGraph,
} from '@/lib/nmr/coupling-engine/jCalculator';

import {
  simulateSpinSystem,
  SpinInput,
} from '@/lib/nmr/spin-system';

import {
  buildEquivalenceGroups,
  EquivalenceAnalysisInput,
} from '@/lib/nmr/equivalence-engine';

import {
  calculateLinewidth,
  generateSpectrumArray,
} from '@/lib/nmr/lineshape-engine';

import {
  runValidation,
  ValidationInput,
} from '@/lib/nmr/validation';

import {
  runSpecialPacksAnalysis,
} from '@/lib/nmr/special-packs';

import {
  renderSpectrum,
  RenderConfig,
  DEFAULT_RENDER_CONFIG,
} from '@/lib/nmr/spectrum-renderer';

// ============================================================================
// SERVICE INPUT/OUTPUT TYPES
// ============================================================================

export interface NMRSimulationInput {
  // Molekül bilgisi
  smiles: string;
  formula: string;
  dbe: number;
  
  // Proton bilgisi (RDKit'ten)
  protons: ProtonInput[];
  
  // Konformer bilgisi (opsiyonel)
  conformers?: Conformer[];
  
  // Yapı özellikleri
  structure: {
    hasAldehyde?: boolean;
    hasEster?: boolean;
    hasCarboxylicAcid?: boolean;
    hasAromatic?: boolean;
    hasAlkene?: boolean;
    hasAmide?: boolean;
    hasKetoEnol?: boolean;
    aromaticHCount?: number;
    vinylHCount?: number;
  };
  
  // Deneysel koşullar
  solvent?: Solvent;
  temperatureK?: number;
  fieldMHz?: number;
  
  // Config override
  config?: Partial<NMRSimulationConfig>;
}

export interface ProtonInput {
  id: string;
  atomIndex: number;
  type: string;                // alkyl, aromatic, vinylic, etc.
  hybridization: string;       // sp3, sp2, sp
  topoClass: number;           // Canonical rank
  stereoClass?: 'proR' | 'proS' | 'none';
  attachedAtoms: number[];     // Neighboring atom indices
  isExchangeable: boolean;
  
  // 3D koordinatlar (konformer-bağımsız veya ortalama)
  coordinates?: { x: number; y: number; z: number };
  
  // Partial charge (RDKit'ten)
  partialCharge?: number;
}

export interface NMRSimulationOutput {
  peaks: NMRPeakSimulated[];
  spectrum: SpectrumOutput;
  spinLines: SpinLine[];
  equivalenceGroups: EquivalenceGroup[];
  jEdges: JEdge[];
  exchangeSites: ExchangeSite[];
  validation: ValidationResult;
  provenance: SimulationProvenance;
  warnings: string[];
}

export interface SimulationProvenance {
  method: string;
  conformerCount: number;
  boltzmannWeighted: boolean;
  secondOrderSystems: string[];
  specialPacksUsed: string[];
  timestamp: string;
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class NMRSimulationService {
  private config: NMRSimulationConfig;
  
  constructor(config?: Partial<NMRSimulationConfig>) {
    this.config = { ...DEFAULT_NMR_SIMULATION_CONFIG, ...config };
  }
  
  /**
   * Ana simülasyon fonksiyonu
   */
  async simulate(input: NMRSimulationInput): Promise<NMRSimulationOutput> {
    const warnings: string[] = [];
    const secondOrderSystems: string[] = [];
    const specialPacksUsed: string[] = [];
    
    // Config merge
    const config = { ...this.config, ...input.config };
    
    // Solvent ve koşullar
    const solvent = input.solvent ?? (config as any).experimentalConditions?.solvent ?? 'CDCl3';
    const fieldMHz = input.fieldMHz ?? (config as any).experimentalConditions?.fieldMHz ?? 400;
    const temperatureK = input.temperatureK ?? (config as any).experimentalConditions?.temperatureK ?? 298.15;
    
    // Konformer kontrolü
    const conformers = input.conformers ?? [];
    const hasConformers = conformers.length > 0;
    
    if (!hasConformers) {
      warnings.push('No conformers provided; using 2D topology-based predictions');
    }
    
    // Step 1: Protonları işle ve δ hesapla
    const protons = this.processProtons(input.protons, conformers, solvent, config);
    
    // Step 2: J coupling graph oluştur
    const jEdges = this.buildJCouplingGraph(protons, conformers, config);
    
    // Step 3: Special packs analizi
    const specialAnalysis = runSpecialPacksAnalysis(
      protons,
      jEdges,
      input.structure as any,
      solvent,
      config.specialPacks
    );
    
    warnings.push(...specialAnalysis.warnings);
    
    if (config.specialPacks.aldehyde.enabled && specialAnalysis.aldehyde.isAldehyde) {
      specialPacksUsed.push('aldehyde');
    }
    if (specialAnalysis.exchangeable.protonIds.length > 0) {
      specialPacksUsed.push('exchangeable');
    }
    if (specialAnalysis.amideRotamer.hasAmide) {
      specialPacksUsed.push('amide_rotamer');
    }
    if (specialAnalysis.tautomer.hasTautomer) {
      specialPacksUsed.push('tautomer');
    }
    
    // Step 4: Eşdeğerlik grupları
    const equivalenceInput: EquivalenceAnalysisInput = {
      protons: specialAnalysis.modifiedProtons,
      conformers,
      dynamicEvents: [
        ...specialAnalysis.amideRotamer.rotamerEvents,
      ],
      fieldMHz,
      temperatureK,
      solvent,
    };
    
    const equivalenceResult = buildEquivalenceGroups(equivalenceInput);
    warnings.push(...equivalenceResult.warnings);
    
    // Step 5: Spin sistem simülasyonu
    const spinInputs: SpinInput[] = protons.map(p => ({
      id: p.id,
      protonId: p.id,
      shiftHz: p.deltaFinal * fieldMHz,
      shiftPPM: p.deltaFinal,
      integral: 1,
    }));
    
    const spinResult = simulateSpinSystem(
      spinInputs,
      specialAnalysis.modifiedEdges,
      {
        fieldMHz,
        linewidthHz: config.lineShape.baseFWHMHz,
        jMinHz: 0.7,
        secondOrderThreshold: 3,
      }
    );
    
    warnings.push(...spinResult.warnings);
    
    // Second-order sistemleri kaydet
    for (const sys of spinResult.spinSystems) {
      if (sys.solver === 'hamiltonian') {
        secondOrderSystems.push(`${sys.type} (${sys.protonIds.length} spins)`);
      }
    }
    
    // Step 6: Peak'leri oluştur (eşdeğerlik gruplarından)
    const peaks = this.buildPeaksFromEquivalence(
      equivalenceResult.groups,
      protons,
      spinResult.lines,
      specialAnalysis.modifiedEdges,
      fieldMHz,
      solvent,
      config
    );
    
    // Step 7: Validasyon
    const validationInput: ValidationInput = {
      peaks,
      structure: {
        smiles: input.smiles,
        formula: input.formula,
        dbe: input.dbe,
        totalH: input.protons.length,
        hasAldehyde: input.structure.hasAldehyde,
        hasEster: input.structure.hasEster,
        hasCarboxylicAcid: input.structure.hasCarboxylicAcid,
        hasAromatic: input.structure.hasAromatic,
        hasAlkene: input.structure.hasAlkene,
        aromaticHCount: input.structure.aromaticHCount,
        vinylHCount: input.structure.vinylHCount,
      },
      jEdges: specialAnalysis.modifiedEdges,
      solvent,
    };
    
    const validation = runValidation(validationInput);
    
    // Validation warning'leri
    for (const issue of validation.issues) {
      warnings.push(`[${issue.severity}] ${issue.message}`);
    }
    
    // Step 8: Spektrum render
    const renderConfig: RenderConfig = {
      ...DEFAULT_RENDER_CONFIG,
      fieldMHz,
      lineShape: config.lineShape.defaultShape,
      voigtEta: config.lineShape.voigtEta,
    };
    
    const spectrum = renderSpectrum({
      peaks,
      spinLines: spinResult.lines,
      config: renderConfig,
    });
    
    // Provenance
    const provenance: SimulationProvenance = {
      method: hasConformers ? '3D-ensemble-weighted' : '2D-topology-only',
      conformerCount: conformers.length,
      boltzmannWeighted: hasConformers,
      secondOrderSystems,
      specialPacksUsed,
      timestamp: new Date().toISOString(),
    };
    
    return {
      peaks,
      spectrum,
      spinLines: spinResult.lines,
      equivalenceGroups: equivalenceResult.groups,
      jEdges: specialAnalysis.modifiedEdges,
      exchangeSites: specialAnalysis.additionalExchangeSites,
      validation,
      provenance,
      warnings,
    };
  }
  
  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================
  
  /**
   * Protonları işle ve δ hesapla
   */
  private processProtons(
    inputs: ProtonInput[],
    conformers: Conformer[],
    solvent: Solvent,
    config: NMRSimulationConfig
  ): Proton[] {
    return inputs.map(input => {
      // Temel proton nesnesi
      const proton = {
        id: input.id,
        atomIndex: input.atomIndex,
        type: input.type,
        hybridization: input.hybridization as 'sp3' | 'sp2' | 'sp',
        topoClass: input.topoClass,
        stereoClass: (input.stereoClass === 'none' ? 'unknown' : input.stereoClass) ?? 'unknown',
        attachedAtoms: input.attachedAtoms,
        isExchangeable: input.isExchangeable,
        
        // Kaymalar (başlangıç değerleri)
        deltaBase: 0,
        deltaTopology: 0,
        deltaElectronic: 0,
        delta3D: 0,
        deltaFinal: 0,
        deltaBoltzmann: 0,
        deltaStd: 0,
        
        // Partial charge
        partialCharge: input.partialCharge,
        
        // Confidence
        confidence: 0.8,
      };
      
      // Shift hesapla
      if (conformers.length > 0) {
        // Konformer bazlı
        const shifts: number[] = [];
        const weights: number[] = [];
        
        for (const conf of conformers) {
          const coords = conf.coordinates[input.atomIndex];
          if (!coords) continue;
          
          const shiftResult = calculateShiftForConformer(
            proton,
            conf,
            [], // aromaticRings - dışarıdan alınmalı
            [], // carbonylAtomIndices
            [], // hbondAcceptors
            [], // nearbyHeteroatoms
            solvent,
            config.shiftModel
          );
          
          shifts.push({
            conformerId: conf.id,
            weight: conf.boltzmannWeight,
            layers: shiftResult,
          });
        }
        
        // Boltzmann ağırlıklı ortalama
        const result = calculateBoltzmannWeightedShift(shifts);
        
        proton.deltaFinal = result.total;
        
      } else {
        // 2D topology bazlı basit hesap
        proton.deltaFinal = this.estimateShift2D(input);
      }
      
      return proton;
    });
  }
  
  /**
   * 2D topology'den basit shift tahmini
   */
  private estimateShift2D(input: ProtonInput): number {
    // Base shifts
    const baseShifts: Record<string, number> = {
      'alkyl': 1.2,
      'aromatic': 7.2,
      'vinylic': 5.5,
      'aldehyde': 9.5,
      'allylic': 2.0,
      'benzylic': 2.8,
      'nh': 7.5,
      'oh': 3.5,
      'n_ch': 2.8,
      'n_ch2': 2.9,
      'n_ch3': 2.7,
      'o_ch': 3.8,
      'o_ch2': 3.6,
      'o_ch3': 3.3,
    };
    
    return baseShifts[input.type] ?? 2.0;
  }
  
  /**
   * J coupling graph oluştur
   */
  private buildJCouplingGraph(
    protons: Proton[],
    conformers: Conformer[],
    config: NMRSimulationConfig
  ): JEdge[] {
    const edges: JEdge[] = [];
    
    // Her proton çifti için coupling hesapla
    for (let i = 0; i < protons.length; i++) {
      for (let j = i + 1; j < protons.length; j++) {
        const p1 = protons[i];
        const p2 = protons[j];
        
        // J coupling hesapla
        const jResult = calculateJCoupling(
          p1,
          p2,
          conformers,
          [],  // bondInfo - dışarıdan alınmalı
          config.jCoupling
        );
        
        if (jResult.jHz > 0.5) {  // Minimum J threshold
          edges.push({
            proton1Id: p1.id,
            proton2Id: p2.id,
            jHz: jResult.jHz,
            couplingType: jResult.pathLength === 2 ? '2J' : 
                          jResult.pathLength === 3 ? '3J' : '4J',
            source: jResult.source,
            confidence: jResult.confidence,
            bondClass: jResult.bondClass,
            isLongRange: jResult.pathLength > 3,
            karplusAngle: jResult.dihedralAngle,
          });
        }
      }
    }
    
    return edges;
  }
  
  /**
   * Eşdeğerlik gruplarından peak'ler oluştur
   */
  private buildPeaksFromEquivalence(
    groups: EquivalenceGroup[],
    protons: Proton[],
    spinLines: SpinLine[],
    jEdges: JEdge[],
    fieldMHz: number,
    solvent: Solvent,
    config: NMRSimulationConfig
  ): NMRPeakSimulated[] {
    const peaks: NMRPeakSimulated[] = [];
    
    for (const group of groups) {
      // Grup protonlarını bul
      const groupProtons = protons.filter(p => group.protonIds.includes(p.id));
      if (groupProtons.length === 0) continue;
      
      // Ortalama kayma
      const centerPPM = group.deltaMean;
      
      // Bu gruptaki spin lines
      const groupLines = spinLines.filter(line =>
        line.sourceProtonIds?.some(id => group.protonIds.includes(id))
      );
      
      // Coupling'ler
      const groupCouplings = jEdges.filter(e =>
        group.protonIds.includes(e.proton1Id) || group.protonIds.includes(e.proton2Id)
      );
      
      // Multiplicity belirle
      const multiplicity = this.determineMultiplicity(groupCouplings);
      
      // Linewidth
      const isExchangeable = groupProtons.some(p => p.isExchangeable);
      const linewidthResult = calculateLinewidth({
        baseLinewidthHz: config.lineShape.baseLinewidthHz,
        solvent,
        isExchangeable,
      });
      
      // Peak oluştur
      peaks.push({
        id: `peak_${group.id}`,
        protonIds: group.protonIds,
        centerPPM,
        integral: group.integral,
        multiplicity,
        couplings: groupCouplings.map(c => ({
          partnerProtonId: group.protonIds.includes(c.proton1Id) ? c.proton2Id : c.proton1Id,
          jHz: c.jHz,
          bondClass: c.bondClass ?? 'unknown',
        })),
        spinLines: groupLines,
        linewidthHz: linewidthResult.totalFWHM,
        assignment: this.generateAssignment(groupProtons),
        confidence: group.confidence,
        provenance: {
          shiftSource: 'model',
          jSource: 'karplus+library',
          conformerCount: 0,
          boltzmannWeighted: false,
        },
      });
    }
    
    // PPM'ye göre sırala (high to low)
    peaks.sort((a, b) => b.centerPPM - a.centerPPM);
    
    return peaks;
  }
  
  /**
   * Multiplicity belirle
   */
  private determineMultiplicity(couplings: JEdge[]): string {
    const significantCouplings = couplings.filter(c => c.jHz >= 1.0);
    
    if (significantCouplings.length === 0) return 's';
    
    // J değerlerine göre grupla
    const jGroups = new Map<number, number>();
    
    for (const c of significantCouplings) {
      const jRounded = Math.round(c.jHz);
      jGroups.set(jRounded, (jGroups.get(jRounded) ?? 0) + 1);
    }
    
    const multipllets: string[] = [];
    const names: Record<number, string> = {
      1: 's', 2: 'd', 3: 't', 4: 'q', 5: 'quin', 6: 'sex', 7: 'sep',
    };
    
    // Her J grubu için multiplicity
    for (const [, count] of jGroups) {
      const n = count + 1;
      multipllets.push(names[n] ?? 'm');
    }
    
    if (multipllets.length === 1) return multipllets[0];
    if (multipllets.length === 2) return multipllets.join('');
    return 'm';
  }
  
  /**
   * Assignment metni oluştur
   */
  private generateAssignment(protons: Proton[]): string {
    if (protons.length === 0) return '';
    
    const types = [...new Set(protons.map(p => p.type))];
    const count = protons.length;
    
    if (types.length === 1) {
      const type = types[0];
      if (count === 1) return type;
      return `${count}×${type}`;
    }
    
    return types.join('/');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let serviceInstance: NMRSimulationService | null = null;

export function getNMRSimulationService(
  config?: Partial<NMRSimulationConfig>
): NMRSimulationService {
  if (!serviceInstance || config) {
    serviceInstance = new NMRSimulationService(config);
  }
  return serviceInstance;
}

export default NMRSimulationService;
