/**
 * Load verification_library JSON. In Node: fs; in browser: fetch or injected loader.
 */
const defaultLibraryPath = '../../lib/spectra/library';
/**
 * Load verification_library_seed.json. Validates minimal shape (functional_group_shift_priors etc. optional).
 */
export async function loadLibrary(options = {}) {
    const base = options.libraryPath ?? defaultLibraryPath;
    const path = `${base}/verification_library_seed.json`.replace(/\/+/g, '/');
    const loader = options.loadJson;
    if (!loader)
        return null;
    try {
        const data = await loader(path);
        if (data && typeof data === 'object')
            return data;
        return null;
    }
    catch {
        return null;
    }
}
