/**
 * NMReDATA-oriented export scaffolding: builds a minimal SDfile-style record with a peak list data block.
 * Not fully NMReDATA 1.1–compliant; intended as a stable extension point for future strict encoding.
 */

/**
 * One peak row for NMReDATA-style tabular export (chemical shift axis in ppm).
 */
export interface NmredataPeak {
  /** Chemical shift δ (ppm). */
  shift: number;
  /** Relative intensity or peak height (arbitrary units). */
  intensity?: number;
  /** Multiplicity label (e.g. s, d, t, m). */
  multiplicity?: string;
  /** Integration (proton count or relative). */
  integration?: number;
  /** Assignment or label text. */
  label?: string;
}

/**
 * Molecule / experiment context carried beside the peak table.
 */
export interface NmredataExportMetadata {
  /** Compound or sample title. */
  compoundName?: string;
  /** Molecular formula string, if known. */
  formula?: string;
  /** Canonical or arbitrary SMILES, if known. */
  smiles?: string;
  /** Solvent description. */
  solvent?: string;
  /** Observation frequency (MHz). */
  observeFrequencyMHz?: number;
  /** Target nuclide. */
  nucleus?: '1H' | '13C';
  /** Free-form description. */
  description?: string;
}

/**
 * Options controlling the scaffold SDF layout and field naming.
 */
export interface NmredataExportOptions {
  /** Nuclide channel; defaults from `metadata.nucleus` or `'1H'`. */
  nucleus?: '1H' | '13C';
  /**
   * SDF data header for the embedded peak list.
   * Default: `SPECTROMIND_NMREDATA_PEAKLIST`.
   */
  peakListFieldName?: string;
  /** Line ending for the returned document (`\\n` or `\\r\\n`). */
  eol?: '\n' | '\r\n';
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Collapses newlines and trims; safe for single-line SDF value fields. */
function sdfEscapeLine(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

/** Empty V2000 connection table (no atoms) — tolerated by many SDF readers for data-only records. */
function emptyMolBlock(titleLine: string): string {
  const header = sdfEscapeLine(titleLine) || 'SpectroMind';
  return [
    header,
    '  SpectroMind NMReDATA scaffold',
    '',
    '  0  0  0  0  0  0  0  0  0 0999 V2000',
    'M  END',
  ].join('\n');
}

/**
 * Serializes `peaks` as simple `key=value;` rows (one peak per line).
 */
function formatPeakTable(peaks: NmredataPeak[]): string {
  if (peaks.length === 0) {
    return '';
  }
  const lines: string[] = [];
  peaks.forEach((pk, idx) => {
    const parts: string[] = [`index=${idx + 1}`, `shift_ppm=${pk.shift}`];
    if (isFiniteNumber(pk.intensity)) parts.push(`I=${pk.intensity}`);
    if (pk.multiplicity !== undefined && String(pk.multiplicity).trim() !== '') {
      parts.push(`mult=${sdfEscapeLine(String(pk.multiplicity))}`);
    }
    if (isFiniteNumber(pk.integration)) parts.push(`integ=${pk.integration}`);
    if (pk.label !== undefined && String(pk.label).trim() !== '') {
      parts.push(`label=${sdfEscapeLine(String(pk.label))}`);
    }
    lines.push(parts.join('; '));
  });
  return lines.join('\n');
}

/**
 * Builds a minimal SDF record: empty MOL block + SpectroMind NMReDATA-style data fields + `$$$$` terminator.
 *
 * @param peaks Peak list (may be empty — still yields a valid SDF envelope).
 * @param metadata Optional compound / experiment metadata.
 * @param options Layout and field naming.
 * @returns One SDfile record as a string.
 */
export function exportToNmredata(
  peaks: NmredataPeak[],
  metadata: NmredataExportMetadata = {},
  options: NmredataExportOptions = {}
): string {
  const eol = options.eol ?? '\n';
  const nucleus = options.nucleus ?? metadata.nucleus ?? '1H';
  const fieldName = options.peakListFieldName ?? 'SPECTROMIND_NMREDATA_PEAKLIST';

  const title = metadata.compoundName ?? 'SpectroMind_NMReDATA';
  const mol = emptyMolBlock(title).split('\n').join(eol);

  const metaLines: string[] = [
    `generator=SpectroMind`,
    `nuclide=${nucleus}`,
    `peak_count=${peaks.length}`,
  ];
  if (metadata.formula !== undefined && metadata.formula.trim() !== '') {
    metaLines.push(`formula=${sdfEscapeLine(metadata.formula)}`);
  }
  if (metadata.smiles !== undefined && metadata.smiles.trim() !== '') {
    metaLines.push(`smiles=${sdfEscapeLine(metadata.smiles)}`);
  }
  if (metadata.solvent !== undefined && metadata.solvent.trim() !== '') {
    metaLines.push(`solvent=${sdfEscapeLine(metadata.solvent)}`);
  }
  if (isFiniteNumber(metadata.observeFrequencyMHz)) {
    metaLines.push(`observe_MHz=${metadata.observeFrequencyMHz}`);
  }
  if (metadata.description !== undefined && metadata.description.trim() !== '') {
    metaLines.push(`description=${sdfEscapeLine(metadata.description)}`);
  }

  const metaField = metaLines.join(eol);
  const peakBody = formatPeakTable(peaks);

  const blocks: string[] = [
    mol,
    `> <SPECTROMIND_NMREDATA_META>${eol}${metaField}${eol}`,
    `> <${fieldName}>${eol}${peakBody}${eol}`,
    `$$$$`,
  ];

  return blocks.join(eol) + eol;
}
