/**
 * FTIR Normal Mode Analysis
 * Solves coupled vibrational modes using Wilson's GF-matrix method
 *
 * Reference: Wilson, Decius, Cross - Molecular Vibrations (1955)
 * Simplified implementation for organic molecules
 */

import { MolecularGraph, Atom, Bond, IRPeak } from '../core/types';
import { calculateForceConstant, calculateReducedMass, calculateVibrationalFrequency } from './forceConstantModel';

interface NormalMode {
  frequency: number; // cm⁻¹
  intensity: number; // Relative IR intensity
  assignment: string;
  mode: 'stretch' | 'bend' | 'wag' | 'twist' | 'rock';
  bondIds: string[]; // Bonds involved in this mode
}

/**
 * Calculate normal modes for the molecule
 * Returns IR-active modes with frequencies and intensities
 */
export function calculateNormalModes(graph: MolecularGraph): IRPeak[] {
  // 1. Build simplified force constant matrix
  const modes = extractLocalModes(graph);

  // 2. Apply coupling corrections
  const coupledModes = applyCouplingCorrections(modes, graph);

  // 3. Calculate IR intensities
  const irPeaks = calculateIRIntensities(coupledModes, graph);

  // 4. Filter IR-active modes (remove silent modes)
  return irPeaks.filter(peak => peak.intensity > 0);
}

/**
 * Extract local vibrational modes (uncoupled)
 * Each bond vibrates independently as starting point
 */
function extractLocalModes(graph: MolecularGraph): NormalMode[] {
  const modes: NormalMode[] = [];

  graph.bonds.forEach(bond => {
    const atom1 = graph.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = graph.atoms.find(a => a.id === bond.atom2Id);

    if (!atom1 || !atom2) return;

    // Calculate force constant and reduced mass
    const k = calculateForceConstant(bond, atom1, atom2, graph);
    const mu = calculateReducedMass(atom1, atom2);

    // Determine bond type for anharmonic correction
    const bondType = getBondTypeString(bond, atom1, atom2);

    // Calculate frequency with anharmonic correction
    const freq = calculateVibrationalFrequency(k, mu, bondType);

    // Determine mode type
    const mode = determineModeType(bond, atom1, atom2);
    const assignment = getModeAssignment(bond, atom1, atom2, graph);

    // Calculate dynamic intensity based on bond polarity
    const intensity = calculateDynamicIntensity(bond, atom1, atom2, graph);

    modes.push({
      frequency: freq,
      intensity, // Dynamic intensity based on dipole moment derivative
      assignment,
      mode,
      bondIds: [bond.id]
    });
  });

  return modes;
}

/**
 * Apply coupling corrections between nearby modes
 * Critical for: Amide I-II, symmetric/asymmetric stretches, Fermi resonance
 */
function applyCouplingCorrections(modes: NormalMode[], graph: MolecularGraph): NormalMode[] {
  const correctedModes = [...modes];

  // 1. Symmetric/Asymmetric stretch coupling
  correctedModes.push(...findSymmetricAsymmetricPairs(modes, graph));

  // 2. Aromatic ring modes (C=C stretches, C-H stretches, out-of-plane bending)
  const aromaticModes = findAromaticRingModes(modes, graph);
  if (aromaticModes.length > 0) {
    correctedModes.push(...aromaticModes);
  }

  // 3. Amide I-II coupling (if present)
  const amideModes = findAmideCoupling(modes, graph);
  if (amideModes.length > 0) {
    correctedModes.push(...amideModes);
  }

  // 4. CH2/CH3 bending modes (NEW!)
  const bendingModes = findBendingModes(graph);
  if (bendingModes.length > 0) {
    correctedModes.push(...bendingModes);
  }

  // 5. C-O ester/ether stretches (NEW!)
  const coStretchModes = findCOStretchModes(graph);
  if (coStretchModes.length > 0) {
    correctedModes.push(...coStretchModes);
  }

  // 6. Combination bands (ν₁ + ν₂) - weak but observable
  const combinationBands = findCombinationBands(correctedModes);
  if (combinationBands.length > 0) {
    correctedModes.push(...combinationBands);
  }

  // 7. Fermi resonance (overtone-fundamental mixing)
  applyFermiResonance(correctedModes);

  return correctedModes;
}

