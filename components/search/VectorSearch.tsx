'use client';

import { useState } from 'react';

export interface VectorSearchResult {
  molecule: {
    name: string;
    smiles: string;
    formula: string;
    cid?: number;
  };
  similarity: number;
  spectrum?: {
    nmr?: Array<{ shift: number; integration: number; multiplicity: string }>;
    ftir?: Array<{ wavenumber: number; intensity: number }>;
  };
}

interface VectorSearchProps {
  onResultSelect?: (result: VectorSearchResult) => void;
}

/**
 * Vector Search Component
 * 
 * Provides semantic and substructure search interface
 */
export default function VectorSearch({ onResultSelect }: VectorSearchProps) {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<'molecule' | 'spectrum' | 'substructure'>('molecule');
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v2/vector-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: {
            type: queryType,
            data: query,
            topK: 10,
            threshold: 0.5
          }
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.results || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">🔍 Vector Search (v2.0)</h2>

      {/* Search Input */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value as any)}
            className="p-2 border rounded"
          >
            <option value="molecule">Molecule (SMILES)</option>
            <option value="spectrum">Spectrum (Peak Pattern)</option>
            <option value="substructure">Substructure (SMARTS)</option>
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              queryType === 'molecule' ? 'Enter SMILES...' :
              queryType === 'spectrum' ? 'Enter peak pattern...' :
              'Enter SMARTS pattern...'
            }
            className="flex-1 p-2 border rounded"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Results ({results.length}):</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => onResultSelect?.(result)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{result.molecule.name}</div>
                    <div className="text-sm text-gray-600">
                      {result.molecule.formula} • SMILES: {result.molecule.smiles.substring(0, 50)}...
                    </div>
                    {result.molecule.cid && (
                      <div className="text-xs text-gray-500">CID: {result.molecule.cid}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {(result.similarity * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Similarity</div>
                  </div>
                </div>

                {/* Spectrum Preview */}
                {result.spectrum?.nmr && result.spectrum.nmr.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    NMR: {result.spectrum.nmr.slice(0, 3).map(p => 
                      `δ ${p.shift.toFixed(2)} (${p.multiplicity}, ${p.integration}H)`
                    ).join(', ')}
                    {result.spectrum.nmr.length > 3 && '...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <div className="text-gray-500 text-center py-8">
          No results found. Try adjusting your search query.
        </div>
      )}
    </div>
  );
}

