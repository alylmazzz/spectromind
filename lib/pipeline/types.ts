/**
 * SpectroMind Pipeline Types
 * 
 * Single Source of Truth type definitions for the molecule processing pipeline.
 * These types ensure consistency across all pipeline stages.
 */

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface MoleculeInput {
  /** PubChem Compound ID */
  cid?: number;
  
  /** Molecule name (common name, trade name, or IUPAC) */
  moleculeName?: string;
  
  /** IUPAC name (if known) */
  iupacName?: string;
  
  /** Molecular formula (e.g., "C47H51NO14") */
  formula?: string;
  
  /** InChI string */
  inchi?: string;
  
  /** SMILES string (canonical or isomeric) */
  smiles?: string;
  
  /** User's original query (for display) */
  userQuery?: string;
  
  /** Additional options */
  options?: {
    /** Preferred stereo policy */
    preferredStereoPolicy?: 'require_isomeric' | 'allow_canonical' | 'auto';
    
    /** Force refresh (bypass cache) */
    forceRefresh?: boolean;
  };
}

// ============================================================================
// IDENTITY RESULT
// ============================================================================

export interface IdentityResult {
  /** Resolved CID (if found) */
  cid?: number;
  
  /** Preferred name (IUPAC if available, else common name) */
  preferredName: string;
  
  /** IUPAC name (if resolved) */
  iupacName?: string;
  
  /** Molecular formula */
  formula?: string;
  
  /** InChI Key (for compound matching) */
  inchiKey?: string;
  
  /** Multiple candidates if ambiguous */
  candidates?: Array<{
    cid: number;
    name: string;
    formula?: string;
    score: number;
    matchReason: string;
  }>;
  
  /** Warnings during identity resolution */
  warnings: PipelineWarning[];
}

// ============================================================================
// STRUCTURE RESULT
// ============================================================================

export interface StructureResult {
  /** Canonical SMILES (always present if structure resolved) */
  canonicalSmiles: string | undefined;
  
  /** Isomeric SMILES (with stereochemistry) */
  isomericSmiles: string | undefined;
  
  /** InChI string */
  inchi: string | undefined;
  
  /** InChI Key */
  inchiKey: string | undefined;
  
  /** Stereochemistry status */
  stereoStatus: 'full' | 'partial' | 'none';
  
  /** Source of structure data */
  source: 'pubchem' | 'opsin' | 'user' | 'cached' | 'unknown';
  
  /** Structure hash (for caching/deduplication) */
  structureHash?: string;
  
  /** Warnings */
  warnings: PipelineWarning[];
  
  /** Atom counts (computed from structure) - SINGLE SOURCE OF TRUTH */
  atomCounts?: Record<string, number>; // e.g. {C:47, H:51, N:1, O:14}
  
  /** Molecular formula in Hill system (computed from atomCounts) */
  molecularFormulaHill?: string; // e.g. "C47H51NO14"
  
  /** Degree of unsaturation (DBE) computed from atomCounts */
  dbe?: number;
  
  /** Total hydrogen count from formula (atomCounts["H"] or 0) */
  totalHydrogenFromFormula?: number;
}

// ============================================================================
// GRAPH RESULT
// ============================================================================

export interface Atom2D {
  x: number;
  y: number;
}

export interface Atom3D {
  x: number;
  y: number;
  z: number;
}

export interface GraphAtom {
  id: string;
  symbol: string;
  formalCharge: number;
  implicitHydrogens: number;
  isAromatic: boolean;
  hybridization?: string;
}

export interface GraphBond {
  id: string;
  atom1Id: string;
  atom2Id: string;
  order: number;
  isAromatic: boolean;
}

export interface GraphResult {
  /** Source of graph data */
  graphSource: 'rdkit' | 'js';
  
  /** 2D coordinates (for depiction) */
  coords2d?: Atom2D[];
  
