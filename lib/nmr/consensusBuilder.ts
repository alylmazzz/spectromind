/**
 * Consensus Builder
 * 
 * Merges deterministic model predictions with LLM interpretations
 * into a final consensus result.
 */

import {
  DeterministicPrediction,
  LLMInterpretation,
  FinalConsensus,
  NMRPeakPrediction
} from '@/lib/pipeline/types';

export interface ConsensusOptions {
  /** Tolerance for peak matching (ppm) */
  tolerancePpm?: number;
  
  /** Stereo status - affects fusion rules */
  stereoStatus?: 'full' | 'partial' | 'none';
  
  /** Prefer model over LLM if both exist? */
  preferModel?: boolean;
}

const DEFAULT_TOLERANCE_PPM = 0.2;

/**
 * Build final consensus from model and LLM predictions
 */
export function buildConsensus(
  modelPrediction: DeterministicPrediction,
  llmInterpretation?: LLMInterpretation,
  options: ConsensusOptions = {}
): FinalConsensus {
  const tolerance = options.tolerancePpm || DEFAULT_TOLERANCE_PPM;
  const stereoStatus = options.stereoStatus || 'none';
  const preferModel = options.preferModel !== false; // Default true

  // Case 1: Only model prediction
  if (!llmInterpretation || !llmInterpretation.peaks || llmInterpretation.peaks.length === 0) {
    return {
      method: 'model-only',
      peaks: modelPrediction.peaks.map(p => ({
        ...p,
        source: 'model' as const
      })),
      rationale: 'Only deterministic model prediction available',
      confidence: modelPrediction.confidence
    };
  }

  // Case 2: Only LLM interpretation
  if (modelPrediction.peaks.length === 0) {
    return {
      method: 'llm-only',
      peaks: llmInterpretation.peaks.map(p => ({
        ...p,
        source: 'llm' as const
      })),
      rationale: 'Only LLM interpretation available',
      confidence: llmInterpretation.confidence || 0.6
    };
  }

  // Case 3: Both available - fusion
  const mergedPeaks = mergePeaksByShift(
    modelPrediction.peaks,
    llmInterpretation.peaks,
    tolerance,
    stereoStatus,
    preferModel
  );

  return {
    method: 'fusion',
    peaks: mergedPeaks,
    rationale: `Merged ${modelPrediction.peaks.length} model peaks with ${llmInterpretation.peaks.length} LLM peaks using ${tolerance} ppm tolerance`,
    confidence: Math.max(modelPrediction.confidence, llmInterpretation.confidence || 0.6) * 0.9 // Slightly lower for fusion
  };
}

/**
 * Merge peaks from model and LLM by shift proximity
 */
function mergePeaksByShift(
  modelPeaks: NMRPeakPrediction[],
  llmPeaks: NMRPeakPrediction[],
  tolerancePpm: number,
  stereoStatus: 'full' | 'partial' | 'none',
  preferModel: boolean
): NMRPeakPrediction[] {
  const merged: NMRPeakPrediction[] = [];
  const usedModelIndices = new Set<number>();
  const usedLLMIndices = new Set<number>();

  // Match peaks within tolerance
  for (let i = 0; i < modelPeaks.length; i++) {
    const modelPeak = modelPeaks[i];
    let bestMatch: { llmPeak: NMRPeakPrediction; distance: number; llmIdx: number } | null = null;

    for (let j = 0; j < llmPeaks.length; j++) {
      if (usedLLMIndices.has(j)) continue;

      const llmPeak = llmPeaks[j];
      const distance = Math.abs(modelPeak.shift - llmPeak.shift);

      if (distance < tolerancePpm) {
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { llmPeak, distance, llmIdx: j };
        }
      }
    }

    if (bestMatch) {
      // Merge matched peaks
      usedModelIndices.add(i);
      usedLLMIndices.add(bestMatch.llmIdx);

      // Fusion rule: prefer model if stereo is full, else combine
      let finalPeak: NMRPeakPrediction;
      
      if (preferModel && stereoStatus === 'full') {
        // Prefer model shift, but add LLM assignment if better
        finalPeak = {
          ...modelPeak,
          assignment: modelPeak.assignment || bestMatch.llmPeak.assignment,
          source: 'consensus' as const,
          confidence: Math.max(modelPeak.confidence || 0.7, bestMatch.llmPeak.confidence || 0.6)
        };
      } else {
        // Average shift (weighted by confidence)
        const modelWeight = modelPeak.confidence || 0.7;
        const llmWeight = bestMatch.llmPeak.confidence || 0.6;
        const totalWeight = modelWeight + llmWeight;
        
        finalPeak = {
          shift: (modelPeak.shift * modelWeight + bestMatch.llmPeak.shift * llmWeight) / totalWeight,
          multiplicity: modelPeak.multiplicity || bestMatch.llmPeak.multiplicity,
          integration: modelPeak.integration || bestMatch.llmPeak.integration,
          coupling: modelPeak.coupling || bestMatch.llmPeak.coupling,
          assignment: bestMatch.llmPeak.assignment || modelPeak.assignment,
          confidence: Math.max(modelWeight, llmWeight),
          source: 'consensus' as const
        };
      }

      merged.push(finalPeak);
    } else {
      // Model peak has no LLM match - include it
      usedModelIndices.add(i);
      merged.push({
        ...modelPeak,
        source: 'model' as const
      });
    }
  }

  // Add unmatched LLM peaks (only if stereo is full, else they're just interpretation)
  if (stereoStatus === 'full') {
    for (let j = 0; j < llmPeaks.length; j++) {
      if (!usedLLMIndices.has(j)) {
        merged.push({
          ...llmPeaks[j],
          source: 'llm' as const,
          confidence: (llmPeaks[j].confidence || 0.6) * 0.8 // Lower confidence for unmatched LLM peaks
        });
      }
    }
  }

  // Sort by shift
  merged.sort((a, b) => b.shift - a.shift); // High to low ppm

  return merged;
}
