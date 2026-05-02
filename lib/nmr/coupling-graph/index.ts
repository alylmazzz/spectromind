/**
 * Unified Coupling Graph Backbone
 *
 * Shared infrastructure for 1H, COSY, HSQC, HMBC forward generation and
 * verification.  All 2D NMR modalities operate on the same underlying
 * molecular coupling graph.
 *
 * Nodes = atoms, Edges = bonds/couplings.
 * The graph carries:
 *   - 1-bond (direct) attachments (for HSQC)
 *   - 2-bond / 3-bond scalar coupling paths (for COSY)
 *   - 2J/3J long-range paths (for HMBC)
 *   - Through-space proximity edges (for NOESY/ROESY, requires 3D)
 */

import type { AtomRecord, BondRecord, MolecularGraph } from '@/packages/chem-kernel/types';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CouplingEdge {
  from: number;
  to: number;
  pathLength: number;
  bondPath: number[];
  couplingType: 'direct_1J' | 'vicinal_3J' | 'geminal_2J' | 'long_range' | 'through_space';
  estimatedJ?: number;
  isWeak?: boolean;
}

export interface HSQCCorrelation {
  hAtomIdx: number;
  cAtomIdx: number;
  hPpmExpected?: number;
  cPpmExpected?: number;
  multiplicity?: 'CH3' | 'CH2' | 'CH';
}

export interface COSYCorrelation {
  h1AtomIdx: number;
  h2AtomIdx: number;
  pathLength: number;
  bondPath: number[];
  estimatedJ?: number;
  isStrong: boolean;
}

export interface HMBCCorrelation {
  hAtomIdx: number;
  cAtomIdx: number;
  pathLength: number;
  bondPath: number[];
  isOptional: boolean;
  reason?: string;
}

export interface CouplingGraph {
  edges: CouplingEdge[];
  hsqcCorrelations: HSQCCorrelation[];
  cosyCorrelations: COSYCorrelation[];
  hmbcCorrelations: HMBCCorrelation[];
  impossibleCorrelations: Array<{ type: string; description: string }>;
  coverageMetrics: {
    hsqcExpected: number;
    cosyExpected: number;
    hmbcExpected: number;
    totalProtonatedCarbons: number;
    totalProtonPairs: number;
    totalLongRangePaths: number;
  };
}

// --------------------------------------------------------------------------
// Path enumeration
// --------------------------------------------------------------------------

function findPathsBFS(
  startIdx: number,
  maxLength: number,
  adj: Map<number, Array<{ neighbor: number; bondIdx: number }>>,
  atoms: AtomRecord[]
): Array<{ endIdx: number; path: number[]; length: number }> {
  const results: Array<{ endIdx: number; path: number[]; length: number }> = [];
  const queue: Array<{ current: number; path: number[]; length: number }> = [
    { current: startIdx, path: [startIdx], length: 0 },
  ];
  const visited = new Set<number>();
  visited.add(startIdx);

  while (queue.length > 0) {
    const { current, path, length } = queue.shift()!;
    if (length > 0) {
      results.push({ endIdx: current, path: [...path], length });
    }
    if (length >= maxLength) continue;

    for (const { neighbor } of adj.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ current: neighbor, path: [...path, neighbor], length: length + 1 });
    }
  }

  return results;
}

function buildAdj(bonds: BondRecord[]): Map<number, Array<{ neighbor: number; bondIdx: number }>> {
  const adj = new Map<number, Array<{ neighbor: number; bondIdx: number }>>();
  for (let i = 0; i < bonds.length; i++) {
    const b = bonds[i];
    if (!adj.has(b.beginAtomIdx)) adj.set(b.beginAtomIdx, []);
    if (!adj.has(b.endAtomIdx)) adj.set(b.endAtomIdx, []);
    adj.get(b.beginAtomIdx)!.push({ neighbor: b.endAtomIdx, bondIdx: i });
    adj.get(b.endAtomIdx)!.push({ neighbor: b.beginAtomIdx, bondIdx: i });
  }
  return adj;
}

// --------------------------------------------------------------------------
// Estimated J coupling (simplified Karplus-like)
// --------------------------------------------------------------------------

function estimateJ(pathLength: number, isAromatic: boolean): number | undefined {
  if (pathLength === 2) return 12.0; // geminal 2J ~-12 Hz (magnitude)
  if (pathLength === 3) {
    if (isAromatic) return 8.0; // ortho aromatic
    return 7.0; // vicinal (average Karplus)
  }
  if (pathLength === 4) return 2.0; // long-range
  return undefined;
}

// --------------------------------------------------------------------------
// HSQC: direct one-bond C-H mapping
// --------------------------------------------------------------------------

