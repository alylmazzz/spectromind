/**
 * FTIR Force Constant Calculator
 * Based on Hooke's Law: ν = (1/2πc) * √(k/μ)
 *
 * Reference: Pavia - Introduction to Spectroscopy, Table 2.3
 */

import { Bond, Atom, MolecularGraph } from '../core/types';

// Base force constants (N/m) from literature
const BASE_FORCE_CONSTANTS: Record<string, number> = {
  // Single bonds
  'C-H_sp3': 500,
  'C-H_sp2': 550,
  'C-H_sp': 600,
  'C-C': 400,
  'C-O': 450,
  'C-N': 420,
  'C-F': 550,
  'C-Cl': 350,
  'C-Br': 280,
  'O-H': 750,
  'N-H': 650,
  'S-H': 380,

  // Double bonds
  'C=C': 950,
  'C=O': 1200,
  'C=N': 1100,

  // Triple bonds
  'C≡C': 1600,
  'C≡N': 1650
};

export function calculateForceConstant(
  bond: Bond,
  atom1: Atom,
  atom2: Atom,
  graph: MolecularGraph
): number {
  // 1. Determine base force constant
  let k = getBaseForceConstant(bond, atom1, atom2);

  // 2. Apply corrections
  k = applyConjugationCorrection(k, bond, graph);
  k = applyRingStrainCorrection(k, bond, graph);
  k = applyHydrogenBondingCorrection(k, bond, atom1, atom2, graph);
  k = applyElectronWithdrawingCorrection(k, bond, atom1, atom2, graph);

  return k;
}

function getBaseForceConstant(bond: Bond, atom1: Atom, atom2: Atom): number {
  const symbols = [atom1.symbol, atom2.symbol].sort().join('-');

  // Check bond order
  if (bond.order === 3) {
    const key = `${symbols.replace('-', '≡')}`;
    return BASE_FORCE_CONSTANTS[key] || 1600;
  } else if (bond.order === 2) {
    const key = `${symbols.replace('-', '=')}`;
    return BASE_FORCE_CONSTANTS[key] || 1000;
  } else {
    // Single bond - check hybridization
    if (symbols === 'C-H') {
      if (atom1.hybridization === 'sp' || atom2.hybridization === 'sp') {
        return BASE_FORCE_CONSTANTS['C-H_sp'];
      } else if (atom1.hybridization === 'sp2' || atom2.hybridization === 'sp2') {
        return BASE_FORCE_CONSTANTS['C-H_sp2'];
      } else {
        return BASE_FORCE_CONSTANTS['C-H_sp3'];
      }
    }

    return BASE_FORCE_CONSTANTS[symbols] || 400;
  }
}

/**
 * Conjugation correction: -20 to -60 N/m
 * Lowers vibrational frequency
 * Enhanced to detect extended conjugation
 */
function applyConjugationCorrection(
  k: number,
  bond: Bond,
  graph: MolecularGraph
): number {
  // Check if bond is already marked as aromatic
  if (bond.conjugated || bond.isAromatic) {
    return k - 30;
  }

  // Detect conjugation for double/triple bonds
  if (bond.order >= 2) {
    const atom1 = graph.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = graph.atoms.find(a => a.id === bond.atom2Id);

    if (atom1 && atom2) {
      // Count conjugation length (extended conjugation)
      const conjugationLength = detectConjugationLength(bond, graph);

      if (conjugationLength > 0) {
        // Apply correction based on conjugation extent
        let correction = 0;

        if (conjugationLength === 1) {
          // Simple conjugation (Ph-CO-, Ph-CH=CH-)
          correction = -30;
          console.log(`🔗 Simple conjugation: ${bond.id}`);
        } else if (conjugationLength === 2) {
          // Extended conjugation (Ph-CH=CH-CO-, α,β-unsaturated)
          correction = -45;
          console.log(`🔗🔗 Extended conjugation: ${bond.id} (length: ${conjugationLength})`);
        } else {
          // Polyene or highly conjugated (3+ conjugated bonds)
          correction = -60;
          console.log(`🔗🔗🔗 Highly conjugated: ${bond.id} (length: ${conjugationLength})`);
        }

        return k + correction;
      }
    }
  }

  return k;
}

/**
 * Detect conjugation length (number of consecutive conjugated bonds)
 * Returns 0 if no conjugation, 1+ for conjugated systems
 */
