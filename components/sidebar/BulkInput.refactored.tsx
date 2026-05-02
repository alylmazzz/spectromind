/**
 * BulkInput Component - REFACTORED
 * SOLID principles applied
 * Reduced from 1244 lines to ~200 lines
 */

'use client';

import { useState, useEffect } from 'react';
import { NMRPeak, Carbon13Peak, FTIRPeak, SpectrumType } from '@/lib/types';
import { PeakParser } from '@/lib/utils/peakParser';
import { usePubChemSearch, PubChemMolecule } from '@/lib/hooks/usePubChemSearch';
import { MoleculeLoaderService } from '@/lib/services/MoleculeLoaderService';

interface BulkInputProps {
  spectrumType: SpectrumType;
  onPeaksImport?: (peaks: NMRPeak[]) => void;
  onCarbon13PeaksImport?: (peaks: Carbon13Peak[]) => void;
  onFtirPeaksImport?: (peaks: FTIRPeak[]) => void;
  onMoleculeNameChange?: (name: string) => void;
  onFormulaChange?: (formula: string) => void;
  solvent?: string;
}

export default function BulkInputRefactored({
  spectrumType,
  onPeaksImport,
  onCarbon13PeaksImport,
  onFtirPeaksImport,
  onMoleculeNameChange,
  onFormulaChange,
  solvent = 'DMSO'
}: BulkInputProps) {
  const [bulkText, setBulkText] = useState('');
  const [parsedPeaksPreview, setParsedPeaksPreview] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const pubchem = usePubChemSearch();

  // Auto-parse preview (DRY - reuses PeakParser)
  useEffect(() => {
    if (!bulkText.trim()) {
      setParsedPeaksPreview([]);
      return;
    }

    const lines = bulkText.split('\n');
    let preview: any[] = [];

    if (spectrumType === 'c13') {
      preview = PeakParser.parseCarbon13Peaks(lines);
    } else if (spectrumType === 'ftir') {
      preview = PeakParser.parseFTIRPeaks(lines);
    } else {
      preview = PeakParser.parseNMRPeaks(lines);
    }

    setParsedPeaksPreview(preview);
  }, [bulkText, spectrumType]);

  // Import parsed peaks (DRY - reuses PeakParser)
  const handleImport = () => {
    const lines = bulkText.split('\n');

    if (spectrumType === 'c13') {
      const peaks = PeakParser.parseCarbon13Peaks(lines);
      if (peaks.length > 0 && onCarbon13PeaksImport) {
        onCarbon13PeaksImport(peaks);
        console.log(`✅ ${peaks.length} 13C peak imported`);
      }
    } else if (spectrumType === 'ftir') {
      const peaks = PeakParser.parseFTIRPeaks(lines);
      if (peaks.length > 0 && onFtirPeaksImport) {
        onFtirPeaksImport(peaks);
        console.log(`✅ ${peaks.length} FTIR peak imported`);
      }
    } else {
      const peaks = PeakParser.parseNMRPeaks(lines);
      if (peaks.length > 0 && onPeaksImport) {
        onPeaksImport(peaks);
        console.log(`✅ ${peaks.length} NMR peak imported`);
      }
    }

    setBulkText('');
  };

  // PubChem search (Separation of Concerns - uses usePubChemSearch hook)
  const handleSearch = async () => {
    const results = await pubchem.searchByName(searchQuery);

    if (results.length > 0) {
      console.log(`✅ ${results.length} PubChem result found`);
    } else {
      console.log('⚠️ No PubChem results');
    }
  };

  // Load molecule (Separation of Concerns - uses MoleculeLoaderService)
  const handleLoadMolecule = async (molecule: PubChemMolecule) => {
    console.log('📥 Loading molecule:', molecule.name);

    const result = await MoleculeLoaderService.load(molecule, spectrumType as 'nmr' | 'ftir' | 'c13', solvent);

    if (result.success) {
      // Update UI state
      onMoleculeNameChange?.(molecule.name);
      onFormulaChange?.(molecule.formula);

      // Import peaks
      if (result.peaks) {
        if (spectrumType === 'ftir' && onFtirPeaksImport) {
          onFtirPeaksImport(result.peaks as FTIRPeak[]);
        } else if (spectrumType === 'c13' && onCarbon13PeaksImport) {
          onCarbon13PeaksImport(result.peaks as Carbon13Peak[]);
        } else if (spectrumType === 'nmr' && onPeaksImport) {
          onPeaksImport(result.peaks as NMRPeak[]);
        }
      }

      alert(result.message);
      pubchem.clear();
    } else {
      alert(result.message);
    }
  };

  // Handle synonym click (extracted from inline handler)
  const handleSynonymClick = async (suggestion: { name: string; source: string }) => {
    console.log('🔍 Synonym clicked:', suggestion.name);
    setSearchQuery(suggestion.name);

    const results = await pubchem.searchByName(suggestion.name);

    if (results.length > 0 && results[0]) {
      await handleLoadMolecule(results[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* PubChem Search Section */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-bold text-blue-400 mb-2">🔍 PubChem Arama</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Molekül adı girin..."
            className="flex-1 bg-slate-700 text-white px-3 py-2 rounded"
          />
          <button
            onClick={handleSearch}
            disabled={pubchem.isSearching || !searchQuery.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {pubchem.isSearching ? pubchem.searchStage : 'Ara'}
          </button>
        </div>

        {/* Search Results */}
        {pubchem.results.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-bold text-green-400">Sonuçlar:</h4>
            {pubchem.results.map((molecule) => (
              <div key={molecule.cid} className="bg-slate-700 p-3 rounded flex justify-between items-center">
                <div>
                  <div className="font-bold">{molecule.name}</div>
                  <div className="text-sm text-gray-400">CID: {molecule.cid} | {molecule.formula}</div>
                </div>
                <button
                  onClick={() => handleLoadMolecule(molecule)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                >
                  Yükle
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI Synonym Suggestions */}
        {pubchem.synonymSuggestions.length > 0 && (
          <div className="mt-4">
            <h4 className="font-bold text-yellow-400">AI Önerileri:</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {pubchem.synonymSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSynonymClick(suggestion)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
                >
                  {suggestion.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Text Input Section */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-bold text-purple-400 mb-2">📝 Toplu Peak Girişi</h3>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={getPlaceholder(spectrumType)}
          className="w-full bg-slate-700 text-white p-3 rounded font-mono text-sm h-40"
        />

        {/* Preview */}
        {parsedPeaksPreview.length > 0 && (
          <div className="mt-2 text-sm text-green-400">
            ✅ {parsedPeaksPreview.length} peak algılandı
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={parsedPeaksPreview.length === 0}
          className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:opacity-50"
        >
          İçe Aktar ({parsedPeaksPreview.length} peak)
        </button>
      </div>
    </div>
  );
}

function getPlaceholder(spectrumType: SpectrumType): string {
  if (spectrumType === 'c13') {
    return 'δ 128.5\nδ 77.0\n...';
  } else if (spectrumType === 'ftir') {
    return '1680 (s)\n3400 (w)\n...';
  } else {
    return 'δ 7.26 (d, J = 8 Hz, 2H)\nδ 3.80 (s, 3H)\n...';
  }
}