function buildHSQC(atoms: AtomRecord[], bonds: BondRecord[]): HSQCCorrelation[] {
  const correlations: HSQCCorrelation[] = [];

  for (const bond of bonds) {
    if (bond.bondOrder !== 1) continue;
    const a1 = atoms.find(a => a.index === bond.beginAtomIdx);
    const a2 = atoms.find(a => a.index === bond.endAtomIdx);
    if (!a1 || !a2) continue;

    let hIdx: number | undefined;
    let cIdx: number | undefined;

    if (a1.symbol === 'H' && a2.symbol === 'C') { hIdx = a1.index; cIdx = a2.index; }
    else if (a2.symbol === 'H' && a1.symbol === 'C') { hIdx = a2.index; cIdx = a1.index; }

    if (hIdx !== undefined && cIdx !== undefined) {
      const cAtom = atoms.find(a => a.index === cIdx)!;
      const mult: 'CH3' | 'CH2' | 'CH' =
        cAtom.implicitHydrogens >= 3 ? 'CH3'
        : cAtom.implicitHydrogens === 2 ? 'CH2'
        : 'CH';
      correlations.push({ hAtomIdx: hIdx, cAtomIdx: cIdx, multiplicity: mult });
    }
  }

  for (const atom of atoms) {
    if (atom.symbol === 'C' && atom.implicitHydrogens > 0) {
      const existing = correlations.some(c => c.cAtomIdx === atom.index);
      if (!existing) {
        const mult: 'CH3' | 'CH2' | 'CH' =
          atom.implicitHydrogens >= 3 ? 'CH3'
          : atom.implicitHydrogens === 2 ? 'CH2'
          : 'CH';
        correlations.push({
          hAtomIdx: -1, // implicit
          cAtomIdx: atom.index,
          multiplicity: mult,
        });
      }
    }
  }

  return correlations;
}

// --------------------------------------------------------------------------
// COSY: vicinal H-H scalar coupling (3-bond paths between protons)
// --------------------------------------------------------------------------

function buildCOSY(atoms: AtomRecord[], bonds: BondRecord[]): COSYCorrelation[] {
  const adj = buildAdj(bonds);
  const hAtoms = atoms.filter(a => a.symbol === 'H');
  const correlations: COSYCorrelation[] = [];
  const seen = new Set<string>();

  for (const h of hAtoms) {
    const paths = findPathsBFS(h.index, 4, adj, atoms);
    for (const p of paths) {
      if (p.length < 2 || p.length > 4) continue;
      const endAtom = atoms.find(a => a.index === p.endIdx);
      if (!endAtom || endAtom.symbol !== 'H') continue;

      const key = [Math.min(h.index, p.endIdx), Math.max(h.index, p.endIdx)].join('-');
      if (seen.has(key)) continue;
      seen.add(key);

      const aromaticPath = p.path.some(idx => atoms.find(a => a.index === idx)?.isAromatic);
      const j = estimateJ(p.length, aromaticPath);
      correlations.push({
        h1AtomIdx: h.index,
        h2AtomIdx: p.endIdx,
        pathLength: p.length,
        bondPath: p.path,
        estimatedJ: j,
        isStrong: p.length === 3,
      });
    }
  }

  return correlations;
}

// --------------------------------------------------------------------------
// HMBC: 2J/3J H-C long-range correlations
// --------------------------------------------------------------------------

