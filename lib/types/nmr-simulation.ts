/**
 * SpectroMind v2.0 - NMR Simülasyon Core Type Definitions
 * 
 * Bu dosya, gelişmiş ¹H NMR spektrum simülasyonu için gereken tüm
 * tip tanımlarını içerir:
 * - Konformer ansambli ve Boltzmann ağırlıklandırma
 * - Katmanlı δ modeli (base + topology + electronic + 3D)
 * - J coupling parametreleri ve bağ sınıfları
 * - Spin sistem türleri (AB, ABX, AMX, AA'BB')
 * - Eşdeğerlik ve dinamik exchange
 * - Line shape ve spektrum rendering
 * - Validasyon ve provenance
 */

// ============================================================================
// SOLVENT & EXPERIMENTAL CONDITIONS
// ============================================================================

export type Solvent = 'CDCl3' | 'DMSO-d6' | 'CD3OD' | 'D2O' | 'Acetone-d6' | 'Benzene-d6' | 'CD2Cl2';

export interface ExperimentalConditions {
  solvent: Solvent;
  temperatureK: number;        // Default: 298.15
  fieldMHz: number;            // 400, 500, 600 etc.
  referenceCompound?: string;  // TMS, DSS, etc.
}

export const SOLVENT_PRESETS: Record<Solvent, {
  residualPeakPPM: number;
  viscosityFactor: number;     // 1.0 = normal, >1 = daha geniş çizgi
  hbondStrength: 'weak' | 'medium' | 'strong';
  exchangeableRemoved: boolean;
}> = {
  'CDCl3': { residualPeakPPM: 7.26, viscosityFactor: 1.0, hbondStrength: 'weak', exchangeableRemoved: false },
  'DMSO-d6': { residualPeakPPM: 2.50, viscosityFactor: 1.5, hbondStrength: 'strong', exchangeableRemoved: false },
  'CD3OD': { residualPeakPPM: 3.31, viscosityFactor: 1.2, hbondStrength: 'medium', exchangeableRemoved: false },
  'D2O': { residualPeakPPM: 4.79, viscosityFactor: 1.0, hbondStrength: 'medium', exchangeableRemoved: true },
  'Acetone-d6': { residualPeakPPM: 2.05, viscosityFactor: 1.0, hbondStrength: 'weak', exchangeableRemoved: false },
  'Benzene-d6': { residualPeakPPM: 7.16, viscosityFactor: 1.0, hbondStrength: 'weak', exchangeableRemoved: false },
  'CD2Cl2': { residualPeakPPM: 5.32, viscosityFactor: 1.0, hbondStrength: 'weak', exchangeableRemoved: false },
};

// ============================================================================
// CONFORMER TYPES
// ============================================================================

export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
}

export interface ConformerAtom {
  atomIndex: number;
  element: string;
  coords: Coordinate3D;
  hybridization?: 'sp' | 'sp2' | 'sp3';
  isAromatic?: boolean;
  formalCharge?: number;
}

export interface Conformer {
  id: number;
  energy: number;              // kcal/mol
  weight: number;              // Boltzmann ağırlığı (0-1)
  probability: number;         // Yüzde (0-100)
  atoms: ConformerAtom[];
  dihedrals?: DihedralAngle[];
  hbonds?: HBondInfo[];
}

export interface DihedralAngle {
  atomIndices: [number, number, number, number];  // H1-C1-C2-H2
  angleDeg: number;
  conformerId: number;
}

export interface HBondInfo {
  donorAtomIdx: number;        // D in D-H...A
  hydrogenAtomIdx: number;     // H
  acceptorAtomIdx: number;     // A
  distanceHA: number;          // H...A mesafesi (Å)
  angleDHA: number;            // D-H...A açısı (derece)
  strength: 'weak' | 'medium' | 'strong';
}

export interface ConformerEnsemble {
  smiles: string;
  conformers: Conformer[];
  globalMinEnergy: number;
  totalGenerated: number;
  significantCount: number;    // >1% popülasyon
  method: string;              // 'ETKDGv3 + MMFF94'
  temperatureK: number;
}

