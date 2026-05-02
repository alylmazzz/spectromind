/**
 * Spectrotester core orchestrator.
 * run({ smiles?, formula?, context, observedSpectra, scenario }) => { predicted, verification_report, coverage_report }
 */
import { type MoleculeGraph } from './graph/features.js';
import type { LibraryLoader } from './library/loadLibrary.js';
export interface RunInput {
    smiles?: string;
    formula?: string;
    context?: Record<string, unknown>;
    observedSpectra?: Record<string, unknown>;
    scenario?: string;
    /** Precomputed graph (e.g. from SpectroMind parse_and_standardize) */
    precomputedGraph?: MoleculeGraph;
    /** API base URL for parse (if no precomputedGraph) */
    apiBase?: string;
    /** Load JSON from path (Node: fs; browser: fetch) */
    loadJson?: LibraryLoader;
    libraryPath?: string;
    engineId?: string;
}
export interface RunResult {
    success: boolean;
    parseError?: string;
    root_cause_code?: string;
    verification_report?: Record<string, unknown>;
    coverage_report?: Record<string, unknown>;
    predicted?: unknown;
    feature_snapshot?: Record<string, unknown>;
}
export declare function run(input: RunInput): Promise<RunResult>;
