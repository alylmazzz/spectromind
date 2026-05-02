/**
 * Core "expected variables" from molecule graph (graph-derived, not heuristic).
 * Used by predictors and verification; single source of truth.
 */

export interface MoleculeGraphAtom {
  index: number;
  symbol: string;
  formalCharge: number;
  implicitHydrogens: number;
  explicitHydrogens?: number;
  isAromatic: boolean;
  hybridization?: string;
  ringSize?: number;
  ringCount?: number;
}

export interface MoleculeGraphBond {
  beginAtomIdx: number;
  endAtomIdx: number;
  bondOrder: number;
  bondType: string;
  isAromatic: boolean;
}

export interface MoleculeGraph {
  canonicalSmiles: string;
  inputSmiles?: string;
  atoms: MoleculeGraphAtom[];
  bonds: MoleculeGraphBond[];
  formula: string;
  formulaHill?: string;
  atomCounts: Record<string, number>;
  dbe?: number;
  source: string;
}

export interface GraphFeatures {
  nC_total: number;
  nH_total: number;
  nX_total: number;
  dbe: number;
  nC_aromatic: number;
  nH_aromatic: number;
  nC_sp2_non_aromatic: number;
  nC_carbonyl: number;
  nC_protonated: number;
  nCH3: number;
  nCH2: number;
  nCH: number;
  nC_quaternary: number;
  nH_exchangeable: number;
  nH_non_exchangeable: number;
  has_carbonyl: boolean;
  has_nitrile: boolean;
  has_halogen: boolean;
  expected_unique_carbons_approx: number;
}

/**
 * Compute features from graph. All counts are graph-derived.
 * Exchangeable H: attached to O/N (OH, NH, SH, COOH) — do NOT count CH/CH2 as exchangeable.
 */
export function computeGraphFeatures(graph: MoleculeGraph): GraphFeatures {
  const atoms = graph.atoms;
  const bonds = graph.bonds;
  const counts = graph.atomCounts || {};

  const nC_total = counts.C ?? 0;
  const nH_total = counts.H ?? 0;
  const nX_total = (counts.F ?? 0) + (counts.Cl ?? 0) + (counts.Br ?? 0) + (counts.I ?? 0);
  const dbe = graph.dbe ?? 0;

  let nC_aromatic = 0;
  let nH_aromatic = 0;
  let nC_sp2_non_aromatic = 0;
  let nC_carbonyl = 0;
  let nCH3 = 0;
  let nCH2 = 0;
  let nCH = 0;
  let nC_quaternary = 0;
  let nH_exchangeable = 0;

  const isO = (i: number) => atoms[i]?.symbol === 'O';
  const isC = (i: number) => atoms[i]?.symbol === 'C';

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.symbol === 'C') {
      const h = a.implicitHydrogens ?? 0;
      if (a.isAromatic) {
        nC_aromatic++;
        nH_aromatic += h;
      } else if ((a.hybridization || '').toLowerCase().includes('sp2')) {
        nC_sp2_non_aromatic++;
      }
      if (h === 3) nCH3++;
      else if (h === 2) nCH2++;
      else if (h === 1) nCH++;
      else if (h === 0) nC_quaternary++;
    }
  }

  for (const b of bonds) {
    const order = b.bondOrder || (b.isAromatic ? 1.5 : 1);
    if (order >= 2 && isC(b.beginAtomIdx) && isO(b.endAtomIdx)) nC_carbonyl++;
    if (order >= 2 && isC(b.endAtomIdx) && isO(b.beginAtomIdx)) nC_carbonyl++;
  }

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const h = a.implicitHydrogens ?? 0;
    if (a.symbol === 'O' && h >= 1) nH_exchangeable += h;
    if (a.symbol === 'N' && h >= 1) nH_exchangeable += Math.min(h, 2);
    if (a.symbol === 'S' && h >= 1) nH_exchangeable += h;
  }

  const nC_protonated = nCH3 + nCH2 + nCH;
  const nH_non_exchangeable = Math.max(0, nH_total - nH_exchangeable);

  const has_nitrile = bonds.some(
    (b) => b.bondOrder >= 3 && (atoms[b.beginAtomIdx]?.symbol === 'N' || atoms[b.endAtomIdx]?.symbol === 'N')
  );
  const has_halogen = nX_total > 0;
  const has_carbonyl = nC_carbonyl > 0;

  // Estimate unique carbons using neighbor-signature heuristic.
  // A proper implementation requires graph automorphism (nauty/bliss).
  const carbonSignatures = new Set<string>();
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.symbol !== 'C') continue;
    const neighborBonds = bonds.filter(
      b => b.beginAtomIdx === a.index || b.endAtomIdx === a.index
    );
    const neighborSig = neighborBonds
      .map(b => {
        const otherIdx = b.beginAtomIdx === a.index ? b.endAtomIdx : b.beginAtomIdx;
        const other = atoms[otherIdx];
        return other ? `${other.symbol}:${b.bondOrder}:${other.isAromatic}` : '?';
      })
      .sort()
      .join(',');
    const sig = `${a.hybridization}|${a.isAromatic}|${a.implicitHydrogens ?? 0}|${a.ringSize ?? 0}|${neighborSig}`;
    carbonSignatures.add(sig);
  }
  const expected_unique_carbons_approx = carbonSignatures.size || nC_total;

  return {
    nC_total,
    nH_total,
    nX_total,
    dbe,
    nC_aromatic,
    nH_aromatic,
    nC_sp2_non_aromatic,
    nC_carbonyl,
    nC_protonated: nCH3 + nCH2 + nCH,
    nCH3,
    nCH2,
    nCH,
    nC_quaternary,
    nH_exchangeable,
    nH_non_exchangeable,
    has_carbonyl,
    has_nitrile,
    has_halogen,
    expected_unique_carbons_approx,
  };
}
