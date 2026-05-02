// Spectrum Types
export type SpectrumType = 'nmr' | 'ftir' | 'c13' | 'ms';
export type Multiplicity = 
  // Basit multiplisiteler
  | 's' | 'd' | 't' | 'q' | 'quint' | 'sext' | 'sept' | 'oct' | 'non'
  // İkili kombinasyonlar
  | 'dd' | 'dt' | 'td' | 'dq' | 'qd' | 'tt' | 'tq' | 'qt' | 'qq'
  // Üçlü kombinasyonlar
  | 'ddd' | 'ddt' | 'dtd' | 'tdd' | 'dtt' | 'tdt' | 'ttd' | 'ttt' | 'ddq' | 'dqd' | 'qdd'
  // Dörtlü kombinasyonlar
  | 'dddd' | 'dddt' | 'ddtd' | 'dtdd' | 'tddd'
  // Broad peaks
  | 'm' | 'br' | 'br s' | 'br d' | 'br t' | 'br q' | 'br m'
  // Apparent multiplicities
  | 'app t' | 'app q' | 'app d'
  // Legacy
  | 'sep';
export type AIProvider = 'gemini' | 'chatgpt';

// Peak Interfaces
export interface NMRPeak {
  shift: number;
  integ: number;
  mult: Multiplicity | string;
  coupling?: number | number[]; // Single J value or array for multiple couplings (dd, dt, td, etc.)
  isSolvent?: boolean;
  isBroad?: boolean;
  label?: string;
  integOriginal?: number; // Original integration before normalization
  source?: {
    moleculeName: string;
    cid?: number;
  }; // Hangi molekülden geldiğini takip et (karışım analizi için)
  /** FID otomatik pik: Lorentzian simülasyon genliği (API height ile aynı birim; oranlar korunur) */
  fidPickIntensity?: number;
  /** FID integral alanı (ham) */
  fidPickArea?: number;
  /** Lorentzian yarı yükseklik genişliği (ppm); verilmezse dar/isBroad’a göre varsayılan */
  lorentzianGammaPpm?: number;
  /** FID’den gelen yoğun piklerde grafik etiketi çizme (çizgi yine çizilir) */
  hideChartLabel?: boolean;
  /** Region/deconvolution-aware peak metadata (authoritative observed). */
  fidRegionId?: string;
  fidOverlapFlag?: boolean;
  fidLinewidthEstimate?: number;
  fidShapeModel?: string;
  fidFitResidual?: number;
  fidConfidence?: number;
}

export interface FTIRPeak {
  wavenumber: number;
  intensity: number; // 0-100
  type: 'strong' | 'medium' | 'weak';
  width?: number;
  label?: string;
  assignment?: string;
}

// Carbon-13 NMR Peak (alias for frontend compatibility)
export interface Carbon13Peak {
  ppm: number;
  intensity?: number;
  multiplicity?: string; // From DEPT: s, d, t, q
  coupling?: number;
  label?: string;
  carbonType?: 'CH3' | 'CH2' | 'CH' | 'Cq'; // DEPT classification
  assignment?: string; // e.g., "C-1", "C=O"
  isSolvent?: boolean;
  deptPhase?: number; // DEPT-135: +1 (CH3/CH), -1 (CH2), 0 (Cq/solvent)
  id?: string;
  assignment_label?: string;
  assignment_class?: string;
  confidence?: number;
  evidence_type?: string;
  residual_flag?: boolean;
  analyte_flag?: boolean;
  explanation_short?: string;
}

// MS (Mass Spectrometry) Peak
export interface MSPeak {
  mz: number;              // Mass-to-charge ratio
  intensity: number;       // Relative intensity (0-100)
  assignment: string;      // Fragment assignment (e.g., "M+", "[M+H]+", "Fragment")
  formula?: string;        // Fragment formula
  charge?: number;         // Charge state (default: 1)
  type?: string;           // 'M+', '[M+H]+', 'Fragment', etc.
}

// Molecule Interfaces
export interface Molecule {
  name: string;
  formula?: string;
  nmr?: string;
  structure?: string;
  category?: string;
  peaks?: NMRPeak[];
}

