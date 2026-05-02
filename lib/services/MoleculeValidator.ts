/**
 * MoleculeValidator Service
 * Extracted from page.tsx lines 88-175
 *
 * Handles:
 * - Known molecule validation
 * - Mixture detection
 * - Peak consistency checks
 */

import type { NMRPeak } from '@/lib/types';

export interface KnownMolecule {
  name: string;
  formula?: string;
  savedPeaks?: NMRPeak[];
  solvent?: string;
  frequency?: number;
}

export interface ValidationResult {
  isValid: boolean;
  shouldSkipAnalysis: boolean;
  warnings: string[];
  knownMolecule?: KnownMolecule;
  cleanedPeaks?: NMRPeak[];
}

export class MoleculeValidator {

  /**
   * Validate known molecule from localStorage
   */
  validateKnownMolecule(
    knownMolecule: KnownMolecule | null,
    currentPeaks: NMRPeak[],
    currentSolvent: string,
    currentFrequency: number
  ): ValidationResult {

    const warnings: string[] = [];

    // No known molecule - proceed with analysis
    if (!knownMolecule) {
      return {
        isValid: true,
        shouldSkipAnalysis: false,
        warnings: []
      };
    }

    // Check if molecule name comes from different sources (mixture detection)
    const uniqueSources = new Set<string>();
    currentPeaks.forEach(peak => {
      if (peak.source?.moleculeName) {
        uniqueSources.add(peak.source.moleculeName);
      }
    });

    if (uniqueSources.size > 1) {
      warnings.push(`⚠️ KARISIM TESPİT EDİLDİ: ${uniqueSources.size} farklı molekül peak'i bulundu!`);
      const molecules = Array.from(uniqueSources).join(', ');
      warnings.push(`Moleküller: ${molecules}`);

      return {
        isValid: false,
        shouldSkipAnalysis: false,
        warnings,
        cleanedPeaks: currentPeaks
      };
    }

    // If molecule name is different, it's a new molecule
    if (uniqueSources.size === 1 && !uniqueSources.has(knownMolecule.name)) {
      warnings.push(`Yeni molekül tespit edildi: ${Array.from(uniqueSources)[0]}`);
      return {
        isValid: true,
        shouldSkipAnalysis: false,
        warnings
      };
    }

    // Validate saved peaks match current peaks
    if (knownMolecule.savedPeaks) {
      const peaksMatch = this.comparePeaks(knownMolecule.savedPeaks, currentPeaks);

      if (!peaksMatch) {
        warnings.push('⚠️ Peak\'ler değişti! Yeni analiz gerekiyor.');
        return {
          isValid: false,
          shouldSkipAnalysis: false,
          warnings
        };
      }
    }

    // Validate solvent and frequency
    if (knownMolecule.solvent && knownMolecule.solvent !== currentSolvent) {
      warnings.push(`Çözücü değişti: ${knownMolecule.solvent} → ${currentSolvent}`);
    }

    if (knownMolecule.frequency && knownMolecule.frequency !== currentFrequency) {
      warnings.push(`Frekans değişti: ${knownMolecule.frequency} → ${currentFrequency} MHz`);
    }

    // If conditions match, can skip analysis
    const shouldSkip = warnings.length === 0;

    return {
      isValid: true,
      shouldSkipAnalysis: shouldSkip,
      warnings,
      knownMolecule
    };
  }

  /**
   * Compare two peak arrays for equality
   */
  private comparePeaks(savedPeaks: NMRPeak[], currentPeaks: NMRPeak[]): boolean {
    if (savedPeaks.length !== currentPeaks.length) {
      return false;
    }

    // Sort by shift for comparison
    const sorted1 = [...savedPeaks].sort((a, b) => a.shift - b.shift);
    const sorted2 = [...currentPeaks].sort((a, b) => a.shift - b.shift);

    // Compare each peak
    for (let i = 0; i < sorted1.length; i++) {
      const p1 = sorted1[i];
      const p2 = sorted2[i];

      if (
        Math.abs(p1.shift - p2.shift) > 0.01 ||
        Math.abs(p1.integ - p2.integ) > 0.1 ||
        p1.mult !== p2.mult
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect if peaks indicate a mixture
   */
  detectMixture(peaks: NMRPeak[]): {
    isMixture: boolean;
    components: string[];
    impurityPeaks: NMRPeak[];
  } {
    const sources = new Map<string, NMRPeak[]>();

    peaks.forEach(peak => {
      const source = peak.source?.moleculeName || 'unknown';
      if (!sources.has(source)) {
        sources.set(source, []);
      }
      sources.get(source)!.push(peak);
    });

    const isMixture = sources.size > 1;
    const components = Array.from(sources.keys());

    // Find impurity peaks (less than 10% total integration)
    const totalIntegration = peaks.reduce((sum, p) => sum + p.integ, 0);
    const impurityPeaks = peaks.filter(p => {
      const percentage = (p.integ / totalIntegration) * 100;
      return percentage < 10;
    });

    return {
      isMixture,
      components,
      impurityPeaks
    };
  }

  /**
   * Clean peaks by removing impurities
   */
  cleanPeaks(peaks: NMRPeak[]): NMRPeak[] {
    const totalIntegration = peaks.reduce((sum, p) => sum + p.integ, 0);

    return peaks.filter(peak => {
      const percentage = (peak.integ / totalIntegration) * 100;
      return percentage >= 10; // Keep peaks >= 10%
    });
  }
}

// Export singleton instance
export const moleculeValidator = new MoleculeValidator();
