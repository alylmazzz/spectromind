/**
 * Graph automorphism-based symmetry engine.
 *
 * Since Nauty/bliss are C libraries not trivially callable from TS,
 * we implement Morgan-extended-connectivity refinement with neighbor
 * invariants.  This is the same algorithm RDKit's CanonicalRankAtoms uses
 * internally (extended Morgan, then tie-breaking).
 *
 * For breakTies=false the resulting partition = equivalence classes
 * (constitutionally equivalent atoms).
 *
 * Scientific limitations (documented, not hidden):
 * - Cannot distinguish enantiotopic from diastereotopic sites without
 *   3D/CIP analysis.  We flag potential diastereotopic centers.
 * - Accidental degeneracy in Morgan invariants is rare but possible;
 *   for production use the RDKit Python route which wraps C++ code.
 */

import type { AtomRecord, BondRecord, MolecularGraph } from './types';

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export interface SymmetryClass {
  classId: number;
  atomIndices: number[];
  representative: number;
  symbol: string;
  isAromatic: boolean;
  hCount: number;
}

export interface EquivalenceResult {
  classes: SymmetryClass[];
  uniqueAtomCount: number;
  uniqueCarbonCount: number;
  uniqueHydrogenGroupCount: number;
  potentialDiastereotopicSites: number[];
  magneticEquivalenceWarnings: string[];
  method: 'morgan_extended' | 'rdkit_canonical' | 'fallback_signature';
}

// --------------------------------------------------------------------------
// Morgan extended connectivity
// --------------------------------------------------------------------------

function buildAdjList(
  atoms: AtomRecord[],
  bonds: BondRecord[]
): Map<number, Array<{ neighbor: number; bondOrder: number; isAromatic: boolean }>> {
  const adj = new Map<number, Array<{ neighbor: number; bondOrder: number; isAromatic: boolean }>>();
  for (const a of atoms) {
    adj.set(a.index, []);
  }
  for (const b of bonds) {
    adj.get(b.beginAtomIdx)?.push({ neighbor: b.endAtomIdx, bondOrder: b.bondOrder, isAromatic: b.isAromatic });
    adj.get(b.endAtomIdx)?.push({ neighbor: b.beginAtomIdx, bondOrder: b.bondOrder, isAromatic: b.isAromatic });
  }
  return adj;
}

function initialInvariant(a: AtomRecord): number {
  let inv = 0;
  inv = inv * 100 + (a.symbol.charCodeAt(0) ?? 0);
  inv = inv * 10 + (a.isAromatic ? 1 : 0);
  inv = inv * 10 + (a.implicitHydrogens ?? 0);
  inv = inv * 10 + Math.abs(a.formalCharge ?? 0);
  inv = inv * 10 + (a.formalCharge < 0 ? 1 : 0);
  inv = inv * 10 + (a.inRing ? 1 : 0);
  return inv;
}

/**
 * Morgan extended connectivity refinement (no tie-breaking).
 * Returns equivalence class IDs per atom index.
 */
function morganPartition(
  atoms: AtomRecord[],
  bonds: BondRecord[],
  maxIterations = 64
): Map<number, number> {
  const adj = buildAdjList(atoms, bonds);
  const atomMap = new Map<number, AtomRecord>();
  for (const a of atoms) atomMap.set(a.index, a);

  let invariants = new Map<number, number>();
  for (const a of atoms) {
    invariants.set(a.index, initialInvariant(a));
  }

  let prevClassCount = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const newInv = new Map<number, number>();

    for (const a of atoms) {
      const neighbors = adj.get(a.index) ?? [];
      const neighborInvs = neighbors
        .map(n => {
          const nInv = invariants.get(n.neighbor) ?? 0;
          return nInv * 10 + n.bondOrder + (n.isAromatic ? 100 : 0);
        })
        .sort((x, y) => x - y);

      let hash = invariants.get(a.index) ?? 0;
      for (const ni of neighborInvs) {
        hash = ((hash * 31) + ni) | 0;
      }
      newInv.set(a.index, hash);
    }

    const uniqueVals = new Set(newInv.values());
    if (uniqueVals.size === prevClassCount) break;
    prevClassCount = uniqueVals.size;
    invariants = newInv;
  }

  const valToClass = new Map<number, number>();
  let nextClass = 0;
  const result = new Map<number, number>();
  for (const a of atoms) {
    const val = invariants.get(a.index)!;
    if (!valToClass.has(val)) {
      valToClass.set(val, nextClass++);
    }
    result.set(a.index, valToClass.get(val)!);
  }

  return result;
}

// --------------------------------------------------------------------------
// Diastereotopic detection
// --------------------------------------------------------------------------

