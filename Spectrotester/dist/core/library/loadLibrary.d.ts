/**
 * Load verification_library JSON. In Node: fs; in browser: fetch or injected loader.
 */
export type LibraryLoader = (path: string) => Promise<unknown>;
export interface LoadLibraryOptions {
    /** Base path for library files (e.g. Spectrotester/lib/spectra/library) */
    libraryPath?: string;
    /** Custom loader (e.g. fetch or require). If not set, loadLibrary will return undefined unless loadJson is provided. */
    loadJson?: LibraryLoader;
}
/**
 * Load verification_library_seed.json. Validates minimal shape (functional_group_shift_priors etc. optional).
 */
export declare function loadLibrary(options?: LoadLibraryOptions): Promise<Record<string, unknown> | null>;
