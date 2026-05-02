/**
 * Molecular Formula Utilities
 * 
 * Single source of truth for formula calculation, DBE computation, and validation.
 * All formulas MUST be computed from atomCounts, never from free text.
 */

/**
 * Atom counts from structure (e.g., {C:47, H:51, N:1, O:14})
 */
export type AtomCounts = Record<string, number>;

/**
 * Compute atom counts from RDKit atoms array
 * Includes implicit hydrogens if available
 */
export function computeAtomCountsFromRDKitAtoms(
  atoms: Array<{
    symbol: string;
    implicitHydrogens?: number;
  }>
): AtomCounts {
  const counts: AtomCounts = {};

  for (const atom of atoms) {
    const symbol = atom.symbol;
    counts[symbol] = (counts[symbol] || 0) + 1;

    // Add implicit hydrogens if available
    if (atom.implicitHydrogens && atom.implicitHydrogens > 0) {
      counts['H'] = (counts['H'] || 0) + atom.implicitHydrogens;
    }
  }

  return counts;
}

/**
 * Format molecular formula in Hill system
 * Order: C, H, then alphabetical
 */
export function formatHillFormula(atomCounts: AtomCounts): string {
  if (Object.keys(atomCounts).length === 0) {
    return '';
  }

  let formula = '';

  // Carbon first (if present)
  if (atomCounts['C'] !== undefined && atomCounts['C'] > 0) {
    formula += `C${atomCounts['C'] > 1 ? atomCounts['C'] : ''}`;
  }

  // Hydrogen second (if present)
  if (atomCounts['H'] !== undefined && atomCounts['H'] > 0) {
    formula += `H${atomCounts['H'] > 1 ? atomCounts['H'] : ''}`;
  }

  // Other elements alphabetically
  const otherElements = Object.keys(atomCounts)
    .filter(symbol => symbol !== 'C' && symbol !== 'H')
    .sort();

  for (const symbol of otherElements) {
    const count = atomCounts[symbol];
    if (count > 0) {
      formula += `${symbol}${count > 1 ? count : ''}`;
    }
  }

  return formula;
}

/**
 * Compute Degree of Unsaturation (DBE - Double Bond Equivalent)
 *
 * Standard formula: DBE = C - H/2 - X/2 + N/2 + 1
 * where X = F + Cl + Br + I (halogens)
 *
 * Extended: P is trivalent like N, so +P/2.
 * O and S are divalent → no DBE contribution.
 * Charge correction: +charge/2 (for cations the effective H count shifts).
 *
 * All arithmetic uses float division — half-integer DBE values are meaningful
 * and must NOT be truncated.
 */
export type DBEResult = {
  dbe: number;
  terms: {
    C: number;
    H: number;
    N: number;
    P: number;
    X: number;
  };
  charge: number;
  isValid: boolean;
  parityNote: string;
};

export function computeDBE(atomCounts: AtomCounts, charge: number = 0): number {
  return computeDBEDetailed(atomCounts, charge).dbe;
}

export function computeDBEDetailed(atomCounts: AtomCounts, charge: number = 0): DBEResult {
  const C = atomCounts['C'] ?? 0;
  const H = atomCounts['H'] ?? 0;
  const N = atomCounts['N'] ?? 0;
  const P = atomCounts['P'] ?? 0;

  const X =
    (atomCounts['F'] ?? 0) +
    (atomCounts['Cl'] ?? 0) +
    (atomCounts['Br'] ?? 0) +
    (atomCounts['I'] ?? 0);

  const dbe = C - H / 2 - X / 2 + (N + P) / 2 + charge / 2 + 1;

  const isInteger = Number.isInteger(dbe) || Number.isInteger(dbe * 2);
  const isValid = dbe >= 0;

  let parityNote = '';
  if (dbe < 0) {
    parityNote = 'DBE negative: formula/charge inconsistency';
  } else if (!Number.isInteger(dbe * 2)) {
    parityNote = 'DBE not integer or half-integer: unexpected parity';
  }

  return { dbe, terms: { C, H, N, P, X }, charge, isValid, parityNote };
}

