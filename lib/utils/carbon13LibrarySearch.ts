/**
 * 13C NMR Library Search Utilities
 * Search and match 13C NMR spectra against the molecule library
 */

import { Carbon13Peak } from '@/lib/types';
import { Carbon13Molecule, getAllCarbon13Molecules } from '@/lib/data/carbon13Library';

export interface Carbon13LibraryMatch {
  molecule: Carbon13Molecule;
  score: number;
  matchedPeaks: number;
  totalPeaks: number;
  explanation: string;
}

/**
 * Calculate similarity score between two 13C peaks
 * @param peak1 First peak
 * @param peak2 Second peak
 * @param tolerance Tolerance in ppm (default 2.0 for 13C)
 * @returns Similarity score (0-100)
 */
function calculatePeakSimilarity(peak1: Carbon13Peak, peak2: Carbon13Peak, tolerance: number = 2.0): number {
  const ppmDiff = Math.abs(peak1.ppm - peak2.ppm);

  if (ppmDiff > tolerance) {
    return 0;
  }

  // Base score from chemical shift match
  const shiftScore = (1 - (ppmDiff / tolerance)) * 70;

  // Bonus for carbon type match
  let typeBonus = 0;
  if (peak1.carbonType && peak2.carbonType && peak1.carbonType === peak2.carbonType) {
    typeBonus = 30;
  }

  return shiftScore + typeBonus;
}

/**
 * Search 13C NMR library for matching molecules
 * @param userPeaks User's input peaks
 * @param tolerance Tolerance in ppm (default 2.0)
 * @param minScore Minimum score to consider a match (default 70)
 * @returns Array of matched molecules sorted by score
 */
export function searchCarbon13Library(
  userPeaks: Carbon13Peak[],
  tolerance: number = 2.0,
  minScore: number = 70
): Carbon13LibraryMatch[] {
  if (userPeaks.length === 0) {
    return [];
  }

  const allMolecules = getAllCarbon13Molecules();
  const results: Carbon13LibraryMatch[] = [];

  for (const molecule of allMolecules) {
    const libraryPeaks = molecule.peaks;

    // Calculate match score
    let totalSimilarity = 0;
    let matchedCount = 0;

    for (const userPeak of userPeaks) {
      let bestMatch = 0;

      for (const libPeak of libraryPeaks) {
        const similarity = calculatePeakSimilarity(userPeak, libPeak, tolerance);
        if (similarity > bestMatch) {
          bestMatch = similarity;
        }
      }

      if (bestMatch > 50) { // Threshold for considering a peak matched
        matchedCount++;
        totalSimilarity += bestMatch;
      }
    }

    // Calculate overall score
    const avgSimilarity = matchedCount > 0 ? totalSimilarity / matchedCount : 0;
    const peakCoverageRatio = matchedCount / Math.max(userPeaks.length, libraryPeaks.length);
    const finalScore = avgSimilarity * peakCoverageRatio;

    if (finalScore >= minScore) {
      const explanation = `${matchedCount}/${userPeaks.length} peak eşleşti. ` +
        `Kütüphanede ${libraryPeaks.length} peak var. ` +
        `Eşleşme skoru: %${finalScore.toFixed(1)}`;

      results.push({
        molecule,
        score: finalScore,
        matchedPeaks: matchedCount,
        totalPeaks: userPeaks.length,
        explanation
      });
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Search 13C NMR library by exact peak count match
 */
export function searchCarbon13ByPeakCount(peakCount: number): Carbon13Molecule[] {
  return getAllCarbon13Molecules().filter(mol => mol.peaks.length === peakCount);
}

/**
 * Search 13C NMR library by formula
 */
export function searchCarbon13ByFormula(formula: string): Carbon13Molecule[] {
  return getAllCarbon13Molecules().filter(mol => mol.formula === formula);
}

/**
 * Get best match from library
 */
export function getBestCarbon13Match(userPeaks: Carbon13Peak[], tolerance: number = 2.0): Carbon13LibraryMatch | null {
  const matches = searchCarbon13Library(userPeaks, tolerance, 70);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Check if user peaks match a specific molecule
 */
export function matchAgainstMolecule(
  userPeaks: Carbon13Peak[],
  molecule: Carbon13Molecule,
  tolerance: number = 2.0
): Carbon13LibraryMatch {
  let matchedCount = 0;
  let totalSimilarity = 0;

  for (const userPeak of userPeaks) {
    for (const libPeak of molecule.peaks) {
      const similarity = calculatePeakSimilarity(userPeak, libPeak, tolerance);
      if (similarity > 50) {
        matchedCount++;
        totalSimilarity += similarity;
        break;
      }
    }
  }

  const avgSimilarity = matchedCount > 0 ? totalSimilarity / matchedCount : 0;
  const peakCoverageRatio = matchedCount / Math.max(userPeaks.length, molecule.peaks.length);
  const finalScore = avgSimilarity * peakCoverageRatio;

  return {
    molecule,
    score: finalScore,
    matchedPeaks: matchedCount,
    totalPeaks: userPeaks.length,
    explanation: `${matchedCount}/${userPeaks.length} peak eşleşti (%${finalScore.toFixed(1)})`
  };
}
