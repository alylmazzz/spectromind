/**
 * FID Processing Specification
 * 
 * Single source of truth for FID processing parameters.
 * Ensures consistency between server (Python) and client (Pyodide worker).
 */

export type ApodizationType = 'exponential' | 'none';
export type FFTMode = 'complex' | 'magnitude' | 'real';
export type PhaseMethod = 'manual' | 'auto-acme' | 'auto-peakmax';
export type BaselineMethod = 'poly' | 'asls' | 'airpls' | 'none';
export type PeakPickingMethod = 'snr' | 'fixed';
export type ReferencingMethod = 'none' | 'solvent';

export interface FIDProcessingSpec {
  /** Specification version */
  version: '1.0';
  
  /** Apodization (line broadening) */
  apodization?: {
    type: ApodizationType;
    lb_hz?: number; // Line broadening in Hz
  };
  
  /** Zero filling */
  zeroFill?: {
    factor: number; // 1, 2, 4, etc.
  };
  
  /** FFT mode */
  fft?: {
    mode: FFTMode;
  };
  
  /** Phase correction */
  phase?: {
    method: PhaseMethod;
    ph0_deg?: number; // 0th order phase (degrees)
    ph1_deg?: number; // 1st order phase (degrees)
  };
  
  /** Baseline correction */
  baseline?: {
    method: BaselineMethod;
    polyOrder?: number; // For polynomial baseline
  };
  
  /** Peak picking */
  peakPicking?: {
    method: PeakPickingMethod;
    snrK?: number; // SNR threshold multiplier (for snr method)
    fixedThreshold?: number; // Fixed threshold (for fixed method)
    minDistancePts?: number; // Minimum distance between peaks (points)
    prominence?: number; // Peak prominence (0-1)
  };
  
  /** Referencing */
  referencing?: {
    method: ReferencingMethod;
    solvent?: string; // e.g., 'CDCl3', 'DMSO-d6'
    refPpm?: number; // Manual reference ppm
  };
}

/**
 * Default processing specification
 */
export const defaultProcessingSpec: FIDProcessingSpec = {
  version: '1.0',
  apodization: {
    type: 'exponential',
    lb_hz: 0.3
  },
  zeroFill: {
    factor: 2
  },
  fft: {
    mode: 'complex' // Keep complex until after phase correction
  },
  phase: {
    method: 'auto-peakmax' // Fallback to peakmax if ACME not available
  },
  baseline: {
    method: 'poly',
    polyOrder: 3
  },
  peakPicking: {
    method: 'snr',
    snrK: 5.0,
    minDistancePts: 10,
    prominence: 0.1
  },
  referencing: {
    method: 'solvent',
    solvent: 'CDCl3' // Default
  }
};

/**
 * Solvent reference ppm values
 */
export const SOLVENT_REFERENCES: Record<string, number> = {
  'CDCl3': 7.26,
  'DMSO-d6': 2.50,
  'D2O': 4.79,
  'MeOD': 3.31,
  'Acetone-d6': 2.05,
  'TMS': 0.0
};

/**
 * Merge user spec with defaults
 */
export function mergeSpec(userSpec: Partial<FIDProcessingSpec>): FIDProcessingSpec {
  return {
    ...defaultProcessingSpec,
    ...userSpec,
    apodization: {
      ...defaultProcessingSpec.apodization,
      ...userSpec.apodization,
    } as { type: ApodizationType; lb_hz?: number },
    zeroFill: {
      ...defaultProcessingSpec.zeroFill,
      ...userSpec.zeroFill,
    } as { factor: number },
    fft: {
      ...defaultProcessingSpec.fft,
      ...userSpec.fft,
    } as { mode: FFTMode },
    phase: {
      ...defaultProcessingSpec.phase,
      ...userSpec.phase,
    } as { method: PhaseMethod; ph0_deg?: number; ph1_deg?: number },
    baseline: {
      ...defaultProcessingSpec.baseline,
      ...userSpec.baseline,
    } as { method: BaselineMethod; polyOrder?: number },
    peakPicking: {
      ...defaultProcessingSpec.peakPicking,
      ...userSpec.peakPicking,
    } as { method: PeakPickingMethod; snrK?: number; fixedThreshold?: number; minDistancePts?: number; prominence?: number },
    referencing: {
      ...defaultProcessingSpec.referencing,
      ...userSpec.referencing,
    } as { method: ReferencingMethod; solvent?: string; refPpm?: number },
  };
}