/**
 * Parse molecular formula string to atom counts
 * Handles Hill system format (e.g., "C47H51NO14", "C₄₇H₅₁NO₁₄")
 * 
 * Supported:
 * - "C47H51NO14"
 * - "C₄₇H₅₁NO₁₄" (unicode subscripts)
 * - "C 47 H 51 N O 14" (spaces)
 * - "C47H51NO14+" / "C47H51NO14 2+" (charges stripped)
 * - "NaCl" (multi-letter elements)
 * 
 * Not supported (by design, keep it strict):
 * - Parentheses expansions like "Fe2(SO4)3"
 * - Nested groups
 */
export function parseFormulaToAtomCounts(formula: string): AtomCounts {
  return parseFormula(formula).atomCounts;
}

/**
 * Full formula parsing with normalization
 */
export type ParseFormulaResult = {
  normalizedInput: string;     // normalized ASCII-ish formula string
  atomCounts: AtomCounts;      // e.g. { C:47, H:51, N:1, O:14 }
  hillFormula: string;         // e.g. "C47H51NO14"
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

function normalizeSubscripts(s: string): string {
  return s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => SUBSCRIPT_DIGITS[ch] ?? ch);
}

function stripCommonNoise(s: string): string {
  return (
    s
      .trim()
      // Replace unicode subscripts
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => SUBSCRIPT_DIGITS[ch] ?? ch)
      // Remove whitespace
      .replace(/\s+/g, "")
      // Remove dot separators used in hydrates (· or .)
      .replace(/[·•∙.]/g, "")
      // Remove charge notations at the end like 2+, +, 3-, -, etc.
      .replace(/([0-9]+)?[+-]+$/g, "")
      // Remove caret charges like ^2- etc.
      .replace(/\^[0-9]*[+-]+/g, "")
  );
}

function isElementSymbol(sym: string): boolean {
  // Valid element symbol: Capital letter + optional lowercase letter
  return /^[A-Z][a-z]?$/.test(sym);
}

export function parseFormula(formula: string): ParseFormulaResult {
  const normalizedInput = stripCommonNoise(formula);

  if (!normalizedInput) {
    return { normalizedInput, atomCounts: {}, hillFormula: "" };
  }

  // Tokenize as repeating groups: Element + optional count
  // Example: C47 H51 N O14
  const re = /([A-Z][a-z]?)(\d*)/g;

  const atomCounts: AtomCounts = {};
  let match: RegExpExecArray | null;
  let consumed = 0;

  while ((match = re.exec(normalizedInput)) !== null) {
    const [full, element, countStr] = match;
    consumed += full.length;

    if (!isElementSymbol(element)) continue;

    const count = countStr ? Number.parseInt(countStr, 10) : 1;
    if (!Number.isFinite(count) || count <= 0) continue;

    atomCounts[element] = (atomCounts[element] ?? 0) + count;
  }

  const hillFormula = formatHillFormula(atomCounts);

  return { normalizedInput, atomCounts, hillFormula };
}

/**
 * Normalize formula string (remove subscripts, uppercase)
 */
export function normalizeFormula(formula: string): string {
  if (!formula) return '';

  const result = parseFormula(formula);
  if (result.hillFormula) return result.hillFormula;

  return stripCommonNoise(formula);
}

/**
 * Validate formula match (case-insensitive, normalized)
 * Returns true if formulas match (allowing for minor formatting differences)
 */
export function validateFormula(
  expectedFormula: string,
  computedFormula: string
): boolean {
  const normalizedExpected = normalizeFormula(expectedFormula);
  const normalizedComputed = normalizeFormula(computedFormula);

  // Parse both to atom counts for accurate comparison
  const expectedCounts = parseFormulaToAtomCounts(normalizedExpected);
  const computedCounts = parseFormulaToAtomCounts(normalizedComputed);

  // Compare all elements
  const allElements = new Set([
    ...Object.keys(expectedCounts),
    ...Object.keys(computedCounts)
  ]);

  for (const element of allElements) {
    const expected = expectedCounts[element] || 0;
    const computed = computedCounts[element] || 0;
    
    if (expected !== computed) {
      return false;
    }
  }

  return true;
}

/**
 * Get total hydrogen count from atom counts
 */