function detectConjugationLength(bond: Bond, graph: MolecularGraph): number {
  const visited = new Set<string>();
  let maxLength = 0;

  // Helper: Check if atom is part of conjugated system
  const isConjugated = (atomId: string): boolean => {
    const atom = graph.atoms.find(a => a.id === atomId);
    if (!atom) return false;

    // Aromatic atoms are conjugated
    if (atom.aromaticity) return true;

    // Atoms in double/triple bonds with sp2 or sp hybridization
    const bonds = graph.bonds.filter(b => b.atom1Id === atomId || b.atom2Id === atomId);
    return bonds.some(b => b.order >= 2 || b.isAromatic);
  };

  // BFS to count conjugated chain length
  const countConjugation = (startAtomId: string): number => {
    const queue = [{atomId: startAtomId, depth: 0}];
    const localVisited = new Set<string>();
    let maxDepth = 0;

    while (queue.length > 0) {
      const {atomId, depth} = queue.shift()!;

      if (localVisited.has(atomId)) continue;
      localVisited.add(atomId);
      maxDepth = Math.max(maxDepth, depth);

      // Don't explore beyond 4 bonds (performance)
      if (depth >= 4) continue;

      // Find conjugated neighbors
      const neighborBonds = graph.bonds.filter(
        b => (b.atom1Id === atomId || b.atom2Id === atomId) && b.id !== bond.id
      );

      for (const nb of neighborBonds) {
        const neighborId = nb.atom1Id === atomId ? nb.atom2Id : nb.atom1Id;

        if (localVisited.has(neighborId)) continue;
        if (!isConjugated(neighborId)) continue;

        // Continue if neighbor is conjugated
        queue.push({atomId: neighborId, depth: depth + 1});
      }
    }

    return maxDepth;
  };

  // Check both ends of the bond
  maxLength = Math.max(
    countConjugation(bond.atom1Id),
    countConjugation(bond.atom2Id)
  );

  return maxLength;
}

/**
 * Ring strain correction: +20 to +50 N/m
 * Increases vibrational frequency for small rings
 */
function applyRingStrainCorrection(
  k: number,
  bond: Bond,
  graph: MolecularGraph
): number {
  const ringSize = detectRingSize(bond, graph);

  if (ringSize === 0) return k; // Not in a ring

  if (ringSize === 3) return k + 50; // Cyclopropane
  if (ringSize === 4) return k + 30; // Cyclobutane
  if (ringSize === 5) return k + 10; // Cyclopentane

  return k; // 6+ membered rings have minimal strain
}

/**
 * Hydrogen bonding correction: -50 to -100 N/m
 * Broadens and shifts O-H, N-H peaks
 */
function applyHydrogenBondingCorrection(
  k: number,
  bond: Bond,
  atom1: Atom,
  atom2: Atom,
  graph: MolecularGraph
): number {
  // O-H or N-H bond with potential H-bonding
  if ((atom1.symbol === 'O' || atom1.symbol === 'N') && atom2.symbol === 'H') {
    // Check for nearby acceptors (O, N)
    const hasAcceptor = graph.atoms.some(a =>
      (a.symbol === 'O' || a.symbol === 'N') && a.id !== atom1.id
    );

    if (hasAcceptor) {
      return k - 80; // Hydrogen bonding present
    }
  }

  return k;
}

/**
 * Electron-withdrawing group correction
 * Increases force constant for nearby EWG
 */
function applyElectronWithdrawingCorrection(
  k: number,
  bond: Bond,
  atom1: Atom,
  atom2: Atom,
  graph: MolecularGraph
): number {
  // Check for electron-withdrawing groups (F, Cl, Br, NO2, etc.)
  const ewgSymbols = ['F', 'Cl', 'Br', 'I'];

  const nearbyAtoms = graph.bonds
    .filter(b => b.atom1Id === atom1.id || b.atom2Id === atom1.id)
    .map(b => {
      const otherAtomId = b.atom1Id === atom1.id ? b.atom2Id : b.atom1Id;
      return graph.atoms.find(a => a.id === otherAtomId);
    })
    .filter((a): a is Atom => a !== undefined);

  const hasEWG = nearbyAtoms.some(a => ewgSymbols.includes(a.symbol));

  if (hasEWG && bond.order === 2) {
    return k + 20; // EWG increases C=O frequency
  }

  return k;
}

/**
 * Ring detection using DFS (Depth-First Search)
 * Returns the size of the smallest ring containing this bond
 * Returns 0 if bond is not in any ring
 */
