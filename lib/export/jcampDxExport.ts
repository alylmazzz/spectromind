/**
 * JCAMP-DX 5.01 NMR spectrum export (XYDATA, AFFN, `X++(Y..Y)`).
 * Pure TypeScript; only {@link downloadJcampDx} touches the DOM.
 */

/**
 * Metadata bundled with an observed (or simulated) 1D NMR trace for JCAMP-DX export.
 * Optional fields are omitted from the file when absent or empty (except `sourceMode`, which is required in-app).
 */
export interface JcampExportMetadata {
  /** Spectrum title (`##TITLE=`). */
  title?: string;
  /** Owner / operator (`##OWNER=`, default `user`). */
  owner?: string;
  /** Spectrometer observation frequency in MHz (`##OBSERVE FREQUENCY=`). */
  observeFrequency?: number;
  /** Solvent name (`##SOLVENT NAME=`). */
  solvent?: string;
  /** Observed nuclide (`##.OBSERVE NUCLEUS=`). */
  nucleus?: '1H' | '13C';
  /** Sample temperature in Kelvin (optional `##COMMENT=` fragment). */
  temperature?: number;
  /** Instrument model (optional `##COMMENT=` fragment). */
  spectrometerModel?: string;
  /** Free-text processing notes (optional `##COMMENT=` fragment). */
  processingInfo?: string;
  /** Distinguishes experiment origin for application logic; echoed in `##COMMENT=` when other comment fields are set. */
  sourceMode: 'observed' | 'simulated';
  /** Axis provenance used by UI/export parity checks. */
  axisSource?: 'processed_axis' | 'metadata_default' | 'safe_fallback';
}

/** Observed 1D NMR spectrum as parallel arrays (same length). */
export interface JcampSpectrumInput {
  /** Chemical shift axis (ppm), any monotonic order. */
  ppm: number[];
  /** Intensity / arbitrary vertical scale. */
  intensity: number[];
  metadata: JcampExportMetadata;
}

const JCAMP_VERSION = '5.01';
const ORIGIN = 'SpectroMind';
const DEFAULT_OWNER = 'user';

/** Maximum characters per XYDATA line (excluding newline), for broad reader compatibility. */
const XYDATA_MAX_LINE_LEN = 78;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function formatHeaderValue(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

/**
 * Formats a numeric LDR field; omits scientific notation for typical ppm ranges when possible.
 */
function formatNum(n: number, decimals = 8): string {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(decimals);
  return s.replace(/\.?0+$/, '') || '0';
}

/** Linear interpolation of `intensity` over `ppm` at target x (handles ascending or descending ppm). */
function interpolateY(ppm: number[], intensity: number[], x: number): number {
  const n = ppm.length;
  if (n === 0) return 0;
  if (n === 1) return intensity[0]!;

  const ascending = ppm[0]! <= ppm[n - 1]!;
  if (ascending) {
    if (x <= ppm[0]!) return intensity[0]!;
    if (x >= ppm[n - 1]!) return intensity[n - 1]!;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ppm[mid]! <= x) lo = mid;
      else hi = mid;
    }
    const x0 = ppm[lo]!;
    const x1 = ppm[hi]!;
    const t = (x - x0) / (x1 - x0);
    return intensity[lo]! * (1 - t) + intensity[hi]! * t;
  }

  if (x >= ppm[0]!) return intensity[0]!;
  if (x <= ppm[n - 1]!) return intensity[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ppm[mid]! >= x) lo = mid;
    else hi = mid;
  }
  const x0 = ppm[lo]!;
  const x1 = ppm[hi]!;
  const t = (x - x0) / (x1 - x0);
  return intensity[lo]! * (1 - t) + intensity[hi]! * t;
}

/**
 * If ppm steps are not uniform within tolerance, resamples intensity onto a uniform grid
 * from first to last ppm (linear interpolation). Required for valid `X++(Y..Y)` semantics.
 */
function ensureUniformPpmGrid(ppm: number[], intensity: number[]): { ppm: number[]; intensity: number[] } {
  const n = ppm.length;
  if (n <= 1) return { ppm: [...ppm], intensity: [...intensity] };

  const first = ppm[0]!;
  const last = ppm[n - 1]!;
  const denom = n - 1;
  const delta = (last - first) / denom;

  if (delta === 0) {
    return { ppm: [...ppm], intensity: [...intensity] };
  }

  const tol = Math.max(1e-9, Math.abs(delta) * 1e-6);
  for (let i = 1; i < n; i++) {
    const expected = first + delta * i;
    if (Math.abs(ppm[i]! - expected) > tol) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < n; i++) {
        const x = first + delta * i;
        xs.push(x);
        ys.push(interpolateY(ppm, intensity, x));
      }
      return { ppm: xs, intensity: ys };
    }
  }

  return { ppm: [...ppm], intensity: [...intensity] };
}

/**
 * Builds AFFN `X++(Y..Y)` lines: each line starts with the X of the first Y on that line;
 * following tokens are successive Y values at X, X+ΔX, …
 */
function buildXydataLines(ppm: number[], intensity: number[]): string[] {
  const n = ppm.length;
  if (n === 0) return [];

  const lines: string[] = [];
  let i = 0;
  while (i < n) {
    const xStart = ppm[i]!;
    const parts: string[] = [formatNum(xStart)];
    let lineLen = parts[0]!.length;

    while (i < n) {
      const yStr = formatNum(intensity[i]!);
      const add = 1 + yStr.length;
      if (parts.length > 1 && lineLen + add > XYDATA_MAX_LINE_LEN) break;
      parts.push(yStr);
      lineLen += add;
      i++;
    }

    lines.push(parts.join(' '));
  }

  return lines;
}

