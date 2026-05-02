/**
 * Vector Search Service (RAG - Retrieval Augmented Generation)
 * 
 * Provides semantic and substructure search using vector embeddings
 */

export interface VectorSearchQuery {
  type?: 'molecule' | 'spectrum' | 'substructure' | 'hybrid';  // 'hybrid' for multi-modal search
  data?: string;              // SMILES, peak pattern, or SMARTS (legacy)
  text?: string;              // Semantic text query
  smiles?: string;            // SMILES for structural search
  peaks?: Array<[number, number]>;  // NMR peaks: [[ppm, intensity], ...]
  topK?: number;            // Number of results
  threshold?: number;        // Similarity threshold (0-1)
  weights?: {                // Hybrid search weights
    text?: number;
    struct?: number;
    spec?: number;
  };
}

export interface VectorSearchResult {
  molecule: {
    name: string;
    smiles: string;
    formula: string;
    cid?: number;
  };
  similarity: number;        // 0-1
  spectrum?: {
    nmr?: Array<{ shift: number; integration: number; multiplicity: string }>;
    ftir?: Array<{ wavenumber: number; intensity: number }>;
    ms?: Array<{ mz: number; intensity: number }>;
  };
  metadata?: Record<string, any>;
}

export interface VectorSearchResponse {
  success: boolean;
  results: VectorSearchResult[];
  query: VectorSearchQuery;
  method: string;
  error?: string;
}

/**
 * Search for similar molecules/spectra using vector embeddings
 * 
 * Supports hybrid search: text + structure + spectrum
 */
export async function vectorSearch(
  query: VectorSearchQuery
): Promise<VectorSearchResponse> {
  try {
    console.log(`🔍 Vector Search v2.0: ${query.type || 'hybrid'}`);
    
    // Use advanced Python vector search engine
    const result = await performAdvancedVectorSearch(query);

    if (result.error) {
      // Fallback to library search if Python engine fails
      console.warn('⚠️ Advanced vector search failed, using fallback');
      return await fallbackSearch(query);
    }

    // Convert Python result to TypeScript format
    const results: VectorSearchResult[] = (result.results || []).map((r: any) => ({
      molecule: {
        name: r.name,
        smiles: r.smiles || '',
        formula: '',  // Will be filled from metadata if available
        cid: r.id
      },
      similarity: r.score,
      metadata: {
        reason: r.reason,
        abstract: r.abstract,
        source: 'vector-search'
      }
    }));

    console.log(`✅ Vector Search complete: ${results.length} results`);

    return {
      success: true,
      results,
      query,
      method: result.method || 'Hybrid Vector Search'
    };

  } catch (error) {
    console.error('❌ Vector Search error:', error);
    return {
      success: false,
      results: [],
      query,
      method: 'Vector Search (Fallback)',
      error: error instanceof Error ? error.message : 'Vector search failed'
    };
  }
}

/**
 * Perform advanced vector search using Python VectorSearchEngine
 */
async function performAdvancedVectorSearch(
  query: VectorSearchQuery
): Promise<any> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');
  const { getPythonPath } = await import('@/lib/utils/pythonPath');

  // Build query object for Python
  const pythonQuery: any = {};
  
  if (query.text) {
    pythonQuery.text = query.text;
  }
  if (query.smiles) {
    pythonQuery.smiles = query.smiles;
  } else if (query.data && (query.type === 'molecule' || query.type === 'substructure')) {
    pythonQuery.smiles = query.data;
  }
  if (query.peaks) {
    pythonQuery.peaks = query.peaks;
  } else if (query.data && query.type === 'spectrum') {
    // Try to parse spectrum data (format may vary)
    try {
      const peaks = JSON.parse(query.data);
      pythonQuery.peaks = Array.isArray(peaks) ? peaks : [];
    } catch {
      pythonQuery.peaks = [];
    }
  }

  const pythonScript = `
import sys
import os
import json

# Add project root to path
project_root = r"${process.cwd().replace(/\\/g, '/')}"
sys.path.insert(0, os.path.join(project_root, 'services', 'vector-service'))

try:
    from vector_search_engine import VectorSearchEngine
    
    query_obj = ${JSON.stringify(pythonQuery)}
    weights = ${JSON.stringify(query.weights || {text: 0.3, struct: 0.4, spec: 0.3})}
    top_k = ${query.topK || 10}
    threshold = ${query.threshold || 0.0}
    
    engine = VectorSearchEngine()
    results = engine.search_hybrid(
        query_obj=query_obj,
        weights=weights,
        top_k=top_k,
        threshold=threshold
    )
    
    print(json.dumps({
        "success": True,
        "results": results,
        "method": "Hybrid Vector Search"
    }))
except Exception as e:
    import traceback
    print(json.dumps({
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }))
`;

  try {
    const pythonPath = getPythonPath();
    const tempScriptPath = path.join(
      os.tmpdir(),
      `vector_search_${Date.now()}_${Math.random().toString(36).substring(7)}.py`
    );
    
    // Get the project root directory
    const projectRoot = process.cwd();
    const vectorServicePath = path.join(projectRoot, 'services', 'vector-service');
    
    // Check if vector_search_engine.py exists
    const enginePath = path.join(vectorServicePath, 'vector_search_engine.py');
    if (!fs.existsSync(enginePath)) {
      throw new Error('Vector search engine module not found. Please ensure vector_search_engine.py exists in services/vector-service/');
    }

    fs.writeFileSync(tempScriptPath, pythonScript, 'utf8');
    
    try {
      const { stdout, stderr } = await execAsync(
        `"${pythonPath}" "${tempScriptPath}"`,
        {
          timeout: 60000,  // 60 seconds timeout
          maxBuffer: 50 * 1024 * 1024,
          cwd: projectRoot
        }
      );
      
      if (stderr && !stdout) {
        throw new Error(`Python error: ${stderr}`);
      }
      
      const result = JSON.parse(stdout.trim());
      return result;
    } finally {
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  } catch (error) {
    console.error('Advanced vector search error:', error);
    return {
      error: error instanceof Error ? error.message : 'Vector search failed'
    };
  }
}