function detectRingSize(bond: Bond, graph: MolecularGraph): number {
  const atom1Id = bond.atom1Id;
  const atom2Id = bond.atom2Id;

  // DFS to find shortest path from atom2 back to atom1 (excluding direct bond)
  const visited = new Set<string>();
  const minRingSize = findShortestPath(atom2Id, atom1Id, visited, graph, atom1Id);

  // If path found, ring size = path length + 1 (for the original bond)
  return minRingSize > 0 ? minRingSize + 1 : 0;
}

/**
 * Helper function: Find shortest path using BFS
 * Returns path length, or 0 if no path found
 */
function findShortestPath(
  startId: string,
  targetId: string,
  visited: Set<string>,
  graph: MolecularGraph,
  excludeAtom: string // Don't use direct bond back
): number {
  // BFS for shortest path
  const queue: Array<{atomId: string, depth: number}> = [{atomId: startId, depth: 0}];
  const localVisited = new Set<string>();

  while (queue.length > 0) {
    const {atomId, depth} = queue.shift()!;

    if (localVisited.has(atomId)) continue;
    localVisited.add(atomId);

    // Found target?
    if (atomId === targetId && depth > 0) {
      return depth;
    }

    // Don't go deeper than ring size 8 (performance)
    if (depth >= 8) continue;

    // Get neighbors
    const neighborBonds = graph.bonds.filter(
      b => (b.atom1Id === atomId || b.atom2Id === atomId)
    );

    for (const bond of neighborBonds) {
      const neighborId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;

      // Skip if already visited
      if (localVisited.has(neighborId)) continue;

      // Skip direct bond back to start (only on first step)
      if (depth === 0 && neighborId === excludeAtom) continue;

      queue.push({atomId: neighborId, depth: depth + 1});
    }
  }

  return 0; // No path found
}

/**
 * Calculate reduced mass (μ)
 * μ = (m1 * m2) / (m1 + m2)
 */
export function calculateReducedMass(atom1: Atom, atom2: Atom): number {
  const masses: Record<string, number> = {
    'H': 1.008,
    'C': 12.011,
    'N': 14.007,
    'O': 15.999,
    'F': 18.998,
    'Cl': 35.45,
    'Br': 79.904,
    'S': 32.06,
    'P': 30.974
  };

  const m1 = masses[atom1.symbol] || 12;
  const m2 = masses[atom2.symbol] || 12;

  return (m1 * m2) / (m1 + m2);
}

/**
 * Calculate vibrational frequency with anharmonic correction
 * Harmonic: ν₀ = (1/2πc) * √(k/μ)
 * Anharmonic: ν = ν₀(1 - χₑν₀/ν₀) ≈ ν₀(1 - 0.02)
 *
 * c = 2.998 × 10^10 cm/s
 * k in N/m
 * μ in amu (converted to kg)
 */
export function calculateVibrationalFrequency(
  k: number, // N/m
  mu: number, // amu
  bondType?: string // Optional: for anharmonic correction
): number {
  const c = 2.998e10; // cm/s
  const amu_to_kg = 1.66054e-27;

  const mu_kg = mu * amu_to_kg;
  const harmonicFreq = (1 / (2 * Math.PI * c)) * Math.sqrt(k / mu_kg);

  // Apply anharmonic correction (Morse potential)
  const anharmonicFreq = applyAnharmonicCorrection(harmonicFreq, bondType);

  return Math.round(anharmonicFreq); // cm⁻¹
}

/**
 * Anharmonic correction using Morse potential
 * Real bonds are NOT perfect springs - they weaken at large displacement
 *
 * ν = ν₀(1 - χₑ·ν₀/10000)
 * χₑ = anharmonicity constant (typically 0.01-0.03)
 */
function applyAnharmonicCorrection(freq: number, bondType?: string): number {
  // Anharmonicity constants for different bond types
  const anharmonicityConstants: Record<string, number> = {
    'O-H': 0.025,  // High anharmonicity (hydrogen bonding capable)
    'N-H': 0.023,
    'C-H': 0.020,
    'S-H': 0.018,
    'C=O': 0.015,  // Moderate
    'C=C': 0.015,
    'C≡C': 0.012,  // Low (stiffer bond)
    'C≡N': 0.012,
    'default': 0.018
  };

  const χₑ = bondType ? (anharmonicityConstants[bondType] || anharmonicityConstants['default']) : anharmonicityConstants['default'];

  // Morse potential correction: ν_real ≈ ν_harmonic * (1 - χₑ * ν/10000)
  const correctedFreq = freq * (1 - χₑ * (freq / 10000));

  return correctedFreq;
}