/**
 * Find symmetric and asymmetric stretch pairs
 * Example: CH2 has ν_s(CH2) at ~2850 and ν_as(CH2) at ~2920 cm⁻¹
 */
function findSymmetricAsymmetricPairs(modes: NormalMode[], graph: MolecularGraph): NormalMode[] {
  const newModes: NormalMode[] = [];

  // Find CH2 groups
  const ch2Groups = findCH2Groups(graph);

  ch2Groups.forEach(ch2 => {
    const chModes = modes.filter(m =>
      m.bondIds.some(bid => {
        const bond = graph.bonds.find(b => b.id === bid);
        return bond && (
          (bond.atom1Id === ch2.carbonId && ch2.hydrogenIds.includes(bond.atom2Id)) ||
          (bond.atom2Id === ch2.carbonId && ch2.hydrogenIds.includes(bond.atom1Id))
        );
      })
    );

    if (chModes.length === 2) {
      const avgFreq = (chModes[0].frequency + chModes[1].frequency) / 2;

      // Symmetric stretch (lower frequency)
      newModes.push({
        frequency: Math.round(avgFreq - 35),
        intensity: 30,
        assignment: 'ν_s(CH₂) symmetric stretch',
        mode: 'stretch',
        bondIds: chModes.flatMap(m => m.bondIds)
      });

      // Asymmetric stretch (higher frequency)
      newModes.push({
        frequency: Math.round(avgFreq + 35),
        intensity: 70,
        assignment: 'ν_as(CH₂) asymmetric stretch',
        mode: 'stretch',
        bondIds: chModes.flatMap(m => m.bondIds)
      });
    }
  });

  return newModes;
}

/**
 * Detect Amide I-II coupling
 * Amide I: C=O stretch (~1650 cm⁻¹)
 * Amide II: N-H bend + C-N stretch (~1550 cm⁻¹)
 */
function findAmideCoupling(modes: NormalMode[], graph: MolecularGraph): NormalMode[] {
  const amideModes: NormalMode[] = [];

  // Find amide groups: -CO-NH-
  graph.bonds.forEach(bond => {
    if (bond.order === 2) {
      const carbonAtom = graph.atoms.find(a => a.id === bond.atom1Id || a.id === bond.atom2Id);
      if (!carbonAtom || carbonAtom.symbol !== 'C') return;

      const oxygenAtom = graph.atoms.find(a =>
        (a.id === bond.atom1Id || a.id === bond.atom2Id) && a.symbol === 'O'
      );
      if (!oxygenAtom) return;

      // Check for adjacent N-H
      const nitrogenBond = graph.bonds.find(b =>
        (b.atom1Id === carbonAtom.id || b.atom2Id === carbonAtom.id) &&
        b.id !== bond.id
      );

      if (nitrogenBond) {
        const nitrogenAtom = graph.atoms.find(a =>
          (a.id === nitrogenBond.atom1Id || a.id === nitrogenBond.atom2Id) &&
          a.symbol === 'N'
        );

        if (nitrogenAtom) {
          // Amide I (C=O stretch)
          amideModes.push({
            frequency: 1650,
            intensity: 100,
            assignment: 'Amide I (C=O stretch)',
            mode: 'stretch',
            bondIds: [bond.id]
          });

          // Amide II (N-H bend + C-N stretch)
          amideModes.push({
            frequency: 1550,
            intensity: 60,
            assignment: 'Amide II (N-H bend, C-N stretch)',
            mode: 'bend',
            bondIds: [nitrogenBond.id]
          });
        }
      }
    }
  });

  return amideModes;
}

