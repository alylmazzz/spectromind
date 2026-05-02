/**
 * Profesyonel 1H NMR gorunumu: sabit ppm pencereleri, robust Y olcegi, cozucu maskesi.
 * Grafik ekseni: linear min= dusuk ppm (sag), max= yuksek ppm (sol), Chart.js reverse:true.
 */

export type NmrYScaleMode =
  | 'PHYSICAL_AUTO'
  | 'GLOBAL_MAX'
  | 'AUTHORITATIVE_MAX'
  | 'ROBUST_P99'
  | 'ROBUST_P995'
  | 'HELPER_NORMALIZED';

export const H1_DEFAULT_X_DOMAIN = { min: -1, max: 14 } as const;

export const H1_EXTENDED_X_DOMAIN = { min: -2, max: 14 } as const;

/**
 * API / ilk acilis: MestReNova tarzi 1H penceresi (yuksek ppm solda).
 * [14, 0] = Chart domain min=0 max=14 + reverse; tam genislik preset H1_EXTENDED.
 * Tam spektral SW genisligine OTOMATIK genisletme YAPILMAZ (kucuk pikler ezilir).
 */
export const H1_PRO_FIRST_VIEW_PPM: [number, number] = [14, -1];

export const C13_PRO_FIRST_VIEW_PPM: [number, number] = [230, -10];

export const H1_DISPLAY_PRESETS = [
  { id: 'H1_FULL', label: '1H tam (14->-1)', min: -1, max: 14 },
  { id: 'H1_EXTENDED', label: '1H genis (14->-2)', min: -2, max: 14 },
  { id: 'AROMATIC', label: 'Aromatik', min: 5, max: 10 },
  { id: 'OLEFINIC', label: 'Olefinik / O-CH', min: 2.5, max: 6 },
  { id: 'ALIPHATIC', label: 'Alifatik', min: -0.5, max: 3.5 },
] as const;

const SOLVENT_EXCLUSIONS: Array<{ lo: number; hi: number }> = [
  { lo: 2.48, hi: 2.56 },
  { lo: 3.28, hi: 3.36 },
  { lo: 7.24, hi: 7.28 },
  { lo: 1.55, hi: 1.6 },
];

export function isInSolventExclusion(ppm: number): boolean {
  return SOLVENT_EXCLUSIONS.some((z) => ppm >= z.lo && ppm <= z.hi);
}

function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[idx];
}

/**
 * Peak-preserving downsample: each bucket emits min and max y points
 * so narrow peaks are never silently dropped (unlike naive stride sampling).
 */
export function downsampleXY(
  ppm: number[],
  intensity: number[],
  maxPoints: number
): Array<{ x: number; y: number }> {
  const n = ppm.length;
  if (n <= maxPoints) {
    return ppm.map((x, i) => ({ x, y: intensity[i] }));
  }

  const bucketCount = Math.floor(maxPoints / 2);
  const bucketSize = n / bucketCount;
  const out: Array<{ x: number; y: number }> = [];

  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(Math.floor((b + 1) * bucketSize), n);
    if (start >= end) continue;

    let minIdx = start;
    let maxIdx = start;
    for (let j = start + 1; j < end; j++) {
      if (intensity[j] < intensity[minIdx]) minIdx = j;
      if (intensity[j] > intensity[maxIdx]) maxIdx = j;
    }

    if (minIdx <= maxIdx) {
      out.push({ x: ppm[minIdx], y: intensity[minIdx] });
      if (minIdx !== maxIdx) out.push({ x: ppm[maxIdx], y: intensity[maxIdx] });
    } else {
      out.push({ x: ppm[maxIdx], y: intensity[maxIdx] });
      if (minIdx !== maxIdx) out.push({ x: ppm[minIdx], y: intensity[minIdx] });
    }
  }

  return out;
}

export function normalizeSimulatedToUnitMax(
  points: Array<{ x: number; y: number }>,
  xMin: number,
  xMax: number
): Array<{ x: number; y: number }> {
  let m = 0;
  for (const p of points) {
    if (p.x < xMin || p.x > xMax) continue;
    m = Math.max(m, p.y);
  }
  const s = m > 1e-12 ? m : 1;
  return points.map((p) => ({ x: p.x, y: p.y / s }));
}

export interface YBoundsOptions {
  yScaleMode: NmrYScaleMode;
  solventMask: boolean;
  includeSimulated: boolean;
  includeObserved: boolean;
  preserveMinorSignals?: boolean;
}

/**
 * Gorunur x araligindaki noktalardan Y min/max (robust ust sinir).
 * Observed ve simulasyon ayni eksende: simulasyon bu fonksiyondan once normalize edilmeli.
 */
