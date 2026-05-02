/**
 * Otomatik integral bölgesi tespiti ve integral izi (running integral) yardımcıları.
 * Saf TypeScript; grafik ekseni ile uyum: düşük ppm sağda, birikim sağ→sol için artan ppm sırasında prefix toplamı.
 */

/** Çözücü rezidü ppm aralıkları (1H). */
export const SOLVENT_EXCLUSION_ZONES = [
  { lo: 7.24, hi: 7.28, solvent: 'CDCl3' },
  { lo: 2.48, hi: 2.56, solvent: 'DMSO-d6' },
  { lo: 3.28, hi: 3.36, solvent: 'CD3OD' },
  { lo: 4.75, hi: 4.85, solvent: 'D2O' },
  { lo: 1.55, hi: 1.6, solvent: 'H2O_residual' },
  { lo: 2.03, hi: 2.07, solvent: 'Acetone-d6' },
  { lo: 5.3, hi: 5.34, solvent: 'CD2Cl2' },
  { lo: 7.14, hi: 7.18, solvent: 'C6D6' },
] as const;

export type SolventExclusionZone = (typeof SOLVENT_EXCLUSION_ZONES)[number];

export interface IntegralRegion {
  id: string;
  startPpm: number;
  endPpm: number;
  area: number;
  normalizedArea: number;
  peakCount: number;
  confidence: 'high' | 'medium' | 'low';
  isSolventExcluded: boolean;
  provenance: 'auto' | 'manual';
}

/** `detectIntegralRegions` seçenekleri. */
export interface IntegralDetectionOptions {
  /**
   * Yoğunluk eşiği; bu değerin üstündeki noktalar sinyal sayılır.
   * Verilmezse spektrumdan kaba gürültü tahmini kullanılır.
   */
  noiseThreshold?: number;
  /** Gürültü tahmini için medyan + k * (MAD tabanlı ölçek). Varsayılan 6. */
  noiseStdMultiplier?: number;
  /** Bölge ppm genişliği bu değerin altındaysa elenir (0 = filtre yok). */
  minRegionWidthPpm?: number;
  /** Bitişik bölgeler arası ppm boşluğu bu kadar veya daha azsa birleştirilir. */
  mergeGapPpm?: number;
  /** Çözücü maskesi; varsayılan `SOLVENT_EXCLUSION_ZONES`. */
  solventExclusionZones?: ReadonlyArray<{ lo: number; hi: number }>;
}

const DEFAULT_NOISE_MULTIPLIER = 6;
const DEFAULT_MERGE_GAP_PPM = 0.02;
const DEFAULT_MIN_WIDTH_PPM = 0.01;

/** Kahan toplama — uzun birikimlerde kayan nokta sapmasını azaltır. */
function kahanSum(values: number[]): number {
  let sum = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  return sum;
}

function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Spektrum yoğunluklarından basit bir mutlak eşik tahmini (medyan + k·MAD·1.4826).
 */
export function estimateNoiseThresholdFromSpectrum(
  intensities: number[],
  multiplier: number = DEFAULT_NOISE_MULTIPLIER
): number {
  if (intensities.length === 0) return 0;
  const sorted = [...intensities].sort((a, b) => a - b);
  const med = medianSorted(sorted);
  const absDev = sorted.map((x) => Math.abs(x - med));
  absDev.sort((a, b) => a - b);
  const mad = medianSorted(absDev);
  const sigma = mad * 1.4826;
  return med + multiplier * sigma;
}

function intervalsOverlap(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number
): boolean {
  return !(aHi < bLo || bHi < aLo);
}

function regionOverlapsSolvent(
  startPpm: number,
  endPpm: number,
  zones: ReadonlyArray<{ lo: number; hi: number }>
): boolean {
  const lo = Math.min(startPpm, endPpm);
  const hi = Math.max(startPpm, endPpm);
  return zones.some((z) => intervalsOverlap(lo, hi, z.lo, z.hi));
}

/**
 * Trapezoid kuralı ile [i0, i1] kapanır indeks aralığında ∫ I dδ yaklaşımı (Kahan).
 * ppm artan sıraya göre indeksler.
 */