/**
 * Find combination bands (ν₁ + ν₂)
 *
 * Combination bands appear at the sum of two fundamental frequencies.
 * They are generally weak (10-30% of fundamental intensity) but can be
 * important for structural identification.
 *
 * COMMON EXAMPLES:
 * - Amides: Amide I (1650) + Amide II (1550) = 3200 cm⁻¹
 * - Aromatics: Ring stretch (1600) + C-H bend (1000) = 2600 cm⁻¹
 * - Carbonyls: C=O stretch (1700) + C-C stretch (1100) = 2800 cm⁻¹
 *
 * SELECTION RULES:
 * - Only modes with significant intensity combine
 * - Combination band intensity ≈ 10-30% of weaker fundamental
 * - Most important in fingerprint region (when sum > 2000 cm⁻¹)
 */
function findCombinationBands(modes: NormalMode[]): NormalMode[] {
  const combinationBands: NormalMode[] = [];

  // Only consider strong modes (intensity > 40)
  const strongModes = modes.filter(m => m.intensity > 40);

  // Limit to avoid explosion of combinations
  const maxCombinations = 3;
  let count = 0;

  for (let i = 0; i < strongModes.length && count < maxCombinations; i++) {
    for (let j = i + 1; j < strongModes.length && count < maxCombinations; j++) {
      const mode1 = strongModes[i];
      const mode2 = strongModes[j];

      // Calculate combination frequency
      const combFreq = mode1.frequency + mode2.frequency;

      // Only include if combination is in observable range (1500-4000 cm⁻¹)
      // Lower frequencies are too crowded, higher frequencies are beyond typical FTIR range
      if (combFreq >= 1800 && combFreq <= 4000) {
        // Combination band intensity: 10-30% of weaker fundamental
        const weakerIntensity = Math.min(mode1.intensity, mode2.intensity);
        const combIntensity = Math.round(weakerIntensity * 0.20); // 20% of weaker mode

        // Only add if intensity is significant (> 10)
        if (combIntensity > 10) {
          combinationBands.push({
            frequency: combFreq,
            intensity: combIntensity,
            assignment: `Combination band (${mode1.assignment.split(' ')[0]} + ${mode2.assignment.split(' ')[0]})`,
            mode: 'stretch', // Combination bands are typically stretch-like
            bondIds: [...mode1.bondIds, ...mode2.bondIds]
          });

          console.log(`➕ Combination band: ${mode1.frequency} + ${mode2.frequency} = ${combFreq} cm⁻¹ (intensity: ${combIntensity})`);
          count++;
        }
      }
    }
  }

  return combinationBands;
}

/**
 * Apply Fermi resonance - overtone/fundamental mixing
 *
 * When an overtone (2ν) or combination band (ν₁+ν₂) has similar frequency
 * to a fundamental (ν), they couple and split into two peaks with intensity
 * redistribution.
 *
 * CLASSIC EXAMPLES:
 * - CO₂: ν₁ (1388 cm⁻¹) + 2ν₂ (667×2=1334 cm⁻¹) → split to 1285, 1388 cm⁻¹
 * - Aldehydes: C-H bend overtone (2×1390=2780) near C-H stretch (2820)
 * - Benzene: Ring breathing overtone near C-H stretch
 *
 * RESULT:
 * - Two peaks appear instead of one
 * - Peak separation: ±20-50 cm⁻¹
 * - Intensity redistribution: stronger fundamental donates to weaker overtone
 */