// ============================================================================
// PROTON TYPES
// ============================================================================

export type ProtonType = 
  | 'alkyl_ch3' | 'alkyl_ch2' | 'alkyl_ch'
  | 'allylic' | 'benzylic'
  | 'vinylic_cis' | 'vinylic_trans' | 'vinylic_gem'
  | 'aromatic'
  | 'aldehyde'
  | 'o_ch' | 'o_ch2' | 'o_ch3'   // O-attached
  | 'n_ch' | 'n_ch2' | 'n_ch3'   // N-attached
  | 'oh' | 'nh' | 'nh2' | 'cooh' // Exchangeable
  | 'other';

export interface Proton {
  id: string;                  // H_23 gibi
  atomIndex: number;           // Moleküldeki atom indeksi
  heavyAtomIdx: number;        // Bağlı olduğu ağır atom
  type: ProtonType;
  isExchangeable: boolean;
  isAromatic: boolean;
  
  // Eşdeğerlik bilgisi
  topoClass: number;           // 2D topolojik sınıf
  stereoClass: 'eq' | 'proR' | 'proS' | 'unknown';
  equivalenceGroupId?: string;
  
  // Konformer bazlı δ
  deltaByConf: number[];       // Her konformer için δ
  deltaFinal: number;          // Boltzmann ortalaması
  
  // Coupling bilgisi
  jEdges: JEdge[];             // Komşu coupling'ler
}

// ============================================================================
// CHEMICAL SHIFT (δ) TYPES - LAYERED MODEL
// ============================================================================

export interface ShiftLayerContribution {
  base: number;                // Atom tipi + hibritleşme
  topology: number;            // α/β/γ substituent etkileri
  electronic: number;          // Gasteiger partial charge proxy
  pi_anisotropy: number;       // Ring current / karbonil anizotropi
  hbond: number;               // H-bağı etkisi
  throughSpace: number;        // Yakın heteroatom etkileri
  total: number;               // Toplam δ
}

export interface ShiftProvenance {
  protonId: string;
  conformerId: number;
  layers: ShiftLayerContribution;
  confidence: number;
  warnings: string[];
}

// Base Shift Constants
export interface BaseShiftConstant {
  protonType: ProtonType;
  baseShift: number;
  rangeMin: number;
  rangeMax: number;
}

// Topology Correction (α/β/γ effects)
export interface TopologyCorrection {
  group: string;               // SMARTS veya grup adı
  alpha: number;               // α pozisyondaki etki
  beta: number;                // β pozisyondaki etki
  gamma: number;               // γ pozisyondaki etki
  inductiveEffect: 'EWG' | 'EDG' | 'neutral';
  resonanceEffect: '+M' | '-M' | 'none';
}

// ============================================================================
// J COUPLING TYPES
// ============================================================================

export type CouplingType = '2J' | '3J' | '4J' | '5J';

export type BondClass = 
  | 'sp3_sp3'           // Alifatik tek bağ
  | 'sp2_sp3'           // Allylic/benzylic
  | 'sp2_sp2_cis'       // Vinilik cis
  | 'sp2_sp2_trans'     // Vinilik trans
  | 'aromatic_ortho'    // Aromatik ortho
  | 'aromatic_meta'     // Aromatik meta
  | 'aromatic_para'     // Aromatik para
  | 'hetero_adjacent';  // Heteroatom komşusu

export interface KarplusParameters {
  A: number;
  B: number;
  C: number;
  bondClass: BondClass;
  substituent_corrections?: Record<string, number>;
}

export interface JEdge {
  proton1Id: string;
  proton2Id: string;
  couplingType: CouplingType;
  bondClass: BondClass;
  jHz: number;                 // Hesaplanan J değeri
  dihedralAngle?: number;      // 3J için dihedral (derece)
  confidence: number;
  source: 'karplus' | 'library' | 'motif' | 'estimated';
}

export interface JCouplingLibrary {
  // Aromatik J değerleri
  aromatic_ortho: { min: number; max: number; typical: number };
  aromatic_meta: { min: number; max: number; typical: number };
  aromatic_para: { min: number; max: number; typical: number };
  
