/**
 * Deterministic artifact hashes for run traceability.
 * Same input + config => same hash (no RNG in hash).
 */
export declare function simpleHash(str: string): string;
export declare function artifactHashes(payload: {
    inputSmiles?: string;
    configSnapshot?: Record<string, unknown>;
    rulesetVersion?: string;
    libraryVersion?: string;
}): Record<string, string>;