function applyFermiResonance(modes: NormalMode[]): void {
  const processedPairs = new Set<string>();

  for (let i = 0; i < modes.length; i++) {
    for (let j = i + 1; j < modes.length; j++) {
      const pairKey = `${i}-${j}`;
      if (processedPairs.has(pairKey)) continue;

      const freq1 = modes[i].frequency;
      const freq2 = modes[j].frequency;
      const intensity1 = modes[i].intensity;
      const intensity2 = modes[j].intensity;

      // Check for Fermi resonance conditions:
      // 1. One frequency ≈ 2× the other (overtone coupling)
      // 2. Similar frequencies within 50 cm⁻¹ (accidental degeneracy)

      const isOvertone = Math.abs(freq1 - 2 * freq2) < 50 || Math.abs(freq2 - 2 * freq1) < 50;
      const isAccidental = Math.abs(freq1 - freq2) < 50 && Math.abs(freq1 - freq2) > 5;

      if (isOvertone || isAccidental) {
        processedPairs.add(pairKey);

        // Calculate splitting (depends on coupling strength)
        const avgFreq = (freq1 + freq2) / 2;
        const couplingStrength = Math.min(intensity1, intensity2) / 100; // 0-1
        const split = 20 + couplingStrength * 30; // 20-50 cm⁻¹

        // Split frequencies
        modes[i].frequency = Math.round(avgFreq + split);
        modes[j].frequency = Math.round(avgFreq - split);

        // Intensity redistribution
        // Stronger mode donates intensity to weaker mode
        const totalIntensity = intensity1 + intensity2;
        if (intensity1 > intensity2) {
          // Mode i is fundamental, mode j is overtone
          modes[i].intensity = Math.round(totalIntensity * 0.65); // Fundamental gets 65%
          modes[j].intensity = Math.round(totalIntensity * 0.35); // Overtone gets 35%
        } else {
          modes[i].intensity = Math.round(totalIntensity * 0.35);
          modes[j].intensity = Math.round(totalIntensity * 0.65);
        }

        // Mark as Fermi resonance
        const resonanceType = isOvertone ? 'overtone' : 'accidental';
        modes[i].assignment += ` (Fermi resonance - ${resonanceType})`;
        modes[j].assignment += ` (Fermi resonance - ${resonanceType})`;

        console.log(`🔀 Fermi resonance detected: ${freq1} ↔ ${freq2} cm⁻¹ (${resonanceType})`);
        console.log(`   → Split to: ${modes[i].frequency}, ${modes[j].frequency} cm⁻¹`);
        console.log(`   → Intensity: ${modes[i].intensity}, ${modes[j].intensity}`);
      }
    }
  }
}

/**
 * Calculate IR intensities based on dipole moment derivative
 * Simplified: Use empirical rules for bond polarity
 */
function calculateIRIntensities(modes: NormalMode[], graph: MolecularGraph): IRPeak[] {
  return modes.map(mode => {
    const bondId = mode.bondIds[0];
    const bond = graph.bonds.find(b => b.id === bondId);

    if (!bond) {
      return {
        wavenumber: mode.frequency,
        intensity: 0,
        type: 'weak' as const,
        assignment: mode.assignment,
        mode: mode.mode
      };
    }

    const atom1 = graph.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = graph.atoms.find(a => a.id === bond.atom2Id);

    if (!atom1 || !atom2) {
      return {
        wavenumber: mode.frequency,
        intensity: 0,
        type: 'weak' as const,
        assignment: mode.assignment,
        mode: mode.mode
      };
    }

    // Calculate intensity based on electronegativity difference
    const intensity = calculateBondPolarity(atom1, atom2) * mode.intensity;

    return {
      wavenumber: mode.frequency,
      intensity: Math.round(intensity),
      type: intensity > 70 ? 'strong' : intensity > 40 ? 'medium' : 'weak',
      assignment: mode.assignment,
      mode: mode.mode
    };
  });
}

/**
 * Determine mode type (stretch, bend, etc.)
 */
function determineModeType(bond: Bond, atom1: Atom, atom2: Atom): 'stretch' | 'bend' | 'wag' | 'twist' | 'rock' {
  // High frequency = stretch
  // Low frequency = bend
  // For now, simplified: bonds are stretches
  return 'stretch';
}

/**
 * Generate mode assignment string
 */
function getModeAssignment(bond: Bond, atom1: Atom, atom2: Atom, graph: MolecularGraph): string {
  const symbols = [atom1.symbol, atom2.symbol].sort();

  if (bond.order === 3) {
    return `ν(${symbols[0]}≡${symbols[1]}) stretch`;
  } else if (bond.order === 2) {
    return `ν(${symbols[0]}=${symbols[1]}) stretch`;
  } else {
    return `ν(${symbols[0]}-${symbols[1]}) stretch`;
  }
}

