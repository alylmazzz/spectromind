/**
 * Unified schemas for SpectroMind + Spectrotester integration.
 * Shared by TS (Next.js) and target for Python JSON schema alignment.
 */

// ----- Policy -----
export interface MoleculeStandardizationPolicy {
  kekulize?: boolean;
  aromatize?: boolean;
  tautomer?: 'none' | 'default' | 'canonical';
  protomer?: 'none' | 'default';
}

// ----- Graph (Chem Core output) -----
export interface AtomInGraph {
  index: number;
  symbol: string;
  aromatic: boolean;
  implicit_h?: number;
  charge?: number;
}

export interface BondInGraph {
  from: number;
  to: number;
  order: number;
  aromatic?: boolean;
}

export interface MoleculeGraph {
  canonical_smiles: string;
  inchi?: string;
  inchikey?: string;
  formula: string;
  exact_mass: number;
  atoms: AtomInGraph[];
  bonds: BondInGraph[];
  aromatic_flags?: boolean[]; // per-atom
  stereo?: string;
  charge?: number;
}

// ----- Features (expected set for QC) -----
export interface MoleculeFeatures {
  nC_total: number;
  nH_total: number;
  DBE: number;
  nC_aromatic: number;
  nH_aromatic: number;
  nC_carbonyl?: number;
  nC_protonated?: number; // CH + CH2 + CH3
  nH_exchangeable?: number;
  symmetry_classes?: number;
  [key: string]: number | undefined;
}

// ----- Unified spectrum (1D: peaks + sim curve) -----
export interface Peak1D {
  ppm_or_mz: number;
  intensity?: number;
  integ?: number;
  mult?: string;
  label?: string;
}

export interface SimCurve {
  x: number[];
  y: number[];
}

export interface NMR1DSpectrum {
  peaks: Peak1D[];
  sim?: SimCurve;
  solvent?: string;
  frequency_MHz?: number;
}

export interface IRSpectrum {
  bands: Array<{ cm1: number; intensity: number; assignment?: string }>;
  sim?: SimCurve;
}

export interface MSSpectrum {
  peaks: Peak1D[];
  isotope_envelopes?: Array<{ mz: number[]; intensity: number[] }>;
  sim?: SimCurve;
}

export interface Peak2D {
  x: number;  // e.g. δH
  y: number;  // e.g. δC
  intensity?: number;
  type?: string;
}

export interface NMR2DSpectrum {
  hsqc?: Peak2D[];
  cosy?: Peak2D[];
  hmbc?: Peak2D[];
}

export interface UnifiedSpectrum {
  nmr1h?: NMR1DSpectrum;
  nmr13c?: NMR1DSpectrum;
  ir?: IRSpectrum;
  ms?: MSSpectrum;
  nmr2d?: NMR2DSpectrum;
  source_engine?: 'spectromind' | 'spectrotester' | 'hybrid';
}

// ----- QC -----
export type QCStatus = 'PASS' | 'WARN' | 'FAIL' | 'FATAL';

export interface QCRuleResult {
  rule_id: string;
  status: QCStatus;
  evidence?: string;
  suggested_action?: string;
  rule_trace?: string;
}

export interface QCReport {
  overall: QCStatus;
  rules: QCRuleResult[];
  score?: number;
  coverage?: number;
  confidence?: number;
}

// ----- Verification Report -----
export type VerificationStatus = 'PASS' | 'WARN' | 'FAIL' | 'INCONCLUSIVE' | 'SKIP' | 'NOT_APPLICABLE';

export interface RuleEvidence {
  rule_id: string;
  modality: string;
  status: VerificationStatus;
  evidence: Record<string, unknown>;
  why?: string;
  suggested_action?: string;
  scientific_basis?: string;
  trace_keys?: string[];
}

export interface ModalitySummary {
  modality: string;
  status: VerificationStatus;
  rules_evaluated: number;
  rules_passed: number;
  rules_failed: number;
  rules_warned: number;
  key_evidence: RuleEvidence[];
}

export interface VerificationReport {
  status: VerificationStatus;
  overall: VerificationStatus;
  summary: string;
  confidence_score: number;
  coverage_score: number;
  modality_summaries: ModalitySummary[];
  rule_results: RuleEvidence[];
  contradictions: Array<{ description: string; modalities: string[]; severity: 'high' | 'medium' | 'low' }>;
  engine_used: string;
  rulepack_version: string;
  parameter_profile: string;
  artifact_hashes: Record<string, string>;
  provenance: {
    kernel_version: string;
    timestamp: string;
    inputs_echo: Record<string, unknown>;
  };
}

// ----- Elucidation -----
export interface CandidateHypothesis {
  rank: number;
  smiles: string;
  name?: string;
  formula: string;
  exactMass: number;
  source: 'database' | 'generated' | 'pubchem' | 'library';
  scores: CandidateScoreBreakdown;
  forwardSpectra?: UnifiedSpectrum;
  contradictions: string[];
  supporting_evidence: string[];
}

export interface CandidateScoreBreakdown {
  total: number;
  formula_score: number;
  nmr_shift_score: number;
  multiplicity_score: number;
  c13_score: number;
  hsqc_coverage: number;
  cosy_coverage: number;
  hmbc_coverage: number;
  ftir_score: number;
  ms_score: number;
  cross_modal_score: number;
}

export interface ElucidationReport {
  status: 'resolved' | 'ambiguous' | 'inconclusive' | 'no_candidates';
  top_candidate: CandidateHypothesis | null;
  alternatives: CandidateHypothesis[];
  constraints_used: {
    formula_candidates: string[];
    dbe_range: [number, number];
    functional_groups_required: string[];
    functional_groups_forbidden: string[];
  };
  data_quality: {
    modalities_provided: string[];
    modalities_missing: string[];
    overall_quality: 'high' | 'medium' | 'low';
  };
}

// ----- Benchmark -----
export interface BenchmarkCase {
  id: string;
  name: string;
  smiles: string;
  formula: string;
  category: string;
  expected_dbe: number;
  expected_h_count: number;
  expected_c_count: number;
  observed_spectra?: {
    h1_peaks?: Array<{ ppm: number; integral?: number; mult?: string }>;
    c13_peaks?: Array<{ ppm: number }>;
    ir_bands?: Array<{ cm: number; intensity?: string }>;
    ms_peaks?: Array<{ mz: number; intensity: number }>;
  };
  expected_verdict?: VerificationStatus;
  tags: string[];
}

// ----- Calibration -----
export interface CalibrationProfile {
  id: string;
  name: string;
  solvent: string;
  fieldMHz: number;
  temperature_K: number;
  reference_standard: string;
  ppm_tolerance: number;
  j_tolerance_hz: number;
  mz_tolerance_ppm: number;
  ir_band_tolerance_cm: number;
  ionization_mode?: 'EI' | 'ESI+' | 'ESI-' | 'APCI' | 'MALDI';
}

// ----- Processing Provenance -----
export interface ProcessingProvenance {
  source_file?: string;
  processing_steps: string[];
  software_version: string;
  timestamp: string;
  parameters: Record<string, unknown>;
  hash?: string;
}

// ----- Audit Trace -----
export interface AuditTrace {
  trace_id: string;
  timestamp: string;
  action: string;
  module: string;
  inputs_hash: string;
  outputs_hash: string;
  parameters_version: string;
  rulepack_version: string;
  duration_ms: number;
}