// Library Match Interface
export interface LibraryMatch {
  molecule: Molecule;
  score: number;
  matchedPeaks: number;
  totalPeaks: number;
  explanation?: string;
}

/** Tek yüzeyden beslenen nihai teyit nesnesi (verdict / kimlik parity kilidi). */
export interface FinalVerdict {
  final_candidate: string;
  final_confidence: number;
  verdict_mode:
    | 'EXACT_ID_CONFIDENCE_CEILING'
    | 'CLASS_LEVEL'
    | 'INCONCLUSIVE'
    | 'PASS'
    | 'WARN';
  verdict_reason: string;
  exact_id_active: boolean;
  confidence_ceiling_applied: boolean;
  /** Üst kart / özet için görünür durum (QC tavanı kimliği düşürmez). */
  display_verification_status: 'PASS' | 'WARN' | 'INCONCLUSIVE';
  source_object_id: string;
  parity_guard_status: boolean;
  authority_guard_status: boolean;
  exact_id_gate_status: boolean;
  residual_mask_status: boolean;
  benzoic_veto_status: boolean;
  ftir_override_block_status: boolean;
  /** Kimlik yüzeyi — tüm UI/export/chat bu alanlardan türetilmeli (LOCKED iken zorunlu). */
  final_formula?: string;
  final_iupac?: string;
  final_smiles?: string;
  /** Örn. PUBCHEM_CID_10494_EXACT_ID_LOCK | analysis_sot | DISPLAY_ONLY_FALLBACK */
  final_identity_source?: string;
  parity_status: 'LOCKED' | 'OPEN' | 'DRIFT_DETECTED';
  authority_status: 'AUTHORITATIVE' | 'DEGRADED' | 'FALLBACK';
  verdict_source?: string;
  fallback_leak_detected?: boolean;
  authority_breach_detected?: boolean;
}

// AI Analysis Result
export interface AIAnalysisResult {
  moleculeName: string;
  iupacName?: string;
  formula: string;
  structure?: string;
  smiles?: string; // SMILES notation for unknown molecules
  confidence: number;
  reasoning: string;
  cid?: number | null;
  functionalGroups?: string[];
  predicted_ftir?: FTIRPeak[];
  alternatives?: Array<{
    moleculeName: string;
    iupacName?: string;
    cid?: number | null;
    confidence: number;
    reasoning?: string;
  }>;
  verificationStatus?: 'PASS' | 'WARN' | 'INCONCLUSIVE';
  verificationNotes?: string[];
  verificationRuleIds?: string[];
  spectralInterpretation?: SpectralInterpretationSummary;
  contentConsistency?: {
    title_source: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
    body_source: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
    summary_source: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
    source_mismatch: boolean;
    mismatch_items: string[];
    severity: 'INFO' | 'WARN' | 'ERROR';
  };
  contradictionPanel?: {
    items: Array<{
      id: string;
      title: string;
      detail: string;
      evidence?: string;
      severity: 'INFO' | 'WARN' | 'ERROR';
      impacts_confidence: boolean;
      impacts_verdict: boolean;
    }>;
    has_blocking_contradiction: boolean;
  };
  /** Tüm yüzeylerin (başlık, yapı kartı, özet, dışa aktarım) türetilmesi gereken tek kaynak-of-truth. */
  final_verdict?: FinalVerdict;
  /** AI aracılığıyla yapılan analizin kaynağı – örn. polymer-class, pubchem, vs. */
  source?: string;
}

export type InterpretationAuthoritySource =
  | 'AUTHORITATIVE_OBSERVED'
  | 'OBSERVED_PROCESSED_FID'
  | 'FID_DERIVED_HELPER'
  | 'DISPLAY_ONLY_FALLBACK'
  | 'SIMULATED_STRUCTURE_MODEL';

export type InterpretationQCDurum =
  | 'PASS'
  | 'WARN'
  | 'FAIL_WITH_CONFIDENCE_CEILING';

export interface InterpretedCandidate {
  ppm?: number;
  region?: string;
  label: string;
  confidence: number;
  reason?: string;
}

