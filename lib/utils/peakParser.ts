/**
 * Strict peak parsing with guardrails to prevent unit mismatches.
 * 
 * Prevents:
 * - FTIR cm⁻¹ values (3300, 3500) being parsed as ¹H NMR ppm
 * - ¹H + ¹³C + FTIR mixing in same dataset
 * - Out-of-range values causing formula derivation errors
 */

export type ParseWarningCode =
  | "LINE_UNPARSEABLE"
  | "OUT_OF_RANGE"
  | "MISSING_FIELDS"
  | "UNIT_MISMATCH";

export interface ParseWarning {
  code: ParseWarningCode;
  line: string;
  message: string;
}

export interface H1Peak {
  shiftPpm: number;
  multiplicity: string; // e.g., s, d, t, m, dd ...
  integrationH: number; // numeric count of H
  raw: string;
}

export interface C13Peak {
  shiftPpm: number;
  carbonType: "Cq" | "CH" | "CH2" | "CH3";
  raw: string;
}

export interface FTIRBand {
  wavenumberCm1: number;
  intensity?: number; // optional (50)
  raw: string;
}

function normalizeLine(line: string): string {
  // Normalize common unicode variants
  return line
    .trim()
    // normalize delta symbol variations/spaces
    .replace(/\s+/g, " ")
    // normalize superscript minus one for cm^-1
    .replace(/cm\s*[\u207B\u2212-]?\s*[\u00B9¹]/gi, "cm^-1")
    // normalize odd minus chars
    .replace(/[\u2212\u2013\u2014]/g, "-");
}

