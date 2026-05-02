/**
 * Spectrotester core – public API.
 * Use: run({ smiles?, precomputedGraph?, loadJson?, ... }) for verification.
 */
export { run } from './engine.js';
export type { RunInput, RunResult } from './engine.js';
export { parseSmiles } from './graph/parseSmiles.js';
export type { ParseSmilesResult, ParseSmilesOptions } from './graph/parseSmiles.js';
export { computeGraphFeatures } from './graph/features.js';
export type { MoleculeGraph, GraphFeatures, MoleculeGraphAtom, MoleculeGraphBond } from './graph/features.js';
export { loadLibrary } from './library/loadLibrary.js';
export { loadRules } from './library/loadRules.js';
export type { RulesetData, RuleEntry } from './library/loadRules.js';
export { evaluateRules } from './verify/evaluateRules.js';
export type { EvalContext, RuleEvalResult } from './verify/evaluateRules.js';
export { aggregateScoring } from './verify/scoring.js';
export { buildReport, featureSnapshotFromGraph, buildArtifactHashes } from './verify/report.js';
export { artifactHashes } from './util/hash.js';
export { createSeededRng, seedFromSmiles } from './util/seed.js';
export { createTimers } from './util/timers.js';
export { parseIntegralValue, detectIntegralMode } from './util/integral.js';
export type { IntegralMode } from './util/integral.js';
