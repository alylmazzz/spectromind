/**
 * usePubChemSearch Hook - Separation of Concerns
 * Extracted from BulkInput.tsx (220-320 lines)
 */

import { useState } from 'react';

export interface PubChemMolecule {
  cid: number;
  name: string;
  formula: string;
  synonyms?: string[];
}

export function usePubChemSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState('');
  const [results, setResults] = useState<PubChemMolecule[]>([]);
  const [synonymSuggestions, setSynonymSuggestions] = useState<Array<{ name: string; source: string }>>([]);

  const searchByName = async (query: string): Promise<PubChemMolecule[]> => {
    setIsSearching(true);
    setSearchStage('PubChem aranıyor...');
    setResults([]);
    setSynonymSuggestions([]);

    try {
      const url = `/api/pubchem?query=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.molecules && data.molecules.length > 0) {
        setResults(data.molecules);
        return data.molecules;
      }

      // Try AI synonym suggestion
      setSearchStage('AI öneri alınıyor...');
      const aiResponse = await fetch(`/api/ai-suggest-synonyms?query=${encodeURIComponent(query)}`);
      const aiData = await aiResponse.json();

      if (aiData.success && aiData.suggestions?.length > 0) {
        setSynonymSuggestions(aiData.suggestions);
      }

      return [];
    } catch (error) {
      console.error('PubChem search error:', error);
      return [];
    } finally {
      setIsSearching(false);
      setSearchStage('');
    }
  };

  const clear = () => {
    setResults([]);
    setSynonymSuggestions([]);
    setSearchStage('');
  };

  return {
    isSearching,
    searchStage,
    results,
    synonymSuggestions,
    searchByName,
    clear
  };
}
