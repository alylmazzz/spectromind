/**
 * Symmetry Analysis & Equivalent Atom Detection
 *
 * Detects:
 * - Chemical equivalence (same NMR chemical shift)
 * - Magnetic equivalence (same coupling to all other nuclei)
 * - Point group symmetry operations
 *
 * Reference: Pavia - Introduction to Spectroscopy, Chapter 5
 */

import { Atom, Bond, MolecularGraph } from '../core/types';

export interface EquivalenceGroup {
  atomIds: string[];
  chemicallyEquivalent: boolean;
  magneticallyEquivalent: boolean;
  symmetryOperation: string; // C2, σ, etc.
}

/**
 * Find all equivalent atom sets in the molecule
 */
export function findEquivalentAtoms(graph: MolecularGraph): EquivalenceGroup[] {
  const groups: EquivalenceGroup[] = [];

  // Group atoms by element type first
  const atomsByElement = groupByElement(graph);

  Object.entries(atomsByElement).forEach(([element, atoms]) => {
    // For each element, find chemically equivalent sets
    const equivalentSets = findChemicallyEquivalentSets(atoms, graph);

    equivalentSets.forEach(set => {
      const magneticallyEquiv = checkMagneticEquivalence(set, graph);

      groups.push({
        atomIds: set.map(a => a.id),
        chemicallyEquivalent: true,
        magneticallyEquivalent: magneticallyEquiv,
        symmetryOperation: detectSymmetryOperation(set, graph)
      });
    });
  });

  return groups;
}

/**
 * Group atoms by element symbol
 */
function groupByElement(graph: MolecularGraph): Record<string, Atom[]> {
  const groups: Record<string, Atom[]> = {};

  graph.atoms.forEach(atom => {
    if (!groups[atom.symbol]) {
      groups[atom.symbol] = [];
    }
    groups[atom.symbol].push(atom);
  });

  return groups;
}

/**
 * Find chemically equivalent atoms
 * Atoms are chemically equivalent if they have identical chemical environments
 */
function findChemicallyEquivalentSets(atoms: Atom[], graph: MolecularGraph): Atom[][] {
  const sets: Atom[][] = [];
  const visited = new Set<string>();

  atoms.forEach(atom => {
    if (visited.has(atom.id)) return;

    const equivalentSet = [atom];
    visited.add(atom.id);

    // Compare with remaining atoms
    atoms.forEach(otherAtom => {
      if (visited.has(otherAtom.id)) return;

      if (areChemicallyEquivalent(atom, otherAtom, graph)) {
        equivalentSet.push(otherAtom);
        visited.add(otherAtom.id);
      }
    });

    if (equivalentSet.length > 0) {
      sets.push(equivalentSet);
    }
  });

  return sets;
}

/**
 * Check if two atoms are chemically equivalent
 * Compare: hybridization, connectivity, neighbors
 */
function areChemicallyEquivalent(atom1: Atom, atom2: Atom, graph: MolecularGraph): boolean {
  // Same hybridization
  if (atom1.hybridization !== atom2.hybridization) return false;

  // Same formal charge
  if (atom1.formalCharge !== atom2.formalCharge) return false;

  // Same aromaticity
  if (atom1.aromaticity !== atom2.aromaticity) return false;

  // Same connectivity (number and type of neighbors)
  const neighbors1 = getNeighbors(atom1, graph);
  const neighbors2 = getNeighbors(atom2, graph);

  if (neighbors1.length !== neighbors2.length) return false;

  // Sort neighbors by element and compare
  const sorted1 = neighbors1.map(n => n.symbol).sort();
  const sorted2 = neighbors2.map(n => n.symbol).sort();

  for (let i = 0; i < sorted1.length; i++) {
    if (sorted1[i] !== sorted2[i]) return false;
  }

  // Compare bond orders
  const bonds1 = graph.bonds.filter(b => b.atom1Id === atom1.id || b.atom2Id === atom1.id);
  const bonds2 = graph.bonds.filter(b => b.atom1Id === atom2.id || b.atom2Id === atom2.id);

  const orders1 = bonds1.map(b => b.order).sort();
  const orders2 = bonds2.map(b => b.order).sort();

  for (let i = 0; i < orders1.length; i++) {
    if (orders1[i] !== orders2[i]) return false;
  }

  return true;
}

/**
 * Check magnetic equivalence
 * Atoms are magnetically equivalent if they couple identically to all other nuclei
 */
function checkMagneticEquivalence(atoms: Atom[], graph: MolecularGraph): boolean {
  if (atoms.length < 2) return true;

  // For each pair in the set, check if they couple identically to external nuclei
  const firstAtom = atoms[0];
  const firstCouplings = getCouplingPattern(firstAtom, atoms, graph);

  for (let i = 1; i < atoms.length; i++) {
    const otherCouplings = getCouplingPattern(atoms[i], atoms, graph);

    if (!areCouplingPatternsEqual(firstCouplings, otherCouplings)) {
      return false;
    }
  }

  return true;
}