export function getTotalHydrogen(atomCounts: AtomCounts): number {
  return atomCounts['H'] || 0;
}

/**
 * Get total carbon count from atom counts
 */
export function getTotalCarbon(atomCounts: AtomCounts): number {
  return atomCounts['C'] || 0;
}

/**
 * Compares two formula strings by parsing + Hill formatting.
 * This ignores ordering differences and unicode subscripts.
 */
export function formulaEquals(a: string, b: string): boolean {
  const pa = parseFormula(a);
  const pb = parseFormula(b);
  return pa.hillFormula !== "" && pa.hillFormula === pb.hillFormula;
}

/**
 * Utility to normalize formula string to plain ASCII digits and Hill order.
 * Useful to store in "effectiveFormula".
 */
export function normalizeToHill(formula: string): string {
  return parseFormula(formula).hillFormula;
}

/**
 * Renders a deterministic DBE block in your UI/LLM reasoning output.
 * Keep the "interpretation" minimal & generic (do not claim exact rings).
 */
export function renderDBEBlock(formula: string): string {
  const { hillFormula, atomCounts } = parseFormula(formula);
  const { dbe, terms } = computeDBEDetailed(atomCounts);

  // Format DBE nicely: integer if close, else keep one decimal
  const rounded = Math.round(dbe * 2) / 2; // to nearest 0.5
  const dbeStr = Number.isInteger(rounded) ? String(rounded) : String(rounded);

  // Build a deterministic "calculation string"
  // DBE = C - H/2 - X/2 + N/2 + 1
  let calc = `DBE = ${terms.C}`;
  if (terms.H > 0) calc += ` - ${terms.H}/2`;
  if (terms.X > 0) calc += ` - ${terms.X}/2`;
  if (terms.N > 0) calc += ` + ${terms.N}/2`;
  calc += ` + 1 = ${dbeStr}`;

  // Minimal interpretation (avoid hallucinations)
  let interp = "";
  if (rounded <= 0) interp = "DBE≈0: doymuş yapı (çift bağ/halka beklenmez).";
  else if (rounded === 1) interp = "DBE≈1: 1 halka veya 1 çift bağ (veya 1 karbonil) olası.";
  else if (rounded >= 4) interp = `DBE≥4: aromatik/çoklu halka veya çoklu doymamışlık olasılığı artar (kompleks yapı olabilir).`;
  else interp = `DBE=${dbeStr}: birden fazla doymamışlık/halka olası.`;

  return [
    `**0. DBE Analizi (ZORUNLU!):**`,
    `- Formül: ${hillFormula || formula}`,
    `- DBE Hesabı: ${calc}`,
    `- DBE Yorumu: ${interp}`,
  ].join("\n");
}

/**
 * Picks the effective formula from multiple sources with priority order.
 * This is the SINGLE SOURCE OF TRUTH for formula selection.
 * 
 * Priority order (highest to lowest):
 * 1. identityLockFormula - User selected molecule (absolute truth)
 * 2. rdkitAtomCounts - Computed from structure (most reliable automatic)
 * 3. pubchemFormula - From PubChem API (supporting source)
 * 4. llmFormula - LLM estimate (fallback only, marked as "estimated")
 * 
 * @returns { formula, source, warnings }
 */
export type EffectiveFormulaResult = {
  formula: string;
  source: 'identity_lock' | 'rdkit' | 'pubchem' | 'llm_fallback' | 'none';
  warnings: string[];
  atomCounts?: AtomCounts;
  dbe?: number;
};

