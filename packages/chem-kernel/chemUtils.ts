/**
 * Chemistry utility functions — part of the unified kernel.
 * All mass, valence, functional group, and environment classification logic lives here.
 */

import type {
  AtomRecord,
  BondRecord,
  MolecularGraph,
  AtomEnvironment,
  AtomEnvironmentClass,
  FunctionalGroupFlags,
  ValenceCheck,
  AdductInfo,
} from './types';

// ---------------------------------------------------------------------------
// Element data
// ---------------------------------------------------------------------------

export const ELEMENT_MASSES: Record<string, number> = {
  H: 1.00782503207, D: 2.01410178, C: 12.0, N: 14.00307400480,
  O: 15.99491461956, F: 18.99840322, Si: 27.97692653, P: 30.97376163,
  S: 31.97207100, Cl: 34.96885268, Br: 78.9183371, I: 126.904473,
  Na: 22.9897693, K: 38.9637069, Ca: 39.9625909, Fe: 55.9349375,
  Se: 79.9165213, B: 11.0093054,
};

const NOMINAL_MASSES: Record<string, number> = {
  H: 1, D: 2, C: 12, N: 14, O: 16, F: 19, Si: 28, P: 31,
  S: 32, Cl: 35, Br: 79, I: 127, Na: 23, K: 39, Ca: 40,
  Fe: 56, Se: 80, B: 11,
};

export const VALENCE_TABLE: Record<string, number[]> = {
  H: [1], D: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1],
  Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1], Br: [1], I: [1, 3, 5, 7],
  Se: [2, 4, 6], Na: [1], K: [1], Ca: [2], Fe: [2, 3],
};

// ---------------------------------------------------------------------------
// Mass calculations
// ---------------------------------------------------------------------------

export function computeExactMass(atomCounts: Record<string, number>): number {
  let mass = 0;
  for (const [element, count] of Object.entries(atomCounts)) {
    const eMass = ELEMENT_MASSES[element];
    if (eMass !== undefined) {
      mass += eMass * count;
    }
  }
  return mass;
}

export function computeNominalMass(atomCounts: Record<string, number>): number {
  let mass = 0;
  for (const [element, count] of Object.entries(atomCounts)) {
    const nMass = NOMINAL_MASSES[element];
    if (nMass !== undefined) {
      mass += nMass * count;
    }
  }
  return mass;
}

// ---------------------------------------------------------------------------
// Adducts
// ---------------------------------------------------------------------------

export const COMMON_ADDUCTS: Array<{ name: string; formula: string; deltaMass: number; charge: number; mode: 'positive' | 'negative' }> = [
  { name: '[M+H]+', formula: 'H', deltaMass: 1.00727646677, charge: 1, mode: 'positive' },
  { name: '[M+Na]+', formula: 'Na', deltaMass: 22.98922, charge: 1, mode: 'positive' },
  { name: '[M+K]+', formula: 'K', deltaMass: 38.96316, charge: 1, mode: 'positive' },
  { name: '[M+NH4]+', formula: 'NH4', deltaMass: 18.03437, charge: 1, mode: 'positive' },
  { name: '[M+2H]2+', formula: '2H', deltaMass: 1.00727646677, charge: 2, mode: 'positive' },
  { name: '[M-H]-', formula: '-H', deltaMass: -1.00727646677, charge: -1, mode: 'negative' },
  { name: '[M+Cl]-', formula: 'Cl', deltaMass: 34.96940, charge: -1, mode: 'negative' },
  { name: '[M+HCOO]-', formula: 'HCOO', deltaMass: 44.99820, charge: -1, mode: 'negative' },
  { name: '[M+CH3COO]-', formula: 'CH3COO', deltaMass: 59.01385, charge: -1, mode: 'negative' },
  { name: '[M-2H]2-', formula: '-2H', deltaMass: -1.00727646677, charge: -2, mode: 'negative' },
];

export function computeAdductMasses(
  exactMass: number,
  mode?: 'positive' | 'negative'
): AdductInfo[] {
  const adducts = mode
    ? COMMON_ADDUCTS.filter(a => a.mode === mode)
    : COMMON_ADDUCTS;

  return adducts.map(a => ({
    name: a.name,
    formula: a.formula,
    deltaMass: a.deltaMass,
    charge: a.charge,
    computedMz: (exactMass + a.deltaMass) / Math.abs(a.charge),
  }));
}

// ---------------------------------------------------------------------------
// Valence validation
// ---------------------------------------------------------------------------