/**
 * Find CH2 groups in molecule
 */
function findCH2Groups(graph: MolecularGraph): { carbonId: string; hydrogenIds: string[] }[] {
  const ch2Groups: { carbonId: string; hydrogenIds: string[] }[] = [];

  graph.atoms.forEach(atom => {
    if (atom.symbol === 'C') {
      const hydrogenBonds = graph.bonds.filter(b => {
        const otherAtomId = b.atom1Id === atom.id ? b.atom2Id : b.atom1Id;
        const otherAtom = graph.atoms.find(a => a.id === otherAtomId);
        return otherAtom?.symbol === 'H' && (b.atom1Id === atom.id || b.atom2Id === atom.id);
      });

      if (hydrogenBonds.length === 2) {
        ch2Groups.push({
          carbonId: atom.id,
          hydrogenIds: hydrogenBonds.map(b =>
            b.atom1Id === atom.id ? b.atom2Id : b.atom1Id
          )
        });
      }
    }
  });

  return ch2Groups;
}

/**
 * Detect aromatic ring modes
 * Arkadaşının tablosuna göre:
 * - Aromatik C-H: 3030-3080 cm⁻¹ (zayıf)
 * - C=C ring stretch: ~1600 & ~1580 cm⁻¹
 * - Out-of-plane bending: 690-760 cm⁻¹ (mono-substitution)
 */
function findAromaticRingModes(modes: NormalMode[], graph: MolecularGraph): NormalMode[] {
  const aromaticModes: NormalMode[] = [];

  // Check if molecule has aromatic atoms
  const hasAromatic = graph.atoms.some(a => a.aromaticity);
  if (!hasAromatic) return aromaticModes;

  // 1. Aromatic C-H stretch (>3000 cm⁻¹)
  const aromaticCHs = graph.bonds.filter(b => {
    const atom1 = graph.atoms.find(a => a.id === b.atom1Id);
    const atom2 = graph.atoms.find(a => a.id === b.atom2Id);

    return (
      atom1 && atom2 &&
      ((atom1.symbol === 'C' && atom1.aromaticity && atom2.symbol === 'H') ||
       (atom2.symbol === 'C' && atom2.aromaticity && atom1.symbol === 'H'))
    );
  });

  if (aromaticCHs.length > 0) {
    aromaticModes.push({
      frequency: 3050,
      intensity: 30,
      assignment: 'ν(Ar-H) aromatic C-H stretch',
      mode: 'stretch',
      bondIds: aromaticCHs.map(b => b.id)
    });
  }

  // 2. Aromatic C=C ring stretches
  aromaticModes.push({
    frequency: 1600,
    intensity: 75,
    assignment: 'ν(C=C) aromatic ring stretch',
    mode: 'stretch',
    bondIds: []
  });

  aromaticModes.push({
    frequency: 1580,
    intensity: 70,
    assignment: 'ν(C=C) aromatic ring stretch',
    mode: 'stretch',
    bondIds: []
  });

  // 3. Out-of-plane C-H bending + Aromatic substitution pattern
  const substitutionPattern = detectAromaticSubstitutionPattern(graph);

  if (substitutionPattern === 'mono') {
    // Mono-substitution: 2 strong peaks at 690-760 cm⁻¹
    aromaticModes.push({
      frequency: 756,
      intensity: 90,
      assignment: 'γ(Ar-H) out-of-plane bending (monosubstituted)',
      mode: 'wag',
      bondIds: []
    });

    aromaticModes.push({
      frequency: 690,
      intensity: 85,
      assignment: 'γ(Ar-H) out-of-plane bending (monosubstituted)',
      mode: 'wag',
      bondIds: []
    });
  } else if (substitutionPattern === 'ortho') {
    // Ortho-substitution: 735-770 cm⁻¹
    aromaticModes.push({
      frequency: 750,
      intensity: 80,
      assignment: 'γ(Ar-H) out-of-plane (ortho-disubstituted)',
      mode: 'wag',
      bondIds: []
    });
  } else if (substitutionPattern === 'meta') {
    // Meta-substitution: 750-810 cm⁻¹ (2 peaks)
    aromaticModes.push({
      frequency: 810,
      intensity: 75,
      assignment: 'γ(Ar-H) out-of-plane (meta-disubstituted)',
      mode: 'wag',
      bondIds: []
    });

    aromaticModes.push({
      frequency: 750,
      intensity: 70,
      assignment: 'γ(Ar-H) out-of-plane (meta-disubstituted)',
      mode: 'wag',
      bondIds: []
    });
  } else if (substitutionPattern === 'para') {
    // Para-substitution: 810-840 cm⁻¹
    aromaticModes.push({
      frequency: 825,
      intensity: 90,
      assignment: 'γ(Ar-H) out-of-plane (para-disubstituted)',
      mode: 'wag',
      bondIds: []
    });
  }

  // 4. Ring breathing mode (~1000-1050 cm⁻¹)
  aromaticModes.push({
    frequency: 1020,
    intensity: 40,
    assignment: 'Ring breathing (benzene ring)',
    mode: 'stretch',
    bondIds: []
  });

  // 5. Additional fingerprint region peaks
  // C-C skeletal vibrations
  aromaticModes.push({
    frequency: 1175,
    intensity: 50,
    assignment: 'ν(C-C) in-plane ring deformation',
    mode: 'stretch',
    bondIds: []
  });

  return aromaticModes;
}

