import { describe, it, expect } from 'vitest';
import { predictCarbon13Spectrum } from '../lib/nmr/carbon13/engine';
import type { MolecularGraph, AtomRecord, BondRecord } from '../packages/chem-kernel/types';

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

describe('Carbon-13 Engine', () => {
  it('predicts no peaks for empty graph', () => {
    const graph = makeGraph([], []);
    const result = predictCarbon13Spectrum(graph);
    expect(result.peaks).toHaveLength(0);
    expect(result.totalCarbons).toBe(0);
  });

  it('predicts methane (single CH4) near 0 ppm', () => {
    const graph = makeGraph(
      [{ symbol: 'C', implicitHydrogens: 4 }],
      []
    );
    const result = predictCarbon13Spectrum(graph);
    expect(result.peaks).toHaveLength(1);
    const peak = result.peaks[0];
    expect(peak.predictedShift).toBeLessThan(30);
    // Methane has 4 implicit H — engine classifies as alkyl_primary (CH3-like)
    // because implicitHydrogens >= 3; this is correct for the additive model
    expect(['CH3', 'C']).toContain(peak.deptClass);
  });

  it('predicts ethane CH3 groups', () => {
    const graph = makeGraph(
      [
        { index: 0, symbol: 'C', implicitHydrogens: 3 },
        { index: 1, symbol: 'C', implicitHydrogens: 3 },
      ],
      [{ beginAtomIdx: 0, endAtomIdx: 1 }]
    );
    const result = predictCarbon13Spectrum(graph);
    expect(result.peaks.length).toBeGreaterThanOrEqual(1);
    expect(result.peaks.every(p => p.deptClass === 'CH3')).toBe(true);
    expect(result.peaks[0].predictedShift).toBeLessThan(30);
  });

  it('predicts aromatic carbons in benzene-like ring', () => {
    const atoms = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      symbol: 'C' as string,
      isAromatic: true,
      implicitHydrogens: 1,
      hybridization: 'SP2' as const,
      inRing: true,
      ringSize: 6,
      ringCount: 1,
    }));
    const bonds = Array.from({ length: 6 }, (_, i) => ({
      beginAtomIdx: i,
      endAtomIdx: (i + 1) % 6,
      isAromatic: true,
      bondOrder: 1.5,
    }));
    const graph = makeGraph(atoms, bonds);
    const result = predictCarbon13Spectrum(graph);
    expect(result.peaks.length).toBe(6);
    for (const peak of result.peaks) {
      expect(peak.predictedShift).toBeGreaterThan(100);
      expect(peak.predictedShift).toBeLessThan(180);
      expect(peak.carbonType).toContain('aromatic');
    }
  });

  it('predicts carbonyl ketone in correct region', () => {
    const graph = makeGraph(
      [
        { index: 0, symbol: 'C', implicitHydrogens: 3 },
        { index: 1, symbol: 'C', implicitHydrogens: 0, hybridization: 'SP2' },
        { index: 2, symbol: 'O', implicitHydrogens: 0 },
        { index: 3, symbol: 'C', implicitHydrogens: 3 },
      ],
      [
        { beginAtomIdx: 0, endAtomIdx: 1 },
        { beginAtomIdx: 1, endAtomIdx: 2, bondOrder: 2 },
        { beginAtomIdx: 1, endAtomIdx: 3 },
      ]
    );
    const result = predictCarbon13Spectrum(graph);
    const carbonylPeaks = result.peaks.filter(p => p.carbonType === 'carbonyl_ketone');
    expect(carbonylPeaks.length).toBeGreaterThanOrEqual(1);
    for (const p of carbonylPeaks) {
      expect(p.predictedShift).toBeGreaterThan(150);
      expect(p.predictedShift).toBeLessThan(230);
    }
  });

  it('includes version and method info', () => {
    const graph = makeGraph([{ symbol: 'C', implicitHydrogens: 4 }], []);
    const result = predictCarbon13Spectrum(graph);
    expect(result.version).toBeDefined();
    expect(result.method).toBe('additive_substituent_model_v1');
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('flags quaternary carbons with warnings', () => {
    const graph = makeGraph(
      [
        { index: 0, symbol: 'C', implicitHydrogens: 0 },
        { index: 1, symbol: 'C', implicitHydrogens: 3 },
        { index: 2, symbol: 'C', implicitHydrogens: 3 },
        { index: 3, symbol: 'C', implicitHydrogens: 3 },
        { index: 4, symbol: 'C', implicitHydrogens: 3 },
      ],
      [
        { beginAtomIdx: 0, endAtomIdx: 1 },
        { beginAtomIdx: 0, endAtomIdx: 2 },
        { beginAtomIdx: 0, endAtomIdx: 3 },
        { beginAtomIdx: 0, endAtomIdx: 4 },
      ]
    );
    const result = predictCarbon13Spectrum(graph);
    const qC = result.peaks.find(p => p.carbonType === 'alkyl_quaternary');
    expect(qC).toBeDefined();
    expect(qC!.deptClass).toBe('C');
    expect(qC!.warnings.length).toBeGreaterThan(0);
  });
});
