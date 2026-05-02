/**
 * JEOL Jeol Data Format (JDF) — ikili NMR dosyaları için iskelet ayrıştırıcı.
 *
 * @remarks
 * Resmi JEOL spesifikasyonu kapalıdır. Bu modül, açık kaynak **nmrglue** `jeol`
 * modülünde belgelenen başlık düzeni ve parametre bloğu mantığına dayanır; tam
 * spektrum doğruluğu için **Bruker tarzı alt-matris yeniden sıralama** ve
 * `truncate_data` eşdeğeri gerekir. Bu sürüm başlığı ve ham FID sayısallarını
 * çıkarır; yeniden sıralama yapılmadığı için `supportLevel: 'partial'` döner
 * ve uyarılar üretir.
 *
 * @see https://github.com/jjhelmus/nmrglue/blob/master/nmrglue/fileio/jeol.py
 *
 * @packageDocumentation
 */

/** JDF dosya imzası: ASCII `JEOL.NMR` (8 bayt). Kamuya açık uzantı açıklamaları ve nmrglue ile uyumlu. */
export const JDF_FILE_IDENTIFIER_BYTES = new Uint8Array([
  0x4a, 0x45, 0x4f, 0x4c, 0x2e, 0x4e, 0x4d, 0x52,
]);

/**
 * Makine tarafından işlenebilir hata kodları.
 * Açıklamalar kullanıcıya `errorMessage` / `warnings` ile iletilir.
 */
export const JDF_ERROR_CODES = {
  /** İlk 8 bayt geçerli JEOL JDF tanımlayıcısı değil. */
  JDF_INVALID_MAGIC: 'JDF_INVALID_MAGIC',
  /** `JDF_SUPPORTED_MAJOR_VERSIONS` dışında major sürüm (başlık okunduktan sonra). */
  JDF_UNSUPPORTED_VERSION: 'JDF_UNSUPPORTED_VERSION',
  /** 2B veya “small 2D” / 3B+ biçimleri bu iskelette FID olarak desteklenmiyor. */
  JDF_2D_NOT_SUPPORTED: 'JDF_2D_NOT_SUPPORTED',
  /** Beklenen başlık alanları okunamadı veya aralık dışı. */
  JDF_CORRUPT_HEADER: 'JDF_CORRUPT_HEADER',
  /** `data_start` + beklenen örnek sayısı dosya sonunu aşıyor. */
  JDF_DATA_TRUNCATED: 'JDF_DATA_TRUNCATED',
  /** `data_type` ayrılmış (reserved) veya eşlenemedi. */
  JDF_UNKNOWN_DATA_FORMAT: 'JDF_UNKNOWN_DATA_FORMAT',
} as const;

export type JdfErrorCode = (typeof JDF_ERROR_CODES)[keyof typeof JDF_ERROR_CODES];

/**
 * Hangi alt türlerin hedeflendiği / neden sınırlı olduğu.
 * Gerçek dosya varyantları üretici yazılım sürümüne göre farklılık gösterebilir.
 */
export const JDF_SUPPORTED_SUBTYPES = {
  /** Başlık bloğu: büyük endian okuma (nmrglue ile uyumlu). */
  headerEndian: 'big-endian for fixed header; parameter block may switch per file',
  /** 1B, `one_d`, float32/float64, yeniden sıralama hariç ham okuma. */
  oneD_FloatRawLinear: 'partial — raw linear FID at data_start; submatrix reorder NOT applied',
  /** 1B karmaşık: ham iki bölüm doğrusal; gerçek/imag ayrımı iskelet düzeyinde. */
  oneD_ComplexRawLinear: 'partial — same as oneD_FloatRawLinear; phase/submatrix not verified',
  /** 2B `two_d`: başlık okunabilir; FID dizisi bu modülde üretilmez. */
  twoD: 'unsupported for FID extraction in this scaffold',
  /** `small_two_d` / 3B+ / “not for NMR” kodları: desteklenmiyor. */
  smallMultiD: 'unsupported',
  /** Parametre sözlüğü: nmrglue `read_parameters` düzeni (sınırlı doğrulama). */
  parameterBlock: 'best-effort key/value; mismatched vendor builds may yield gaps',
} as const;

