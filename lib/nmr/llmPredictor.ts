/**
 * LLM NMR Predictor
 * 
 * AI-based interpretation (NOT simulation).
 * This provides interpretation, literature insights, and assignment suggestions.
 * It does NOT claim to be a deterministic simulation.
 */

import OpenAI from 'openai';
import { LLMInterpretation } from '@/lib/pipeline/types';
import { FUNCTIONAL_GROUP_LIBRARY } from '@/lib/data/functionalGroupLibrary';

export interface LLMPredictorInput {
  moleculeName: string;
  smiles?: string;
  formula?: string;
  literature?: Array<{ doi: string; title: string; url: string }>;
  solvent?: string;
  frequency?: number;
}

const PROMPT_VERSION = 'v2.0-interpretation';

/**
 * Run LLM interpretation (not simulation)
 */
export async function runLLMInterpretation(
  input: LLMPredictorInput,
  apiKey?: string
): Promise<LLMInterpretation | null> {
  if (!apiKey) {
    console.warn('OpenAI API key not provided, skipping LLM interpretation');
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Build functional group context
    const functionalGroupContext = buildFunctionalGroupContext();

    // Build prompt emphasizing "interpretation" not "simulation"
    const prompt = buildInterpretationPrompt(input, functionalGroupContext);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert NMR spectroscopist providing INTERPRETATION and ESTIMATES based on chemical knowledge and literature. You are NOT simulating a spectrum - you are providing educated estimates with appropriate uncertainty.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3 // Lower temperature for more consistent interpretation
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const parsed = JSON.parse(content);

    return {
      model: 'gpt-4o',
      promptVersion: PROMPT_VERSION,
      notes: parsed.notes || parsed.structuralAnalysis || undefined,
      literatureInsights: parsed.literatureInsights || undefined,
      peaks: parsed.peaks ? parsed.peaks.map((p: any) => ({
        shift: p.shift,
        multiplicity: p.multiplicity,
        integration: p.integration,
        coupling: Array.isArray(p.coupling) ? p.coupling : p.coupling ? [p.coupling] : undefined,
        assignment: p.assignment,
        confidence: p.confidence || 0.6, // LLM confidence typically lower
        source: 'llm' as const
      })) : undefined,
      confidence: parsed.confidence || 0.6
    };

  } catch (error) {
    console.error('LLM interpretation failed:', error);
    return null;
  }
}

/**
 * Build interpretation prompt (emphasizes interpretation, not simulation)
 */
function buildInterpretationPrompt(
  input: LLMPredictorInput,
  functionalGroupContext: string
): string {
  return `You are an expert NMR spectroscopist providing INTERPRETATION and ESTIMATES for the expected ¹H NMR spectrum of: **${input.moleculeName}**

⚠️ IMPORTANT: You are providing INTERPRETATION based on chemical knowledge, NOT simulating a spectrum. Express uncertainty appropriately.

${input.formula ? `Molecular Formula: ${input.formula}` : ''}
${input.smiles ? `SMILES: ${input.smiles}` : ''}

${functionalGroupContext}

═══════════════════════════════════════════════════════════════════
🔬 YOUR TASK: INTERPRETATION (NOT SIMULATION)
═══════════════════════════════════════════════════════════════════

Provide your interpretation in this JSON format:

{
  "notes": "Your interpretation of expected spectral features, with appropriate uncertainty statements",
  "literatureInsights": "Summary of NMR information from literature (if available)",
  "peaks": [
    {
      "shift": 7.34,
      "multiplicity": "m",
      "integration": "5H",
      "assignment": "Aromatic protons - ESTIMATED based on typical aromatic range",
      "confidence": 0.7
    }
  ],
  "confidence": 0.7
}

⚠️ CRITICAL INSTRUCTIONS:
1. Use phrases like "expected to appear around", "typically observed at", "estimated"
2. Express uncertainty: "±0.2 ppm", "may vary", "depends on solvent"
3. DO NOT claim exact simulation - these are estimates
4. If stereo information is missing, note that peak positions may be ambiguous
5. Include confidence scores (0.0-1.0) reflecting uncertainty

Solvent: ${input.solvent || 'CDCl3'}
Frequency: ${input.frequency || 400} MHz
`;
}

/**
 * Build functional group context (reused from existing code)
 */
function buildFunctionalGroupContext(): string {
  let context = '\n\n📚 **FUNCTIONAL GROUP LIBRARY:**\n\n';
  const importantGroups = FUNCTIONAL_GROUP_LIBRARY.slice(0, 30);

  importantGroups.forEach(group => {
    context += `**${group.name}** - ${group.structure}\n`;
    context += `  ¹H NMR: ${group.h1nmr.map(h => `${h.range} (${h.description})`).join('; ')}\n`;
    context += '\n';
  });

  return context;
}
