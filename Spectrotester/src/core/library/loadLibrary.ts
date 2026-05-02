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

const defaultLibraryPath = '../../lib/spectra/library';

/**
 * Load verification_library_seed.json. Validates minimal shape (functional_group_shift_priors etc. optional).
 */
export async function loadLibrary(options: LoadLibraryOptions = {}): Promise<Record<string, unknown> | null> {
  const base = options.libraryPath ?? defaultLibraryPath;
  const path = `${base}/verification_library_seed.json`.replace(/\/+/g, '/');
  const loader = options.loadJson;
  if (!loader) return null;
  try {
    const data = await loader(path);
    if (data && typeof data === 'object') return data as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}
