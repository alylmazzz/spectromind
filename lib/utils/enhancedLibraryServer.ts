/**
 * Enhanced Library Server-Side Utilities
 *
 * @module enhancedLibraryServer
 * @description Server-side ONLY utilities for loading enhanced NMR library from filesystem.
 * This module uses Node.js fs APIs and cannot be used in client-side code.
 *
 * @author Spectromind Team
 * @version 2.0.0
 *
 * @example
 * // In API routes only:
 * import { loadEnhancedLibraryFromFile } from '@/lib/utils/enhancedLibraryServer';
 * const library = await loadEnhancedLibraryFromFile('gemini');
 */

import fs from 'fs/promises';
import path from 'path';
import { EnhancedLibrary, EnhancedLibraryV1 } from '@/lib/types/index';
import { migrateV1ToV2 } from './enhancedLibrary';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current enhanced library version */
const VERSION = '2.0.0';

/** Library file name */
const LIBRARY_FILE = 'chatgpt_enhanced_library.json';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Load enhanced library directly from filesystem (Server-side only)
 *
 * This function reads the enhanced library JSON file from disk, performs
 * version migration if needed, and returns the library data structure.
 *
 * **IMPORTANT:** This function uses Node.js fs APIs and can ONLY be used
 * in server-side code (API routes, server components).
 *
 * @returns Promise resolving to enhanced library data
 *
 * @throws Will not throw - returns empty library on error
 *
 * @example
 * // In API route:
 * export async function GET(request: NextRequest) {
 *   const library = await loadEnhancedLibraryFromFile();
 *   // ... use library
 * }
 */
export async function loadEnhancedLibraryFromFile(): Promise<EnhancedLibrary> {
  try {
    // Construct file path
    const filePath = path.join(process.cwd(), 'lib', 'data', LIBRARY_FILE);

    console.log(`📖 Loading enhanced library: ${LIBRARY_FILE}`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.warn(`⚠️  Library file not found: ${filePath}`);
      return createEmptyLibrary();
    }

    // Read and parse file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Check if file is empty
    if (!fileContent || fileContent.trim().length === 0) {
      console.warn(`⚠️  Library file is empty: ${LIBRARY_FILE}`);
      return createEmptyLibrary();
    }

    // Try to parse JSON
    let library: any;
    try {
      library = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`❌ JSON parse error in library file:`, parseError);
      console.error(`   File content preview: ${fileContent.substring(0, 200)}...`);
      return createEmptyLibrary();
    }

    // Validate library structure
    if (!library || typeof library !== 'object') {
      console.warn(`⚠️  Invalid library structure`);
      return createEmptyLibrary();
    }

    // Perform version migration if needed
    if (isOldVersion(library)) {
      console.log(`⚠️  Legacy v1.0 library detected, migrating to v${VERSION}...`);
      const migratedLibrary = migrateV1ToV2(library as EnhancedLibraryV1);
      console.log(`✅ Migration complete: ${Object.keys(migratedLibrary.molecules).length} molecules`);
      return migratedLibrary;
    }

    console.log(`✅ Library loaded: ${Object.keys(library.molecules || {}).length} molecules (v${library.version})`);
    return library as EnhancedLibrary;

  } catch (error) {
    // Log error but don't throw - return empty library as fallback
    console.error(`❌ Failed to load enhanced library from file:`, error);
    console.log(`↩️  Returning empty library as fallback`);

    return createEmptyLibrary();
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Check if library is old version (v1.0 or missing version)
 * @internal
 */
function isOldVersion(library: any): boolean {
  return !library.version || library.version === '1.0.0';
}

/**
 * Create empty library structure as fallback
 * @internal
 */
function createEmptyLibrary(): EnhancedLibrary {
  return {
    molecules: {},
    version: VERSION,
    lastUpdated: Date.now()
  };
}