/**
 * Exports a 1D NMR spectrum as a JCAMP-DX 5.01 string (`##DATA CLASS= XYDATA`, `X++(Y..Y)`).
 *
 * Empty `ppm` / `intensity` yields a syntactically valid file with `##NPOINTS=0` and no XYDATA rows.
 * Non-uniform ppm spacing is resampled onto a uniform grid between first and last ppm (linear interpolation).
 *
 * @param input Parallel ppm and intensity arrays plus {@link JcampExportMetadata}
 * @returns Full JCAMP-DX document terminated with `##END=`
 */
export function exportToJcampDx(input: JcampSpectrumInput): string {
  const { metadata } = input;
  const ppmIn = input.ppm ?? [];
  const intIn = input.intensity ?? [];
  const pairLen = Math.min(ppmIn.length, intIn.length);
  const ppm: number[] = [];
  const intensity: number[] = [];
  for (let i = 0; i < pairLen; i++) {
    const p = Number(ppmIn[i]);
    const y = Number(intIn[i]);
    if (isFiniteNumber(p) && isFiniteNumber(y)) {
      ppm.push(p);
      intensity.push(y);
    }
  }
  let xs = ppm;
  let ys = intensity;
  const nPaired = xs.length;

  const title = formatHeaderValue(metadata.title ?? 'NMR Spectrum');
  const owner = formatHeaderValue(metadata.owner ?? DEFAULT_OWNER);
  const nucleus = metadata.nucleus ?? '1H';

  let npoints = nPaired;
  let firstX = 0;
  let lastX = 0;
  let xFactor = 1;
  let firstY = 0;
  const yFactor = 1;
  let xyLines: string[] = [];

  if (npoints === 0) {
    firstX = 0;
    lastX = 0;
    firstY = 0;
    xFactor = 1;
  } else {
    const uniform = ensureUniformPpmGrid(xs, ys);
    xs = uniform.ppm;
    ys = uniform.intensity;
    npoints = xs.length;
    firstX = xs[0]!;
    lastX = xs[npoints - 1]!;
    firstY = ys[0]!;
    xFactor = npoints > 1 ? (lastX - firstX) / (npoints - 1) : 0;
    xyLines = buildXydataLines(xs, ys);
  }

  const observeMHz =
    isFiniteNumber(metadata.observeFrequency) && metadata.observeFrequency! > 0
      ? formatNum(metadata.observeFrequency!, 6)
      : '';

  const lines: string[] = [
    `##TITLE= ${title}`,
    `##JCAMP-DX= ${JCAMP_VERSION}`,
    `##DATA TYPE= NMR SPECTRUM`,
    `##DATA CLASS= XYDATA`,
    `##ORIGIN= ${ORIGIN}`,
    `##OWNER= ${owner}`,
    `##XUNITS= PPM`,
    `##YUNITS= ARBITRARY UNITS`,
    `##XFACTOR= ${formatNum(xFactor)}`,
    `##YFACTOR= ${formatNum(yFactor)}`,
    `##FIRSTX= ${formatNum(firstX)}`,
    `##LASTX= ${formatNum(lastX)}`,
    `##NPOINTS= ${npoints}`,
    `##FIRSTY= ${formatNum(firstY)}`,
  ];

  if (observeMHz !== '') {
    lines.push(`##OBSERVE FREQUENCY= ${observeMHz}`);
  }

  if (metadata.solvent !== undefined && String(metadata.solvent).trim() !== '') {
    lines.push(`##SOLVENT NAME= ${formatHeaderValue(String(metadata.solvent))}`);
  }

  lines.push(`##.OBSERVE NUCLEUS= ${nucleus}`);

  const commentParts: string[] = [];
  if (metadata.processingInfo !== undefined && String(metadata.processingInfo).trim() !== '') {
    commentParts.push(formatHeaderValue(String(metadata.processingInfo)));
  }
  if (isFiniteNumber(metadata.temperature)) {
    commentParts.push(`T_K=${formatNum(metadata.temperature!, 4)}`);
  }
  if (metadata.spectrometerModel !== undefined && String(metadata.spectrometerModel).trim() !== '') {
    commentParts.push(`spectrometer=${formatHeaderValue(String(metadata.spectrometerModel))}`);
  }
  commentParts.push(`SpectroMind sourceMode=${metadata.sourceMode}`);
  if (metadata.axisSource) {
    commentParts.push(`axisSource=${metadata.axisSource}`);
  }
  lines.push(`##COMMENT= ${commentParts.join('; ')}`);

  lines.push(`##XYDATA=(X++(Y..Y))`);
  lines.push(...xyLines);
  lines.push(`##END=`);

  return lines.join('\r\n') + '\r\n';
}

/**
 * Triggers a file download of JCAMP-DX content in the browser (`.jdx`).
 * No-op on the server (`typeof window === 'undefined'`).
 *
 * @param jcampContent Full JCAMP-DX document
 * @param baseFileName File name without or with extension (`.jdx` appended if missing)
 */
export function downloadJcampDx(jcampContent: string, baseFileName: string): void {
  if (typeof window === 'undefined') return;

  const name = baseFileName.endsWith('.jdx') ? baseFileName : `${baseFileName}.jdx`;
  const blob = new Blob([jcampContent], { type: 'chemical/x-jcamp-dx;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
