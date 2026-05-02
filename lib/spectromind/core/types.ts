/**
 * SpectroMind Core Type Definitions
 * Rule-based theoretical spectroscopy engine
 */

export interface Atom {
  id: string;
  symbol: string; // H, C, N, O, etc.
  x: number;
  y: number;
  z?: number;
  hybridization?: 'sp' | 'sp2' | 'sp3';
  formalCharge: number;
  implicitHydrogens: number;
  aromaticity: boolean;
  symmetryGroup?: string; // Equivalent atom set
  magneticEquivalence?: string;
}

export interface Bond {
  id: string;
  atom1Id: string;
  atom2Id: string;
  order: 1 | 2 | 3 | 1.5; // 1.5 for aromatic
  isAromatic: boolean;
  conjugated: boolean;
  stereo?: 'E' | 'Z' | 'cis' | 'trans';
}

export interface MolecularGraph {
  atoms: Atom[];
  bonds: Bond[];
  formula: string;
  smiles?: string;
  iupac?: string;
}

export interface MolecularProperties {
  IHD: number; // Index of Hydrogen Deficiency
  pointGroup?: string;
  equivalentAtomSets: string[][]; // Symmetry groups
  conjugationPaths: Bond[][];
  hasChirality: boolean;
  tautomers?: MolecularGraph[];
}

export interface Conformer {
  id: string;
  atoms: Atom[];
  energy: number; // kcal/mol
  boltzmannWeight: number;
  dihedralAngles: Map<string, number>; // bond_id -> angle
}

export interface IRPeak {
  wavenumber: number; // cm⁻¹
  intensity: number; // 0-100
  type: 'strong' | 'medium' | 'weak';
  assignment: string;
  mode: 'stretch' | 'bend' | 'wag' | 'twist' | 'rock';
  forceConstant?: number; // N/m
}

export interface NMRPeakTheoretical {
  delta: number; // ppm
  atom: Atom;
  couplings: JCoupling[];
  multiplet: number[]; // Splitting tree
  integration: number;
  exchangeable: boolean;
}

export interface JCoupling {
  atom1: Atom;
  atom2: Atom;
  J: number; // Hz
  type: '2J' | '3J' | '4J' | '5J';
  dihedralAngle?: number; // For Karplus
}

export interface SpectralResult {
  ftir: IRPeak[];
  protonNMR: NMRPeakTheoretical[];
  carbonNMR: NMRPeakTheoretical[];
  validationWarnings: string[];
}
