/**
 * SpectroMind v2.0 Type Definitions
 */

// MS Types
export interface MSPeak {
  mz: number;
  intensity: number;
  assignment: string;
  formula?: string;
  charge?: number;
  type?: string; // 'M+', '[M+H]+', 'Fragment', etc.
}

export interface DiagnosticIon {
  mz: number;
  name: string;
  structure: string;
  relative_intensity: number;
  is_base_peak: boolean;
  confirmations?: Array<{
    mz: number;
    intensity: number;
  }>;
  isotope_match?: boolean;
}

export interface McLaffertyRearrangement {
  type: string;
  carbonyl_atom: number;
  gamma_atom: number;
  possible_mz: number[];
}

export interface MSPrediction {
  molecularIon: number;
  peaks: MSPeak[];
  method: string;
  formula?: string;
  diagnosticIons?: DiagnosticIon[];
  mclaffertyRearrangements?: McLaffertyRearrangement[];
  parameters?: {
    collision_energy: number;
    ionization: string;
    depth_limit: number;
  };
}

// GNN Types
export interface GNNPrediction {
  atomIndex: number;
  shift: number;
  confidence: number;
  assignment: string;
  element: string;
}

// Conformer Types
export interface Conformer {
  id: number;
  energy: number;
  weight: number;
  probability?: number; // Percentage (0-100)
  coordinates: Array<{
    atomIndex: number;
    element: string;
    x: number;
    y: number;
    z: number;
  }>;
  dihedralAngles?: Array<{
    atom1: number;
    atom2: number;
    atom3: number;
    atom4: number;
    angle: number;
  }>;
}

export interface VicinalCoupling {
  atoms: string; // e.g., "H0-C1-C2-H3"
  atom_indices: number[]; // [H1, C1, C2, H2]
  avg_dihedral_angle: number; // degrees
  predicted_J_Hz: number; // Karplus equation prediction
  angles_by_conformer?: Array<{
    conformer_id: number;
    angle: number;
    weight: number;
  }>;
}

export interface ConformerAnalysisResult {
  success: boolean;
  conformers: Conformer[];
  weightedAverage: {
    shift?: number;
    coupling?: number;
  };
  method: string;
  smiles?: string;
  totalConfsGenerated?: number;
  significantConfs?: number;
  globalMinEnergy?: number;
  vicinalCouplings?: VicinalCoupling[];
  topConformerMolBlock?: string;
  ensembleSummary?: Array<{
    id: number;
    energy: number;
    probability: number;
    weight: number;
  }>;
  warnings?: string[];
  error?: string;
}

// DFT Types
export interface DFTShift {
  atomIndex: number;
  shift: number;              // δ ppm (calculated)
  shielding: number;          // σ (shielding constant)
  method: string;            // 'GFN2-xTB + GIAO' | 'ORCA' | etc.
  confidence: number;         // 0-1
  element?: string;          // Atom sembolü (H, C, N, O)
}

export interface DFTVerificationResult {
  success: boolean;
  shifts: DFTShift[];
  method: string;
  computationTime: number;    // seconds
  optimized?: boolean;        // Geometri optimize edildi mi?
  linearScaling?: boolean;    // Lineer ölçekleme kullanıldı mı?
  warnings?: string[];
  error?: string;
}

// Vector Search Types
export interface VectorSearchResult {
  molecule: {
    name: string;
    smiles: string;
    formula: string;
    cid?: number;
  };
  similarity: number;
  spectrum?: {
    nmr?: Array<{ shift: number; integration: number; multiplicity: string }>;
    ftir?: Array<{ wavenumber: number; intensity: number }>;
    ms?: Array<{ mz: number; intensity: number }>;
  };
  metadata?: {
    reason?: string;
    abstract?: string;
    source?: string;
    [key: string]: any;
  };
}

export interface HybridSearchQuery {
  text?: string;              // Semantic text query
  smiles?: string;            // SMILES for structural search
  peaks?: Array<[number, number]>;  // NMR peaks: [[ppm, intensity], ...]
  weights?: {                // Search weights
    text?: number;
    struct?: number;
    spec?: number;
  };
  topK?: number;
  threshold?: number;
}

// Comprehensive Prediction Types
export interface ComprehensivePrediction {
  nmr?: {
    method: string;
    predictions: GNNPrediction[];
    modelVersion?: string;
  };
  ms?: {
    molecularIon: number;
    peaks: MSPeak[];
    method: string;
  };
  conformers?: {
    conformers: Conformer[];
    weightedAverage: {
      shift?: number;
      coupling?: number;
    };
    method: string;
  };
  dft?: {
    shifts: DFTShift[];
    method: string;
    computationTime: number;
  };
  similar?: {
    results: VectorSearchResult[];
    method: string;
  };
}

export interface ComprehensivePredictionResponse {
  success: boolean;
  predictions: ComprehensivePrediction;
  errors?: Record<string, string>;
  metadata: {
    version: string;
    timestamp: string;
    smiles: string;
    modules: {
      nmr: boolean;
      ms: boolean;
      conformers: boolean;
      dft: boolean;
      vectorSearch: boolean;
    };
  };
}

export * from './moleculeAuthority';