  /** 3D coordinates (for geometry calculations) */
  coords3d?: Atom3D[];
  
  /** Atoms (topology) */
  atoms: GraphAtom[];
  
  /** Bonds (topology) */
  bonds: GraphBond[];
  
  /** Molecular formula (backward compatibility - use molecularFormulaHill) */
  formula: string;
  
  /** Atom counts (computed from atoms) - SINGLE SOURCE OF TRUTH */
  atomCounts: Record<string, number>; // e.g. {C:47, H:51, N:1, O:14}
  
  /** Molecular formula in Hill system (computed from atomCounts) */
  molecularFormulaHill: string; // e.g. "C47H51NO14"
  
  /** Degree of unsaturation (DBE) computed from atomCounts */
  dbe: number;
  
  /** Total hydrogen count from formula (atomCounts["H"] or 0) */
  totalHydrogenFromFormula: number;
  
  /** Structure confidence (0.0 to 1.0) */
  structureConfidence: number;
  
  /** Limitations when using fallback parser */
  limitations: string[];
  
  /** Chiral centers (if detected) */
  chiralCenters?: Array<{
    atomIdx: number;
    type: 'R' | 'S' | 'unknown';
  }>;
}

// ============================================================================
// NMR PREDICTION RESULT
// ============================================================================

export interface NMRPeakPrediction {
  /** Chemical shift (ppm) */
  shift: number;
  
  /** Multiplicity (s, d, t, q, dd, dt, m, etc.) */
  multiplicity?: string;
  
  /** Integration (number of equivalent protons) */
  integration?: number;
  
  /** Coupling constants (Hz) - array for complex multiplicities */
  coupling?: number[];
  
  /** Assignment (e.g., "H-2", "CH3", "Aromatic ortho") */
  assignment?: string;
  
  /** Confidence (0.0 to 1.0) */
  confidence?: number;
  
  /** Source of this peak - MUST be set */
  source: 'model' | 'llm' | 'consensus';
}

/**
 * Deterministic NMR Prediction (rule-based/model-based)
 */
export interface DeterministicPrediction {
  /** Method used (e.g., "shoolery+karplus", "shoolery-only") */
  method: string;
  
  /** Explicit assumptions/warnings */
  assumptions: string[];
  
  /** Predicted peaks */
  peaks: NMRPeakPrediction[];
  
  /** Overall confidence */
  confidence: number;
}

/**
 * LLM Interpretation (AI-generated, not simulation)
 */
export interface LLMInterpretation {
  /** Model name used */
  model: string;
  
  /** Prompt version identifier */
  promptVersion: string;
  
  /** Interpretation notes */
  notes?: string;
  
  /** Literature insights */
  literatureInsights?: string;
  
  /** Optional peaks (if LLM returns them) */
  peaks?: NMRPeakPrediction[];
  
  /** Confidence in interpretation */
  confidence?: number;
}

/**
 * Final Consensus (merged result)
 */
export interface FinalConsensus {
  /** Fusion method */
  method: 'model-only' | 'llm-only' | 'fusion';
  
  /** Merged peaks */
  peaks: NMRPeakPrediction[];
  
  /** Rationale for fusion */
  rationale?: string;
  
  /** Overall confidence */
  confidence: number;
}

export interface NMRPredictionResult {
  /** Deterministic model prediction (Shoolery, Karplus, etc.) */
  modelPrediction: DeterministicPrediction;
  
  /** LLM interpretation (if available) */
  llmInterpretation?: LLMInterpretation;
  
  /** Final consensus (combined result) */
  finalConsensus: FinalConsensus;
  
  /** Warnings */
  warnings: Array<{ code: string; message: string }>;
  
  /** Solvent used */
  solvent?: string;
  
  /** Frequency (MHz) */
  frequency?: number;
}

// ============================================================================
// FID COMPARISON RESULT
// ============================================================================

