/**
 * Multiplet / J-coupling analysis scaffolding for 1H NMR peak clusters.
 *
 * This module is intentionally conservative: when spacings are ambiguous,
 * overlapping, or noise-like, it prefers `unresolved` / low confidence over
 * inventing precise J values.
 */

/** First-order multiplet labels supported by this scaffold (subset of common patterns). */
export type MultipletClass =
  | 's'
  | 'd'
  | 't'
  | 'q'
  | 'quint'
  | 'sext'
  | 'sept'
  | 'dd'
  | 'dt'
  | 'td'
  | 'm'
  | 'br'
  | 'unresolved';

/** Estimated J value from observed line positions (Hz) with provenance and confidence. */
export interface JCouplingEstimate {
  valueHz: number;
  confidence: 'high' | 'medium' | 'low';
  method: 'peak_distance' | 'deconvolution' | 'manual';
}

/** Output of {@link classifyMultiplet} — geometry-only interpretation of one cluster. */
export interface MultipletClassification {
  classification: MultipletClass;
  classificationConfidence: 'high' | 'medium' | 'low' | 'unresolved';
  jCouplings: JCouplingEstimate[];
}

/** One grouped multiplet region on the chemical-shift axis. */
export interface MultipletRegion {
  id: string;
  centerPpm: number;
  startPpm: number;
  endPpm: number;
  peakCount: number;
  classification: MultipletClass;
  classificationConfidence: 'high' | 'medium' | 'low' | 'unresolved';
  jCouplings: JCouplingEstimate[];
  integration?: number;
  provenance: 'auto' | 'manual';
}

/** Options for clustering observed peaks into multiplet regions. */
export interface MultipletGroupingOptions {
  /** Maximum ppm gap between consecutive lines still considered one multiplet. Default 0.08. */
  maxIntraMultipletGapPpm?: number;
  /** Discard peaks below this fraction of the tallest peak intensity. Default 0.05. */
  minPeakIntensityFraction?: number;
  observeFreqMHz: number;
}

const DEFAULT_MAX_GAP_PPM = 0.08;
const DEFAULT_MIN_INTENSITY_FRAC = 0.05;

/** Relative tolerance for comparing neighbour spacings (first-order equal-splitting test). */
const REL_SPACING_TOL = 0.14;

/** Stricter tolerance when claiming high-confidence first-order patterns. */
const REL_SPACING_TOL_TIGHT = 0.08;

/** Minimum plausible |Δppm| between lines to treat spacing as meaningful (noise guard). */
const MIN_LINE_GAP_PPM = 1e-4;

/** Hz — below this, spacing estimates are too fragile for "high" confidence. */
const MIN_J_HZ_FOR_HIGH_CONF = 0.25;

/** Maximum lines this scaffold tries to interpret as a simple first-order multiplet. */
const MAX_FIRST_ORDER_LINES = 7;

let regionIdSeq = 0;

function nextRegionId(): string {
  regionIdSeq += 1;
  return `mp-${Date.now().toString(36)}-${regionIdSeq}`;
}

function ppmDeltaToHz(deltaPpm: number, observeFreqMHz: number): number {
  return deltaPpm * observeFreqMHz;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Relative spread of values around their mean (coefficient of variation).
 */
function relativeSpread(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  if (Math.abs(m) < 1e-12) return Number.POSITIVE_INFINITY;
  const dev =
    values.reduce((acc, v) => acc + Math.abs(v - m), 0) / values.length;
  return dev / Math.abs(m);
}

/**
 * True if all values are within `relTol` relative deviation of their mean.
 */
function spacingsNearlyEqual(spacings: number[], relTol: number): boolean {
  if (spacings.length === 0) return true;
  return relativeSpread(spacings) <= relTol;
}

function sortUniquePpm(positions: number[]): number[] {
  const sorted = [...positions].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const out: number[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i]!;
    if (Math.abs(v - out[out.length - 1]!) > MIN_LINE_GAP_PPM) out.push(v);
  }
  return out;
}