/**
 * Detect aromatic substitution pattern (mono, ortho, meta, para)
 * Based on positions of substituents on benzene ring
 */
function detectAromaticSubstitutionPattern(graph: MolecularGraph): string {
  // Find aromatic carbons with non-H, non-aromatic substituents
  const aromaticCarbons = graph.atoms.filter(a => a.aromaticity && a.symbol === 'C');

  const substitutedPositions: number[] = [];

  aromaticCarbons.forEach((carbon, idx) => {
    const hasSubstituent = graph.bonds.some(b => {
      const otherAtomId = b.atom1Id === carbon.id ? b.atom2Id : b.atom1Id;
      const otherAtom = graph.atoms.find(a => a.id === otherAtomId);
      return otherAtom && !otherAtom.aromaticity && otherAtom.symbol !== 'H';
    });

    if (hasSubstituent) {
      substitutedPositions.push(idx);
    }
  });

  // Classify pattern
  if (substitutedPositions.length === 1) {
    return 'mono';
  } else if (substitutedPositions.length === 2) {
    const diff = Math.abs(substitutedPositions[1] - substitutedPositions[0]);

    if (diff === 1 || diff === 5) {
      return 'ortho'; // Adjacent (1,2)
    } else if (diff === 2 || diff === 4) {
      return 'meta';  // 1,3
    } else if (diff === 3) {
      return 'para';  // 1,4
    }
  }

  return 'none';
}

/**
 * Calculate bond polarity (electronegativity difference)
 * Higher polarity = stronger IR absorption
 */
function calculateBondPolarity(atom1: Atom, atom2: Atom): number {
  const electronegativities: Record<string, number> = {
    'H': 2.20,
    'C': 2.55,
    'N': 3.04,
    'O': 3.44,
    'F': 3.98,
    'Cl': 3.16,
    'Br': 2.96,
    'S': 2.58,
    'P': 2.19
  };

  const en1 = electronegativities[atom1.symbol] || 2.5;
  const en2 = electronegativities[atom2.symbol] || 2.5;

  const diff = Math.abs(en1 - en2);

  // Normalize to 0-100 scale
  return Math.min(100, diff * 50);
}

/**
 * Calculate dynamic IR intensity based on bond polarity and bond order
 * Intensity ∝ (dμ/dq)² - dipole moment derivative squared
 *
 * Strong (85-100): C=O, C-O, O-H, N-H (highly polar)
 * Medium (50-80): C=C, aromatic, CH₂ bending
 * Weak (20-45): C-C, C-H, C≡C (low polarity)
 */
