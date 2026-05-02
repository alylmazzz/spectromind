/**
 * KnownMoleculeService - Separation of Concerns
 * Handles localStorage management for known molecules
 */

import { NMRPeak, Carbon13Peak } from '@/lib/types';

export interface KnownMolecule {
  name: string;
  cid: number;
  formula?: string;
  timestamp: number;
  peaks?: Array<{ shift: number; source?: { moleculeName?: string } }>;
}

export class KnownMoleculeService {
  private static STORAGE_KEY = 'spectromind_known_molecule';
  private static EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes

  static get(peaks: NMRPeak[] | Carbon13Peak[]): KnownMolecule | null {
    if (typeof window === 'undefined') return null;

    const stored = this.getStored();
    if (!stored) return null;

    if (this.isExpired(stored)) {
      this.clear();
      return null;
    }

    if (this.isManualInput(peaks)) {
      this.clear();
      return null;
    }

    if (this.isMixture(peaks)) {
      this.clear();
      return null;
    }

    if (this.hasPeakChanges(stored, peaks)) {
      this.clear();
      return null;
    }

    return stored;
  }

  static set(molecule: KnownMolecule): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(molecule));
  }

  static clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private static getStored(): KnownMolecule | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private static isExpired(molecule: KnownMolecule): boolean {
    const age = Date.now() - (molecule.timestamp || 0);
    return age > this.EXPIRY_TIME;
  }

  private static isManualInput(peaks: NMRPeak[] | Carbon13Peak[]): boolean {
    const uniqueSources = new Set<string>();

    peaks.forEach((p: any) => {
      if (p.source?.moleculeName) {
        uniqueSources.add(p.source.moleculeName);
      }
    });

    return uniqueSources.size === 0;
  }

  private static isMixture(peaks: NMRPeak[] | Carbon13Peak[]): boolean {
    const uniqueSources = new Set<string>();

    peaks.forEach((p: any) => {
      if (p.source?.moleculeName) {
        uniqueSources.add(p.source.moleculeName);
      }
    });

    if (uniqueSources.size > 1) {
      return true;
    }

    const stored = this.getStored();
    if (uniqueSources.size === 1 && stored) {
      const sourceMolecule = Array.from(uniqueSources)[0];
      return stored.name !== sourceMolecule;
    }

    return false;
  }

  private static hasPeakChanges(stored: KnownMolecule, currentPeaks: NMRPeak[] | Carbon13Peak[]): boolean {
    if (!stored.peaks || stored.peaks.length === 0) return false;

    const savedPeaks = stored.peaks.filter(p => p.source?.moleculeName);
    const currentSourcePeaks = currentPeaks.filter((p: any) => p.source?.moleculeName);

    if (savedPeaks.length !== currentSourcePeaks.length) {
      return true;
    }

    const savedShifts = savedPeaks.map(p => p.shift).sort((a, b) => a - b);
    const currentShifts = currentSourcePeaks.map((p: any) => 'shift' in p ? p.shift : p.ppm).sort((a, b) => a - b);

    for (let i = 0; i < savedShifts.length; i++) {
      if (Math.abs(savedShifts[i] - currentShifts[i]) > 0.01) {
        return true;
      }
    }

    return false;
  }
}