export function computeYBounds(
  observed: Array<{ x: number; y: number }> | null,
  simulated: Array<{ x: number; y: number }>,
  xMin: number,
  xMax: number,
  opts: YBoundsOptions
): { min: number; max: number } {
  const obsValues: number[] = [];
  const simValues: number[] = [];
  const pushFiltered = (bucket: number[], x: number, y: number) => {
    if (x < xMin || x > xMax) return;
    if (opts.solventMask && isInSolventExclusion(x)) return;
    bucket.push(y);
  };

  if (opts.includeObserved && observed) {
    for (const p of observed) pushFiltered(obsValues, p.x, p.y);
  }
  if (opts.includeSimulated) {
    for (const p of simulated) pushFiltered(simValues, p.x, p.y);
  }

  // Authoritative isolation: observed varsa helper asla y-scale'i belirlemez.
  const values = obsValues.length > 0 ? obsValues : simValues;
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  values.sort((a, b) => a - b);
  const vmin = values[0];
  const vmax = values[values.length - 1];

  let cap: number;
  if (opts.yScaleMode === 'AUTHORITATIVE_MAX' || opts.yScaleMode === 'GLOBAL_MAX') {
    cap = vmax;
  } else if (opts.yScaleMode === 'ROBUST_P995') {
    cap = percentileSorted(values, 0.995);
  } else if (opts.yScaleMode === 'PHYSICAL_AUTO') {
    const p995 = percentileSorted(values, 0.995);
    const p99 = percentileSorted(values, 0.99);
    // Region-aware görünürlük koruma: dominant outlier geri kalan bölgeleri ezmesin.
    const outlierRatio = vmax / Math.max(p99, 1e-12);
    cap = outlierRatio > 20 ? Math.max(p995, p99 * 1.4) : vmax;
  } else {
    cap = percentileSorted(values, 0.99);
  }

  const top = Math.max(cap * 1.12, vmin + 1e-9, 1e-6);
  // Negative overshoot clamp: baseline-corrected NMR should not dip far below zero
  const negClamp = -top * 0.08;
  const bottom = Math.max(negClamp, Math.min(0, vmin) * (vmin < -1e-6 ? 1.05 : 1));

  return { min: bottom, max: top };
}

/**
 * Gozlenen ppm dizisinin gercek min/max araligini hesaplar.
 */
export function observedPpmRange(ppm: number[]): { min: number; max: number } | null {
  if (!ppm?.length) return null;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of ppm) {
    if (!Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;
  return { min: lo, max: hi };
}

/**
 * 1H gozlem verisi icin akilli ilk X domain.
 * Veri 0-14 araliginda piklere sahipse varsayilan pencereyi dondurur;
 * eger veri tamamen bu pencere disindaysa pencereyi veriye uyarlar.
 */
export function smartInitialXDomain(
  obsPpmRange: { min: number; max: number } | null,
  defaultDomain: { min: number; max: number } = H1_DEFAULT_X_DOMAIN
): { min: number; max: number; adapted: boolean } {
  if (!obsPpmRange) return { ...defaultDomain, adapted: false };

  const dMin = defaultDomain.min;
  const dMax = defaultDomain.max;

  const overlapLo = Math.max(obsPpmRange.min, dMin);
  const overlapHi = Math.min(obsPpmRange.max, dMax);
  const hasOverlap = overlapHi > overlapLo;

  if (hasOverlap) {
    return { ...defaultDomain, adapted: false };
  }

  const margin = (obsPpmRange.max - obsPpmRange.min) * 0.05 + 0.5;
  return {
    min: obsPpmRange.min - margin,
    max: obsPpmRange.max + margin,
    adapted: true,
  };
}

/**
 * PPM eksenini dogrulama (sacma degerlere karsi koruma).
 * 1H icin makul aralik: ~ -2 ... 20 ppm.
 * Aralik disinda ise uyari bilgisiyle beraber donus yapar.
 */
export interface PpmAxisValidation {
  plausible: boolean;
  reason?: string;
  actualRange: { min: number; max: number } | null;
}
export function validatePpmAxis(
  ppm: number[],
  nucleus: string = '1H'
): PpmAxisValidation {
  const range = observedPpmRange(ppm);
  if (!range) return { plausible: false, reason: 'EMPTY_OR_INVALID_PPM', actualRange: null };

  if (nucleus === '1H' || nucleus === '1h') {
    if (range.min > 30 || range.max < -10 || range.max > 200) {
      return { plausible: false, reason: 'PPM_OUTSIDE_H1_RANGE', actualRange: range };
    }
    const span = range.max - range.min;
    // Genis SW (or. 30-40 ppm) normal; yalnizca asiri genis / muhtemel Hz karisimi
    if (span > 120) {
      return { plausible: false, reason: 'PPM_SPAN_TOO_WIDE_FOR_H1', actualRange: range };
    }
  } else if (nucleus === '13C' || nucleus === '13c') {
    if (range.min > 300 || range.max < -20 || range.max > 500) {
      return { plausible: false, reason: 'PPM_OUTSIDE_C13_RANGE', actualRange: range };
    }
  }

  return { plausible: true, actualRange: range };
}

/**
 * Gozlenen spektrumdan "sinyale sigdir" ppm araligi (x ekseni domain).
 */
export function fitSignalXDomain(
  ppm: number[],
  intensity: number[],
  floorRelative = 0.04,
  marginPpm = 0.45,
  clampLow = -0.5,
  clampHigh = 16
): { min: number; max: number } {
  if (!ppm.length || ppm.length !== intensity.length) {
    return { ...H1_DEFAULT_X_DOMAIN };
  }
  let m = 0;
  for (const v of intensity) m = Math.max(m, v);
  const thr = m * floorRelative;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < ppm.length; i++) {
    if (intensity[i] < thr) continue;
    const p = ppm[i];
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    return { ...H1_DEFAULT_X_DOMAIN };
  }
  return {
    min: Math.max(clampLow, lo - marginPpm),
    max: Math.min(clampHigh, hi + marginPpm),
  };
}