function calculateDynamicIntensity(
  bond: Bond,
  atom1: Atom,
  atom2: Atom,
  graph: MolecularGraph
): number {
  const electronegativities: Record<string, number> = {
    'H': 2.20,
    'C': 2.55,
    'N': 3.04,
    'O': 3.44,
    'F': 3.98,
    'Cl': 3.16,
    'Br': 2.96,
    'S': 2.58,
    'P': 2.19
  };

  const χ1 = electronegativities[atom1.symbol] || 2.5;
  const χ2 = electronegativities[atom2.symbol] || 2.5;

  const polarity = Math.abs(χ1 - χ2);

  // Base intensity from polarity: I ∝ (Δχ)²
  let intensity = polarity * polarity * 100;

  // Bond order multiplier
  if (bond.order === 2) {
    // Double bonds (C=O, C=C) → stronger dipole change
    intensity *= 1.3;

    // C=O is exceptionally strong!
    if ((atom1.symbol === 'O' || atom2.symbol === 'O') &&
        (atom1.symbol === 'C' || atom2.symbol === 'C')) {
      intensity *= 1.5; // C=O: very strong (carbonyl is THE strongest)
      console.log(`💪 C=O double bond detected - Very strong intensity: ${Math.round(intensity)}`);
    }
  } else if (bond.order === 3) {
    // Triple bonds: often symmetric → weak intensity
    intensity *= 0.5;
  }

  // X-H bonds (O-H, N-H): strong intensity
  if (atom1.symbol === 'H' || atom2.symbol === 'H') {
    const heavyAtom = atom1.symbol === 'H' ? atom2 : atom1;
    if (heavyAtom.symbol === 'O' || heavyAtom.symbol === 'N') {
      intensity *= 1.4; // O-H, N-H: strong
      console.log(`💪 ${heavyAtom.symbol}-H bond detected - Strong intensity: ${Math.round(intensity)}`);
    }
  }

  // C-O single bond (ester, ether): very strong
  if (bond.order === 1 &&
      ((atom1.symbol === 'C' && atom2.symbol === 'O') ||
       (atom1.symbol === 'O' && atom2.symbol === 'C'))) {
    intensity *= 1.6;
    console.log(`💪 C-O single bond detected - Very strong intensity: ${Math.round(intensity)}`);
  }

  // Aromatic bonds: medium intensity
  if (bond.isAromatic || bond.conjugated) {
    intensity *= 0.8; // Slightly weaker due to delocalization
  }

  // Clamp to 0-100 range
  intensity = Math.max(20, Math.min(100, intensity));

  return Math.round(intensity);
}

/**
 * Get bond type string for anharmonic correction
 */
function getBondTypeString(bond: Bond, atom1: Atom, atom2: Atom): string {
  const symbols = [atom1.symbol, atom2.symbol].sort();

  if (bond.order === 3) {
    return `${symbols[0]}≡${symbols[1]}`;
  } else if (bond.order === 2) {
    return `${symbols[0]}=${symbols[1]}`;
  } else {
    return `${symbols[0]}-${symbols[1]}`;
  }
}

/**
 * Find CH3 groups in molecule
 */
function findCH3Groups(graph: MolecularGraph): { carbonId: string; hydrogenIds: string[] }[] {
  const ch3Groups: { carbonId: string; hydrogenIds: string[] }[] = [];

  graph.atoms.forEach(atom => {
    if (atom.symbol === 'C') {
      const hydrogenBonds = graph.bonds.filter(b => {
        const otherAtomId = b.atom1Id === atom.id ? b.atom2Id : b.atom1Id;
        const otherAtom = graph.atoms.find(a => a.id === otherAtomId);
        return otherAtom?.symbol === 'H' && (b.atom1Id === atom.id || b.atom2Id === atom.id);
      });

      if (hydrogenBonds.length === 3) {
        ch3Groups.push({
          carbonId: atom.id,
          hydrogenIds: hydrogenBonds.map(b =>
            b.atom1Id === atom.id ? b.atom2Id : b.atom1Id
          )
        });
      }
    }
  });

  return ch3Groups;
}