/** Bu major sürümler başlık sonrası kabul edilir; dışı `JDF_UNSUPPORTED_VERSION`. */
export const JDF_SUPPORTED_MAJOR_VERSIONS: readonly number[] = [0, 1];

// --- Public types (sözleşme) ---

export interface JdfHeader {
  magic: string;
  version: number;
  dataOffset: number;
  dataFormat: 'complex' | 'real' | 'unknown';
  numPoints: number;
  dimension: 1 | 2;
  nucleus: string;
  solvent: string;
  fieldStrengthMHz: number;
  spectralWidthHz: number;
  transmitterFrequencyHz: number;
  byteOrder: 'big' | 'little';
  dataType: 'float64' | 'float32' | 'int32' | 'unknown';
  title: string;
  rawHeaderBytes: number;
}

export interface JdfParseResult {
  success: boolean;
  header?: JdfHeader;
  realData?: Float64Array;
  imagData?: Float64Array;
  errorCode?: JdfErrorCode;
  errorMessage?: string;
  warnings: string[];
  supportLevel: 'full' | 'partial' | 'unsupported';
}

// --- Internal: nmrglue ConversionTable özeti ---

const ENDIANNESS: Record<number, 'big_endian' | 'little_endian'> = {
  0: 'big_endian',
  1: 'little_endian',
};

const DATA_TYPE_MAP: Record<number, 'float64' | 'float32' | 'unknown'> = {
  0: 'float64',
  1: 'float32',
  2: 'unknown',
  3: 'unknown',
};

/** data_format alanı (alt 6 bit), nmrglue `data_format`. */
const DATA_FORMAT_MAP: Record<number, string> = {
  1: 'one_d',
  2: 'two_d',
  3: 'three_d',
  4: 'four_d',
  5: 'five_d',
  6: 'six_d',
  7: 'seven_d',
  8: 'eight_d',
  9: 'not_for_nmr',
  10: 'not_for_nmr',
  11: 'not_for_nmr',
  12: 'small_two_d',
  13: 'small_three_d',
  14: 'small_four_d',
};

const AXIS_TYPE_MAP: Record<number, string | null> = {
  0: null,
  1: 'real',
  2: 'tppi',
  3: 'complex',
  4: 'real_complex',
  5: 'envelope',
};

const VALUE_TYPE_MAP: Record<number, 'string' | 'integer' | 'float' | 'complex' | 'infinity' | 'unknown'> = {
  0: 'string',
  1: 'integer',
  2: 'float',
  3: 'complex',
  4: 'infinity',
};

interface InternalJeolHeader {
  fileIdentifier: string;
  endian: 'big_endian' | 'little_endian';
  majorVersion: number;
  minorVersion: number;
  dataDimensionNumber: number;
  dataDimensionExist: boolean[];
  dataTypeKey: 'float64' | 'float32' | 'unknown';
  dataFormat: string;
  dataAxisType: (string | null)[];
  title: string;
  comment: string;
  dataPoints: number[];
  dataStart: number;
  paramStart: number;
  /** Başlık sonundaki okuma konumu (compound_units sonrası). */
  headerEndOffset: number;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function decodeIdentifier8(bytes: Uint8Array): string {
  let end = 8;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, end));
}

class BinaryCursor {
  private view: DataView;
  private little = false;