  // Vinilik J değerleri
  vinyl_trans: { min: number; max: number; typical: number };
  vinyl_cis: { min: number; max: number; typical: number };
  vinyl_gem: { min: number; max: number; typical: number };
  
  // Geminal J değerleri
  geminal_ch2: { min: number; max: number; typical: number };
  geminal_benzylic: { min: number; max: number; typical: number };
  
  // Long-range J değerleri
  allylic_4j: { min: number; max: number; typical: number };
  w_coupling: { min: number; max: number; typical: number };
}

// ============================================================================
// SPIN SYSTEM TYPES
// ============================================================================

export type SpinSystemType = 
  | 'FIRST_ORDER'       // n+1 kuralı geçerli
  | 'AB'                // Diastereotopik CH2 veya yakın δ
  | 'ABX'               // AB + weak coupling X
  | 'AMX'               // Üç farklı coupling
  | 'A2B2'              // AA'BB' (para-disubstituted)
  | 'ABC'               // Üç farklı proton sistemi
  | 'ABCD'              // Dört farklı proton (kompleks aromatik)
  | 'GENERAL';          // Hamiltonian gerektiren genel sistem

export interface SpinSystem {
  id: string;
  type: SpinSystemType;
  protonIds: string[];
  shifts: number[];            // Hz cinsinden (ppm * fieldMHz)
  jMatrix: number[][];         // N x N coupling matrisi
  
  // Simülasyon parametreleri
  solver: 'quick' | 'hamiltonian' | 'hybrid';
  rValues?: number[];          // |Δν|/J oranları (second-order kontrolü)
}

export interface SpinLine {
  frequencyHz: number;
  frequencyPPM: number;
  intensity: number;           // Göreceli şiddet
  linewidthHz: number;
  sourceProtonIds: string[];
  label?: string;              // Opsiyonel etiket
}

// ============================================================================
// LINE SHAPE & EXCHANGE TYPES
// ============================================================================

export type LineShape = 'lorentzian' | 'gaussian' | 'voigt';

export interface LineShapeParams {
  shape: LineShape;
  fwhmHz: number;              // Full Width at Half Maximum
  eta?: number;                // Voigt mixing (0=Gaussian, 1=Lorentzian)
}

export type ExchangeRegime = 'fast' | 'intermediate' | 'slow';

export interface ExchangeSite {
  siteId: string;
  protonIds: string[];
  states: Array<{
    name: string;
    deltaPPM: number;
    population: number;        // 0-1 arası
  }>;
  rateK: number;               // s⁻¹
  regime: ExchangeRegime;
  linewidthExtraHz: number;    // Exchange kaynaklı genişleme
}

export interface DynamicEvent {
  id: string;
  type: 'ring_flip' | 'bond_rotation' | 'amide_rotamer' | 'tautomer';
  affectedAtomIndices: number[];
  barrierKcal: number;
  estimatedRateK: number;
  swapMapping?: Record<string, string>;  // Atom swap eşleşmeleri
}

// ============================================================================
// EQUIVALENCE TYPES
// ============================================================================

export interface EquivalenceGroup {
  id: string;
  protonIds: string[];
  integral: number;            // H sayısı
  deltaMean: number;           // Ortalama δ
  deltaStd: number;            // Standart sapma
  confidence: number;
  mergeReason?: string;        // Neden birleştirildi
  dynamicNotes?: string[];     // Dinamik süreç notları
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type ValidationSeverity = 'VETO' | 'WARN' | 'FIX';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  evidence: Record<string, unknown>;
  suggestedAction?: string;
  confidencePenalty?: number;  // 0-1 arası
  fixPatch?: ValidationPatch;
}

export interface ValidationPatch {
  kind: 
    | 'MERGE_PEAKS'
    | 'SPLIT_PEAK'
    | 'SHIFT_REFERENCE'
    | 'ROUND_INTEGRALS'
    | 'DROP_CLAIM'
    | 'ADJUST_J'
    | 'BROADEN_LINE';
  payload: Record<string, unknown>;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  confidenceAdjustment: number;
  finalConfidence: number;
}

