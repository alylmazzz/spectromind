/**
 * Node.js loader: read JSON from filesystem (for CLI and smoke tests).
 * Use from Spectrotester/scripts with path relative to script or process.cwd().
 */
/** Default library path: Spectrotester/lib/spectra/library */
export declare function getDefaultLibraryPath(): string;
/**
 * Returns a loader that reads JSON from a base path (e.g. getDefaultLibraryPath()).
 */
export declare function createNodeLoader(basePath: string): (pathOrFile: string) => Promise<unknown>;
/**
 * Load a single file by filename under library (e.g. 'ruleset.json').
 */
export declare function loadLibraryJson(filename: string, basePath?: string): Promise<unknown>;