/**
 * Get coupling pattern for an atom to all nuclei outside the equivalent set
 */
function getCouplingPattern(
  atom: Atom,
  equivalentSet: Atom[],
  graph: MolecularGraph
): Map<string, number> {
  const pattern = new Map<string, number>();

  graph.atoms.forEach(otherAtom => {
    if (otherAtom.id === atom.id) return;
    if (equivalentSet.some(a => a.id === otherAtom.id)) return;

    const distance = getBondDistance(atom, otherAtom, graph);
    if (distance > 0 && distance <= 3) {
      pattern.set(otherAtom.id, distance);
    }
  });

  return pattern;
}

/**
 * Compare two coupling patterns
 */
function areCouplingPatternsEqual(
  pattern1: Map<string, number>,
  pattern2: Map<string, number>
): boolean {
  if (pattern1.size !== pattern2.size) return false;

  // Patterns must have same distribution of distances
  const dist1 = Array.from(pattern1.values()).sort();
  const dist2 = Array.from(pattern2.values()).sort();

  for (let i = 0; i < dist1.length; i++) {
    if (dist1[i] !== dist2[i]) return false;
  }

  return true;
}

/**
 * Get bond distance between two atoms (BFS)
 */
function getBondDistance(atom1: Atom, atom2: Atom, graph: MolecularGraph): number {
  const queue: { atomId: string; distance: number }[] = [{ atomId: atom1.id, distance: 0 }];
  const visited = new Set<string>([atom1.id]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.atomId === atom2.id) {
      return current.distance;
    }

    const neighbors = graph.bonds.filter(
      b => b.atom1Id === current.atomId || b.atom2Id === current.atomId
    );

    neighbors.forEach(bond => {
      const neighborId = bond.atom1Id === current.atomId ? bond.atom2Id : bond.atom1Id;

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ atomId: neighborId, distance: current.distance + 1 });
      }
    });
  }

  return -1; // Not connected
}

/**
 * Detect symmetry operation relating equivalent atoms
 */
function detectSymmetryOperation(atoms: Atom[], graph: MolecularGraph): string {
  if (atoms.length === 1) return 'none';
  if (atoms.length === 2) return 'C2 or σ';

  // Simple heuristic: check if atoms are related by rotation or reflection
  const centroid = calculateCentroid(atoms);

  // Check for C2 rotation (180°)
  const hasC2 = checkC2Symmetry(atoms, centroid);
  if (hasC2) return 'C2';

  // Check for mirror plane (σ)
  const hasSigma = checkMirrorPlane(atoms, centroid);
  if (hasSigma) return 'σ';

  return 'complex';
}

/**
 * Calculate geometric centroid of atoms
 */
function calculateCentroid(atoms: Atom[]): { x: number; y: number; z: number } {
  const sum = atoms.reduce(
    (acc, atom) => ({
      x: acc.x + atom.x,
      y: acc.y + atom.y,
      z: acc.z + (atom.z || 0)
    }),
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: sum.x / atoms.length,
    y: sum.y / atoms.length,
    z: sum.z / atoms.length
  };
}

/**
 * Check for C2 rotational symmetry
 */
function checkC2Symmetry(atoms: Atom[], centroid: { x: number; y: number; z: number }): boolean {
  // TODO: Implement proper C2 check
  // For now, return false
  return false;
}

/**
 * Check for mirror plane symmetry
 */
function checkMirrorPlane(atoms: Atom[], centroid: { x: number; y: number; z: number }): boolean {
  // TODO: Implement proper mirror plane check
  // For now, return true for 2 atoms
  return atoms.length === 2;
}

/**
 * Get neighboring atoms
 */
function getNeighbors(atom: Atom, graph: MolecularGraph): Atom[] {
  const neighbors: Atom[] = [];

  graph.bonds.forEach(bond => {
    if (bond.atom1Id === atom.id) {
      const neighbor = graph.atoms.find(a => a.id === bond.atom2Id);
      if (neighbor) neighbors.push(neighbor);
    } else if (bond.atom2Id === atom.id) {
      const neighbor = graph.atoms.find(a => a.id === bond.atom1Id);
      if (neighbor) neighbors.push(neighbor);
    }
  });

  return neighbors;
}

/**
 * Assign symmetry groups to atoms
 */
export function assignSymmetryGroups(graph: MolecularGraph): void {
  const groups = findEquivalentAtoms(graph);

  groups.forEach((group, index) => {
    const label = String.fromCharCode(65 + index); // A, B, C, ...

    group.atomIds.forEach(atomId => {
      const atom = graph.atoms.find(a => a.id === atomId);
      if (atom) {
        atom.symmetryGroup = label;
        atom.magneticEquivalence = group.magneticallyEquivalent ? label : `${label}'`;
      }
    });
  });
}
