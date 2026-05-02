/**
 * MoleculeLoaderService - Single Responsibility
 * Extracted from BulkInput.tsx loadFromPubChem (435 lines)
 * Handles loading molecule data from PubChem for different spectrum types
 */

import { FTIRPeak, NMRPeak, Carbon13Peak } from '@/lib/types';
import { PubChemMolecule } from '@/lib/hooks/usePubChemSearch';

export interface MoleculeLoadResult {
  success: boolean;
  message: string;
  peaks?: FTIRPeak[] | NMRPeak[] | Carbon13Peak[];
  metadata?: any;
}

export class MoleculeLoaderService {
  static async loadForFTIR(molecule: PubChemMolecule): Promise<MoleculeLoadResult> {
    // Clear old metadata
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ftir_molecule_metadata');
    }

    try {
      // Try FTIR data aggregator
      const aggregatorResponse = await fetch('/api/ftir-data-aggregator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MoleculeName: molecule.name,
          CID: molecule.cid,
          MolecularFormula: molecule.formula
        })
      });

      const aggregatorData = await aggregatorResponse.json();

      if (aggregatorData.success && aggregatorData.data?.predictedPeaks?.length > 0) {
        const peaks: FTIRPeak[] = aggregatorData.data.predictedPeaks;
        const metadata = {
          moleculeName: molecule.name,
          cid: molecule.cid,
          formula: molecule.formula,
          source: aggregatorData.data.bestSource?.name || 'Theoretical',
          iupacName: aggregatorData.data.IUPACName
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('ftir_molecule_metadata', JSON.stringify(metadata));
        }

        return {
          success: true,
          message: `✅ ${metadata.source} kaynağında spektrum bulundu!`,
          peaks,
          metadata
        };
      }

      // Try multi-source fallback
      const multiSourceResponse = await fetch('/api/ftir-multi-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: molecule.cid, moleculeName: molecule.name })
      });

      const multiSourceData = await multiSourceResponse.json();

      if (multiSourceData.success && multiSourceData.peaks?.length > 0) {
        const peaks: FTIRPeak[] = multiSourceData.peaks;
        const metadata = {
          moleculeName: molecule.name,
          cid: molecule.cid,
          formula: molecule.formula,
          source: 'Multi-Source'
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('ftir_molecule_metadata', JSON.stringify(metadata));
        }

        return {
          success: true,
          message: '✅ Multi-source spektrum bulundu!',
          peaks,
          metadata
        };
      }

      return {
        success: false,
        message: '⚠️ FTIR spektrumu bulunamadı'
      };
    } catch (error: any) {
      console.error('FTIR load error:', error);
      return {
        success: false,
        message: `❌ Hata: ${error.message}`
      };
    }
  }

  static async loadFor13CNMR(molecule: PubChemMolecule, solvent: string): Promise<MoleculeLoadResult> {
    try {
      const nmrUrl = `/api/pubchem?type=nmr&query=${molecule.cid}&solvent=${encodeURIComponent(solvent)}`;
      const nmrResponse = await fetch(nmrUrl);
      const nmrData = await nmrResponse.json();

      if (nmrData.success && nmrData.c13Peaks && nmrData.c13Peaks.length > 0) {
        const peaks: Carbon13Peak[] = nmrData.c13Peaks.map((peak: any) => ({
          ppm: peak.shift || peak.ppm,
          intensity: 100,
          assignment: peak.assignment || ''
        }));

        // Save known molecule
        if (typeof window !== 'undefined') {
          localStorage.setItem('spectromind_known_molecule', JSON.stringify({
            name: molecule.name,
            cid: molecule.cid,
            formula: molecule.formula,
            timestamp: Date.now()
          }));
        }

        return {
          success: true,
          message: `✅ ${peaks.length} adet 13C NMR peak'i yüklendi`,
          peaks
        };
      }

      return {
        success: false,
        message: '⚠️ 13C NMR verisi bulunamadı'
      };
    } catch (error: any) {
      console.error('13C NMR load error:', error);
      return {
        success: false,
        message: `❌ Hata: ${error.message}`
      };
    }
  }

  static async loadFor1HNMR(molecule: PubChemMolecule, solvent: string): Promise<MoleculeLoadResult> {
    try {
      const nmrUrl = `/api/pubchem?type=nmr&query=${molecule.cid}&solvent=${encodeURIComponent(solvent)}`;
      const nmrResponse = await fetch(nmrUrl);
      const nmrData = await nmrResponse.json();

      if (nmrData.success && nmrData.peaks && nmrData.peaks.length > 0) {
        const peaks: NMRPeak[] = nmrData.peaks.map((peak: any) => ({
          ...peak,
          source: {
            moleculeName: molecule.name,
            cid: molecule.cid
          }
        }));

        // Save known molecule
        if (typeof window !== 'undefined') {
          localStorage.setItem('spectromind_known_molecule', JSON.stringify({
            name: molecule.name,
            cid: molecule.cid,
            formula: molecule.formula,
            peaks: peaks,
            timestamp: Date.now()
          }));
        }

        return {
          success: true,
          message: `✅ ${peaks.length} adet 1H NMR peak'i yüklendi`,
          peaks
        };
      }

      return {
        success: false,
        message: '⚠️ 1H NMR verisi bulunamadı'
      };
    } catch (error: any) {
      console.error('1H NMR load error:', error);
      return {
        success: false,
        message: `❌ Hata: ${error.message}`
      };
    }
  }

  static async load(
    molecule: PubChemMolecule,
    spectrumType: 'nmr' | 'ftir' | 'c13',
    solvent?: string
  ): Promise<MoleculeLoadResult> {
    switch (spectrumType) {
      case 'ftir':
        return this.loadForFTIR(molecule);
      case 'c13':
        return this.loadFor13CNMR(molecule, solvent || 'DMSO');
      case 'nmr':
        return this.loadFor1HNMR(molecule, solvent || 'DMSO');
      default:
        return {
          success: false,
          message: 'Geçersiz spektrum tipi'
        };
    }
  }
}
