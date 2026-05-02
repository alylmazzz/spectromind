/**
 * Deterministic RNG: same seed => same sequence.
 * Used for spectrum synthesis and any stochastic steps.
 */
export declare function createSeededRng(seed: number): () => number;
export declare function seedFromSmiles(smiles: string): number;