function jFromSpacingPpm(
  deltaPpm: number,
  observeFreqMHz: number,
  spacingConfidence: 'high' | 'medium' | 'low',
): JCouplingEstimate {
  const valueHz = Math.abs(ppmDeltaToHz(deltaPpm, observeFreqMHz));
  return {
    valueHz,
    confidence: spacingConfidence,
    method: 'peak_distance',
  };
}

/**
 * Detects a coarse first-order `dt` / `td` footprint: two repeated spacings
 * appearing as a 1:2:2:1 style gap pattern (outer pair equal, two middle equal, all four similar scale).
 * This is heuristic only; overlaps break the pattern quickly.
 */
function tryClassifyDtTd(
  gapsPpm: number[],
  observeFreqMHz: number,
): MultipletClassification | null {
  if (gapsPpm.length !== 5) return null;
  const [g0, g1, g2, g3, g4] = gapsPpm;
  const outerEq =
    Math.abs(g0 - g4) / mean([g0, g4]) <= REL_SPACING_TOL_TIGHT;
  const midEq = spacingsNearlyEqual([g1, g2, g3], REL_SPACING_TOL_TIGHT);
  if (!outerEq || !midEq) return null;
  const jSmallPpm = mean([g0, g4]);
  const jLargePpm = mean([g1, g2, g3]);
  if (jLargePpm <= MIN_LINE_GAP_PPM || jSmallPpm <= MIN_LINE_GAP_PPM) return null;
  // dt vs td cannot be distinguished from line positions alone.
  const jAHz = Math.abs(ppmDeltaToHz(jSmallPpm, observeFreqMHz));
  const jBHz = Math.abs(ppmDeltaToHz(jLargePpm, observeFreqMHz));
  const jSmallHz = Math.min(jAHz, jBHz);
  const jLargeHz = Math.max(jAHz, jBHz);
  const conf: 'medium' | 'low' =
    relativeSpread([g0, g4]) < 0.05 && relativeSpread([g1, g2, g3]) < 0.08
      ? 'medium'
      : 'low';
  return {
    classification: 'dt',
    classificationConfidence: conf === 'medium' ? 'medium' : 'low',
    jCouplings: [
      {
        valueHz: jSmallHz,
        confidence: conf,
        method: 'peak_distance',
      },
      {
        valueHz: jLargeHz,
        confidence: conf,
        method: 'peak_distance',
      },
    ],
  };
}

/**
 * Classifies a single cluster of chemical shifts (ppm) using only line positions.
 *
 * - Converts neighbour spacings to Hz via `observeFreqMHz`.
 * - Uses equal-spacing tests for simple multiplets (t, q, …).
 * - Uses a conservative outer-equal-gap test for `dd` (4 lines).
 * - Returns `unresolved` / empty J list when patterns are ambiguous or overlapping.
 *
 * @param peakPositionsPpm — ppm of each line in the cluster (may include duplicates; merged if extremely close).
 * @param observeFreqMHz — spectrometer frequency (e.g. 400 for a 400 MHz instrument).
 */