// Window Expectation for δ validation
export interface WindowExpectation {
  id: string;
  requiredSubstructures: string[];   // SMARTS patterns
  forbiddenSubstructures?: string[];
  windows: Array<{
    ppmMin: number;
    ppmMax: number;
    minRelativeArea?: number;
    minIntegral?: number;
    tag: string;
    strength: 'strong' | 'medium' | 'weak';
  }>;
  allowAbsenceIf?: string[];
}

// ============================================================================
// SPECTRUM OUTPUT TYPES
// ============================================================================

export interface NMRPeakSimulated {
  centerPPM: number;
  multiplicity: string;        // s, d, t, q, dd, dt, m, br s, etc.
  integral: number;            // H sayısı
  jHz: number[];               // Coupling sabitleri
  couplings?: Array<{           // Detaylı coupling bilgisi
    partnerProtonId: string;
    jHz: number;
    bondClass: string;
  }>;
  assignment: string;          // H-2, CH3, Ar-H ortho, etc.
  confidence: number;
  source: 'simulation' | 'model' | 'llm' | 'consensus';
  linewidthHz?: number;
  
  // Provenance
  protonIds: string[];
  spinLines?: SpinLine[];
  shiftLayers?: ShiftLayerContribution;
  spinSystemType?: SpinSystemType;
  warnings?: string[];
  provenance?: Record<string, unknown>;
}

export interface SpectrumArray {
  ppmAxis: number[];           // ppm değerleri (ör: 0-12, step 0.001)
  intensities: number[];       // Her ppm için intensity
  ppmMin: number;
  ppmMax: number;
  resolution: number;          // ppm step
  normalizedTo: 'max' | 'integral' | 'proton_count';
}

export interface SimulatedSpectrum {
  peakList: NMRPeakSimulated[];
  spectrumArray: SpectrumArray;
  totalProtons: number;
  equivalenceGroups: EquivalenceGroup[];
  spinSystems: SpinSystem[];
  exchangeSites: ExchangeSite[];
  
  // Metadata
  conditions: ExperimentalConditions;
  method: string;
  confidence: number;
  warnings: string[];
  validation: ValidationResult;
  
  // Provenance
  provenance: {
    conformerCount: number;
    boltzmannWeighted: boolean;
    secondOrderSystems: number;
    dynamicEvents: string[];
    computationTimeMs: number;
  };
}

// Rendered spectrum output (from spectrum-renderer)
export interface SpectrumOutput {
  ppmAxis: number[];
  intensities: number[];
  peakList: Array<{
    ppm: number;
    intensity: number;
    integral: number;
    multiplicity: string;
    jHz: number[];
    assignment?: string;
    protonIds?: string[];
  }>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SPECIAL PACKS TYPES
// ============================================================================

export interface AldehydeCouplingPack {
  enabled: boolean;
  choWindowPPM: [number, number];  // 9.0-10.5
  alphaJRange: [number, number];   // 1-3 Hz
}

export interface BenzylicAllylicPack {
  enabled: boolean;
  benzylicShiftRange: [number, number];  // 2.2-3.0
  allylicShiftRange: [number, number];   // 1.6-2.3
  longRange4JRange: [number, number];    // 1-3 Hz
}

export interface ExchangeableProtonsPack {
  enabled: boolean;
  solventDependentVisibility: boolean;
  d2oRemoval: boolean;
  broadLinewidthHz: number;  // 5-15 Hz
}

export interface AmideRotamerPack {
  enabled: boolean;
  barrierKcal: number;       // ~15-20 kcal/mol
  dmsoEnhancement: boolean;  // DMSO'da daha belirgin
}

export interface TautomerMesomerPack {
  enabled: boolean;
  ketoEnolDetection: boolean;
  downfieldOHThreshold: number;  // ~12-18 ppm
}

export interface SpecialPacksConfig {
  aldehyde: AldehydeCouplingPack;
  benzylicAllylic: BenzylicAllylicPack;
  exchangeable: ExchangeableProtonsPack;
  amideRotamer: AmideRotamerPack;
  tautomer: TautomerMesomerPack;
}

// ============================================================================
// MAIN SIMULATION CONFIG
// ============================================================================

export interface NMRSimulationConfig {
  // Conformer generation
  conformer: {
    numConformers: number;       // Default: 50
    pruneRmsThresh: number;      // Default: 0.5 Å
    energyWindowKcal: number;    // Default: 7 kcal/mol
    populationCutoff: number;    // Default: 1% (filtre eşiği)
  };
  