function trapezoidArea(
  ppm: number[],
  intensity: number[],
  i0: number,
  i1: number
): number {
  if (i1 <= i0) {
    if (i1 === i0) return 0;
    return trapezoidArea(ppm, intensity, i1, i0);
  }
  const terms: number[] = [];
  for (let k = i0; k < i1; k++) {
    const d = ppm[k + 1]! - ppm[k]!;
    const h = Math.abs(d);
    if (h === 0) continue;
    terms.push(0.5 * (intensity[k]! + intensity[k + 1]!) * h);
  }
  return kahanSum(terms);
}

/**
 * Bölge içinde eşik üstü yerel maksimum sayısı (kenarlar dahil, tek tepe: soldan/sağdan daha yüksek).
 */
function countPeaksInIndices(
  intensity: number[],
  mask: boolean[],
  i0: number,
  i1: number,
  threshold: number
): number {
  if (i0 > i1) return 0;
  if (i0 === i1) {
    return mask[i0] && intensity[i0]! > threshold ? 1 : 0;
  }
  let count = 0;
  for (let k = i0; k <= i1; k++) {
    if (!mask[k] || intensity[k]! <= threshold) continue;
    const y = intensity[k]!;
    const left = k === i0 ? y - 1 : intensity[k - 1]!;
    const right = k === i1 ? y - 1 : intensity[k + 1]!;
    if (y > left && y > right) count++;
  }
  return Math.max(1, count);
}

function confidenceForRegion(
  widthPpm: number,
  peakCount: number,
  maxIntensityInRegion: number,
  threshold: number
): 'high' | 'medium' | 'low' {
  const snr = threshold > 0 ? maxIntensityInRegion / threshold : maxIntensityInRegion;
  if (widthPpm >= 0.05 && snr >= 8 && peakCount >= 1) return 'high';
  if (widthPpm >= DEFAULT_MIN_WIDTH_PPM && snr >= 4) return 'medium';
  return 'low';
}

export interface IntegralTraceResult {
  ppm: number[];
  trace: number[];
}

/**
 * NMR alışıldığı gibi: sağ (düşük ppm) → sol (yüksek ppm) birikimli integral.
 * Girdi artan ppm ile sıralanır; `trace[i]` = 0..i arası yoğunlukların Kahan prefix toplamı (ppm adımı ile ağırlıklandırılmamış basit birikim;
 * görsel integral eğrisi için normalize edilebilir).
 *
 * Pik alanı ile tutarlılık için trapezoid ağırlıklı birikim kullanılır: trace[i], artan ppm sırasında i noktasına kadar olan ∫I dδ yaklaşımıdır.
 */
export function computeIntegralTrace(
  ppm: number[],
  intensity: number[]
): IntegralTraceResult {
  if (ppm.length === 0 || intensity.length === 0) {
    return { ppm: [], trace: [] };
  }
  if (ppm.length !== intensity.length) {
    throw new Error('computeIntegralTrace: ppm ve intensity uzunlukları eşit olmalı');
  }

  const order = ppm.map((_, i) => i).sort((i, j) => ppm[i]! - ppm[j]!);
  const p: number[] = [];
  const y: number[] = [];
  for (const idx of order) {
    p.push(ppm[idx]!);
    y.push(intensity[idx]!);
  }

  const n = p.length;
  const trace: number[] = new Array(n);
  let sum = 0;
  let c = 0;
  trace[0] = 0;
  for (let k = 0; k < n - 1; k++) {
    const h = p[k + 1]! - p[k]!;
    const step = 0.5 * (y[k]! + y[k + 1]!) * Math.abs(h);
    const yk = step - c;
    const t = sum + yk;
    c = t - sum - yk;
    sum = t;
    trace[k + 1] = sum;
  }

  return { ppm: p, trace };
}

/**
 * Ardışık indeks aralıklarını ppm boşluğuna göre birleştirir.
 */
function mergeRegionsByGap(
  regions: Array<{ i0: number; i1: number }>,
  ppm: number[],
  mergeGapPpm: number
): Array<{ i0: number; i1: number }> {
  if (regions.length === 0) return [];
  const sorted = [...regions].sort((a, b) => a.i0 - b.i0);
  const out: Array<{ i0: number; i1: number }> = [];
  let cur = sorted[0]!;
  for (let r = 1; r < sorted.length; r++) {
    const next = sorted[r]!;
    const gapStartPpm = ppm[cur.i1]!;
    const gapEndPpm = ppm[next.i0]!;
    const gap = Math.abs(gapEndPpm - gapStartPpm);
    if (gap <= mergeGapPpm) {
      cur = { i0: cur.i0, i1: Math.max(cur.i1, next.i1) };
    } else {
      out.push(cur);
      cur = next;
    }
  }
  out.push(cur);
  return out;
}

