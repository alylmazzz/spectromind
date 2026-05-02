/**
 * SpectroMind Unified Chemistry Kernel
 *
 * SINGLE SOURCE OF TRUTH for all chemical computations.
 * Every module that needs formula, DBE, atom counts, or molecular features
 * MUST import from this package.
 *
 * Design principles:
 * - All arithmetic uses float division (half-integer DBE is meaningful)
 * - H counting always includes implicit hydrogens
 * - Element symbols preserve case (Cl, Br, not CL, BR)
 * - Charge-aware DBE
 * - P treated as trivalent (like N) for DBE
 */

export {
  computeDBE,
  computeDBEDetailed,
  formatHillFormula,
  parseFormula,
  parseFormulaToAtomCounts,
  computeAtomCountsFromRDKitAtoms,
  normalizeFormula,
  normalizeToHill,
  validateFormula,
  formulaEquals,
  pickEffectiveFormula,
  renderDBEBlock,
  upsertDBEBlock,
  getTotalHydrogen,
  getTotalCarbon,
} from '../../lib/chem/formula';

export type {
  AtomCounts,
  DBEResult,
  ParseFormulaResult,
  EffectiveFormulaResult,
} from '../../lib/chem/formula';

export {
  ELEMENT_MASSES,
  computeExactMass,
  computeNominalMass,
  COMMON_ADDUCTS,
  computeAdductMasses,
  VALENCE_TABLE,
  validateValence,
  validateMoleculeGraph,
  classifyAtomEnvironment,
  classifyFunctionalGroups,
  detectExchangeableProtons,
  countExpectedUniqueCarbons,
} from './chemUtils';

export type {
  CanonicalMolecule,
  AtomRecord,
  BondRecord,
  MolecularGraph,
  MolecularFeatures,
  AtomEnvironment,
  FunctionalGroupFlags,
  ValenceCheck,
  AdductInfo,
} from './types';

export {
  computeEquivalenceClasses,
  expectedUniqueCarbon13Signals,
} from './symmetry';

export type {
  SymmetryClass,
  EquivalenceResult,
} from './symmetry';
