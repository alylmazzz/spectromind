/**
 * Molecular Structure Analysis from SMILES
 *
 * SMILES stringinden moleküler yapı bilgisi çıkarır:
 * - Fonksiyonel gruplar
 * - Hibridizasyon
 * - Aromatiklik
 * - Konjugasyon
 * - Coupling path analizi
 * - Basit 3D koordinat tahmini
 */

export interface Atom {
  id: number;
  element: string;
  hybridization: 'sp' | 'sp2' | 'sp3';
  isAromatic: boolean;
  formalCharge: number;
  connectedAtoms: number[];
  position?: { x: number; y: number; z: number };
}

export interface Bond {
  from: number;
  to: number;
  order: 1 | 2 | 3 | 1.5; // 1.5 = aromatic
  isAromatic: boolean;
}

export interface MolecularStructure {
  atoms: Atom[];
  bonds: Bond[];
  functionalGroups: FunctionalGroup[];
  aromaticRings: number[][];
  conjugationPaths: number[][];
  stereochemistry: Map<number, 'R' | 'S' | 'E' | 'Z'>;
}

export interface FunctionalGroup {
  name: string;
  type: 'carbonyl' | 'hydroxyl' | 'amine' | 'ether' | 'ester' | 'amide' | 'carboxylic_acid' | 'aldehyde' | 'ketone' | 'alkene' | 'alkyne' | 'aromatic' | 'halogen' | 'nitro' | 'nitrile';
  atoms: number[]; // Atom IDs involved
  inductiveEffect: number; // -1.0 to 1.0
  resonanceEffect: number; // -1.0 to 1.0
}

/**
 * Parse SMILES string to molecular structure
 *
 * Basitleştirilmiş SMILES parser - ana yapıları yakalar
 */
export function parseSMILES(smiles: string): MolecularStructure {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  let atomId = 0;

  // Stack for branch handling
  const branchStack: number[] = [];
  let currentAtom = -1;
  let previousAtom = -1;

  // Ring closure tracking
  const ringClosures: Map<string, number> = new Map();

  // Aromatic tracking
  let inAromaticRing = false;

  for (let i = 0; i < smiles.length; i++) {
    const char = smiles[i];

    // Branches
    if (char === '(') {
      branchStack.push(currentAtom);
      continue;
    }
    if (char === ')') {
      currentAtom = branchStack.pop() || currentAtom;
      continue;
    }

    // Ring closures
    if (char >= '0' && char <= '9') {
      const ringNum = char;
      if (ringClosures.has(ringNum)) {
        const startAtom = ringClosures.get(ringNum)!;
        bonds.push({
          from: startAtom,
          to: currentAtom,
          order: inAromaticRing ? 1.5 : 1,
          isAromatic: inAromaticRing
        });
        ringClosures.delete(ringNum);
      } else {
        ringClosures.set(ringNum, currentAtom);
      }
      continue;
    }

    // Bond orders
    if (char === '-') continue; // Single bond (default)
    if (char === '=') {
      // Next bond will be double
      continue;
    }
    if (char === '#') {
      // Next bond will be triple
      continue;
    }

    // Aromatic markers
    if (char === 'c' || char === 'n' || char === 'o' || char === 's') {
      inAromaticRing = true;
    }

    // Atoms
    let element = '';
    let isAromatic = false;

    if (char === 'C' || char === 'c') {
      element = 'C';
      isAromatic = char === 'c';
    } else if (char === 'N' || char === 'n') {
      element = 'N';
      isAromatic = char === 'n';
    } else if (char === 'O' || char === 'o') {
      element = 'O';
      isAromatic = char === 'o';
    } else if (char === 'S' || char === 's') {
      element = 'S';
      isAromatic = char === 's';
    } else if (char === 'H') {
      element = 'H';
    } else if (char === 'F') {
      element = 'F';
    } else if (char === 'Cl') {
      element = 'Cl';
      i++; // Skip 'l'
    } else if (char === 'Br') {
      element = 'Br';
      i++; // Skip 'r'
    } else {
      continue; // Unknown character
    }

    if (element) {
      previousAtom = currentAtom;
      currentAtom = atomId;

      atoms.push({
        id: atomId,
        element,
        hybridization: 'sp3', // Will be determined later
        isAromatic,
        formalCharge: 0,
        connectedAtoms: []
      });

      // Create bond to previous atom
      if (previousAtom >= 0) {
        bonds.push({
          from: previousAtom,
          to: currentAtom,
          order: 1, // Default, will be refined
          isAromatic
        });
      }

      atomId++;
    }
  }

  // Build connectivity
  bonds.forEach(bond => {
    atoms[bond.from].connectedAtoms.push(bond.to);
    atoms[bond.to].connectedAtoms.push(bond.from);
  });

  // Determine hybridization
  atoms.forEach(atom => {
    const degree = atom.connectedAtoms.length;
    const connectedBonds = bonds.filter(b => b.from === atom.id || b.to === atom.id);
    const hasDoubleBond = connectedBonds.some(b => b.order === 2);
    const hasTripleBond = connectedBonds.some(b => b.order === 3);

    if (hasTripleBond) {
      atom.hybridization = 'sp';
    } else if (hasDoubleBond || atom.isAromatic) {
      atom.hybridization = 'sp2';
    } else {
      atom.hybridization = 'sp3';
    }
  });

  // Detect functional groups
  const functionalGroups = detectFunctionalGroups(atoms, bonds);

  // Detect aromatic rings
  const aromaticRings = detectAromaticRings(atoms, bonds);

  // Detect conjugation paths
  const conjugationPaths = detectConjugation(atoms, bonds);

  return {
    atoms,
    bonds,
    functionalGroups,
    aromaticRings,
    conjugationPaths,
    stereochemistry: new Map()
  };
}

