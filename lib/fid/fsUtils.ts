import path from 'path';
import fs from 'fs/promises';

/**
 * Safe path join with traversal protection
 */
export function safeJoin(root: string, relPath: string): string {
  // Normalize and remove path traversal attempts
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(root, normalized);
}

/**
 * Recursively find a file by name (case-insensitive)
 */
export async function findFileRecursive(
  startDir: string,
  filename: string
): Promise<string | null> {
  try {
    const entries = await fs.readdir(startDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(startDir, entry.name);
      
      if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
        return fullPath;
      }
      
      if (entry.isDirectory()) {
        const found = await findFileRecursive(fullPath, filename);
        if (found) return found;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching in ${startDir}:`, error);
    return null;
  }
}

/**
 * List directory tree (for debugging)
 */
export async function listTree(
  rootDir: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];
  
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      files.push(fullPath);
      
      if (entry.isDirectory() && currentDepth < maxDepth - 1) {
        const subFiles = await listTree(fullPath, maxDepth, currentDepth + 1);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
  
  return files;
}
