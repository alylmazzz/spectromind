/**
 * Hybridization Assignment
 * Determines sp, sp2, sp3 hybridization for atoms
 *
 * Rules:
 * - sp3: 4 σ bonds (tetrahedral)
 * - sp2: 3 σ bonds + 1 π bond (trigonal planar)
 * - sp: 2 σ bonds + 2 π bonds (linear)
 */

import { Atom, Bond, MolecularGraph } from '../core/types';

export function assignHybridization(graph: MolecularGraph): void {
  graph.atoms.forEach(atom => {
    atom.hybridization = determineHybridization(atom, graph);
  });
}

function determineHybridization(atom: Atom, graph: MolecularGraph): 'sp' | 'sp2' | 'sp3' {
  // Get all bonds connected to this atom
  const connectedBonds = graph.bonds.filter(
    b => b.atom1Id === atom.id || b.atom2Id === atom.id
  );

  // Count sigma and pi bonds
  let sigmaBonds = 0;
  let piBonds = 0;

  connectedBonds.forEach(bond => {
    sigmaBonds += 1; // Always has 1 σ bond

    if (bond.order === 2) {
      piBonds += 1; // Double bond = 1 π bond
    } else if (bond.order === 3) {
      piBonds += 2; // Triple bond = 2 π bonds
    } else if (bond.order === 1.5) {
      piBonds += 0.5; // Aromatic = 0.5 π bond (delocalized)
    }
  });

  // Add implicit hydrogens as sigma bonds
  sigmaBonds += atom.implicitHydrogens;

  // Add lone pairs for heteroatoms
  const lonePairs = getLonePairs(atom, sigmaBonds, piBonds);
  const stericNumber = sigmaBonds + lonePairs;

  // Determine hybridization based on steric number
  if (piBonds >= 2) {
    return 'sp'; // Linear (C≡C, C≡N)
  } else if (piBonds >= 1 || atom.aromaticity) {
    return 'sp2'; // Trigonal planar (C=C, C=O, aromatic)
  } else if (stericNumber === 4) {
    return 'sp3'; // Tetrahedral
  } else if (stericNumber === 3) {
    return 'sp2'; // Trigonal planar (carbocation, carbanion)
  } else if (stericNumber === 2) {
    return 'sp'; // Linear
  }

  // Default to sp3 for saturated carbon
  return 'sp3';
}

/**
 * Calculate number of lone pairs
 */
function getLonePairs(atom: Atom, sigmaBonds: number, piBonds: number): number {
  const valenceElectrons: Record<string, number> = {
    'H': 1,
    'C': 4,
    'N': 5,
    'O': 6,
    'F': 7,
    'Cl': 7,
    'Br': 7,
    'S': 6,
    'P': 5
  };

  const totalValence = valenceElectrons[atom.symbol] || 4;
  const bondingElectrons = sigmaBonds + piBonds;
  const lonePairElectrons = totalValence - bondingElectrons - atom.formalCharge;

  return Math.floor(lonePairElectrons / 2);
}

/**
 * Special cases for resonance structures
 */
export function detectResonanceHybridization(atom: Atom, graph: MolecularGraph): 'sp' | 'sp2' | 'sp3' {
  // Carbonyl carbon adjacent to N, O (amide, ester)
  if (atom.symbol === 'C') {
    const bonds = graph.bonds.filter(b => b.atom1Id === atom.id || b.atom2Id === atom.id);
    const hasDoubleBond = bonds.some(b => b.order === 2);
    const adjacentHeteroatoms = bonds.filter(b => {
      const otherAtomId = b.atom1Id === atom.id ? b.atom2Id : b.atom1Id;
      const otherAtom = graph.atoms.find(a => a.id === otherAtomId);
      return otherAtom && ['N', 'O', 'S'].includes(otherAtom.symbol);
    });

    if (hasDoubleBond && adjacentHeteroatoms.length > 0) {
      return 'sp2'; // Resonance-stabilized
    }
  }

  return determineHybridization(atom, graph);
}