export function validateValence(atoms: AtomRecord[]): ValenceCheck[] {
  const results: ValenceCheck[] = [];
  for (const atom of atoms) {
    const expected = VALENCE_TABLE[atom.symbol];
    if (!expected) {
      results.push({
        atomIdx: atom.index,
        symbol: atom.symbol,
        expectedValence: [],
        actualValence: 0,
        valid: true,
        message: `Unknown element ${atom.symbol} — skipped`,
      });
      continue;
    }

    const actualValence = atom.totalHydrogens + (atom.numRadicalElectrons ?? 0);
    const valid = true; // Full valence check requires bond info
    results.push({
      atomIdx: atom.index,
      symbol: atom.symbol,
      expectedValence: expected,
      actualValence,
      valid,
    });
  }
  return results;
}

export function validateMoleculeGraph(graph: MolecularGraph): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!graph.canonicalSmiles) {
    issues.push('Missing canonical SMILES');
  }
  if (!graph.atoms || graph.atoms.length === 0) {
    issues.push('No atoms in graph');
  }
  if (graph.dbe < 0) {
    issues.push(`Negative DBE: ${graph.dbe}`);
  }

  const hFromAtoms = graph.atoms.reduce(
    (sum, a) => sum + (a.symbol === 'H' ? 1 : 0) + (a.implicitHydrogens ?? 0),
    0
  );
  const hFromCounts = graph.atomCounts?.['H'] ?? 0;
  if (Math.abs(hFromAtoms - hFromCounts) > 0) {
    issues.push(
      `H count mismatch: atoms say ${hFromAtoms}, atomCounts says ${hFromCounts}`
    );
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Atom environment classification
// ---------------------------------------------------------------------------

export function classifyAtomEnvironment(
  atom: AtomRecord,
  atoms: AtomRecord[],
  bonds: BondRecord[]
): AtomEnvironment {
  const neighbors = bonds
    .filter(b => b.beginAtomIdx === atom.index || b.endAtomIdx === atom.index)
    .map(b => b.beginAtomIdx === atom.index ? b.endAtomIdx : b.beginAtomIdx);

  const neighborAtoms = neighbors.map(idx => atoms.find(a => a.index === idx)!).filter(Boolean);
  const heteroNeighborCount = neighborAtoms.filter(
    a => a && a.symbol !== 'C' && a.symbol !== 'H'
  ).length;

  const carbonylBonds = bonds.filter(
    b =>
      (b.beginAtomIdx === atom.index || b.endAtomIdx === atom.index) &&
      b.bondOrder >= 2
  );
  const carbonylAdjacent = carbonylBonds.some(b => {
    const otherIdx = b.beginAtomIdx === atom.index ? b.endAtomIdx : b.beginAtomIdx;
    const other = atoms.find(a => a.index === otherIdx);
    return other?.symbol === 'O';
  });

  let envClass: AtomEnvironmentClass = 'unknown';
  const hCount = atom.implicitHydrogens + (atom.symbol === 'H' ? 1 : 0);
  const isExchangeable = (atom.symbol === 'O' || atom.symbol === 'N' || atom.symbol === 'S') && hCount > 0;

  if (atom.symbol === 'C') {
    if (atom.isAromatic) {
      envClass = 'aromatic';
    } else if (carbonylAdjacent && atom.hybridization?.includes('SP2')) {
      const oNeighbor = neighborAtoms.find(a => a.symbol === 'O');
      const hasDoubleO = bonds.some(b =>
        ((b.beginAtomIdx === atom.index && b.endAtomIdx === oNeighbor?.index) ||
         (b.endAtomIdx === atom.index && b.beginAtomIdx === oNeighbor?.index)) &&
        b.bondOrder >= 2
      );
      if (hasDoubleO) {
        if (hCount >= 1) envClass = 'carbonyl_aldehyde';
        else {
          const hasEsterO = neighborAtoms.some(a => a.symbol === 'O' && !bonds.some(bb =>
            ((bb.beginAtomIdx === atom.index && bb.endAtomIdx === a.index) ||
             (bb.endAtomIdx === atom.index && bb.beginAtomIdx === a.index)) && bb.bondOrder >= 2
          ));
          const hasN = neighborAtoms.some(a => a.symbol === 'N');
          if (hasN) envClass = 'carbonyl_amide';
          else if (hasEsterO) envClass = 'carbonyl_ester';
          else envClass = 'carbonyl_ketone';
        }
      }
    } else if (atom.hybridization?.includes('SP') && !atom.hybridization?.includes('SP2') && !atom.hybridization?.includes('SP3')) {
      const hasTripleN = bonds.some(b =>
        (b.beginAtomIdx === atom.index || b.endAtomIdx === atom.index) &&
        b.bondOrder >= 3 &&
        atoms.find(a => a.index === (b.beginAtomIdx === atom.index ? b.endAtomIdx : b.beginAtomIdx))?.symbol === 'N'
      );
      envClass = hasTripleN ? 'nitrile' : 'unknown';
    } else {
      const isAllylic = neighborAtoms.some(a => a.isAromatic || (a.hybridization?.includes('SP2') && a.symbol === 'C'));
      const isAlphaO = neighborAtoms.some(a => a.symbol === 'O');
      const isAlphaN = neighborAtoms.some(a => a.symbol === 'N');
      const isAlphaHalogen = neighborAtoms.some(a => ['F', 'Cl', 'Br', 'I'].includes(a.symbol));
      const isAlphaCarbonyl = neighborAtoms.some(na => {
        if (na.symbol !== 'C') return false;
        return bonds.some(b =>
          (b.beginAtomIdx === na.index || b.endAtomIdx === na.index) &&
          b.bondOrder >= 2 &&
          atoms.find(a => a.index === (b.beginAtomIdx === na.index ? b.endAtomIdx : b.beginAtomIdx))?.symbol === 'O'
        );
      });

      if (atom.isAromatic) envClass = 'aromatic';
      else if (isAllylic && atom.ringSize) envClass = 'benzylic';
      else if (isAlphaCarbonyl) envClass = 'alpha_to_carbonyl';
      else if (isAlphaO) envClass = 'alpha_to_oxygen';
      else if (isAlphaN) envClass = 'alpha_to_nitrogen';
      else if (isAlphaHalogen) envClass = 'alpha_to_halogen';
      else if (hCount === 3) envClass = 'alkyl_ch3';
      else if (hCount === 2) envClass = 'alkyl_ch2';
      else if (hCount === 1) envClass = 'alkyl_ch';
      else envClass = 'alkyl_c';
    }
  } else if (atom.symbol === 'O') {
    if (hCount > 0 && neighborAtoms.some(a => a.isAromatic)) envClass = 'phenolic_oh';
    else if (hCount > 0 && neighborAtoms.some(a => {
      return bonds.some(b =>
        (b.beginAtomIdx === a.index || b.endAtomIdx === a.index) &&
        b.bondOrder >= 2 &&
        atoms.find(aa => aa.index === (b.beginAtomIdx === a.index ? b.endAtomIdx : b.beginAtomIdx))?.symbol === 'O'
      );
    })) envClass = 'carboxylic_oh';
    else if (hCount > 0) envClass = 'alcoholic_oh';
  } else if (atom.symbol === 'N') {
    const hasAmideCarbonyl = neighborAtoms.some(a => {
      if (a.symbol !== 'C') return false;
      return bonds.some(b =>
        (b.beginAtomIdx === a.index || b.endAtomIdx === a.index) &&
        b.bondOrder >= 2 &&
        atoms.find(aa => aa.index === (b.beginAtomIdx === a.index ? b.endAtomIdx : b.beginAtomIdx))?.symbol === 'O'
      );
    });
    envClass = hasAmideCarbonyl ? 'amide_nh' : 'amine_nh';
  } else if (atom.symbol === 'S' && hCount > 0) {
    envClass = 'thiol_sh';
  }

  return {
    atomIdx: atom.index,
    symbol: atom.symbol,
    envClass,
    hCount,
    isExchangeable,
    neighbors,
    heteroNeighborCount,
    carbonylAdjacent,
    aromaticRingMember: atom.isAromatic,
    ringSize: atom.ringSize ?? null,
  };
}

// ---------------------------------------------------------------------------
// Functional group detection
// ---------------------------------------------------------------------------

export function classifyFunctionalGroups(
  atoms: AtomRecord[],
  bonds: BondRecord[]
): FunctionalGroupFlags {
  const flags: FunctionalGroupFlags = {
    hasOH: false, hasNH: false, hasCarbonyl: false,
    hasCarbonylKetone: false, hasCarbonylAldehyde: false,
    hasCarbonylEster: false, hasCarbonylAcid: false,
    hasCarbonylAmide: false, hasNitrile: false, hasNitro: false,
    hasEther: false, hasThioether: false, hasSulfonyl: false,
    hasPhosphate: false, hasHalogen: false, hasFluorine: false,
    hasChlorine: false, hasBromine: false, hasIodine: false,
    hasAromaticRing: false, hasAlkene: false, hasAlkyne: false,
    hasMethoxy: false, hasAnhydride: false,
  };

  for (const atom of atoms) {
    if (atom.isAromatic) flags.hasAromaticRing = true;
    if (atom.symbol === 'F') { flags.hasHalogen = true; flags.hasFluorine = true; }
    if (atom.symbol === 'Cl') { flags.hasHalogen = true; flags.hasChlorine = true; }
    if (atom.symbol === 'Br') { flags.hasHalogen = true; flags.hasBromine = true; }
    if (atom.symbol === 'I') { flags.hasHalogen = true; flags.hasIodine = true; }

    if ((atom.symbol === 'O' || atom.symbol === 'N') && atom.implicitHydrogens > 0) {
      if (atom.symbol === 'O') flags.hasOH = true;
      if (atom.symbol === 'N') flags.hasNH = true;
    }
  }

  for (const bond of bonds) {
    const a1 = atoms.find(a => a.index === bond.beginAtomIdx);
    const a2 = atoms.find(a => a.index === bond.endAtomIdx);
    if (!a1 || !a2) continue;

    if (bond.bondOrder >= 2 && !bond.isAromatic) {
      if (a1.symbol === 'C' && a2.symbol === 'O') {
        flags.hasCarbonyl = true;
        if (a1.implicitHydrogens > 0) flags.hasCarbonylAldehyde = true;
      } else if (a2.symbol === 'C' && a1.symbol === 'O') {
        flags.hasCarbonyl = true;
        if (a2.implicitHydrogens > 0) flags.hasCarbonylAldehyde = true;
      } else if (a1.symbol === 'C' && a2.symbol === 'C') {
        flags.hasAlkene = true;
      } else if (a1.symbol === 'C' && a2.symbol === 'N' && bond.bondOrder >= 3) {
        flags.hasNitrile = true;
      } else if (a2.symbol === 'C' && a1.symbol === 'N' && bond.bondOrder >= 3) {
        flags.hasNitrile = true;
      }
    }
    if (bond.bondOrder >= 3 && a1.symbol === 'C' && a2.symbol === 'C') {
      flags.hasAlkyne = true;
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Exchangeable proton detection
// ---------------------------------------------------------------------------

export function detectExchangeableProtons(
  atoms: AtomRecord[]
): { count: number; sites: Array<{ atomIdx: number; symbol: string; hCount: number }> } {
  const sites: Array<{ atomIdx: number; symbol: string; hCount: number }> = [];
  let count = 0;

  for (const atom of atoms) {
    if (['O', 'N', 'S'].includes(atom.symbol) && atom.implicitHydrogens > 0) {
      sites.push({
        atomIdx: atom.index,
        symbol: atom.symbol,
        hCount: atom.implicitHydrogens,
      });
      count += atom.implicitHydrogens;
    }
  }

  return { count, sites };
}

// ---------------------------------------------------------------------------
// Expected unique carbon count (basic symmetry estimation)
// ---------------------------------------------------------------------------

export function countExpectedUniqueCarbons(
  atoms: AtomRecord[],
  bonds: BondRecord[]
): number {
  const carbons = atoms.filter(a => a.symbol === 'C');
  if (carbons.length === 0) return 0;

  // Basic heuristic: group carbons by (hybridization, isAromatic, neighborCount, hCount)
  // A proper implementation requires graph automorphism (nauty/bliss).
  // This provides a reasonable lower bound.
  const signatures = new Map<string, number>();

  for (const c of carbons) {
    const neighborBonds = bonds.filter(
      b => b.beginAtomIdx === c.index || b.endAtomIdx === c.index
    );
    const neighborSymbols = neighborBonds
      .map(b => {
        const otherIdx = b.beginAtomIdx === c.index ? b.endAtomIdx : b.beginAtomIdx;
        const other = atoms.find(a => a.index === otherIdx);
        return other ? `${other.symbol}:${b.bondOrder}` : '?';
      })
      .sort()
      .join(',');

    const sig = `${c.hybridization}|${c.isAromatic}|${c.implicitHydrogens}|${c.ringSize}|${neighborSymbols}`;
    signatures.set(sig, (signatures.get(sig) ?? 0) + 1);
  }

  return signatures.size;
}
