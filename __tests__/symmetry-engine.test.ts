import { describe, it, expect } from 'vitest';
import {
  computeEquivalenceClasses,
  expectedUniqueCarbon13Signals,
} from '../packages/chem-kernel/symmetry';
import type { AtomRecord, BondRecord, MolecularGraph } from '../packages/chem-kernel/types';

function makeGraph(
  atoms: Partial<AtomRecord>[],
  bonds: Partial<BondRecord>[],
): MolecularGraph {
  return {
    canonicalSmiles: '',
    inputSmiles: '',
    atoms: atoms.map((a, i) => ({
      index: i,
      symbol: 'C',
      formalCharge: 0,
      implicitHydrogens: 0,
      totalHydrogens: 0,
      isAromatic: false,
      hybridization: 'SP3',
      ringSize: null,
      ringCount: 0,
      inRing: false,
      ...a,
      index: a.index ?? i,
    })),
    bonds: bonds.map(b => ({
      beginAtomIdx: 0,
      endAtomIdx: 1,
      bondOrder: 1,
      bondType: 'SINGLE',
      isAromatic: false,
      ...b,
    })),
    formula: '',
    formulaHill: '',
    atomCounts: {},
    dbe: 0,
    exactMass: 0,
    formalCharge: 0,
    source: 'rdkit',
    chiralCenters: [],
  };
}

describe('Symmetry Engine', () => {
  it('all carbons in methane are equivalent (single C)', () => {
    const graph = makeGraph(
      [{ symbol: 'C', implicitHydrogens: 4 }],
      []
    );
    const eq = computeEquivalenceClasses(graph);
    expect(eq.uniqueCarbonCount).toBe(1);
    expect(eq.uniqueAtomCount).toBe(1);
  });

  it('ethane has 2 equivalent CH3 groups → 1 unique carbon', () => {
    const graph = makeGraph(
      [
        { index: 0, symbol: 'C', implicitHydrogens: 3 },
        { index: 1, symbol: 'C', implicitHydrogens: 3 },
      ],
      [{ beginAtomIdx: 0, endAtomIdx: 1 }]
    );
    const eq = computeEquivalenceClasses(graph);
    expect(eq.uniqueCarbonCount).toBe(1);
  });

  it('propane has 2 types of carbon (CH3 and CH2)', () => {
    const graph = makeGraph(
      [
        { index: 0, symbol: 'C', implicitHydrogens: 3 },
        { index: 1, symbol: 'C', implicitHydrogens: 2 },
        { index: 2, symbol: 'C', implicitHydrogens: 3 },
      ],
      [
        { beginAtomIdx: 0, endAtomIdx: 1 },
        { beginAtomIdx: 1, endAtomIdx: 2 },
      ]
    );
    const eq = computeEquivalenceClasses(graph);
    expect(eq.uniqueCarbonCount).toBe(2);
  });

  it('benzene has 1 unique carbon class (all equivalent)', () => {
    const graph = makeGraph(
      Array.from({ length: 6 }, (_, i) => ({
        index: i,
        symbol: 'C',
        isAromatic: true,
        implicitHydrogens: 1,
        hybridization: 'SP2' as const,
        inRing: true,
        ringSize: 6,
        ringCount: 1,
      })),
      Array.from({ length: 6 }, (_, i) => ({
        beginAtomIdx: i,
        endAtomIdx: (i + 1) % 6,
        isAromatic: true,
        bondOrder: 1.5,
      }))
    );
    const eq = computeEquivalenceClasses(graph);
    expect(eq.uniqueCarbonCount).toBe(1);
  });

  it('toluene has more than 1 unique carbon', () => {
    const atoms: Partial<AtomRecord>[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        index: i,
        symbol: 'C' as string,
        isAromatic: true,
        implicitHydrogens: i === 0 ? 0 : 1,
        hybridization: 'SP2' as const,
        inRing: true,
        ringSize: 6,
        ringCount: 1,
      })),
      { index: 6, symbol: 'C', implicitHydrogens: 3, hybridization: 'SP3' as const },
    ];
    const bonds: Partial<BondRecord>[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        beginAtomIdx: i,
        endAtomIdx: (i + 1) % 6,
        isAromatic: true,
        bondOrder: 1.5,
      })),
      { beginAtomIdx: 0, endAtomIdx: 6, bondOrder: 1 },
    ];
    const graph = makeGraph(atoms, bonds);
    const eq = computeEquivalenceClasses(graph);
    expect(eq.uniqueCarbonCount).toBeGreaterThan(1);
    expect(eq.uniqueCarbonCount).toBeLessThanOrEqual(5);
  });

  it('returns empty for no atoms', () => {
    const graph = makeGraph([], []);
    const eq = computeEquivalenceClasses(graph);
    expect(eq.uniqueAtomCount).toBe(0);
    expect(eq.classes).toHaveLength(0);
  });

  it('expectedUniqueCarbon13Signals wraps correctly', () => {
    const graph = makeGraph(
      [
        { index: 0, symbol: 'C', implicitHydrogens: 3 },
        { index: 1, symbol: 'C', implicitHydrogens: 2 },
        { index: 2, symbol: 'C', implicitHydrogens: 3 },
      ],
      [
        { beginAtomIdx: 0, endAtomIdx: 1 },
        { beginAtomIdx: 1, endAtomIdx: 2 },
      ]
    );
    const result = expectedUniqueCarbon13Signals(graph);
    expect(result.count).toBe(2);
    expect(result.carbonClasses.length).toBe(2);
  });
});