/**
 * Fallback search using library matching
 */
async function fallbackSearch(
  query: VectorSearchQuery
): Promise<VectorSearchResponse> {
  try {
    // Load library data
    const libraryPath = require.resolve('@/lib/data/chatgpt_enhanced_library.json');
    const library = JSON.parse(require('fs').readFileSync(libraryPath, 'utf8'));

    const results: VectorSearchResult[] = [];
    const topK = query.topK || 10;
    const threshold = query.threshold || 0.5;

    if (query.type === 'molecule' || query.type === 'substructure') {
      // Search by SMILES similarity (simple string matching for now)
      const querySmiles = query.data?.toUpperCase() ?? '';
      
      for (const mol of library) {
        if (!mol.smiles) continue;
        
        const molSmiles = mol.smiles.toUpperCase();
        
        // Simple similarity: check if query is substring or vice versa
        let similarity = 0;
        if (molSmiles === querySmiles) {
          similarity = 1.0;
        } else if (molSmiles.includes(querySmiles) || querySmiles.includes(molSmiles)) {
          similarity = 0.7;
        } else {
          // Calculate Jaccard similarity of character sets
          const set1 = new Set(querySmiles);
          const set2 = new Set(molSmiles);
          const intersection = new Set([...set1].filter(x => set2.has(x)));
          const union = new Set([...set1, ...set2]);
          similarity = intersection.size / union.size;
        }

        if (similarity >= threshold) {
          results.push({
            molecule: {
              name: mol.name || 'Unknown',
              smiles: mol.smiles,
              formula: mol.formula || '',
              cid: mol.cid
            },
            similarity,
            spectrum: mol.nmr_peaks ? {
              nmr: mol.nmr_peaks.map((p: any) => ({
                shift: p.shift || p.ppm,
                integration: p.integration || p.integ || 1,
                multiplicity: p.multiplicity || p.mult || 's'
              }))
            } : undefined,
            metadata: {
              source: 'library',
              confidence: mol.confidence
            }
          });
        }
      }
    } else if (query.type === 'spectrum') {
      // Search by peak pattern (simplified)
      // TODO: Implement proper peak pattern matching
      // For now, return empty results
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, topK);

    return {
      success: true,
      results: topResults,
      query,
      method: 'Library Search (Vector Search Fallback)'
    };

  } catch (error) {
    return {
      success: false,
      results: [],
      query,
      method: 'Library Search (Vector Search Fallback)',
      error: error instanceof Error ? error.message : 'Fallback search failed'
    };
  }
}

/**
 * Generate embedding for molecule (placeholder)
 */
export async function generateMoleculeEmbedding(smiles: string): Promise<number[]> {
  // TODO: Implement embedding generation
  // Options:
  // 1. RDKit molecular fingerprints (Morgan, MACCS)
  // 2. GNN node embeddings
  // 3. Pre-trained transformer models
  
  // Placeholder: return zero vector
  return new Array(128).fill(0);
}

/**
 * Generate embedding for spectrum (placeholder)
 */
export async function generateSpectrumEmbedding(
  peaks: Array<{ shift: number; intensity: number }>
): Promise<number[]> {
  // TODO: Implement spectrum embedding
  // Options:
  // 1. Histogram binning
  // 2. Fourier transform
  // 3. Autoencoder embeddings
  
  // Placeholder: return zero vector
  return new Array(128).fill(0);
}

/**
 * Initialize Pinecone connection (placeholder)
 */
export async function initializePinecone(): Promise<boolean> {
  // TODO: Implement Pinecone initialization
  // This would involve:
  // 1. Creating Pinecone client
  // 2. Connecting to index
  // 3. Verifying connection
  
  return false;
}