export interface FIDComparisonResult {
  /** Experimental peaks from FID */
  experimentalPeaks: Array<{
    ppm: number;
    height: number;
    area: number;
  }>;
  
  /** Match report */
  matchReport: {
    matched: Array<{
      experimental: number;
      theoretical: number;
      delta: number;
      type: 'MOLECULE_PEAK';
    }>;
    missing: Array<{
      ppm: number;
      type: 'MISSING';
    }>;
    impurity: Array<{
      ppm: number;
      height: number;
      type: 'IMPURITY_OR_SOLVENT';
    }>;
    matchRate: number;
  };
  
  /** FID processing metadata */
  fidMetadata?: {
    sw_hz?: number;
    sw_ppm?: number;
    sfo1_mhz?: number;
    o1_hz?: number;
    ref_ppm?: number;
  };
}

// ============================================================================
// PIPELINE RESULT
// ============================================================================

export interface ConfidenceBreakdown {
  /** Structure confidence (0.0 to 1.0) */
  structureConfidence: number;
  
  /** Stereochemistry confidence */
  stereoConfidence: number;
  
  /** NMR prediction confidence */
  predictionConfidence: number;
  
  /** FID quality (if FID processed) */
  fidQuality?: number;
}

export interface PipelineWarning {
  /** Warning code */
  code: string;

  /** Human-readable message */
  message: string;

  /** Stage where warning occurred */
  stage: 'identity' | 'structure' | 'graph' | 'nmr' | 'fid';

  /** Severity */
  severity?: 'low' | 'medium' | 'high';
}

// ============================================================================
// WARNING CODES
// ============================================================================

export const WARNING_CODES = {
  /** Formula from identity doesn't match graph-computed formula */
  FORMULA_MISMATCH: 'FORMULA_MISMATCH',

  /** Identity resolution drifted from original input */
  IDENTITY_DRIFT_DETECTED: 'IDENTITY_DRIFT_DETECTED',

  /** Multiple candidates found during identity resolution */
  AMBIGUOUS_IDENTITY: 'AMBIGUOUS_IDENTITY',

  /** Structure resolution failed, using fallback */
  STRUCTURE_FALLBACK: 'STRUCTURE_FALLBACK',

  /** Stereochemistry could not be fully resolved */
  STEREO_UNRESOLVED: 'STEREO_UNRESOLVED',

  /** NMR prediction used model-only (no LLM) */
  NMR_MODEL_ONLY: 'NMR_MODEL_ONLY',

  /** FID processing had quality issues */
  FID_QUALITY_LOW: 'FID_QUALITY_LOW',
} as const;

export interface PipelineResult {
  /** Original input */
  input: MoleculeInput;
  
  /** Identity resolution result */
  identity: IdentityResult;
  
  /** Structure resolution result */
  structure: StructureResult;
  
  /** Graph building result */
  graph: GraphResult;
  
  /** NMR prediction (if requested) */
  nmr?: NMRPredictionResult;
  
  /** FID comparison (if requested) */
  fid?: FIDComparisonResult;
  
  /** All warnings */
  warnings: PipelineWarning[];
  
  /** Provenance (source chain) */
  provenance: {
    sourceChain: string[];
    timestamps: Record<string, string>;
  };
  
  /** Confidence breakdown */
  confidence: ConfidenceBreakdown;
}

// ============================================================================
// PROCESSING SPEC (for FID consistency)
// ============================================================================

export interface FIDProcessingSpec {
  apodization: {
    type: 'exponential' | 'none';
    lb_hz: number;
  };
  zeroFill: {
    factor: number;
  };
  fft: {
    mode: 'standard' | 'complex';
  };
  phase: {
    method: 'auto' | 'manual';
    ph0?: number;
    ph1?: number;
  };
  baseline: {
    method: 'polynomial' | 'asls' | 'airpls';
    polyOrder?: number;
  };
  peak: {
    method: 'simple' | 'snr';
    threshold?: number;
    distance?: number;
  };
}
