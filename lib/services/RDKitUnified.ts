/**
 * RDKit Unified Service
 *
 * Single interface for all RDKit operations:
 * - Energy calculation (MMFF94)
 * - Structure analysis (2D/3D coords, symmetry)
 * - Molecular properties
 *
 * USAGE:
 * import { rdkit } from '@/lib/services/RDKitUnified';
 * const energy = await rdkit.calculateEnergy(smiles);
 * const structure = await rdkit.analyzeStructure(smiles);
 *
 * BENEFITS:
 * - Single import instead of multiple
 * - Type-safe responses
 * - Easy to mock for testing
 * - Clear error handling
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EnergyData {
  success: boolean;
  conformers?: Array<{
    id: number;
    energy: number;
    boltzmann_weight: number;
  }>;
  lowest_energy?: number;
  error?: string;
}

export interface StructureData {
  success: boolean;
  coords_2d?: Array<{ element: string; x: number; y: number }>;
  coords_3d?: Array<{ element: string; x: number; y: number; z: number }>;
  point_group?: string;
  symmetry_elements?: string[];
  molecular_formula?: string;
  molecular_weight?: number;
  error?: string;
}

// ============================================================================
// RDKit SERVICE
// ============================================================================

class RDKitUnifiedService {
  /**
   * Calculate conformer energies with MMFF94
   */
  async calculateEnergy(
    smiles: string,
    temperature: number = 298.15
  ): Promise<EnergyData> {
    try {
      const response = await fetch('/api/rdkit/calculate-energy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles, temperature })
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Energy calculation failed'
      };
    }
  }

  /**
   * Analyze molecular structure (2D/3D/symmetry)
   */
  async analyzeStructure(smiles: string): Promise<StructureData> {
    try {
      const response = await fetch('/api/rdkit/analyze-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles })
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Structure analysis failed'
      };
    }
  }

  /**
   * Get all RDKit data in one call (energy + structure)
   */
  async getFullAnalysis(
    smiles: string,
    temperature: number = 298.15
  ): Promise<{
    energy: EnergyData;
    structure: StructureData;
  }> {
    const [energy, structure] = await Promise.all([
      this.calculateEnergy(smiles, temperature),
      this.analyzeStructure(smiles)
    ]);

    return { energy, structure };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const rdkit = new RDKitUnifiedService();
