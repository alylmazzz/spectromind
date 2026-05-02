/**
 * KnownMoleculeValidator
 * Manages known molecule storage and validation
 */

import type { NMRPeak } from '@/lib/types';

export interface KnownMolecule {
  name: string;
  cid: number;
  formula: string;
  peaks?: NMRPeak[];
  timestamp: number;
}

export class KnownMoleculeValidator {
  private readonly STORAGE_KEY = 'spectromind_known_molecule';
  private readonly MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Get known molecule from localStorage
   */
  getKnownMolecule(): KnownMolecule | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const molecule: KnownMolecule = JSON.parse(stored);

      // Check if stale
      const age = Date.now() - (molecule.timestamp || 0);
      if (age > this.MAX_AGE_MS) {
        console.log('⏰ Kaydedilen molekül çok eski, silindi');
        this.clearKnownMolecule();
        return null;
      }

      console.log(`✨ KAYDEDILMIŞ MOLEKÜL BULUNDU: ${molecule.name}`);
      return molecule;
    } catch (e) {
      console.error('Kaydedilen molekül parse hatası:', e);
      this.clearKnownMolecule();
      return null;
    }
  }

  /**
   * Save known molecule to localStorage
   */
  setKnownMolecule(molecule: Omit<KnownMolecule, 'timestamp'>): void {
    if (typeof window === 'undefined') return;

    const dataToStore: KnownMolecule = {
      ...molecule,
      timestamp: Date.now()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
  }

  /**
   * Clear known molecule from localStorage
   */
  clearKnownMolecule(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Detect if peaks come from multiple molecules (mixture)
   */
  detectMixture(peaks: NMRPeak[]): {
    isMixture: boolean;
    sources: string[];
  } {
    const uniqueSources = new Set<string>();

    peaks.forEach(peak => {
      if (peak.source?.moleculeName) {
        uniqueSources.add(peak.source.moleculeName);
      }
    });

    const sources = Array.from(uniqueSources);

    if (sources.length > 1) {
      console.log(`🔬 KARIŞIM TESPİT EDİLDİ! ${sources.length} farklı molekül:`);
      sources.forEach(mol => console.log(`   - ${mol}`));
    }

    return {
      isMixture: sources.length > 1,
      sources
    };
  }

  /**
   * Validate known molecule against current peaks
   * Returns null if invalid, otherwise returns the validated molecule
   */
  validateKnownMolecule(
    knownMolecule: KnownMolecule | null,
    currentPeaks: NMRPeak[]
  ): KnownMolecule | null {
    if (!knownMolecule) return null;

    // Check for mixture
    const { isMixture, sources } = this.detectMixture(currentPeaks);

    if (isMixture) {
      console.log('⚠️ knownMolecule karışımda kullanılamaz, siliniyor...');
      this.clearKnownMolecule();
      return null;
    }

    // If there's exactly one source molecule, check if it matches known molecule
    if (sources.length === 1) {
      const sourceMolecule = sources[0];
      console.log(`✅ Tüm peak'ler aynı molekülden: ${sourceMolecule}`);

      if (knownMolecule.name !== sourceMolecule) {
        console.log(`⚠️ Molekül değişmiş! (Kayıtlı: ${knownMolecule.name}, Şimdi: ${sourceMolecule})`);
        console.log('🔄 knownMolecule GEÇERSİZ, siliniyor...');
        this.clearKnownMolecule();
        return null;
      }
    }

    // Validate peaks if saved
    if (knownMolecule.peaks && knownMolecule.peaks.length > 0) {
      const isValid = this.comparePeaks(knownMolecule.peaks, currentPeaks);

      if (!isValid) {
        console.log('🔄 Peak\'ler değiştirilmiş, knownMolecule GEÇERSİZ, siliniyor...');
        this.clearKnownMolecule();
        return null;
      }

      console.log('✅ Peak\'ler değişmemiş, knownMolecule GEÇERLİ!');
    }

    return knownMolecule;
  }

  /**
   * Compare two peak arrays for equality
   */
  private comparePeaks(savedPeaks: NMRPeak[], currentPeaks: NMRPeak[]): boolean {
    // Check count
    if (savedPeaks.length !== currentPeaks.length) {
      console.log(`⚠️ Peak sayısı değişti! (Kayıtlı: ${savedPeaks.length}, Şimdi: ${currentPeaks.length})`);
      return false;
    }

    // Compare each peak
    for (let i = 0; i < savedPeaks.length; i++) {
      const saved = savedPeaks[i];
      const current = currentPeaks[i];

      // Check shift, integration, and multiplicity
      const shiftDiff = Math.abs(saved.shift - current.shift);
      const integDiff = Math.abs((saved.integ || 1) - (current.integ || 1));
      const multChanged = saved.mult !== current.mult;

      if (shiftDiff > 0.01 || integDiff > 0.1 || multChanged) {
        console.log(`⚠️ Peak ${i + 1} değişti!`);
        console.log(`   Kayıtlı: ${saved.shift} (${saved.mult}, ${saved.integ}H)`);
        console.log(`   Şimdi: ${current.shift} (${current.mult}, ${current.integ}H)`);
        return false;
      }
    }

    return true;
  }
}

// Export singleton
export const knownMoleculeValidator = new KnownMoleculeValidator();