/**
 * Find bending modes (CH2, CH3 scissoring, bending)
 * Critical for fingerprint region (1350-1500 cm⁻¹)
 */
function findBendingModes(graph: MolecularGraph): NormalMode[] {
  const bendingModes: NormalMode[] = [];

  // CH2 scissoring: 1450-1470 cm⁻¹
  const ch2Groups = findCH2Groups(graph);
  ch2Groups.forEach(() => {
    bendingModes.push({
      frequency: 1465,
      intensity: 50,
      assignment: 'δ(CH₂) scissoring',
      mode: 'bend',
      bondIds: []
    });
  });

  // CH3 symmetric bending: 1375 cm⁻¹
  const ch3Groups = findCH3Groups(graph);
  ch3Groups.forEach(() => {
    bendingModes.push({
      frequency: 1375,
      intensity: 40,
      assignment: 'δₛ(CH₃) symmetric bending (umbrella)',
      mode: 'bend',
      bondIds: []
    });
  });

  // CH3 asymmetric bending: 1450-1460 cm⁻¹
  ch3Groups.forEach(() => {
    bendingModes.push({
      frequency: 1450,
      intensity: 35,
      assignment: 'δₐₛ(CH₃) asymmetric bending',
      mode: 'bend',
      bondIds: []
    });
  });

  return bendingModes;
}

/**
 * Find C-O stretching modes (esters, ethers, alcohols)
 * Critical for Aspirin: ester C-O at 1300, 1220 cm⁻¹
 */
function findCOStretchModes(graph: MolecularGraph): NormalMode[] {
  const coModes: NormalMode[] = [];

  // Find C-O bonds
  graph.bonds.forEach(bond => {
    if (bond.order !== 1) return;

    const atom1 = graph.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = graph.atoms.find(a => a.id === bond.atom2Id);

    if (!atom1 || !atom2) return;

    // Check for C-O single bond
    const isCarbon = (atom: Atom) => atom.symbol === 'C';
    const isOxygen = (atom: Atom) => atom.symbol === 'O';

    if ((isCarbon(atom1) && isOxygen(atom2)) || (isOxygen(atom1) && isCarbon(atom2))) {
      const carbonAtom = isCarbon(atom1) ? atom1 : atom2;
      const oxygenAtom = isOxygen(atom1) ? atom1 : atom2;

      // Check if this is an ester C-O (oxygen connected to carbonyl carbon)
      const adjacentCO = graph.bonds.find(b => {
        if (b.order !== 2) return false;
        const connectedAtom1 = b.atom1Id === carbonAtom.id ? graph.atoms.find(a => a.id === b.atom2Id) : null;
        const connectedAtom2 = b.atom2Id === carbonAtom.id ? graph.atoms.find(a => a.id === b.atom1Id) : null;
        return (connectedAtom1?.symbol === 'O') || (connectedAtom2?.symbol === 'O');
      });

      if (adjacentCO) {
        // Ester C-O stretch (asymmetric and symmetric)
        coModes.push({
          frequency: 1300,
          intensity: 75,
          assignment: 'ν(C-O) ester asymmetric stretch',
          mode: 'stretch',
          bondIds: [bond.id]
        });

        coModes.push({
          frequency: 1220,
          intensity: 65,
          assignment: 'ν(C-O) ester symmetric stretch',
          mode: 'stretch',
          bondIds: [bond.id]
        });
      } else {
        // Simple ether/alcohol C-O: 1000-1100 cm⁻¹
        coModes.push({
          frequency: 1050,
          intensity: 60,
          assignment: 'ν(C-O) ether/alcohol stretch',
          mode: 'stretch',
          bondIds: [bond.id]
        });
      }
    }
  });

  return coModes;
}