/**
 * Detect functional groups from molecular structure
 */
function detectFunctionalGroups(atoms: Atom[], bonds: Bond[]): FunctionalGroup[] {
  const groups: FunctionalGroup[] = [];

  atoms.forEach((atom, atomId) => {
    // Carbonyl (C=O)
    if (atom.element === 'C') {
      const connectedOxygen = bonds.find(b =>
        (b.from === atomId || b.to === atomId) &&
        b.order === 2 &&
        (atoms[b.from].element === 'O' || atoms[b.to].element === 'O')
      );

      if (connectedOxygen) {
        const carbonylCarbon = atomId;
        const oxygenId = connectedOxygen.from === atomId ? connectedOxygen.to : connectedOxygen.from;

        // Check if aldehyde (only 1 C neighbor) or ketone (2+ C neighbors)
        const carbonNeighbors = atom.connectedAtoms.filter(id => atoms[id].element === 'C');

        if (carbonNeighbors.length === 0) {
          // Aldehyde
          groups.push({
            name: 'Aldehyde',
            type: 'aldehyde',
            atoms: [carbonylCarbon, oxygenId],
            inductiveEffect: 0.5,
            resonanceEffect: 0.3
          });
        } else {
          // Ketone
          groups.push({
            name: 'Ketone',
            type: 'ketone',
            atoms: [carbonylCarbon, oxygenId],
            inductiveEffect: 0.4,
            resonanceEffect: 0.2
          });
        }
      }
    }

    // Hydroxyl (O-H)
    if (atom.element === 'O') {
      const connectedH = atom.connectedAtoms.filter(id => atoms[id].element === 'H');
      if (connectedH.length > 0) {
        groups.push({
          name: 'Hydroxyl',
          type: 'hydroxyl',
          atoms: [atomId, ...connectedH],
          inductiveEffect: -0.3,
          resonanceEffect: 0.1
        });
      }
    }

    // Amine (N-H or N-C)
    if (atom.element === 'N') {
      groups.push({
        name: 'Amine',
        type: 'amine',
        atoms: [atomId, ...atom.connectedAtoms],
        inductiveEffect: -0.4,
        resonanceEffect: 0.2
      });
    }

    // Aromatic ring
    if (atom.isAromatic) {
      groups.push({
        name: 'Aromatic',
        type: 'aromatic',
        atoms: [atomId],
        inductiveEffect: 0.0,
        resonanceEffect: 0.5
      });
    }

    // Halogens
    if (atom.element === 'F' || atom.element === 'Cl' || atom.element === 'Br') {
      groups.push({
        name: `Halogen-${atom.element}`,
        type: 'halogen',
        atoms: [atomId],
        inductiveEffect: 0.6,
        resonanceEffect: -0.1
      });
    }
  });

  return groups;
}

/**
 * Detect aromatic rings (simplified)
 */
function detectAromaticRings(atoms: Atom[], bonds: Bond[]): number[][] {
  const rings: number[][] = [];

  // Find 6-membered aromatic rings (benzene-like)
  atoms.forEach((atom, startId) => {
    if (!atom.isAromatic) return;

    const visited = new Set<number>();
    const path: number[] = [];

    function dfs(currentId: number, depth: number) {
      if (depth > 6) return;
      if (visited.has(currentId)) {
        if (currentId === startId && depth === 6) {
          rings.push([...path]);
        }
        return;
      }

      visited.add(currentId);
      path.push(currentId);

      atoms[currentId].connectedAtoms.forEach(neighborId => {
        if (atoms[neighborId].isAromatic) {
          dfs(neighborId, depth + 1);
        }
      });

      path.pop();
      visited.delete(currentId);
    }

    dfs(startId, 0);
  });

  return rings;
}

/**
 * Detect conjugation paths (alternating single/double bonds)
 */
function detectConjugation(atoms: Atom[], bonds: Bond[]): number[][] {
  const paths: number[][] = [];

  // Find conjugated systems (simplified)
  bonds.forEach(bond => {
    if (bond.order === 2 || bond.isAromatic) {
      const path = [bond.from, bond.to];
      paths.push(path);
    }
  });

  return paths;
}

