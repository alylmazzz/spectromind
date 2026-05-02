/**
 * Canonical molecule and graph types — shared across TS and Python boundaries.
 *
 * Field naming convention: camelCase for TS, the Python chem-core service
 * must map its snake_case outputs through an adapter.
 */

export interface AtomRecord {
  index: number;
  symbol: string;
  formalCharge: number;
  implicitHydrogens: number;
  totalHydrogens: number;
  isAromatic: boolean;
  hybridization: 'SP' | 'SP2' | 'SP3' | 'S' | 'UNSPECIFIED' | string;
  ringSize: number | null;
  ringCount: number;
  inRing: boolean;
  chiralTag?: string;
  numRadicalElectrons?: number;
}

export interface BondRecord {
  beginAtomIdx: number;
  endAtomIdx: number;
  bondOrder: number;
  bondType: string;
  isAromatic: boolean;
  stereo?: string;
  inRing?: boolean;
}

export interface MolecularGraph {
  canonicalSmiles: string;
  inputSmiles: string;
  atoms: AtomRecord[];
  bonds: BondRecord[];
  formula: string;
  formulaHill: string;
  atomCounts: Record<string, number>;
  dbe: number;
  exactMass: number;
  formalCharge: number;
  source: 'rdkit' | 'js_fallback';
  chiralCenters: Array<{ atomIdx: number; type: string }>;
}

export type AtomEnvironmentClass =
  | 'alkyl_ch3' | 'alkyl_ch2' | 'alkyl_ch' | 'alkyl_c'
  | 'benzylic' | 'allylic' | 'propargylic'
  | 'alpha_to_carbonyl' | 'alpha_to_oxygen' | 'alpha_to_nitrogen' | 'alpha_to_halogen'
  | 'vinylic' | 'aromatic'
  | 'aldehydic' | 'carboxylic_oh' | 'phenolic_oh' | 'alcoholic_oh'
  | 'amide_nh' | 'amine_nh' | 'thiol_sh'
  | 'carbonyl_ketone' | 'carbonyl_aldehyde' | 'carbonyl_ester' | 'carbonyl_acid'
  | 'carbonyl_amide' | 'nitrile' | 'unknown';

export interface AtomEnvironment {
  atomIdx: number;
  symbol: string;
  envClass: AtomEnvironmentClass;
  hCount: number;
  isExchangeable: boolean;
  neighbors: number[];
  heteroNeighborCount: number;
  carbonylAdjacent: boolean;
  aromaticRingMember: boolean;
  ringSize: number | null;
}

export interface FunctionalGroupFlags {
  hasOH: boolean;
  hasNH: boolean;
  hasCarbonyl: boolean;
  hasCarbonylKetone: boolean;
  hasCarbonylAldehyde: boolean;
  hasCarbonylEster: boolean;
  hasCarbonylAcid: boolean;
  hasCarbonylAmide: boolean;
  hasNitrile: boolean;
  hasNitro: boolean;
  hasEther: boolean;
  hasThioether: boolean;
  hasSulfonyl: boolean;
  hasPhosphate: boolean;
  hasHalogen: boolean;
  hasFluorine: boolean;
  hasChlorine: boolean;
  hasBromine: boolean;
  hasIodine: boolean;
  hasAromaticRing: boolean;
  hasAlkene: boolean;
  hasAlkyne: boolean;
  hasMethoxy: boolean;
  hasAnhydride: boolean;
}

export interface MolecularFeatures {
  dbe: number;
  dbeValid: boolean;
  totalCarbons: number;
  totalHydrogens: number;
  totalNitrogens: number;
  totalOxygens: number;
  totalHalogens: number;
  totalSulfurs: number;
  totalPhosphorus: number;
  aromaticCarbons: number;
  aromaticHydrogens: number;
  sp3Carbons: number;
  sp2Carbons: number;
  spCarbons: number;
  ch3Count: number;
  ch2Count: number;
  chCount: number;
  quaternaryCarbons: number;
  carbonylCount: number;
  nitrileCount: number;
  exchangeableHydrogens: number;
  nonExchangeableHydrogens: number;
  expectedUniqueCarbons: number;
  functionalGroups: FunctionalGroupFlags;
  atomEnvironments: AtomEnvironment[];
}

export interface ValenceCheck {
  atomIdx: number;
  symbol: string;
  expectedValence: number[];
  actualValence: number;
  valid: boolean;
  message?: string;
}

export interface AdductInfo {
  name: string;
  formula: string;
  deltaMass: number;
  charge: number;
  computedMz: number;
}

export interface CanonicalMolecule {
  canonicalSmiles: string;
  isomericSmiles: string;
  inputSmiles: string;
  formula: string;
  formulaHill: string;
  atomCounts: Record<string, number>;
  dbe: number;
  dbeDetailed: import('../../lib/chem/formula').DBEResult;
  exactMass: number;
  nominalMass: number;
  formalCharge: number;
  graph: MolecularGraph;
  features: MolecularFeatures;
  valenceChecks: ValenceCheck[];
  provenance: {
    source: string;
    timestamp: string;
    kernelVersion: string;
  };
}