export interface SpectralInterpretationSummary {
  authority_source: InterpretationAuthoritySource;
  qc_status: InterpretationQCDurum;
  confidence_ceiling: number;
  polymer_mode?: boolean;
  interpretation_mode?: 'polymer_mode' | 'small_molecule_mode';
  polymer_mode_triggered?: boolean;
  solvent_context?: string;
  solvent_candidates: InterpretedCandidate[];
  residual_regions?: InterpretedCandidate[];
  artifact_candidates?: InterpretedCandidate[];
  molecule_regions: InterpretedCandidate[];
  analyte_regions?: InterpretedCandidate[];
  polymer_anchor_regions?: InterpretedCandidate[];
  candidate_structures_ranked?: Array<{
    name: string;
    support: number;
    contradictions?: string[];
    demoted?: boolean;
    demotion_reason?: string;
  }>;
  uncertain_regions: InterpretedCandidate[];
  cross_modal_anchors?: Array<{
    h1_region?: string;
    c13_region?: string;
    label: string;
    confidence: number;
    reason?: string;
  }>;
  structure_candidates?: Array<{
    name: string;
    support: number;
    contradictions?: string[];
  }>;
  contradiction_analysis?: string[];
  exact_id_eligibility?: {
    eligible: boolean;
    candidate?: string;
    reasons: string[];
  };
  confidence_ceiling_reason?: string;
  title_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  body_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  summary_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  export_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  structure_card_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  depiction_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  formula_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  iupac_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  smiles_source?: InterpretationAuthoritySource | 'analysis_sot' | 'verification_report' | string;
  evidence_version?: string;
  lineage_id?: string;
  next_best_actions: string[];
  runtime_rules: string[];
  c13_assignments?: Carbon13Peak[];
}

// API Configuration
export interface APIKeys {
  gemini: string;
  openai: string;
}

// Solvent Data
export interface SolventData {
  res: number;
  water: number;
  label: string;
}

export type Solvent = 'CDCl3' | 'DMSO' | 'Acetone' | 'D2O' | 'MeOD' | 'C6D6' | 'CD2Cl2' | 'CD3CN' | 'THF-d8' | 'Toluene-d8' | 'Pyridine-d5' | 'DMF-d7' | 'AcOH-d4' | 'TFA-d';
export type Frequency = '300MHz' | '400MHz' | '500MHz' | '600MHz';

// App State
export interface AppState {
  peaks: NMRPeak[];
  ftirPeaks: FTIRPeak[];
  currentPeakLabels: Record<string, string>;
  currentFTIRPeakLabels: Record<string, string>;
  selectedSolvent: Solvent;
  frequency: number;
  aiProvider: AIProvider;
  model: string;
}

// Enhanced Library Entry (AI sonuçlarıyla birlikte) - DEPRECATED v1.0
export interface EnhancedLibraryEntryV1 {
  moleculeName: string;
  peaks: NMRPeak[];
  aiResult: AIAnalysisResult;
  imageUrl?: string;
  timestamp: number;
  usageCount: number;
}

// Enhanced Library v2.0 - Solvent/Frequency Aware
export interface EnhancedLibraryAnalysis {
  id: string; // "nmr_DMSO_300" formatında
  spectrumType: 'nmr' | 'ftir' | 'c13';
  solvent: Solvent;
  frequency: number; // 300, 400, 500, 600
  peaks: NMRPeak[];
  aiResult: AIAnalysisResult;
  timestamp: number;
  usageCount: number;
}

export interface EnhancedLibraryMolecule {
  cid?: number | null;
  imageUrl?: string;
  analyses: EnhancedLibraryAnalysis[];
}

// Enhanced Library Storage v2.0
export interface EnhancedLibrary {
  molecules: Record<string, EnhancedLibraryMolecule>; // Key = molecule name
  version: string;
  provider?: string;
  lastUpdated: number;
}

// Backward compatibility type for v1.0
export interface EnhancedLibraryV1 {
  entries: EnhancedLibraryEntryV1[];
  version: string;
  provider?: string;
  lastUpdated: number;
}
