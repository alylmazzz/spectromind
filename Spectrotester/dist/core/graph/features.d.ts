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
export declare function computeGraphFeatures(graph: MoleculeGraph): GraphFeatures;
