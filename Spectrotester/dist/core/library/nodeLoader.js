/**
 * Node.js loader: read JSON from filesystem (for CLI and smoke tests).
 * Use from Spectrotester/scripts with path relative to script or process.cwd().
 */
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const _dir = dirname(fileURLToPath(import.meta.url));
/** Default library path: Spectrotester/lib/spectra/library */
export function getDefaultLibraryPath() {
    return join(_dir, '..', '..', '..', 'lib', 'spectra', 'library');
}
/**
 * Returns a loader that reads JSON from a base path (e.g. getDefaultLibraryPath()).
 */
export function createNodeLoader(basePath) {
    return async (pathOrFile) => {
        const full = pathOrFile.startsWith('/') || /^[A-Za-z]:/.test(pathOrFile)
            ? pathOrFile
            : join(basePath, pathOrFile);
        const raw = await readFile(full, 'utf8');
        return JSON.parse(raw);
    };
}
/**
 * Load a single file by filename under library (e.g. 'ruleset.json').
 */
export async function loadLibraryJson(filename, basePath) {
    const base = basePath ?? getDefaultLibraryPath();
    const loader = createNodeLoader(base);
    return loader(filename);
}