function safeFloat(x: string): number | null {
  const n = Number.parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

function pushWarn(warnings: ParseWarning[], code: ParseWarningCode, line: string, message: string) {
  warnings.push({ code, line, message });
}

/**
 * Parses lines like:
 * δ 8.13 (d, 2H)
 * δ 5.79 (dd, 1H)
 * δ 2.30 (m, 2H)
 *
 * Guardrail: ppm must be between -2 and 15 (inclusive).
 * If line looks like δ 3300 ... it's rejected as UNIT_MISMATCH/OUT_OF_RANGE.
 */
export function parseH1Peaks(text: string): { peaks: H1Peak[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const peaks: H1Peak[] = [];

  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);

  // Example accepted:
  // δ 8.13 (d, 2H)
  // δ 7.50 (m, 5H)
  // δ 5.79 (dd, 1H)
  const re = /^δ\s*([+-]?\d+(?:\.\d+)?)\s*\(\s*([A-Za-z]{1,4})\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*H\s*(?:,.*)?\)\s*$/i;

  for (const rawLine of lines) {
    if (!rawLine.startsWith("δ")) continue;

    // If it includes "ppm" it's probably C13; skip here.
    if (/\bppm\b/i.test(rawLine)) continue;

    const m = rawLine.match(re);
    if (!m) {
      // It starts with δ but doesn't match H1 pattern
      // might be a different format or mistaken FTIR line with δ prefix
      pushWarn(warnings, "LINE_UNPARSEABLE", rawLine, "¹H peak format not recognized.");
      continue;
    }

    const shift = safeFloat(m[1]);
    const mult = m[2].toLowerCase();
    const integ = safeFloat(m[3]);

    if (shift === null || integ === null) {
      pushWarn(warnings, "MISSING_FIELDS", rawLine, "Missing numeric fields for ¹H peak.");
      continue;
    }

    // Guardrail range for ¹H: -2 to 15 ppm
    if (shift < -2 || shift > 15) {
      // This catches δ 3300, δ 3500 etc. (FTIR bands)
      pushWarn(
        warnings,
        "UNIT_MISMATCH",
        rawLine,
        `¹H ppm out of range (${shift}). This likely belongs to FTIR (cm^-1) or wrong unit. Line ignored.`
      );
      continue;
    }

    peaks.push({
      shiftPpm: shift,
      multiplicity: mult,
      integrationH: integ,
      raw: rawLine,
    });
  }

  return { peaks, warnings };
}

/**
 * Parses lines like:
 * δ 203.60 ppm (Cq)
 * δ 35.60 ppm (CH2)
 * δ 26.90 ppm (CH3)
 *
 * Guardrail: 0..250 ppm.
 */
export function parseC13Peaks(text: string): { peaks: C13Peak[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const peaks: C13Peak[] = [];

  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);

  const re = /^δ\s*([+-]?\d+(?:\.\d+)?)\s*(?:ppm)?\s*\(\s*(Cq|CH3|CH2|CH)\s*\)\s*$/i;

  for (const rawLine of lines) {
    if (!rawLine.startsWith("δ")) continue;

    // C13 list usually includes ppm or carbon type; if no ppm and no CHn, ignore.
    if (!/\bppm\b/i.test(rawLine) && !/\((?:Cq|CH3|CH2|CH)\)/i.test(rawLine)) continue;

    const m = rawLine.match(re);
    if (!m) {
      pushWarn(warnings, "LINE_UNPARSEABLE", rawLine, "¹³C peak format not recognized.");
      continue;
    }

    const shift = safeFloat(m[1]);
    const ctRaw = m[2];

    if (shift === null) {
      pushWarn(warnings, "MISSING_FIELDS", rawLine, "Missing numeric shift for ¹³C peak.");
      continue;
    }

    // Guardrail range for ¹³C: 0 to 250 ppm
    if (shift < 0 || shift > 250) {
      pushWarn(warnings, "OUT_OF_RANGE", rawLine, `¹³C ppm out of range (${shift}). Line ignored.`);
      continue;
    }

    // Normalize carbonType
    const carbonType = (ctRaw.toUpperCase() as "CQ" | "CH" | "CH2" | "CH3");
    const mapped: C13Peak["carbonType"] = carbonType === "CQ" ? "Cq" : (carbonType as any);

    peaks.push({
      shiftPpm: shift,
      carbonType: mapped,
      raw: rawLine,
    });
  }

  return { peaks, warnings };
}

/**
 * Parses FTIR lines like:
 * 3300 cm⁻¹ (50)
 * 1735 cm⁻¹ (50)
 * 710 cm⁻¹ (50)
 *
 * Accepts normalized "cm^-1".
 * Guardrail: 400..4000 cm^-1.
 */
export function parseFTIRBands(text: string): { bands: FTIRBand[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const bands: FTIRBand[] = [];

  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);

  const re = /^(\d+(?:\.\d+)?)\s*cm\^-1(?:\s*\(\s*(\d+(?:\.\d+)?)\s*\))?\s*$/i;

  for (const rawLine of lines) {
    // Skip NMR delta lines
    if (rawLine.startsWith("δ")) continue;

    const m = rawLine.match(re);
    if (!m) continue; // ignore non-ftir lines silently

    const wn = safeFloat(m[1]);
    const inten = m[2] ? safeFloat(m[2]) : null;

    if (wn === null) {
      pushWarn(warnings, "MISSING_FIELDS", rawLine, "Missing wavenumber for FTIR band.");
      continue;
    }

    // Guardrail range for FTIR: 400 to 4000 cm^-1
    if (wn < 400 || wn > 4000) {
      pushWarn(warnings, "OUT_OF_RANGE", rawLine, `FTIR cm^-1 out of range (${wn}). Line ignored.`);
      continue;
    }

    bands.push({
      wavenumberCm1: wn,
      intensity: inten ?? undefined,
      raw: rawLine,
    });
  }

  return { bands, warnings };
}

/**
 * Counts CHn types from ¹³C peaks for validation.
 * Returns counts: { Cq: n, CH: n, CH2: n, CH3: n }
 */
export function countCHnTypes(c13Peaks: C13Peak[]): { Cq: number; CH: number; CH2: number; CH3: number } {
  const counts = { Cq: 0, CH: 0, CH2: 0, CH3: 0 };
  
  for (const peak of c13Peaks) {
    counts[peak.carbonType]++;
  }
  
  return counts;
}

/**
 * PeakParser namespace - provides the interface expected by BulkInput.refactored.tsx.
 * Wraps the individual parse functions with the naming convention used by the refactored component.
 */
export const PeakParser = {
  /** Parse ¹H NMR peaks (e.g. "δ 8.13 (d, 2H)") */
  parseNMRPeaks(lines: string[]) {
    const text = lines.join('\n');
    const result = parseH1Peaks(text);
    // Map H1Peak to NMRPeak-compatible shape
    return result.peaks.map(p => ({
      shift: p.shiftPpm,
      mult: p.multiplicity,
      integ: p.integrationH,
      raw: p.raw,
    }));
  },

  /** Parse ¹³C NMR peaks (e.g. "δ 203.60 ppm (Cq)") */
  parseCarbon13Peaks(lines: string[]) {
    const text = lines.join('\n');
    const result = parseC13Peaks(text);
    // Map C13Peak to Carbon13Peak-compatible shape
    return result.peaks.map(p => ({
      ppm: p.shiftPpm,
      carbonType: p.carbonType,
      raw: p.raw,
    }));
  },

  /** Parse FTIR bands (e.g. "3300 cm⁻¹ (50)") */
  parseFTIRPeaks(lines: string[]) {
    const text = lines.join('\n');
    const result = parseFTIRBands(text);
    // Map FTIRBand to FTIRPeak-compatible shape
    return result.bands.map(b => ({
      wavenumber: b.wavenumberCm1,
      intensity: b.intensity ?? 50,
      type: 'medium' as const,
      raw: b.raw,
    }));
  },
};