/**
 * Calculate 3D coordinates (simplified distance geometry)
 *
 * Very basic approximation - not accurate but provides spatial info
 */
export function estimate3DCoordinates(structure: MolecularStructure): MolecularStructure {
  const { atoms, bonds } = structure;

  // Start with first atom at origin
  if (atoms.length === 0) return structure;

  atoms[0].position = { x: 0, y: 0, z: 0 };

  // Build coordinates iteratively
  const positioned = new Set<number>([0]);

  while (positioned.size < atoms.length) {
    bonds.forEach(bond => {
      const { from, to } = bond;

      if (positioned.has(from) && !positioned.has(to)) {
        // Position 'to' relative to 'from'
        const fromPos = atoms[from].position!;
        const bondLength = bond.order === 3 ? 1.2 : bond.order === 2 ? 1.34 : 1.54; // Å

        // Simple placement along x-axis with slight y offset
        const angle = positioned.size * 0.3; // Prevent overlap
        atoms[to].position = {
          x: fromPos.x + bondLength * Math.cos(angle),
          y: fromPos.y + bondLength * Math.sin(angle),
          z: fromPos.z
        };

        positioned.add(to);
      } else if (positioned.has(to) && !positioned.has(from)) {
        // Position 'from' relative to 'to'
        const toPos = atoms[to].position!;
        const bondLength = bond.order === 3 ? 1.2 : bond.order === 2 ? 1.34 : 1.54;

        const angle = positioned.size * 0.3;
        atoms[from].position = {
          x: toPos.x + bondLength * Math.cos(angle + Math.PI),
          y: toPos.y + bondLength * Math.sin(angle + Math.PI),
          z: toPos.z
        };

        positioned.add(from);
      }
    });
  }

  return structure;
}

/**
 * Calculate dihedral angle between 4 atoms
 */
export function calculateDihedralAngle(
  pos1: { x: number; y: number; z: number },
  pos2: { x: number; y: number; z: number },
  pos3: { x: number; y: number; z: number },
  pos4: { x: number; y: number; z: number }
): number {
  // Vectors
  const b1 = { x: pos2.x - pos1.x, y: pos2.y - pos1.y, z: pos2.z - pos1.z };
  const b2 = { x: pos3.x - pos2.x, y: pos3.y - pos2.y, z: pos3.z - pos2.z };
  const b3 = { x: pos4.x - pos3.x, y: pos4.y - pos3.y, z: pos4.z - pos3.z };

  // Normal vectors
  const n1 = crossProduct(b1, b2);
  const n2 = crossProduct(b2, b3);

  // Angle between normals
  const dotProduct = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const mag1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z);
  const mag2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosTheta = dotProduct / (mag1 * mag2);
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))); // Clamp to [-1, 1]
}

function crossProduct(
  v1: { x: number; y: number; z: number },
  v2: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  };
}

/**
 * Find proton-proton coupling paths
 *
 * Returns pairs of hydrogen atoms that can couple (2J, 3J, 4J)
 */
export function findCouplingPaths(structure: MolecularStructure): Array<{
  h1: number;
  h2: number;
  pathLength: number; // 2, 3, or 4 bonds
  bondPath: number[];
}> {
  const { atoms, bonds } = structure;
  const couplings: Array<{ h1: number; h2: number; pathLength: number; bondPath: number[] }> = [];

  // Find all hydrogens
  const hydrogens = atoms.filter(a => a.element === 'H').map(a => a.id);

  // For each pair of hydrogens
  for (let i = 0; i < hydrogens.length; i++) {
    for (let j = i + 1; j < hydrogens.length; j++) {
      const h1 = hydrogens[i];
      const h2 = hydrogens[j];

      // Find shortest path between them
      const path = findShortestPath(h1, h2, atoms, bonds);

      if (path && path.length >= 2 && path.length <= 5) {
        // 2J (geminal), 3J (vicinal), 4J (long-range)
        couplings.push({
          h1,
          h2,
          pathLength: path.length - 1,
          bondPath: path
        });
      }
    }
  }

  return couplings;
}

function findShortestPath(
  start: number,
  end: number,
  atoms: Atom[],
  bonds: Bond[]
): number[] | null {
  const queue: { node: number; path: number[] }[] = [{ node: start, path: [start] }];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (node === end) return path;
    if (visited.has(node)) continue;

    visited.add(node);

    atoms[node].connectedAtoms.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    });
  }

  return null;
}

/**
 * Calculate molecular weight from structure
 *
 * Sums atomic weights of all atoms in the molecule
 */
export function calculateMolecularWeight(structure: MolecularStructure): number {
  const atomicWeights: { [key: string]: number } = {
    'H': 1.008,
    'C': 12.011,
    'N': 14.007,
    'O': 15.999,
    'F': 18.998,
    'P': 30.974,
    'S': 32.06,
    'Cl': 35.45,
    'Br': 79.904,
    'I': 126.90
  };

  let mw = 0;
  structure.atoms.forEach(atom => {
    mw += atomicWeights[atom.element] || 0;
  });

  return mw;
}
