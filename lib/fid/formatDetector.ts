/**
 * Heuristic vendor / layout detection from relative paths (before or after upload).
 * Does not read binary — complements on-disk checks.
 */

export type FidVendorGuess = 'bruker' | 'varian' | 'jeol' | 'unknown';

export interface FormatDetectionResult {
  vendor: FidVendorGuess;
  rawFileKind: 'fid' | 'ser' | 'jdf' | 'unknown';
  /** Bruker 2D datasets often live under pdata; still 1D processed — conservative */
  dimensionHint: '1D' | '2D' | 'unknown';
  nucleusGuess: '1H' | '13C' | '19F' | '31P' | 'unknown';
  confidence: 'confirmed' | 'inferred' | 'unknown';
  flags: string[];
}

const lower = (p: string) => p.replace(/\\/g, '/').toLowerCase();

export function detectFormatFromRelPaths(relPaths: string[]): FormatDetectionResult {
  const paths = relPaths.map(lower);
  const flags: string[] = [];

  const has = (name: string) => paths.some((p) => p.endsWith(`/${name}`) || p.endsWith(`/${name}/`) || p.split('/').pop() === name);

  const hasAcqus = has('acqus');
  const hasProcpar = has('procpar');
  const hasFid = paths.some((p) => /(^|\/)fid$/.test(p) || p.endsWith('/fid'));
  const hasSer = paths.some((p) => /(^|\/)ser$/.test(p) || p.endsWith('/ser'));
  const hasJdf = paths.some((p) => p.endsWith('.jdf'));
  const hasPdata = paths.some((p) => p.includes('/pdata/') || p.includes('\\pdata\\'));

  let vendor: FidVendorGuess = 'unknown';
  let rawFileKind: FormatDetectionResult['rawFileKind'] = 'unknown';
  let confidence: FormatDetectionResult['confidence'] = 'unknown';
  let dimensionHint: FormatDetectionResult['dimensionHint'] = 'unknown';
  let nucleusGuess: FormatDetectionResult['nucleusGuess'] = 'unknown';

  if (hasJdf && !hasFid && !hasSer) {
    vendor = 'jeol';
    rawFileKind = 'jdf';
    confidence = 'inferred';
    flags.push('jeol_jdf_paths');
  } else if (hasProcpar) {
    vendor = 'varian';
    rawFileKind = hasFid ? 'fid' : 'unknown';
    confidence = 'confirmed';
    flags.push('varian_procpar');
  } else if (hasAcqus) {
    vendor = 'bruker';
    rawFileKind = hasFid ? 'fid' : hasSer ? 'ser' : 'unknown';
    confidence = 'confirmed';
    flags.push('bruker_acqus');
  } else if (hasFid || hasSer) {
    vendor = 'unknown';
    rawFileKind = hasFid ? 'fid' : 'ser';
    confidence = 'inferred';
    flags.push('raw_without_vendor_metadata');
  }

  if (hasPdata) {
    dimensionHint = '2D';
    flags.push('pdata_present_may_be_2d_or_processed');
  } else {
    dimensionHint = '1D';
  }

  const joined = paths.join('\n');
  if (/\bproton\b|(^|\/)1h\b|_1h\b|proton_/.test(joined)) nucleusGuess = '1H';
  else if (/\bcarbon\b|(^|\/)13c\b|_13c\b/.test(joined)) nucleusGuess = '13C';
  else if (/\bfluorine\b|(^|\/)19f\b/.test(joined)) nucleusGuess = '19F';
  else nucleusGuess = 'unknown';

  return {
    vendor: vendor === ('inferred' as any) ? 'unknown' : vendor,
    rawFileKind,
    dimensionHint,
    nucleusGuess,
    confidence,
    flags,
  };
}