  constructor(private buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  offset = 0;

  setBigEndian(): void {
    this.little = false;
  }

  setLittleEndian(): void {
    this.little = true;
  }

  private e(): boolean {
    return this.little;
  }

  skip(n: number): void {
    this.offset += n;
  }

  readUint8(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readInt8(): number {
    const v = this.view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }

  readUint16(): number {
    const v = this.view.getUint16(this.offset, this.e());
    this.offset += 2;
    return v;
  }

  readInt16(): number {
    const v = this.view.getInt16(this.offset, this.e());
    this.offset += 2;
    return v;
  }

  readUint32(): number {
    const v = this.view.getUint32(this.offset, this.e());
    this.offset += 4;
    return v;
  }

  readInt32(): number {
    const v = this.view.getInt32(this.offset, this.e());
    this.offset += 4;
    return v;
  }

  readFloat32(): number {
    const v = this.view.getFloat32(this.offset, this.e());
    this.offset += 4;
    return v;
  }

  readFloat64(): number {
    const v = this.view.getFloat64(this.offset, this.e());
    this.offset += 8;
    return v;
  }

  readChars(len: number): string {
    const slice = new Uint8Array(this.buffer, this.offset, len);
    this.offset += len;
    return new TextDecoder('utf-8', { fatal: false }).decode(slice);
  }

  readNullPaddedString(len: number): string {
    return this.readChars(len).replace(/\x00/g, '');
  }

  remaining(): number {
    return this.buffer.byteLength - this.offset;
  }
}

/** nmrglue `get_unit` */
function readUnit(cursor: BinaryCursor, count: number): void {
  for (let i = 0; i < count; i++) {
    cursor.readUint8();
    cursor.readInt8();
  }
}

/**
 * Başlığı nmrglue `read_header` sırasıyla okur.
 * @returns null başarısız (yetersiz uzunluk / bozuk).
 */
function readJeolHeader(buffer: ArrayBuffer): InternalJeolHeader | null {
  const minNeed = 1400;
  if (buffer.byteLength < minNeed) return null;

  const c = new BinaryCursor(buffer);
  c.setBigEndian();

  const fileIdentifier = c.readChars(8);
  const endianByte = c.readInt8();
  const endian = ENDIANNESS[endianByte as 0 | 1];
  if (!endian) return null;

  const majorVersion = c.readUint8();
  const minorVersion = c.readUint16();
  const dataDimensionNumber = c.readUint8();

  const dimExistByte = c.readUint8();
  const dataDimensionExist = Array.from({ length: 8 }, (_, i) => {
    const bit = (dimExistByte >> (7 - i)) & 1;
    return bit === 1;
  });

  const typeFmt = c.readUint8();
  const dataTypeKey = DATA_TYPE_MAP[typeFmt >> 6] ?? 'unknown';
  const fmtLow = typeFmt & 0b00111111;
  const dataFormat = DATA_FORMAT_MAP[fmtLow] ?? `unknown_${fmtLow}`;

  c.readInt8(); // instrument

  for (let i = 0; i < 8; i++) c.readInt8(); // translate

  const dataAxisType: (string | null)[] = [];
  for (let i = 0; i < 8; i++) {
    const k = c.readInt8();
    dataAxisType.push(AXIS_TYPE_MAP[k] ?? null);
  }

  readUnit(c, 8);
  const title = c.readNullPaddedString(124);

  for (let i = 0; i < 4; i++) c.readUint8(); // data_axis_ranged nibbles

  const dataPoints: number[] = [];
  for (let i = 0; i < 8; i++) dataPoints.push(c.readUint32());

  for (let i = 0; i < 8; i++) c.readUint32(); // data_offset_start
  for (let i = 0; i < 8; i++) c.readUint32(); // data_offset_stop
  for (let i = 0; i < 8; i++) c.readFloat64(); // data_axis_start
  for (let i = 0; i < 8; i++) c.readFloat64(); // data_axis_stop

  for (let i = 0; i < 4; i++) c.readUint8(); // creation_time
  for (let i = 0; i < 4; i++) c.readUint8(); // revision_time

  c.readNullPaddedString(16); // node_name
  c.readNullPaddedString(128); // site
  c.readNullPaddedString(128); // author
  const comment = c.readNullPaddedString(128);

  for (let i = 0; i < 8; i++) c.readNullPaddedString(32); // data_axis_titles

  for (let i = 0; i < 8; i++) c.readFloat64(); // base_freq
  for (let i = 0; i < 8; i++) c.readFloat64(); // zero_point
  for (let i = 0; i < 8; i++) c.readUint8(); // reversed (boolean as byte)

  c.skip(3);
  c.readUint8(); // annotation_ok (packed)
  c.readUint32(); // history_used
  c.readUint32(); // history_length
  const paramStart = c.readUint32();
  c.readUint32(); // param_length
  for (let i = 0; i < 8; i++) c.readUint32(); // list_start
  for (let i = 0; i < 8; i++) c.readUint32(); // list_length

  const dataStart = c.readUint32();

  c.readUint32();
  c.readUint32(); // data_length u64
  c.readUint32();
  c.readUint32(); // context_start
  c.readUint32(); // context_length
  c.readUint32();
  c.readUint32(); // annote_start
  c.readUint32(); // annote_length
  c.readUint32();
  c.readUint32(); // total_size

  for (let i = 0; i < 8; i++) c.readUint8(); // unit_location

  for (let _ = 0; _ < 2; _++) {
    c.readInt16();
    for (let i = 0; i < 5; i++) c.readInt16();
  }

  const headerEndOffset = c.offset;

  return {
    fileIdentifier,
    endian,
    majorVersion,
    minorVersion,
    dataDimensionNumber,
    dataDimensionExist,
    dataTypeKey,
    dataFormat,
    dataAxisType,
    title,
    comment,
    dataPoints,
    dataStart,
    paramStart,
    headerEndOffset,
  };
}

function ndims(axisTypes: (string | null)[]): number {
  return axisTypes.reduce((n, t) => n + (t ? 1 : 0), 0);
}

function dimensionNames(exist: boolean[]): string[] {
  const letters = 'xyzabcde'.split('');
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (exist[i]) out.push(letters[i]!);
  }
  return out;
}

/**
 * nmrglue `num_complex_dims` / `nsections` mantığı.
 */
function numComplexDims(axisTypes: (string | null)[]): number {
  let complexDims = 0;
  for (const dim of axisTypes) {
    if (dim === 'complex') complexDims++;
    else if (dim === 'real_complex') return 1;
  }
  return complexDims;
}

function nsections(axisTypes: (string | null)[]): number {
  return 2 ** numComplexDims(axisTypes);
}

function prodDataPoints(points: number[], dims: number): number {
  const used = points.slice(0, Math.max(dims, 1));
  let p = 1;
  for (let i = 0; i < dims; i++) {
    const v = used[i] ?? 1;
    if (v > 0) p *= v;
  }
  return p;
}

function activeShape(dataPoints: number[], axisTypes: (string | null)[]): number[] {
  const d = ndims(axisTypes);
  const raw = dataPoints.slice(0, d).filter((n) => n > 1);
  return raw.length ? raw : [dataPoints[0] || 0];
}

function inferDataFormatKind(
  axisTypes: (string | null)[],
): 'complex' | 'real' | 'unknown' {
  const first = axisTypes.find((t) => t != null);
  if (first === 'complex' || first === 'real_complex') return 'complex';
  if (first === 'real' || first === 'tppi' || first === 'envelope') return 'real';
  return 'unknown';
}

function mapAxisLabelToNucleus(label: string): string {
  const l = label.trim().toLowerCase();
  if (!l) return '';
  if (l.includes('proton') || l === '1h' || l === 'h1') return '1H';
  if (l.includes('carbon13') || l.includes('carbon') || l === '13c' || l === 'c13') return '13C';
  if (l.includes('fluorine') || l === '19f' || l === 'f19') return '19F';
  if (l.includes('phosphorus') || l === '31p' || l === 'p31') return '31P';
  return label.trim();
}

interface ParsedParameters {
  scalars: Record<string, number>;
  strings: Record<string, string>;
}

/**
 * nmrglue `read_parameters` — `high_index` kadar 64 baytlık kayıt (çoğu tip için).
 */
function parseParameters(
  buffer: ArrayBuffer,
  paramStart: number,
  endian: 'big_endian' | 'little_endian',
): ParsedParameters {
  const scalars: Record<string, number> = {};
  const strings: Record<string, string> = {};
  const c = new BinaryCursor(buffer);
  if (endian === 'little_endian') c.setLittleEndian();
  else c.setBigEndian();

  if (paramStart >= buffer.byteLength) return { scalars, strings };
  c.offset = paramStart;

  try {
    c.readUint32(); // parameter_size
    c.readUint32(); // low_index
    const highIndex = c.readUint32();
    c.readUint32(); // total_size

    const n = Math.min(highIndex, 100_000);
    for (let p = 0; p < n; p++) {
      if (c.remaining() < 64) break;

      const recordStart = c.offset;
      for (let i = 0; i < 4; i++) c.readUint8();
      const unitScaler = c.readInt16();
      readUnit(c, 5);
      c.skip(16);

      const typePos = c.offset;
      const vtRaw = c.readInt32();
      c.offset = typePos - 20;

      const valueType = VALUE_TYPE_MAP[vtRaw] ?? 'unknown';

      let value: number | null = null;
      if (valueType === 'string') {
        const raw = c.readNullPaddedString(16).replace(/\s+/g, '');
        c.skip(4);
        const name = c.readNullPaddedString(28);
        const bname = name.toLowerCase().replace(/\s+/g, '');
        if (bname) strings[bname] = raw;
        c.offset = recordStart + 64;
        continue;
      }
      if (valueType === 'integer') {
        value = c.readInt32();
        c.skip(12);
      } else if (valueType === 'float') {
        value = c.readFloat64();
        c.skip(8);
      } else if (valueType === 'complex') {
        c.readFloat64();
        c.readFloat64();
      } else if (valueType === 'infinity') {
        value = c.readInt32();
        c.skip(12);
      } else {
        c.skip(16);
      }

      c.skip(4);
      const name = c.readNullPaddedString(28);
      const bname = name.toLowerCase().replace(/\s+/g, '');

      if (value !== null && Number.isFinite(value) && bname) {
        scalars[bname] = value * 10 ** unitScaler;
      }

      c.offset = recordStart + 64;
    }
  } catch {
    /* bozuk parametre bloğu — kısmi sözlük */
  }

  return { scalars, strings };
}

function pickSolvent(
  comment: string,
  title: string,
  warnings: string[],
): string {
  const text = `${comment} ${title}`.toLowerCase();
  const solvents = ['dmso', 'cdcl3', 'chloroform', 'methanol', 'meod', 'acetone', 'dmf', 'water', 'h2o', 'buffer'];
  for (const s of solvents) {
    if (text.includes(s)) {
      warnings.push('Çözücü, başlık/yorum metninde sezgisel anahtar kelime eşlemesiyle tespit edildi (resmi parametre değil).');
      if (s === 'meod' || s === 'methanol') return 'CD3OD';
      if (s === 'dmso') return 'DMSO-d6';
      if (s === 'cdcl3' || s === 'chloroform') return 'CDCl3';
      if (s === 'acetone') return 'acetone-d6';
      if (s === 'dmf') return 'DMF-d7';
      if (s === 'water' || s === 'h2o' || s === 'buffer') return 'H2O';
    }
  }
  return '';
}

/**
 * JEOL `.jdf` ikili tamponunu ayrıştırır.
 *
 * @param buffer — Ham dosya içeriği (`File.arrayBuffer()` vb.)
 * @returns Başarılı başlık okumasında `header` dolu; FID için `partial` ve uyarılar.
 *
 * @remarks
 * - **Alt-matris yeniden sıralama uygulanmaz**; üretilen diziler dosyadaki doğrusal sıradadır.
 * - 2B ve üzeri için FID döndürülmez (`JDF_2D_NOT_SUPPORTED`).
 */
export function parseJdfBuffer(buffer: ArrayBuffer): JdfParseResult {
  const warnings: string[] = [];

  if (buffer.byteLength < 8) {
    return {
      success: false,
      errorCode: JDF_ERROR_CODES.JDF_INVALID_MAGIC,
      errorMessage: 'Buffer çok kısa; JDF tanımlayıcısı okunamıyor.',
      warnings,
      supportLevel: 'unsupported',
    };
  }

  const idBytes = new Uint8Array(buffer, 0, 8);
  if (!bytesEqual(idBytes, JDF_FILE_IDENTIFIER_BYTES)) {
    const asText = decodeIdentifier8(idBytes);
    return {
      success: false,
      errorCode: JDF_ERROR_CODES.JDF_INVALID_MAGIC,
      errorMessage: `Geçersiz JDF imzası (beklenen 8 bayt ASCII "JEOL.NMR", okunan: ${JSON.stringify(asText)}).`,
      warnings,
      supportLevel: 'unsupported',
    };
  }

  const internal = readJeolHeader(buffer);
  if (!internal) {
    return {
      success: false,
      errorCode: JDF_ERROR_CODES.JDF_CORRUPT_HEADER,
      errorMessage: 'Başlık alanları okunamadı veya dosya beklenen başlık boyutundan kısa.',
      warnings,
      supportLevel: 'unsupported',
    };
  }

  if (!JDF_SUPPORTED_MAJOR_VERSIONS.includes(internal.majorVersion)) {
    return {
      success: false,
      header: buildPublicHeader(internal, buffer, parseParameters(buffer, internal.paramStart, internal.endian), warnings),
      errorCode: JDF_ERROR_CODES.JDF_UNSUPPORTED_VERSION,
      errorMessage: `Destek dışı major sürüm: ${internal.majorVersion} (izin verilen: ${JDF_SUPPORTED_MAJOR_VERSIONS.join(', ')}).`,
      warnings,
      supportLevel: 'unsupported',
    };
  }

  if (internal.dataTypeKey === 'unknown') {
    return {
      success: false,
      header: buildPublicHeader(internal, buffer, parseParameters(buffer, internal.paramStart, internal.endian), warnings),
      errorCode: JDF_ERROR_CODES.JDF_UNKNOWN_DATA_FORMAT,
      errorMessage: 'Başlıktaki veri tipi ayrılmış veya bilinmiyor (reserved data_type).',
      warnings,
      supportLevel: 'unsupported',
    };
  }

  const dims = ndims(internal.dataAxisType);
  const fmt = internal.dataFormat;

  const isOneD = fmt === 'one_d';
  const isTwoD = fmt === 'two_d';
  const isUnsupportedFmt =
    !isOneD &&
    (isTwoD ||
      fmt.startsWith('small_') ||
      fmt.includes('three_d') ||
      fmt.includes('four_d') ||
      fmt.includes('five_d') ||
      fmt.includes('six_d') ||
      fmt.includes('seven_d') ||
      fmt.includes('eight_d') ||
      fmt.startsWith('not_for'));

  if (isUnsupportedFmt || dims > 2) {
    const paramsEarly = parseParameters(buffer, internal.paramStart, internal.endian);
    return {
      success: false,
      header: buildPublicHeader(internal, buffer, paramsEarly, warnings),
      errorCode: JDF_ERROR_CODES.JDF_2D_NOT_SUPPORTED,
      errorMessage: `Bu iskelet yalnızca 1B \`one_d\` FID okumasını hedefler (format: ${fmt}, boyut: ${dims}).`,
      warnings,
      supportLevel: 'unsupported',
    };
  }

  if (!isOneD || dims !== 1) {
    const paramsEarly = parseParameters(buffer, internal.paramStart, internal.endian);
    return {
      success: false,
      header: buildPublicHeader(internal, buffer, paramsEarly, warnings),
      errorCode: JDF_ERROR_CODES.JDF_CORRUPT_HEADER,
      errorMessage: `Beklenmeyen boyut/format bileşimi (format: ${fmt}, aktif eksen: ${dims}).`,
      warnings,
      supportLevel: 'unsupported',
    };
  }

  const params = parseParameters(buffer, internal.paramStart, internal.endian);
  const header = buildPublicHeader(internal, buffer, params, warnings);

  warnings.push(
    'Ham FID, JEOL alt-matris yeniden sıralaması olmadan okunur; SpektrMind / nmrpipe ile birebir uyum için ek işleme gerekir.',
  );

  const sections = nsections(internal.dataAxisType);
  const nFloat = prodDataPoints(internal.dataPoints, 1) * sections;

  const elemBytes = internal.dataTypeKey === 'float64' ? 8 : 4;
  const needBytes = nFloat * elemBytes;
  const start = internal.dataStart;

  if (start < 0 || start >= buffer.byteLength) {
    return {
      success: false,
      header,
      errorCode: JDF_ERROR_CODES.JDF_CORRUPT_HEADER,
      errorMessage: `Geçersiz data_start ofseti: ${start}.`,
      warnings,
      supportLevel: 'unsupported',
    };
  }

  if (start + needBytes > buffer.byteLength) {
    return {
      success: false,
      header,
      errorCode: JDF_ERROR_CODES.JDF_DATA_TRUNCATED,
      errorMessage: `Dosya kesik: ${needBytes} bayt FID bekleniyordu, ${buffer.byteLength - start} bayt kaldı.`,
      warnings,
      supportLevel: 'unsupported',
    };
  }

  const dataView = new DataView(buffer, start, needBytes);
  const little = internal.endian === 'little_endian';
  const out = new Float64Array(nFloat);
  for (let i = 0; i < nFloat; i++) {
    const o = i * elemBytes;
    out[i] =
      internal.dataTypeKey === 'float64'
        ? dataView.getFloat64(o, little)
        : dataView.getFloat32(o, little);
  }

  const axis0 = inferDataFormatKind(internal.dataAxisType);
  let realData: Float64Array | undefined;
  let imagData: Float64Array | undefined;

  if (axis0 === 'complex' && sections === 2 && nFloat % 2 === 0) {
    const half = nFloat / 2;
    realData = new Float64Array(half);
    imagData = new Float64Array(half);
    for (let i = 0; i < half; i++) {
      realData[i] = out[i];
      imagData[i] = out[i + half];
    }
    warnings.push(
      'Karmaşık 1B: iki bölüm (gerçel/sanal) dosya sırasına göre ayrıldı; bu, nmrglue reorganize sonrası ile aynı olmayabilir.',
    );
  } else {
    realData = out;
    if (axis0 === 'complex') {
      warnings.push('Karmaşık eksen algılandı ancak bölüm sayısı beklenen 2 değil; tüm örnekler realData içinde bırakıldı.');
    }
  }

  return {
    success: true,
    header,
    realData,
    imagData,
    warnings,
    supportLevel: 'partial',
  };
}

function buildPublicHeader(
  h: InternalJeolHeader,
  _buffer: ArrayBuffer,
  parsed: ParsedParameters,
  warnings: string[],
): JdfHeader {
  const { scalars, strings } = parsed;
  const names = dimensionNames(h.dataDimensionExist);
  const xPrefix = names[0] ?? 'x';

  const sweepKey = `${xPrefix}_sweep`;
  const freqKey = `${xPrefix}_freq`;
  const domainKey = `${xPrefix}_domain`;

  const spectralWidthHz = Number.isFinite(scalars[sweepKey]) ? scalars[sweepKey]! : Number.NaN;
  const transmitterFrequencyHz = Number.isFinite(scalars[freqKey]) ? scalars[freqKey]! : Number.NaN;
  const fieldStrengthMHz = Number.isFinite(transmitterFrequencyHz) ? transmitterFrequencyHz / 1e6 : Number.NaN;

  const domainStr = strings[domainKey] ?? '';
  const nucleus = mapAxisLabelToNucleus(domainStr);

  const shape = activeShape(h.dataPoints, h.dataAxisType);
  const numPoints = shape.reduce((a, b) => a * b, 1);

  const solvent = pickSolvent(h.comment, h.title, warnings);

  if (!Number.isFinite(spectralWidthHz)) {
    warnings.push(`Spektral genişlik (${sweepKey}) parametre bloğunda bulunamadı.`);
  }
  if (!Number.isFinite(transmitterFrequencyHz)) {
    warnings.push(`Verici frekansı (${freqKey}) parametre bloğunda bulunamadı.`);
  }
  if (!domainStr.trim()) {
    warnings.push(`Çekirdek etiketi (${domainKey}) parametre bloğunda bulunamadı veya boş.`);
  }

  return {
    magic: h.fileIdentifier.replace(/\x00/g, '').trim() || 'JEOL.NMR',
    version: h.majorVersion + h.minorVersion / 10_000,
    dataOffset: h.dataStart,
    dataFormat: inferDataFormatKind(h.dataAxisType),
    numPoints,
    dimension: Math.min(2, Math.max(1, ndims(h.dataAxisType))) as 1 | 2,
    nucleus,
    solvent,
    fieldStrengthMHz,
    spectralWidthHz,
    transmitterFrequencyHz,
    byteOrder: h.endian === 'little_endian' ? 'little' : 'big',
    dataType: h.dataTypeKey === 'unknown' ? 'unknown' : h.dataTypeKey,
    title: h.title.trim(),
    rawHeaderBytes: h.headerEndOffset,
  };
}

/**
 * Dosya adına göre JEOL JDF uzantısı kontrolü (içerik doğrulamaz).
 */
export function isJdfFile(filename: string): boolean {
  const lower = filename.trim().toLowerCase();
  return lower.endsWith('.jdf');
}
