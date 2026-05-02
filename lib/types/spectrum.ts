/**
 * SpectroMind v1.5 Spectrum Type Definitions
 *
 * Complete type system for NMR spectroscopy data
 * Supports 1H, 13C, and 2D NMR experiments
 *
 * @module types/spectrum
 * @version 1.5.0
 */

import { SolventType } from '../config/defaults';

// ============================================================================
// 1H NMR TYPES
// ============================================================================

export interface ProtonPeak {
  id: string;
  shift: number;              // ppm
  integration: number;         // Relative integration
  multiplicity: string;        // s, d, t, q, m, dd, etc.
  coupling?: number[];         // J coupling constants (Hz)
  purity_flag?: 'clean' | 'impurity' | 'artifact';
  assignment?: string;         // e.g., "H-2", "CH3"
}

// ============================================================================
// 13C NMR TYPES
// ============================================================================

export interface CarbonPeak {
  id: string;
  shift: number;              // ppm
  type: 'CH3' | 'CH2' | 'CH' | 'Cq'; // DEPT classification
  is_silent?: boolean;        // Silent Cq (no HMBC)
  assignment?: string;
}

// ============================================================================
// 2D NMR CORRELATION TYPES
// ============================================================================

export interface NOESYCorrelation {
  type: 'NOESY';
  proton1: string;            // Proton ID
  proton2: string;            // Proton ID
  intensity: number;          // Normalized 0-1
  distance_angstrom?: number; // Calculated distance
}

export interface HMBCCorrelation {
  type: 'HMBC';
  proton: string;             // Proton ID
  carbon: string;             // Carbon ID
  intensity: number;
  bonds?: number;             // 2J or 3J
}

export interface HSQCCorrelation {
  type: 'HSQC';
  proton: string;
  carbon: string;
  intensity: number;
}

export type TwoDCorrelation = NOESYCorrelation | HMBCCorrelation | HSQCCorrelation;

// ============================================================================
// MASS SPECTROMETRY TYPES
// ============================================================================

export interface MSFragment {
  mz: number;                 // m/z value
  fragment: string;           // SMILES or name
  intensity?: number;
  required: boolean;          // Must be present in structure
}

export interface MSData {
  molecular_ion?: number;
  active_constraints: MSFragment[];
}

// ============================================================================
// COMPLETE SPECTRAL DATA
// ============================================================================

export interface SpectralData {
  // 1H NMR
  proton_nmr?: ProtonPeak[];

  // 13C NMR
  carbon_nmr?: CarbonPeak[];

  // 2D Correlations
  correlations_2d?: TwoDCorrelation[];

  // Mass Spectrometry
  ms_data?: MSData;

  // Molecular Formula (if known)
  molecular_formula?: string;
}

// ============================================================================
// CHEMICAL CONTEXT
// ============================================================================

export interface ChemicalContext {
  solvent: SolventType;
  temperature_k: number;
  ph_estimate?: number;
  concentration_mm?: number;
}

// ============================================================================
// USER OVERRIDES
// ============================================================================

export interface UserOverrides {
  force_fragments?: string[];  // Force inclusion of SMARTS patterns
  ignore_peaks?: string[];     // Peak IDs to exclude
  lock_assignments?: Record<string, string>; // Lock peak assignments
}

// ============================================================================
// COMPLETE INPUT SCHEMA
// ============================================================================

export interface ElucidationInput {
  project_id: string;
  spectral_data: SpectralData;
  chemical_context: ChemicalContext;
  user_overrides?: UserOverrides;

  // Meta parameters (override defaults)
  meta_parameters?: {
    allow_mixtures?: boolean;
    impurity_threshold?: number;
    confidence_policy?: 'research' | 'patent' | 'quality_control';
    rmsd_tolerances?: Record<string, number>;
  };
}
