/**
 * LLM Output Sanitizer
 * 
 * Removes forbidden content from LLM responses:
 * - Formula derivations (should come from computed sources)
 * - DBE calculations (should come from code)
 * - Atom count calculations (should come from structure)
 * 
 * This ensures LLM can only provide interpretation/narrative, never core calculations.
 */

export type SanitizationWarning = {
  code: 'FORBIDDEN_FORMULA_TEXT' | 'FORBIDDEN_DBE_TEXT' | 'FORBIDDEN_ATOM_COUNT_TEXT';
  message: string;
  removedText?: string;
};

export type SanitizationResult = {
  sanitizedText: string;
  warnings: SanitizationWarning[];
  redactions: string[];
};

/**
 * Sanitizes LLM narrative/reasoning text to remove forbidden calculations.
 * 
 * Forbidden patterns:
 * - "Formül: C47H51NO14" (formula derivation)
 * - "DBE = ..." or "DBE: ..." (DBE calculation)
 * - "Atom sayısı: ..." (atom count calculation)
 * 
 * These should only come from computed sources, never from LLM.
 */
export function sanitizeLLMOutput(text: string): SanitizationResult {
  const warnings: SanitizationWarning[] = [];
  const redactions: string[] = [];
  let sanitized = text;

  // Pattern 1: Formula mentions (e.g., "Formül: C47H51NO14" or "Molecular formula: C47H51NO14")
  const formulaPattern = /(?:^|\n)[^\n]*(?:Formül|Molecular\s+formula|Formula)[^\n]*:\s*([A-Z][a-z]?\d+(?:[A-Z][a-z]?\d+)*)[^\n]*(?:\n|$)/gi;
  const formulaMatches = [...text.matchAll(formulaPattern)];
  
  for (const match of formulaMatches) {
    const fullMatch = match[0];
    const formula = match[1];
    
    // Skip if it's part of DBE block (which will be replaced anyway)
    if (fullMatch.includes('DBE Analizi') || fullMatch.includes('DBE Hesabı')) {
      continue;
    }
    
    warnings.push({
      code: 'FORBIDDEN_FORMULA_TEXT',
      message: `LLM attempted to derive formula "${formula}". This should come from computed sources only.`,
      removedText: fullMatch.trim()
    });
    
    redactions.push(fullMatch.trim());
    sanitized = sanitized.replace(fullMatch, '\n');
  }

  // Pattern 2: DBE calculations (e.g., "DBE = 23" or "DBE: 23" or "DBE hesabı: ...")
  // But allow DBE interpretation text (e.g., "DBE yüksek" is OK)
  const dbeCalculationPattern = /(?:^|\n)[^\n]*(?:DBE\s*[=:]\s*\d+|DBE\s+hesabı|DBE\s+calculation)[^\n]*(?:\n|$)/gi;
  const dbeMatches = [...text.matchAll(dbeCalculationPattern)];
  
  for (const match of dbeMatches) {
    const fullMatch = match[0];
    
    // Skip if it's part of DBE block (which will be replaced anyway)
    if (fullMatch.includes('DBE Analizi') || fullMatch.includes('**0.')) {
      continue;
    }
    
    warnings.push({
      code: 'FORBIDDEN_DBE_TEXT',
      message: 'LLM attempted to calculate DBE. This should come from code only.',
      removedText: fullMatch.trim()
    });
    
    redactions.push(fullMatch.trim());
    sanitized = sanitized.replace(fullMatch, '\n');
  }

  // Pattern 3: Atom count calculations (e.g., "C: 47, H: 51" or "Atom sayısı: C=47")
  const atomCountPattern = /(?:^|\n)[^\n]*(?:Atom\s+sayısı|Atom\s+count|Atom\s+counts)[^\n]*:\s*[^\n]*(?:\n|$)/gi;
  const atomCountMatches = [...text.matchAll(atomCountPattern)];
  
  for (const match of atomCountMatches) {
    const fullMatch = match[0];
    
    warnings.push({
      code: 'FORBIDDEN_ATOM_COUNT_TEXT',
      message: 'LLM attempted to calculate atom counts. This should come from structure only.',
      removedText: fullMatch.trim()
    });
    
    redactions.push(fullMatch.trim());
    sanitized = sanitized.replace(fullMatch, '\n');
  }

  // Clean up multiple consecutive newlines
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return {
    sanitizedText: sanitized.trim(),
    warnings,
    redactions
  };
}

/**
 * Sanitizes LLM reasoning and adds warnings to result if needed.
 * This should be called after LLM response is received but before DBE block replacement.
 */
export function sanitizeLLMReasoning(
  reasoning: string,
  result: any
): { sanitizedReasoning: string; warnings: string[] } {
  const sanitization = sanitizeLLMOutput(reasoning);
  
  // Add warnings to result if any
  if (sanitization.warnings.length > 0) {
    if (!result.warnings) {
      result.warnings = [];
    }
    
    for (const warning of sanitization.warnings) {
      result.warnings.push({
        code: warning.code,
        message: warning.message,
        severity: 'medium'
      });
    }
    
    console.warn(`⚠️ LLM sanitization: ${sanitization.warnings.length} forbidden patterns removed`);
  }
  
  return {
    sanitizedReasoning: sanitization.sanitizedText,
    warnings: sanitization.warnings.map(w => w.message)
  };
}