  // Chemical shift
  shift: {
    usePiAnisotropy: boolean;
    useHBondCorrection: boolean;
    useThroughSpace: boolean;
    useChargeCorrection: boolean;
  };
  
  // Coupling
  coupling: {
    jMinHz: number;              // Default: 0.7 Hz (dahil edilecek minimum J)
    use3DKarplus: boolean;       // Dihedral'den Karplus
    useExtendedKarplus: boolean; // Haasnoot-Altona düzeltmeleri
  };
  
  // Spin system
  spinSystem: {
    secondOrderThreshold: number;  // R = |Δν|/J, R < 3 ise second-order
    maxSpinSystemSize: number;     // Default: 12 (Hamiltonian boyut sınırı)
  };
  
  // Line shape
  lineShape: {
    defaultShape: LineShape;
    baseFWHMHz: number;          // Default: 1.0 Hz
    exchangeableFWHMHz: number;  // Default: 5-15 Hz
    voigtEta: number;            // Default: 0.8
  };
  
  // Spectrum rendering
  spectrum: {
    ppmMin: number;              // Default: -0.5
    ppmMax: number;              // Default: 12.0
    resolution: number;          // Default: 0.001 ppm
    normalization: 'max' | 'integral' | 'proton_count';
  };
  
  // Special packs
  specialPacks: SpecialPacksConfig;
  
  // Validation
  validation: {
    enableWindowChecks: boolean;
    enableJPatternChecks: boolean;
    enableAromaticPatternChecks: boolean;
    enableDBEConsistency: boolean;
    enableIntegralRationing: boolean;
  };
}

// Default configuration
export const DEFAULT_NMR_SIMULATION_CONFIG: NMRSimulationConfig = {
  conformer: {
    numConformers: 50,
    pruneRmsThresh: 0.5,
    energyWindowKcal: 7,
    populationCutoff: 1,
  },
  shift: {
    usePiAnisotropy: true,
    useHBondCorrection: true,
    useThroughSpace: true,
    useChargeCorrection: true,
  },
  coupling: {
    jMinHz: 0.7,
    use3DKarplus: true,
    useExtendedKarplus: true,
  },
  spinSystem: {
    secondOrderThreshold: 3,
    maxSpinSystemSize: 12,
  },
  lineShape: {
    defaultShape: 'voigt',
    baseFWHMHz: 1.0,
    exchangeableFWHMHz: 8,
    voigtEta: 0.8,
  },
  spectrum: {
    ppmMin: -0.5,
    ppmMax: 12.0,
    resolution: 0.002,
    normalization: 'proton_count',
  },
  specialPacks: {
    aldehyde: {
      enabled: true,
      choWindowPPM: [9.0, 10.5],
      alphaJRange: [1, 3],
    },
    benzylicAllylic: {
      enabled: true,
      benzylicShiftRange: [2.2, 3.0],
      allylicShiftRange: [1.6, 2.3],
      longRange4JRange: [1, 3],
    },
    exchangeable: {
      enabled: true,
      solventDependentVisibility: true,
      d2oRemoval: true,
      broadLinewidthHz: 10,
    },
    amideRotamer: {
      enabled: true,
      barrierKcal: 18,
      dmsoEnhancement: true,
    },
    tautomer: {
      enabled: true,
      ketoEnolDetection: true,
      downfieldOHThreshold: 12,
    },
  },
  validation: {
    enableWindowChecks: true,
    enableJPatternChecks: true,
    enableAromaticPatternChecks: true,
    enableDBEConsistency: true,
    enableIntegralRationing: true,
  },
};
