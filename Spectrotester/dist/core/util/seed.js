/**
 * Deterministic RNG: same seed => same sequence.
 * Used for spectrum synthesis and any stochastic steps.
 */
export function createSeededRng(seed) {
    let s = seed;
    return function next() {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}
export function seedFromSmiles(smiles) {
    let h = 0;
    const s = String(smiles).trim();
    for (let i = 0; i < s.length; i++)
        h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return Math.abs(h) || 1;
}
