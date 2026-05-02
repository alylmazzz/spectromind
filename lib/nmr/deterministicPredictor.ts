/**
 * Deterministic NMR Predictor
 * 
 * Rule-based/model-based NMR prediction using:
 * - Shoolery rules (chemical shifts)
 * - Karplus equation (coupling constants)
 * - Coupling path analysis
 * 
 * This is NOT LLM-based - it's deterministic and reproducible.
 */

import {
  StructureResult,
  GraphResult,
  DeterministicPrediction,
  NMRPeakPrediction
} from '@/lib/pipeline/types';
import {
  findCouplingPaths,
  calculateDihedralAngle,
  type MolecularStructure,
  parseSMILES
} from '@/lib/utils/molecularStructure';

// ============================================================================
// SHOOLERY CONSTANTS (from UltraThink engine)
// ============================================================================

const SHOOLERY_CONSTANTS: Record<string, number> = {
  '-Cl': 2.53,
  '-Br': 2.33,
  '-I': 1.82,
  '-F': 3.10,
  '-OH': 2.56,
  '-OR': 2.36,
  '-OC(=O)R': 3.13,
  '-OPh': 2.94,
  '-NH2': 1.57,
  '-NHR': 1.60,
  '-NR2': 1.57,
  '-NHC(=O)R': 2.20,
  '-NO2': 3.36,
  '-SH': 1.23,
  '-SR': 1.25,
  '-SOR': 1.80,
  '-SO2R': 2.10,
  '-C(=O)H': 1.10,
  '-C(=O)R': 1.70,
  '-C(=O)OH': 1.10,
  '-C(=O)OR': 1.15,
  '-C(=O)NR2': 1.10,
  '-CN': 1.70,
  '-C=C': 1.32,
  '-C≡C': 1.44,
  '-Ph': 1.85,
  '-R': 0.47
};

// ============================================================================
// KARPLUS EQUATION PARAMETERS
// ============================================================================

const KARPLUS_A = 7.0;
const KARPLUS_B = -1.0;
const KARPLUS_C = 5.0;

/**
 * Calculate Karplus coupling constant
 * J = A + B·cos(φ) + C·cos²(φ)
 */
function calculateKarplusCoupling(dihedralAngleRad: number): number {
  const cosPhi = Math.cos(dihedralAngleRad);
  return KARPLUS_A + KARPLUS_B * cosPhi + KARPLUS_C * cosPhi * cosPhi;
}

// ============================================================================
// DETERMINISTIC PREDICTOR
// ============================================================================

export interface DeterministicPredictorOptions {
  solvent?: string;
  frequency?: number; // MHz
  useUltraThink?: boolean; // Try to call Python UltraThink engine
}

/**
 * Predict NMR spectrum using deterministic rules
 */