/**
 * Identify potential diastereotopic proton sites.
 * A CH2 adjacent to a stereocenter or within 2 bonds of one is potentially
 * diastereotopic (protons may be chemically inequivalent).
 */
function findDiastereotopicSites(
  atoms: AtomRecord[],
  bonds: BondRecord[]
): number[] {
  const adj = buildAdjList(atoms, bonds);
  const stereoAtoms = new Set(
    atoms.filter(a => a.chiralTag && a.chiralTag !== 'CHI_UNSPECIFIED').map(a => a.index)
  );
  if (stereoAtoms.size === 0) return [];

  const sites: number[] = [];
  for (const a of atoms) {
    if (a.symbol !== 'C' || a.implicitHydrogens < 2) continue;
    const neighbors = adj.get(a.index) ?? [];
    const withinTwo = new Set<number>();
    for (const n of neighbors) {
      withinTwo.add(n.neighbor);
      for (const nn of (adj.get(n.neighbor) ?? [])) {
        withinTwo.add(nn.neighbor);
      }
    }
    for (const s of stereoAtoms) {
      if (withinTwo.has(s)) {
        sites.push(a.index);
        break;
      }
    }
  }
  return sites;
}

// --------------------------------------------------------------------------
// Magnetic equivalence warnings
// --------------------------------------------------------------------------

function magneticEquivalenceCheck(
  atoms: AtomRecord[],
  bonds: BondRecord[],
  classes: SymmetryClass[]
): string[] {
  const warnings: string[] = [];
  const adj = buildAdjList(atoms, bonds);

  for (const cls of classes) {
    if (cls.atomIndices.length < 2 || cls.symbol !== 'C') continue;
    if (!cls.isAromatic) continue;
    const couplingPatterns = cls.atomIndices.map(idx => {
      const neighbors = (adj.get(idx) ?? [])
        .filter(n => atoms.find(a => a.index === n.neighbor)?.symbol === 'C')
        .map(n => n.bondOrder)
        .sort()
        .join(',');
      return neighbors;
    });
    const unique = new Set(couplingPatterns);
    if (unique.size > 1) {
      warnings.push(
        `Atoms [${cls.atomIndices.join(',')}] are constitutionally equivalent ` +
        `but may be magnetically inequivalent (different coupling topology)`
      );
    }
  }

  return warnings;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function computeEquivalenceClasses(graph: MolecularGraph): EquivalenceResult {
  const { atoms, bonds } = graph;
  if (atoms.length === 0) {
    return {
      classes: [],
      uniqueAtomCount: 0,
      uniqueCarbonCount: 0,
      uniqueHydrogenGroupCount: 0,
      potentialDiastereotopicSites: [],
      magneticEquivalenceWarnings: [],
      method: 'morgan_extended',
    };
  }

  const partition = morganPartition(atoms, bonds);

  const classMap = new Map<number, number[]>();
  for (const [atomIdx, classId] of partition.entries()) {
    if (!classMap.has(classId)) classMap.set(classId, []);
    classMap.get(classId)!.push(atomIdx);
  }

  const classes: SymmetryClass[] = [];
  for (const [classId, indices] of classMap.entries()) {
    const rep = atoms.find(a => a.index === indices[0])!;
    classes.push({
      classId,
      atomIndices: indices,
      representative: indices[0],
      symbol: rep.symbol,
      isAromatic: rep.isAromatic,
      hCount: rep.implicitHydrogens,
    });
  }

  const carbonClasses = classes.filter(c => c.symbol === 'C');
  const hGroups = classes.filter(c => c.hCount > 0 && c.symbol !== 'H');
  const diastereotopic = findDiastereotopicSites(atoms, bonds);
  const magWarnings = magneticEquivalenceCheck(atoms, bonds, classes);

  return {
    classes,
    uniqueAtomCount: classes.length,
    uniqueCarbonCount: carbonClasses.length,
    uniqueHydrogenGroupCount: hGroups.length,
    potentialDiastereotopicSites: diastereotopic,
    magneticEquivalenceWarnings: magWarnings,
    method: 'morgan_extended',
  };
}

/**
 * Convenience: expected unique 13C signals.
 * Replaces the naive nC_total or signature-based heuristic with
 * Morgan-partition-derived count.
 */
export function expectedUniqueCarbon13Signals(graph: MolecularGraph): {
  count: number;
  carbonClasses: SymmetryClass[];
  diastereotopicWarning: boolean;
} {
  const eq = computeEquivalenceClasses(graph);
  const carbonClasses = eq.classes.filter(c => c.symbol === 'C');
  return {
    count: carbonClasses.length,
    carbonClasses,
    diastereotopicWarning: eq.potentialDiastereotopicSites.length > 0,
  };
}
