import { NextRequest, NextResponse } from 'next/server';
import { vectorSearch, VectorSearchQuery } from '@/lib/services/v2/VectorSearchService';

/**
 * Vector Search API v2.0
 * 
 * Semantic and substructure search using vector embeddings
 * Supports hybrid search: text + structure + spectrum
 * 
 * POST /api/v2/vector-search
 * Body: {
 *   query: {
 *     type?: 'molecule' | 'spectrum' | 'substructure' | 'hybrid';
 *     data?: string;  // Legacy: SMILES, peak pattern, or SMARTS
 *     text?: string;  // Semantic text query
 *     smiles?: string;  // SMILES for structural search
 *     peaks?: [[number, number]];  // NMR peaks: [[ppm, intensity], ...]
 *     topK?: number;
 *     threshold?: number;
 *     weights?: {text?: number, struct?: number, spec?: number};
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query object is required' },
        { status: 400 }
      );
    }

    // Validate that at least one search type is provided
    const hasText = query.text && query.text.trim().length > 0;
    const hasSmiles = query.smiles && query.smiles.trim().length > 0;
    const hasPeaks = query.peaks && Array.isArray(query.peaks) && query.peaks.length > 0;
    const hasLegacyData = query.data && query.data.trim().length > 0;

    if (!hasText && !hasSmiles && !hasPeaks && !hasLegacyData) {
      return NextResponse.json(
        { success: false, error: 'At least one of text, smiles, peaks, or data must be provided' },
        { status: 400 }
      );
    }

    console.log(`🔍 Vector Search Request (v2.0):`);
    console.log(`   Type: ${query.type || 'hybrid'}`);
    if (query.text) console.log(`   Text: ${query.text.substring(0, 50)}...`);
    if (query.smiles) console.log(`   SMILES: ${query.smiles.substring(0, 50)}...`);
    if (query.peaks) console.log(`   Peaks: ${query.peaks.length} peaks`);

    const searchQuery: VectorSearchQuery = {
      type: query.type || 'hybrid',
      data: query.data,
      text: query.text,
      smiles: query.smiles,
      peaks: query.peaks,
      topK: query.topK || 10,
      threshold: query.threshold || 0.0,
      weights: query.weights || { text: 0.3, struct: 0.4, spec: 0.3 }
    };

    const result = await vectorSearch(searchQuery);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Vector search failed',
          results: null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      results: result.results,
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        method: result.method,
        query: searchQuery,
        count: result.results.length
      }
    });

  } catch (error) {
    console.error('❌ Vector Search API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: null
      },
      { status: 500 }
    );
  }
}