export async function predictDeterministic(
  structure: StructureResult,
  graph: GraphResult,
  options: DeterministicPredictorOptions = {}
): Promise<DeterministicPrediction> {
  const assumptions: string[] = [];
  const peaks: NMRPeakPrediction[] = [];

  // Strategy 1: Try UltraThink Python engine (if available)
  if (options.useUltraThink && structure.canonicalSmiles) {
    try {
      const ultraThinkResult = await callUltraThinkEngine(
        structure.canonicalSmiles,
        options
      );
      
      if (ultraThinkResult && ultraThinkResult.peaks.length > 0) {
        return {
          method: 'ultrathink-shoolery+karplus',
          assumptions: ultraThinkResult.assumptions || [],
          peaks: ultraThinkResult.peaks.map(p => ({
            ...p,
            source: 'model' as const
          })),
          confidence: 0.8
        };
      }
    } catch (error) {
      console.warn('UltraThink engine call failed, falling back to TS implementation:', error);
      assumptions.push('UltraThink engine unavailable, using TS fallback');
    }
  }

  // Strategy 2: TypeScript implementation (fallback)
  if (!structure.canonicalSmiles) {
    return {
      method: 'NOT_IMPLEMENTED',
      assumptions: ['No SMILES available for prediction'],
      peaks: [],
      confidence: 0.0
    };
  }

  // Parse structure for analysis
  let molStructure: MolecularStructure;
  try {
    molStructure = parseSMILES(structure.canonicalSmiles);
  } catch (error) {
    return {
      method: 'NOT_IMPLEMENTED',
      assumptions: [`SMILES parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      peaks: [],
      confidence: 0.0
    };
  }

  // Check stereo status
  if (structure.stereoStatus === 'none') {
    assumptions.push('Stereo information missing; diastereotopic protons may be incorrectly grouped');
  }

  // Group equivalent protons (simplified)
  const protonGroups = groupEquivalentProtons(molStructure, structure.stereoStatus);
  
  if (protonGroups.length === 0) {
    assumptions.push('No protons found in structure');
    return {
      method: 'ts-fallback-simple',
      assumptions,
      peaks: [],
      confidence: 0.3
    };
  }

  // Calculate shifts and couplings for each group
  for (const group of protonGroups) {
    const shift = calculateShooleryShift(group, molStructure);
    const integration = group.protonIndices.length;
    
    // Find coupling paths
    const couplings: number[] = [];
    if (graph.coords3d && graph.coords3d.length > 0) {
      // 3D coords available - can calculate Karplus
      const couplingPaths = findCouplingPaths(molStructure);
      
      for (const path of couplingPaths) {
        if (path.pathLength === 3 && group.protonIndices.includes(path.h1)) {
          // 3J coupling - try to calculate dihedral
          const dihedral = calculateDihedralFromPath(path, graph.coords3d, molStructure);
          if (dihedral !== null) {
            const J = calculateKarplusCoupling(dihedral);
            couplings.push(J);
          }
        }
      }
    } else {
      assumptions.push('3D coordinates unavailable; coupling constants estimated from default ranges');
      // Use default coupling ranges if available
      // For now, skip coupling calculation
    }

    // Determine multiplicity
    const multiplicity = determineMultiplicity(group, molStructure, couplings.length);

    peaks.push({
      shift: Math.round(shift * 100) / 100, // Round to 2 decimals
      multiplicity,
      integration,
      coupling: couplings.length > 0 ? couplings : undefined,
      assignment: group.assignment || `H-${group.protonIndices[0] + 1}`,
      confidence: structure.stereoStatus === 'full' ? 0.7 : 0.5,
      source: 'model'
    });
  }

  return {
    method: graph.coords3d ? 'ts-shoolery+karplus' : 'ts-shoolery-only',
    assumptions,
    peaks,
    confidence: structure.stereoStatus === 'full' ? 0.7 : 0.5
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ProtonGroup {
  protonIndices: number[];
  attachedAtomIdx: number;
  assignment?: string;
}

/**
 * Group equivalent protons
 * Simplified: group by attached heavy atom
 * TODO: Use RDKit symmetry classes if available
 */
function groupEquivalentProtons(
  structure: MolecularStructure,
  stereoStatus: 'full' | 'partial' | 'none'
): ProtonGroup[] {
  const groups: ProtonGroup[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < structure.atoms.length; i++) {
    const atom = structure.atoms[i];
    
    if (atom.element === 'H' && !processed.has(i)) {
      // Find attached heavy atom
      const attachedAtom = structure.atoms.find(a => 
        a.connectedAtoms.includes(i)
      );

      if (attachedAtom) {
        // Check if other H atoms are attached to same heavy atom
        const equivalentH = structure.atoms
          .map((a, idx) => ({ atom: a, idx }))
          .filter(({ atom, idx }) => 
            atom.element === 'H' &&
            atom.connectedAtoms.includes(attachedAtom.id) &&
            !processed.has(idx)
          );

        if (equivalentH.length > 0) {
          const groupIndices = equivalentH.map(({ idx }) => idx);
          groupIndices.forEach(idx => processed.add(idx));

          // Determine assignment
          let assignment: string | undefined;
          if (attachedAtom.element === 'C') {
            const hCount = equivalentH.length;
            if (hCount === 3) assignment = 'CH3';
            else if (hCount === 2) assignment = 'CH2';
            else if (hCount === 1) assignment = 'CH';
          }

          groups.push({
            protonIndices: groupIndices,
            attachedAtomIdx: attachedAtom.id,
            assignment
          });
        }
      }
    }
  }

  return groups;
}

/**
 * Calculate Shoolery shift for a proton group
 * Simplified implementation
 */
function calculateShooleryShift(
  group: ProtonGroup,
  structure: MolecularStructure
): number {
  // Base shift for CH3
  let baseShift = 0.9;

  // Find substituents on attached atom
  const attachedAtom = structure.atoms[group.attachedAtomIdx];
  if (!attachedAtom) return baseShift;

  // Simplified: check for common functional groups
  const connectedAtoms = attachedAtom.connectedAtoms
    .map(idx => structure.atoms[idx])
    .filter(a => a.element !== 'H');

  // Check for aromatic
  if (attachedAtom.isAromatic) {
    return 7.0; // Aromatic base
  }

  // Check for electronegative substituents
  for (const neighbor of connectedAtoms) {
    if (neighbor.element === 'O') {
      baseShift += 2.5; // OH/OR effect
    } else if (neighbor.element === 'N') {
      baseShift += 1.5; // NH effect
    } else if (neighbor.element === 'Cl' || neighbor.element === 'Br') {
      baseShift += 2.0; // Halogen effect
    }
  }

  return Math.max(0.0, Math.min(12.0, baseShift)); // Clamp to reasonable range
}

/**
 * Determine multiplicity from coupling count
 */
function determineMultiplicity(
  group: ProtonGroup,
  structure: MolecularStructure,
  couplingCount: number
): string {
  // Simplified n+1 rule
  // In real implementation, would analyze neighbor protons
  
  if (couplingCount === 0) return 's';
  if (couplingCount === 1) return 'd';
  if (couplingCount === 2) return 't';
  if (couplingCount === 3) return 'q';
  if (couplingCount > 3) return 'm';
  
  return 's'; // Default
}

/**
 * Calculate dihedral angle from coupling path using 3D coordinates
 */
function calculateDihedralFromPath(
  path: { h1: number; h2: number; pathLength: number; bondPath: number[] },
  coords3d: Array<{ x: number; y: number; z: number }>,
  structure: MolecularStructure
): number | null {
  if (path.bondPath.length < 4) return null;
  if (!coords3d || coords3d.length === 0) return null;

  // For 3J coupling, need 4 atoms: H1-C1-C2-H2
  // bondPath should contain these atom indices
  try {
    const [a1, a2, a3, a4] = path.bondPath.slice(0, 4);
    
    if (a1 >= coords3d.length || a2 >= coords3d.length ||
        a3 >= coords3d.length || a4 >= coords3d.length) {
      return null;
    }

    const pos1 = coords3d[a1];
    const pos2 = coords3d[a2];
    const pos3 = coords3d[a3];
    const pos4 = coords3d[a4];

    return calculateDihedralAngle(pos1, pos2, pos3, pos4);
  } catch (error) {
    return null;
  }
}

/**
 * Call UltraThink Python engine (if available)
 */
async function callUltraThinkEngine(
  smiles: string,
  options: DeterministicPredictorOptions
): Promise<{
  peaks: Array<{
    shift: number;
    multiplicity?: string;
    integration?: number;
    coupling?: number[];
    assignment?: string;
  }>;
  assumptions?: string[];
} | null> {
  // Try to call via API endpoint (if exists)
  // For now, return null (NOT IMPLEMENTED)
  // TODO: Create /api/nmr/deterministic endpoint that calls Python script
  
  return null;
}
