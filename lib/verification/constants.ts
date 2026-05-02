/**
 * Deterministic root-cause codes for verification (GLOBAL_PARSE / teyit raporu).
 * Tüm parse fail ve kural ihlallerinde bu kodlardan biri kullanılır.
 */
export const ROOT_CAUSE_CODES = {
  PARSER_FAIL_VALENCE_ERROR: 'PARSER_FAIL:VALENCE_ERROR',
  PARSER_FAIL_STEREO_CONFLICT: 'PARSER_FAIL:STEREO_CONFLICT',
  PARSER_FAIL_INVALID_SMILES: 'PARSER_FAIL:INVALID_SMILES',
  PARSER_FAIL_SANITIZE: 'PARSER_FAIL:SANITIZE',
  PARSER_FAIL_UNSUPPORTED_ATOM: 'PARSER_FAIL:UNSUPPORTED_ATOM',
  RULE_VIOLATION_FRAGMENT_NOT_IN_LIBRARY: 'RULE_VIOLATION:FRAGMENT_NOT_IN_LIBRARY',
  RULE_VIOLATION_DBE_NEGATIVE: 'RULE_VIOLATION:DBE_NEGATIVE',
  RULE_VIOLATION_FORMULA_MISMATCH: 'RULE_VIOLATION:FORMULA_MISMATCH',
  RULE_VIOLATION_C13_AROMATIC_BAND: 'RULE_VIOLATION:C13_AROMATIC_BAND_SANITY',
  RULE_VIOLATION_HSQC_NO_PEAKS: 'RULE_VIOLATION:HSQC_NO_PEAKS_WHEN_EXPECTED',
  NOT_PROVIDED: 'NOT_PROVIDED',
  NOT_EXPECTED_FOR_CONTEXT: 'NOT_EXPECTED_FOR_CONTEXT',
} as const;

export type RootCauseCode = typeof ROOT_CAUSE_CODES[keyof typeof ROOT_CAUSE_CODES];

/** Önerilen aksiyon: root_cause koduna göre kullanıcıya gösterilecek metin */
export const ROOT_CAUSE_RECOMMENDED_ACTIONS: Record<string, string> = {
  [ROOT_CAUSE_CODES.PARSER_FAIL_VALENCE_ERROR]: 'SMILES valans ve bağ sayısını kontrol edin; geçersiz element veya yanlış parantez kullanımı olabilir.',
  [ROOT_CAUSE_CODES.PARSER_FAIL_STEREO_CONFLICT]: 'Stereokimya (@ / @@) tutarlılığını kontrol edin.',
  [ROOT_CAUSE_CODES.PARSER_FAIL_INVALID_SMILES]: 'SMILES sözdizimini ve geçerliliğini kontrol edin; RDKit parse için standart notasyon kullanın.',
  [ROOT_CAUSE_CODES.PARSER_FAIL_SANITIZE]: 'Molekül sanitize hatası; yapıyı (aromliklik, charge, H) düzeltin.',
  [ROOT_CAUSE_CODES.PARSER_FAIL_UNSUPPORTED_ATOM]: 'Desteklenmeyen atom veya özel notasyon; sadece C,H,N,O,S,P,F,Cl,Br,I,B,Si kullanın.',
  [ROOT_CAUSE_CODES.RULE_VIOLATION_FRAGMENT_NOT_IN_LIBRARY]: 'Eksik kütüphane girdisi; fragment veya solvent kataloğuna ekleyin.',
  [ROOT_CAUSE_CODES.RULE_VIOLATION_DBE_NEGATIVE]: 'Formül ve SMILES tutarlılığını kontrol edin; DBE negatif olamaz.',
  [ROOT_CAUSE_CODES.RULE_VIOLATION_FORMULA_MISMATCH]: 'Formül sayımı ile yapı uyuşmuyor; canonical SMILES ve formülü doğrulayın.',
  [ROOT_CAUSE_CODES.RULE_VIOLATION_C13_AROMATIC_BAND]: '13C üretici ayarlarını veya aromatik bölge atamasını kontrol edin.',
  [ROOT_CAUSE_CODES.RULE_VIOLATION_HSQC_NO_PEAKS]: 'HSQC verisi girin veya protonlu karbon sayısını doğrulayın.',
  [ROOT_CAUSE_CODES.NOT_PROVIDED]: 'İlgili veri sağlanmadı.',
  [ROOT_CAUSE_CODES.NOT_EXPECTED_FOR_CONTEXT]: 'Bu bağlamda beklenen bir kontrole rastlanmadı.',
};