export function pickEffectiveFormula(options: {
  identityLockFormula?: string;
  rdkitAtomCounts?: AtomCounts;
  pubchemFormula?: string;
  llmFormula?: string;
}): EffectiveFormulaResult {
  const warnings: string[] = [];
  
  // Priority 1: Identity lock (user selected molecule)
  if (options.identityLockFormula) {
    const normalized = normalizeToHill(options.identityLockFormula);
    if (normalized) {
      const parsed = parseFormula(normalized);
      const dbe = computeDBE(parsed.atomCounts);
      return {
        formula: normalized,
        source: 'identity_lock',
        warnings: [],
        atomCounts: parsed.atomCounts,
        dbe
      };
    }
  }
  
  // Priority 2: RDKit atom counts (computed from structure)
  if (options.rdkitAtomCounts && Object.keys(options.rdkitAtomCounts).length > 0) {
    const hillFormula = formatHillFormula(options.rdkitAtomCounts);
    if (hillFormula) {
      const dbe = computeDBE(options.rdkitAtomCounts);
      return {
        formula: hillFormula,
        source: 'rdkit',
        warnings: [],
        atomCounts: options.rdkitAtomCounts,
        dbe
      };
    }
  }
  
  // Priority 3: PubChem formula
  if (options.pubchemFormula) {
    const normalized = normalizeToHill(options.pubchemFormula);
    if (normalized) {
      const parsed = parseFormula(normalized);
      const dbe = computeDBE(parsed.atomCounts);
      return {
        formula: normalized,
        source: 'pubchem',
        warnings: [],
        atomCounts: parsed.atomCounts,
        dbe
      };
    }
  }
  
  // Priority 4: LLM formula (fallback, marked as estimated)
  if (options.llmFormula) {
    const normalized = normalizeToHill(options.llmFormula);
    if (normalized) {
      const parsed = parseFormula(normalized);
      const dbe = computeDBE(parsed.atomCounts);
      warnings.push('Formula is LLM-estimated and may be inaccurate. Use with caution.');
      return {
        formula: normalized,
        source: 'llm_fallback',
        warnings,
        atomCounts: parsed.atomCounts,
        dbe
      };
    }
  }
  
  // No formula found
  warnings.push('No formula source available. DBE calculation cannot be performed.');
  return {
    formula: '',
    source: 'none',
    warnings
  };
}

/**
 * Upserts (inserts or replaces) DBE block in reasoning text.
 * 
 * Algorithm:
 * 1. If DBE block exists (pattern: "**0. DBE Analizi"), replace it
 * 2. If placeholder exists ("<<DBE_BLOCK_INSERTED_BY_APP>>"), replace it
 * 3. Otherwise, insert at the beginning (before "**1." or at start)
 * 
 * @param reasoning - Original reasoning text
 * @param dbeBlock - Deterministic DBE block from renderDBEBlock()
 * @returns Updated reasoning text
 */
export function upsertDBEBlock(reasoning: string, dbeBlock: string): string {
  if (!reasoning) {
    return dbeBlock;
  }
  
  // First, replace placeholder if present
  if (reasoning.includes('<<DBE_BLOCK_INSERTED_BY_APP>>')) {
    return reasoning.replace(/<<DBE_BLOCK_INSERTED_BY_APP>>/g, dbeBlock);
  }
  
  // Pattern to find DBE block start: "**0. DBE Analizi" (case-insensitive)
  const dbeBlockStartPattern = /\*\*0\.\s*DBE\s*Analizi[^*]*/i;
  
  if (dbeBlockStartPattern.test(reasoning)) {
    // Find the start of DBE block
    const dbeStartMatch = reasoning.match(dbeBlockStartPattern);
    if (dbeStartMatch && dbeStartMatch.index !== undefined) {
      const dbeStartIndex = dbeStartMatch.index;
      
      // Find the end: next "**" header (like "**1.") or end of string
      const afterDbeStart = reasoning.substring(dbeStartIndex);
      const nextHeaderMatch = afterDbeStart.match(/\n\n\*\*[^0]/);
      
      if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
        // Replace from DBE start to next header
        const dbeEndIndex = dbeStartIndex + nextHeaderMatch.index;
        return (
          reasoning.substring(0, dbeStartIndex) +
          dbeBlock +
          reasoning.substring(dbeEndIndex)
        );
      } else {
        // Replace from DBE start to end
        return reasoning.substring(0, dbeStartIndex) + dbeBlock;
      }
    }
  }
  
  // No DBE block found, insert at the beginning
  const firstSectionIndex = reasoning.indexOf('**1.');
  if (firstSectionIndex > 0) {
    return dbeBlock + '\n\n' + reasoning.substring(firstSectionIndex);
  } else {
    return dbeBlock + '\n\n' + reasoning;
  }
}