/**
 * ppm / yoğunluk dizilerinden gürültü üstü bölgeleri bulur, birleştirir ve integral meta verisi üretir.
 */
export function detectIntegralRegions(
  ppm: number[],
  intensity: number[],
  options: IntegralDetectionOptions = {}
): IntegralRegion[] {
  if (ppm.length === 0 || intensity.length === 0) return [];
  if (ppm.length !== intensity.length) {
    throw new Error('detectIntegralRegions: ppm ve intensity uzunlukları eşit olmalı');
  }

  const mergeGapPpm = options.mergeGapPpm ?? DEFAULT_MERGE_GAP_PPM;
  const minWidth = options.minRegionWidthPpm ?? DEFAULT_MIN_WIDTH_PPM;
  const zones = options.solventExclusionZones ?? SOLVENT_EXCLUSION_ZONES;
  const mult = options.noiseStdMultiplier ?? DEFAULT_NOISE_MULTIPLIER;
  const threshold =
    options.noiseThreshold ?? estimateNoiseThresholdFromSpectrum(intensity, mult);

  const order = ppm.map((_, i) => i).sort((i, j) => ppm[i]! - ppm[j]!);
  const p: number[] = [];
  const y: number[] = [];
  for (const idx of order) {
    p.push(ppm[idx]!);
    y.push(intensity[idx]!);
  }

  const n = p.length;
  const mask = y.map((v) => v > threshold);
  const raw: Array<{ i0: number; i1: number }> = [];
  let runStart: number | null = null;
  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      raw.push({ i0: runStart, i1: i - 1 });
      runStart = null;
    }
  }
  if (runStart !== null) raw.push({ i0: runStart, i1: n - 1 });

  const merged = mergeRegionsByGap(raw, p, mergeGapPpm);

  const meanStep =
    n > 1
      ? Math.abs(p[n - 1]! - p[0]!) / (n - 1)
      : 1e-6;

  const results: IntegralRegion[] = [];
  let rid = 0;
  for (const { i0, i1 } of merged) {
    const startPpm = p[i0]!;
    const endPpm = p[i1]!;
    const widthPpm = Math.abs(endPpm - startPpm);
    if (widthPpm < minWidth && i0 !== i1) continue;
    let area = trapezoidArea(p, y, i0, i1);
    if (i0 === i1) {
      area = Math.abs(y[i0]!) * meanStep;
    }
    let maxY = -Infinity;
    for (let k = i0; k <= i1; k++) maxY = Math.max(maxY, y[k]!);
    const peaks = countPeaksInIndices(y, mask, i0, i1, threshold);
    const solvent = regionOverlapsSolvent(startPpm, endPpm, zones);
    const conf = confidenceForRegion(
      Math.max(widthPpm, i0 === i1 ? meanStep : widthPpm),
      peaks,
      maxY,
      threshold
    );

    results.push({
      id: `auto-${rid++}`,
      startPpm: Math.min(startPpm, endPpm),
      endPpm: Math.max(startPpm, endPpm),
      area,
      normalizedArea: area,
      peakCount: peaks,
      confidence: conf,
      isSolventExcluded: solvent,
      provenance: 'auto',
    });
  }

  return results;
}

/**
 * Alanları, çözücü hariç en küçük bölgeyi 1.0 olacak şekilde ölçekler.
 * Tüm bölgeler çözücü veya alan ≤ 0 ise `normalizedArea`, alan ile aynı bırakılır.
 */
export function normalizeIntegrals(regions: IntegralRegion[]): IntegralRegion[] {
  if (regions.length === 0) return [];
  const candidates = regions.filter((r) => !r.isSolventExcluded && r.area > 0);
  const minArea =
    candidates.length === 0
      ? 0
      : Math.min(...candidates.map((r) => r.area));
  if (minArea <= 0) {
    return regions.map((r) => ({ ...r, normalizedArea: r.area }));
  }
  return regions.map((r) => ({
    ...r,
    normalizedArea: r.area / minArea,
  }));
}
