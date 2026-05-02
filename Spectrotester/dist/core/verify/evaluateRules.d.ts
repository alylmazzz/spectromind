/**
 * Rule engine: evaluate ALL ruleset rules against context with real evaluators.
 * NO rule may silently PASS without evaluation.
 * Every result carries structured evidence.
 *
 * If a rule lacks observed data (e.g., no COSY peaks provided), it returns SKIP
 * with explicit reason — never a false PASS.
 */
import type { GraphFeatures } from '../graph/features';
import type { RuleEntry } from '../library/loadRules';
export interface ObservedPeak {
    ppm: number;
    integral?: number;
    mult?: string;
    j?: number[];
    assignment?: string;
    width?: number;
}
export interface Observed2DPeak {
    f1: number;
    f2: number;
    intensity?: number;
    assignment?: string;
}
export interface ObservedIRBand {
    cm: number;
    intensity?: 'strong' | 'medium' | 'weak' | 'broad' | string;
    assignment?: string;
}
export interface ObservedMSPeak {
    mz: number;
    intensity: number;
    assignment?: string;
}
export interface EvalContext {
    engineId: string;
    graphFeatures: GraphFeatures;
    canonicalSmiles: string;
    dbeValue?: number;
    formulaRef?: string;
    atomCounts?: Record<string, number>;
    h1?: {
        peaks?: ObservedPeak[];
    };
    c13Signals?: number;
    c13Peaks?: ObservedPeak[];
    hsqcPeaks?: Observed2DPeak[];
    cosyPeaks?: Observed2DPeak[];
    hmbcPeaks?: Observed2DPeak[];
    noesyPeaks?: Observed2DPeak[];
    ftirPeaks?: ObservedIRBand[];
    msPeaks?: ObservedMSPeak[];
    integralMode?: 'absolute_h' | 'relative_area';
    solvent?: string;
    fieldMHz?: number;
    ionMode?: 'positive' | 'negative' | 'EI';
    snrClass?: 'normal' | 'lowSNR' | 'highRes';
    thresholdProfile?: string;
    observedSpectra?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
export interface EvalMetadataContract {
    provenance_type?: 'observed' | 'simulated' | 'library' | 'hybrid' | string;
    engine_used?: string;
    solvent_name?: string;
    field_mhz?: number;
    temperature_c?: number;
    concentration?: number;
    reference_standard?: string;
    snr_class?: string;
    tolerance_profile_id?: string;
    exchangeable_policy?: string;
    raw_complex_fid_present?: boolean;
    sweep_width_hz?: number;
    apodization_type?: string;
    zero_fill_factor?: number;
    phase0_deg?: number;
    phase1_deg?: number;
    baseline_rms?: number;
    reference_target_ppm?: number;
    observed_reference_ppm?: number;
    d1_relaxation_time_s?: number;
    dept_or_apt_available?: boolean;
    F1_tolerance_ppm?: number;
    F2_tolerance_ppm?: number;
    edited_hsqc_flag?: boolean;
    mixing_time_ms?: number;
    conformer_ensemble_size?: number;
    sampling_mode?: string;
    spectral_resolution_cm_1?: number;
    atmospheric_compensation_flag?: boolean;
    ion_mode?: string;
    ppm_tolerance?: number;
    charge_state?: number;
    isotope_spacing_da?: number;
    collision_energy?: number;
    in_source_CID_flag?: boolean;
    allowed_adduct_set?: string[];
    exact_mass_source?: string;
}
export type RuleEvalStatus = 'PASS' | 'WARN' | 'FAIL' | 'SKIP' | 'NOT_APPLICABLE' | 'INCONCLUSIVE' | 'FATAL' | 'INFO' | 'ERROR' | 'NOT_EVALUATED';
export interface RuleEvalResult {
    rule_id: string;
    status: RuleEvalStatus;
    evidence: Record<string, unknown>;
    why?: string;
    suggested_action?: string;
    autofix?: {
        patch_type?: string;
        patch_hint?: string;
    };
    rule_version?: string;
}
export declare function evaluateRules(rules: RuleEntry[], ctx: EvalContext): RuleEvalResult[];
/**
 * Get the rule dependency graph for documentation/auditing.
 */
export declare function getRuleDependencyGraph(): {
    prerequisites: Record<string, string[]>;
    conflicts: Array<[string, string, string]>;
};
/**
 * Generate a coverage report showing which rules have evaluators.
 */
export declare function generateCoverageReport(rules: RuleEntry[]): {
    total: number;
    implemented: number;
    missing: string[];
    coverage: number;
};