export function classifyMultiplet(
  peakPositionsPpm: number[],
  observeFreqMHz: number,
): MultipletClassification {
  if (
    !Number.isFinite(observeFreqMHz) ||
    observeFreqMHz <= 0 ||
    peakPositionsPpm.length === 0
  ) {
    return {
      classification: 'unresolved',
      classificationConfidence: 'unresolved',
      jCouplings: [],
    };
  }

  const ppm = sortUniquePpm(peakPositionsPpm);
  const n = ppm.length;

  if (n === 1) {
    return {
      classification: 's',
      classificationConfidence: 'high',
      jCouplings: [],
    };
  }

  if (n > MAX_FIRST_ORDER_LINES) {
    return {
      classification: 'm',
      classificationConfidence: 'low',
      jCouplings: [],
    };
  }

  const gapsPpm: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    gapsPpm.push(Math.abs(ppm[i + 1]! - ppm[i]!));
  }

  if (gapsPpm.some((g) => g < MIN_LINE_GAP_PPM)) {
    return {
      classification: 'unresolved',
      classificationConfidence: 'unresolved',
      jCouplings: [],
    };
  }

  const avgGap = mean(gapsPpm);
  const avgJHz = ppmDeltaToHz(avgGap, observeFreqMHz);

  // --- 2 lines: doublet (cannot rule out accidental proximity) ---
  if (n === 2) {
    const j = jFromSpacingPpm(gapsPpm[0]!, observeFreqMHz, 'medium');
    const conf =
      avgJHz >= MIN_J_HZ_FOR_HIGH_CONF ? ('medium' as const) : ('low' as const);
    return {
      classification: 'd',
      classificationConfidence: conf === 'medium' ? 'medium' : 'low',
      jCouplings: [j],
    };
  }

  // --- First-order n-line multiplet: (n-1) equal spacings ---
  const equalLoose = spacingsNearlyEqual(gapsPpm, REL_SPACING_TOL);
  const equalTight = spacingsNearlyEqual(gapsPpm, REL_SPACING_TOL_TIGHT);

  if (equalLoose && n >= 3 && n <= 7) {
    const jHz = Math.abs(avgJHz);
    const spacingConf: 'high' | 'medium' =
      equalTight && jHz >= MIN_J_HZ_FOR_HIGH_CONF ? 'high' : 'medium';
    const classMap: MultipletClass[] = [
      's',
      'd',
      't',
      'q',
      'quint',
      'sext',
      'sept',
    ];
    const cls = classMap[n - 1] ?? 'm';
    return {
      classification: cls,
      classificationConfidence:
        spacingConf === 'high' ? 'high' : 'medium',
      jCouplings:
        cls === 's'
          ? []
          : [jFromSpacingPpm(avgGap, observeFreqMHz, spacingConf)],
    };
  }

  // --- 6 lines: possible dt/td (5 gaps) ---
  if (n === 6) {
    const dt = tryClassifyDtTd(gapsPpm, observeFreqMHz);
    if (dt) return dt;
  }

  // --- 4 lines: quartet vs doublet of doublets ---
  if (n === 4 && gapsPpm.length === 3) {
    const [g0, g1, g2] = gapsPpm;
    const outerMatch =
      Math.abs(g0 - g2) / mean([g0, g2]) <= REL_SPACING_TOL_TIGHT;
    const innerDiffers =
      Math.abs(g1 - g0) / mean([g0, g1]) > REL_SPACING_TOL &&
      Math.abs(g1 - g2) / mean([g1, g2]) > REL_SPACING_TOL;

    if (outerMatch && innerDiffers) {
      const jSmallPpm = mean([g0, g2]);
      const jLargePpm = g1;
      const jS = Math.abs(ppmDeltaToHz(jSmallPpm, observeFreqMHz));
      const jL = Math.abs(ppmDeltaToHz(jLargePpm, observeFreqMHz));
      const jCouplings: JCouplingEstimate[] = [
        jFromSpacingPpm(
          jSmallPpm,
          observeFreqMHz,
          jS >= MIN_J_HZ_FOR_HIGH_CONF ? 'medium' : 'low',
        ),
        jFromSpacingPpm(
          jLargePpm,
          observeFreqMHz,
          jL >= MIN_J_HZ_FOR_HIGH_CONF ? 'medium' : 'low',
        ),
      ];
      return {
        classification: 'dd',
        classificationConfidence:
          jS >= MIN_J_HZ_FOR_HIGH_CONF && jL >= MIN_J_HZ_FOR_HIGH_CONF
            ? 'medium'
            : 'low',
        jCouplings,
      };
    }

    if (spacingsNearlyEqual(gapsPpm, REL_SPACING_TOL)) {
      const jHz = Math.abs(avgJHz);
      return {
        classification: 'q',
        classificationConfidence:
          spacingsNearlyEqual(gapsPpm, REL_SPACING_TOL_TIGHT) &&
          jHz >= MIN_J_HZ_FOR_HIGH_CONF
            ? 'high'
            : 'medium',
        jCouplings: [jFromSpacingPpm(avgGap, observeFreqMHz, 'medium')],
      };
    }
  }

  // --- Ambiguous multi-line cluster ---
  if (n >= 3) {
    const irregular = relativeSpread(gapsPpm) > 0.35;
    return {
      classification: irregular ? 'm' : 'unresolved',
      classificationConfidence: irregular ? 'low' : 'unresolved',
      jCouplings: [],
    };
  }

  return {
    classification: 'unresolved',
    classificationConfidence: 'unresolved',
    jCouplings: [],
  };
}

