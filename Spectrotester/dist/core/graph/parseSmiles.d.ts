/**
 * SMILES → graph. Prefer RDKit/API; accept precomputed MoleculeGraph for tests/CLI.
 * GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED: parse fail => do not proceed (FATAL).
 */
import type { MoleculeGraph } from './features.js';
export interface ParseSmilesOptions {
    /** Base URL for parse_and_standardize API (optional) */
    apiBase?: string;
    /** Precomputed graph (e.g. from test or CLI that already called API) */
    precomputedGraph?: MoleculeGraph;
}
export interface ParseSmilesResult {
    success: boolean;
    canonicalSmiles?: string;
    moleculeGraph?: MoleculeGraph;
    rootCause?: string;
    message?: string;
}
/**
 * Parse SMILES to molecule graph. If precomputedGraph given, validate and return.
 * Otherwise in Node/browser you would call parse_and_standardize API; here we only
 * support precomputed for core-only runs (HTML or SpectroMind supplies graph).
 */
export declare function parseSmiles(smiles: string, options?: ParseSmilesOptions): Promise<ParseSmilesResult>;
