/**
 * NMR Engine Service - TypeScript Client
 * 
 * FastAPI microservice'e HTTP istekleri gönderir
 */

export interface NMREngineConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface NMRPredictionRequest {
  smiles: string;
  spectrum_type?: '1H' | '13C' | 'both';
  method?: 'hose' | 'gnn' | 'hybrid';
  solvent?: string;
  temperature?: number;
  frequency?: number;
}

export interface NMRPeak {
  shift: number;
  integration: number;
  multiplicity: string;
  assignment: string;
  coupling?: Record<string, number>;
}

export interface NMRPredictionResponse {
  success: boolean;
  h1_peaks?: NMRPeak[];
  c13_peaks?: Array<{
    shift: number;
    intensity: number;
    assignment: string;
    carbon_type?: string;
  }>;
  method_used: string;
  confidence: number;
  warnings: string[];
  computation_time_ms: number;
}

export interface ConformerRequest {
  smiles: string;
  num_conformers?: number;
  optimize?: boolean;
  boltzmann_weighting?: boolean;
}

export interface ConformerResponse {
  success: boolean;
  conformers: Array<{
    id: number;
    energy: number;
    coordinates: Array<{ x: number; y: number; z: number }>;
    boltzmann_weight?: number;
  }>;
  lowest_energy: number;
  boltzmann_weights: number[];
  computation_time_ms: number;
}

export class NMREngineService {
  private baseUrl: string;
  private timeout: number;

  constructor(config: NMREngineConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:8000';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; rdkit_loaded: boolean }> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Predict NMR spectrum
   */
  async predictNMR(request: NMRPredictionRequest): Promise<NMRPredictionResponse> {
    const response = await fetch(`${this.baseUrl}/predict/nmr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smiles: request.smiles,
        spectrum_type: request.spectrum_type || 'both',
        method: request.method || 'hybrid',
        solvent: request.solvent || 'CDCl3',
        temperature: request.temperature || 298.15,
        frequency: request.frequency || 400.0
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `NMR prediction failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Analyze conformers
   */
  async analyzeConformers(request: ConformerRequest): Promise<ConformerResponse> {
    const response = await fetch(`${this.baseUrl}/analyze/conformers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smiles: request.smiles,
        num_conformers: request.num_conformers || 50,
        optimize: request.optimize !== false,
        boltzmann_weighting: request.boltzmann_weighting !== false
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Conformer analysis failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Predict FTIR
   */
  async predictFTIR(
    smiles: string,
    anharmonicCorrection: boolean = true,
    scalingFactor?: number
  ): Promise<{
    success: boolean;
    peaks: Array<{
      wavenumber: number;
      intensity: number;
      assignment: string;
      type: string;
    }>;
    computation_time_ms: number;
  }> {
    const response = await fetch(`${this.baseUrl}/predict/ftir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smiles,
        anharmonic_correction: anharmonicCorrection,
        scaling_factor: scalingFactor
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `FTIR prediction failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Predict MS
   */
  async predictMS(
    smiles: string,
    ionizationMode: string = 'ESI',
    collisionEnergy?: number
  ): Promise<{
    success: boolean;
    molecular_ion: any;
    fragments: any[];
    isotope_pattern: any;
    computation_time_ms: number;
  }> {
    const response = await fetch(`${this.baseUrl}/predict/ms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smiles,
        ionization_mode: ionizationMode,
        collision_energy: collisionEnergy
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `MS prediction failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Calculate QM (xTB or DFT)
   */
  async calculateQM(
    smiles: string,
    method: 'xtb' | 'dft' = 'xtb',
    level?: string
  ): Promise<{
    success: boolean;
    method: string;
    shifts: Record<string, number>;
    geometry_optimized: boolean;
    computation_time_ms: number;
    job_id?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/calculate/qm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smiles,
        method,
        level: level || (method === 'xtb' ? 'GFN2-xTB' : 'B3LYP/6-31G(d)')
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `QM calculation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get QM job status
   */
  async getQMStatus(jobId: string): Promise<{
    status: string;
    smiles?: string;
    level?: string;
    result?: any;
  }> {
    const response = await fetch(`${this.baseUrl}/qm/status/${jobId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Singleton instance
export const nmrEngineService = new NMREngineService({
  baseUrl: process.env.NEXT_PUBLIC_NMR_ENGINE_URL || 'http://localhost:8000',
  timeout: 30000
});