/**
 * Groups picked peaks into multiplet regions by ppm proximity, then runs
 * {@link classifyMultiplet} on each cluster.
 *
 * - Drops weak peaks relative to the tallest line (`minPeakIntensityFraction`).
 * - Clusters using a chain rule on sorted ppm (gap ≤ `maxIntraMultipletGapPpm`).
 * - Overlapping / crowded clusters often yield `m` or `unresolved` from the classifier.
 *
 * @param peaks — observed lines with ppm and intensity (any positive scale).
 * @param options — grouping thresholds and `observeFreqMHz` (required).
 * @returns regions sorted by ascending center ppm.
 */
export function groupPeaksIntoMultiplets(
  peaks: Array<{ ppm: number; intensity: number }>,
  options: MultipletGroupingOptions,
): MultipletRegion[] {
  const observeFreqMHz = options.observeFreqMHz;
  const maxGap =
    options.maxIntraMultipletGapPpm ?? DEFAULT_MAX_GAP_PPM;
  const minFrac =
    options.minPeakIntensityFraction ?? DEFAULT_MIN_INTENSITY_FRAC;

  if (
    !Number.isFinite(observeFreqMHz) ||
    observeFreqMHz <= 0 ||
    peaks.length === 0
  ) {
    return [];
  }

  const valid = peaks.filter(
    (p) =>
      Number.isFinite(p.ppm) &&
      Number.isFinite(p.intensity) &&
      p.intensity >= 0,
  );
  if (valid.length === 0) return [];

  const maxI = Math.max(...valid.map((p) => p.intensity));
  if (maxI <= 0) return [];

  const threshold = maxI * minFrac;
  const strong = valid.filter((p) => p.intensity >= threshold);
  if (strong.length === 0) return [];

  strong.sort((a, b) => a.ppm - b.ppm);

  const clusters: Array<{ ppm: number; intensity: number }[]> = [];
  let cur: { ppm: number; intensity: number }[] = [strong[0]!];
  for (let i = 1; i < strong.length; i++) {
    const p = strong[i]!;
    const prev = cur[cur.length - 1]!;
    if (p.ppm - prev.ppm <= maxGap) cur.push(p);
    else {
      clusters.push(cur);
      cur = [p];
    }
  }
  clusters.push(cur);

  const regions: MultipletRegion[] = clusters.map((c) => {
    const positions = c.map((x) => x.ppm);
    const startPpm = Math.min(...positions);
    const endPpm = Math.max(...positions);
    const centerPpm = (startPpm + endPpm) / 2;
    const integration = c.reduce((s, x) => s + x.intensity, 0);
    const cls = classifyMultiplet(positions, observeFreqMHz);

    return {
      id: nextRegionId(),
      centerPpm,
      startPpm,
      endPpm,
      peakCount: c.length,
      classification: cls.classification,
      classificationConfidence: cls.classificationConfidence,
      jCouplings: cls.jCouplings,
      integration,
      provenance: 'auto',
    };
  });

  regions.sort((a, b) => a.centerPpm - b.centerPpm);
  return regions;
}
