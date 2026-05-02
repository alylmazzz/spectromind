/**
 * SpectroMind v1.5 Molecule Type Definitions
 *
 * Types for molecular structures, fragments, and elucidation results
 *
 * @module types/molecule
 * @version 1.5.0
 */

// ============================================================================
// FRAGMENT TYPES
// ============================================================================

export interface Fragment {
  type: string;               // e.g., "Aldehyde CHO", "Benzene Ring"
  smarts: string;             // SMARTS pattern
  priority: number;           // Higher = more reliable
  reasoning: string;          // Why detected
}

// ============================================================================
// CANDIDATE MOLECULE
// ============================================================================

export interface Candidate {
  smiles: string;
  name: string;
  iupac?: string;
  formula: string;
  score: number;              // 0-100
  reasoning: string;

  // v1.5 additions
  predicted_spectrum?: {
    proton_shifts: number[];
    carbon_shifts?: number[];
    rmsd: number;
    rmsd_class: 'aromatic' | 'aliphatic' | 'heterocyclic' | 'carbonyl';
  };

  validation_flags?: {
    passes_sanity: boolean;
    bredt_rule_ok: boolean;
    valence_ok: boolean;
    strain_energy?: number;
  };
}

// ============================================================================
// MIXTURE COMPONENT
// ============================================================================

export interface MixtureComponent {
  type: 'major' | 'minor';
  percentage: number;         // Estimated %
  peaks: string[];            // Peak IDs
  candidate?: Candidate;
}

// ============================================================================
// ELUCIDATION RESULT
// ============================================================================

export interface ElucidationResult {
  success: boolean;
  version: string;            // "1.5.0"

  // Detected fragments
  fragments?: Fragment[];

  // Candidate molecules
  candidates?: Candidate[];

  // Best candidate
  best?: Candidate | null;

  // Mixture analysis
  mixture?: {
    detected: boolean;
    components: MixtureComponent[];
    impurities: string[];     // Peak IDs of impurity peaks
  };

  // Metadata
  peak_count?: number;
  target_formula?: string;
  confidence_score?: number;
  confidence_policy?: string;

  // Decision
  decision: 'DETERMINED' | 'INDETERMINATE' | 'REJECTED';
  decision_reason?: string;

  // Error handling
  error?: string;
  warnings?: string[];
  stderr?: string;
}

// ============================================================================
// ENGINE STATUS
// ============================================================================

export interface EngineStatus {
  mixture_detector: boolean;
  carbon_skeleton: boolean;
  forward_predictor: boolean;
  solvent_physics: boolean;
  correlations_2d: boolean;
  certified_validator: boolean;
}