function buildHMBC(atoms: AtomRecord[], bonds: BondRecord[]): HMBCCorrelation[] {
  const adj = buildAdj(bonds);
  const correlations: HMBCCorrelation[] = [];
  const seen = new Set<string>();

  const protonSources: number[] = [];
  for (const a of atoms) {
    if (a.symbol === 'H') protonSources.push(a.index);
    if (a.implicitHydrogens > 0) protonSources.push(a.index);
  }

  for (const hIdx of protonSources) {
    const paths = findPathsBFS(hIdx, 4, adj, atoms);
    for (const p of paths) {
      if (p.length < 2 || p.length > 3) continue;
      const endAtom = atoms.find(a => a.index === p.endIdx);
      if (!endAtom || endAtom.symbol !== 'C') continue;

      if (p.length === 1) continue;

      const key = `${hIdx}-${p.endIdx}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isOptional = endAtom.isAromatic && p.length === 3;
      correlations.push({
        hAtomIdx: hIdx,
        cAtomIdx: p.endIdx,
        pathLength: p.length,
        bondPath: p.path,
        isOptional,
        reason: isOptional ? 'Aromatic 3J HMBC may be weak' : undefined,
      });
    }
  }

  return correlations;
}

// --------------------------------------------------------------------------
// Impossible correlation detection
// --------------------------------------------------------------------------

function findImpossibleCorrelations(
  hsqc: HSQCCorrelation[],
  cosy: COSYCorrelation[],
  hmbc: HMBCCorrelation[],
  atoms: AtomRecord[]
): Array<{ type: string; description: string }> {
  const impossible: Array<{ type: string; description: string }> = [];

  for (const c of hsqc) {
    const carbon = atoms.find(a => a.index === c.cAtomIdx);
    if (carbon && carbon.implicitHydrogens === 0 && c.hAtomIdx !== -1) {
      impossible.push({
        type: 'HSQC_NO_H',
        description: `HSQC correlation to C-${c.cAtomIdx} which has no attached H`,
      });
    }
  }

  return impossible;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export function buildCouplingGraph(graph: MolecularGraph): CouplingGraph {
  const { atoms, bonds } = graph;

  const hsqc = buildHSQC(atoms, bonds);
  const cosy = buildCOSY(atoms, bonds);
  const hmbc = buildHMBC(atoms, bonds);
  const impossible = findImpossibleCorrelations(hsqc, cosy, hmbc, atoms);

  const edges: CouplingEdge[] = [];

  for (const c of hsqc) {
    edges.push({
      from: c.hAtomIdx,
      to: c.cAtomIdx,
      pathLength: 1,
      bondPath: [c.hAtomIdx, c.cAtomIdx],
      couplingType: 'direct_1J',
    });
  }
  for (const c of cosy) {
    edges.push({
      from: c.h1AtomIdx,
      to: c.h2AtomIdx,
      pathLength: c.pathLength,
      bondPath: c.bondPath,
      couplingType: c.pathLength === 2 ? 'geminal_2J' : c.pathLength === 3 ? 'vicinal_3J' : 'long_range',
      estimatedJ: c.estimatedJ,
      isWeak: !c.isStrong,
    });
  }
  for (const c of hmbc) {
    edges.push({
      from: c.hAtomIdx,
      to: c.cAtomIdx,
      pathLength: c.pathLength,
      bondPath: c.bondPath,
      couplingType: 'long_range',
      isWeak: c.isOptional,
    });
  }

  return {
    edges,
    hsqcCorrelations: hsqc,
    cosyCorrelations: cosy,
    hmbcCorrelations: hmbc,
    impossibleCorrelations: impossible,
    coverageMetrics: {
      hsqcExpected: hsqc.length,
      cosyExpected: cosy.filter(c => c.isStrong).length,
      hmbcExpected: hmbc.filter(c => !c.isOptional).length,
      totalProtonatedCarbons: atoms.filter(a => a.symbol === 'C' && a.implicitHydrogens > 0).length,
      totalProtonPairs: cosy.length,
      totalLongRangePaths: hmbc.length,
    },
  };
}

/**
 * Verify observed 2D peaks against the coupling graph.
 * Returns coverage ratios and contradiction flags.
 */
export function verify2DCorrelations(
  couplingGraph: CouplingGraph,
  observed: {
    hsqc?: Array<{ f1: number; f2: number }>;
    cosy?: Array<{ f1: number; f2: number }>;
    hmbc?: Array<{ f1: number; f2: number }>;
  }
): {
  hsqcCoverage: number;
  cosyCoverage: number;
  hmbcCoverage: number;
  contradictions: string[];
  summary: string;
} {
  const contradictions: string[] = [];

  const hsqcCov = observed.hsqc
    ? observed.hsqc.length / Math.max(1, couplingGraph.coverageMetrics.hsqcExpected)
    : -1;

  const cosyCov = observed.cosy
    ? observed.cosy.length / Math.max(1, couplingGraph.coverageMetrics.cosyExpected)
    : -1;

  const hmbcCov = observed.hmbc
    ? observed.hmbc.length / Math.max(1, couplingGraph.coverageMetrics.hmbcExpected)
    : -1;

  if (hsqcCov >= 0 && hsqcCov < 0.3) {
    contradictions.push('Very low HSQC coverage — possible wrong structure or poor data quality');
  }

  for (const imp of couplingGraph.impossibleCorrelations) {
    contradictions.push(`Impossible correlation: ${imp.description}`);
  }

  const parts: string[] = [];
  if (hsqcCov >= 0) parts.push(`HSQC: ${(hsqcCov * 100).toFixed(0)}%`);
  if (cosyCov >= 0) parts.push(`COSY: ${(cosyCov * 100).toFixed(0)}%`);
  if (hmbcCov >= 0) parts.push(`HMBC: ${(hmbcCov * 100).toFixed(0)}%`);

  return {
    hsqcCoverage: hsqcCov,
    cosyCoverage: cosyCov,
    hmbcCoverage: hmbcCov,
    contradictions,
    summary: parts.length > 0 ? `2D coverage: ${parts.join(', ')}` : 'No 2D data provided',
  };
}
