/**
 * Machine-readable FID pipeline error codes (API + UI).
 * See docs/FID_ERROR_CODES.md for full table.
 */

export const FidErrorCodes = {
  DATASET_NOT_FOUND: 'FID_DATASET_NOT_FOUND',
  RAW_FILE_NOT_FOUND: 'FID_RAW_FILE_NOT_FOUND',
  UPLOAD_FAILED: 'FID_UPLOAD_FAILED',
  UPLOAD_PATH_MISMATCH: 'FID_UPLOAD_PATH_MISMATCH',
  PYTHON_MISSING: 'FID_PYTHON_RUNTIME_MISSING',
  PYTHON_NMRGLUE: 'FID_DEP_NMRGLUE_MISSING',
  PYTHON_NUMPY: 'FID_DEP_NUMPY_MISSING',
  PYTHON_SCIPY: 'FID_DEP_SCIPY_MISSING',
  PYTHON_EXIT: 'FID_PYTHON_PROCESS_FAILED',
  PARSE_JSON: 'FID_PARSE_OUTPUT_FAILED',
  EMPTY_SPECTRUM: 'FID_EMPTY_SPECTRUM',
  AXIS_MISMATCH: 'FID_AXIS_LENGTH_MISMATCH',
  UNSUPPORTED_2D: 'FID_UNSUPPORTED_2D_LAYOUT',
  UNSUPPORTED_VENDOR: 'FID_UNSUPPORTED_VENDOR',
  BINARY_PARSE_FAILED: 'FID_BINARY_PARSE_FAILED',
  PHASE_FAILED: 'FID_PHASE_CORRECTION_FAILED',
  AXIS_UNCERTAIN: 'FID_AXIS_UNCERTAIN',
  FLAT_SIGNAL: 'FID_FLAT_SIGNAL',
  VERCEL_BLOCKED: 'FID_LOCAL_ONLY',
  PRODUCTION_CONFIG_MISSING: 'FID_PRODUCTION_CONFIG_MISSING',
  MISSING_INPUT: 'FID_MISSING_INPUT',
  LOAD_FAILED: 'FID_LOAD_FAILED',
  UNKNOWN_VENDOR: 'FID_UNKNOWN_VENDOR',
  UNKNOWN_DATASET: 'FID_UNKNOWN_DATASET',
  API_INTERNAL: 'FID_API_INTERNAL',
} as const;

export type FidErrorCode = (typeof FidErrorCodes)[keyof typeof FidErrorCodes];

const HINTS: Partial<Record<FidErrorCode, string>> = {
  [FidErrorCodes.RAW_FILE_NOT_FOUND]:
    'Klasörde "fid" veya "ser" (Bruker) ham veri dosyası yok. Üst klasörü seçtiğinizden emin olun.',
  [FidErrorCodes.EMPTY_SPECTRUM]:
    'İşleme tamamlandı ancak spektrum noktası üretilmedi. Dosya bozuk veya yanlış format olabilir.',
  [FidErrorCodes.PYTHON_NMRGLUE]:
    'Yerel ortamda pip install nmrglue (venv_rdkit) çalıştırın.',
  [FidErrorCodes.PYTHON_NUMPY]:
    'Yerel ortamda pip install numpy çalıştırın.',
  [FidErrorCodes.PYTHON_SCIPY]:
    'Yerel ortamda pip install scipy (venv_rdkit) çalıştırın.',
  [FidErrorCodes.VERCEL_BLOCKED]:
    'FID işleme yalnızca yerel npm run dev ile çalışır.',
  [FidErrorCodes.PRODUCTION_CONFIG_MISSING]:
    'Production FID processor URL yapılandırılmamış. FID_PROCESSOR_URL env değişkenini tanımlayın.',
  [FidErrorCodes.UNSUPPORTED_VENDOR]:
    'Bu vendor formatı henüz desteklenmiyor (JEOL/JDF şu an üretim dışı).',
  [FidErrorCodes.BINARY_PARSE_FAILED]:
    'Ham binary veri okunamadı. Dosya bozuk veya beklenmeyen formatta olabilir.',
  [FidErrorCodes.PHASE_FAILED]:
    'Otomatik faz düzeltmesi başarısız; manuel ph0/ph1 deneyin.',
  [FidErrorCodes.AXIS_UNCERTAIN]:
    'PPM ekseni güvenilir değil; referans kalibrasyonu kontrol edilmeli.',
  [FidErrorCodes.FLAT_SIGNAL]:
    'İşlenmiş spektrumda anlamlı sinyal tespit edilemedi.',
  [FidErrorCodes.UNKNOWN_DATASET]:
    'Veri seti formatı belirlenemedi; klasör yapısını kontrol edin.',
};

export function hintForCode(code: FidErrorCode | string | undefined): string | undefined {
  if (!code) return undefined;
  return HINTS[code as FidErrorCode];
}

export function inferErrorCodeFromPython(stderr: string, stdout: string): FidErrorCode | undefined {
  const s = `${stderr}\n${stdout}`;
  if (s.includes('NMRGLUE_NOT_INSTALLED') || s.includes("No module named 'nmrglue'")) {
    return FidErrorCodes.PYTHON_NMRGLUE;
  }
  if (s.includes('SCIPY_NOT_INSTALLED') || s.includes("No module named 'scipy'")) {
    return FidErrorCodes.PYTHON_SCIPY;
  }
  if (s.includes('NUMPY_NOT_INSTALLED') || s.includes("No module named 'numpy'")) {
    return FidErrorCodes.PYTHON_NUMPY;
  }
  if (s.includes('LOAD_FAILED')) return FidErrorCodes.LOAD_FAILED;
  if (s.includes('DATASET_NOT_FOUND')) return FidErrorCodes.DATASET_NOT_FOUND;
  if (s.includes('UNSUPPORTED_2D_EXPERIMENT')) return FidErrorCodes.UNSUPPORTED_2D;
  if (s.includes('UNSUPPORTED_VENDOR')) return FidErrorCodes.UNSUPPORTED_VENDOR;
  if (s.includes('BINARY_PARSE_FAILED')) return FidErrorCodes.BINARY_PARSE_FAILED;
  if (s.includes('UNKNOWN_DATASET')) return FidErrorCodes.UNKNOWN_DATASET;
  if (s.includes('INVALID_PHASE_ARGS')) return FidErrorCodes.MISSING_INPUT;
  if (s.includes('FID_NOT_FOUND') || s.includes('RAW_NOT_FOUND')) {
    return FidErrorCodes.RAW_FILE_NOT_FOUND;
  }
  return undefined;
}
