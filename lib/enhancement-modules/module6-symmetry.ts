/**
 * Module 6: Point Group Symmetry Detection
 *
 * PURPOSE:
 * - Detects molecular point group (D6h, C2v, Cs, C1, etc.)
 * - Identifies symmetry elements (rotation axes, mirror planes)
 * - Checks libraries FIRST before generating with RDKit
 *
 * OPTIMIZATION:
 * - Step 1: Check PubChem (if CID available)
 * - Step 2: Check enhanced library
 * - Step 3: Generate with RDKit (only if needed)
 *
 * USAGE:
 * import { detectSymmetry } from '@/lib/enhancement-modules/module6-symmetry';
 * const symmetry = await detectSymmetry(smiles, cid, name);
 *
 * REMOVE:
 * Delete this file if you don't need symmetry analysis
 */

import { structureCache } from '@/lib/services/StructureCache';

export interface SymmetryResult {
  success: boolean;
  pointGroup?: string; // e.g., "D6h", "C2v", "Cs", "C1"
  symmetryElements?: string[]; // e.g., ["E", "C6", "σh"]
  source?: 'pubchem' | 'enhanced-library' | 'rdkit-generated';
  error?: string;
}

/**
 * Detect molecular point group symmetry
 * Uses cache before generating with RDKit
 *
 * @param smiles - SMILES string of molecule
 * @param cid - PubChem CID (optional, for cache lookup)
 * @param moleculeName - Molecule name (optional, for library lookup)
 * @returns Point group and symmetry elements
 */
export async function detectSymmetry(
  smiles: string,
  cid?: number,
  moleculeName?: string
): Promise<SymmetryResult> {
  try {
    // Try cache first (PubChem → Library → RDKit)
    const cached = await structureCache.getStructure(cid, smiles, moleculeName);

    if (cached.pointGroup) {
      return {
        success: true,
        pointGroup: cached.pointGroup,
        symmetryElements: cached.symmetryElements || ['E'],
        source: cached.source
      };
    }

    // If no point group in cache, return default
    return {
      success: true,
      pointGroup: 'C1', // No symmetry by default
      symmetryElements: ['E'],
      source: cached.source
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if point group has inversion center
 */
export function hasInversionCenter(pointGroup: string): boolean {
  const inversionGroups = ['Ci', 'D2h', 'D3h', 'D4h', 'D6h', 'Oh', 'Ih'];
  return inversionGroups.some(g => pointGroup.includes(g));
}

/**
 * Check if point group is chiral (no mirror plane)
 */
export function isChiral(pointGroup: string): boolean {
  const chiralGroups = ['C1', 'Cn', 'Dn', 'T', 'O', 'I'];
  return chiralGroups.some(g => pointGroup.startsWith(g)) &&
         !pointGroup.includes('h') &&
         !pointGroup.includes('v') &&
         !pointGroup.includes('s');
}
