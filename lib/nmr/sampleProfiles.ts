/**
 * Örnek profilleri: diyamanyetik standart, paramanyetik, metal kompleks ve geniş polimer
 * spektrumları için ppm ekseni ve QC toleransları.
 *
 * `validatePpmAxisWithProfile`, sabit kodlanmış ppm penceresi / span kontrollerinin
 * (ör. fid işlemede -5…25 ppm ve max span) profil tabanlı karşılığıdır.
 */

/** Minimum kabul edilebilir eksen genişliği (ppm); çok dar eksen muhtemelen hatalı ölçek. */
const MIN_PPM_SPAN = 0.01;

/**
 * Tek bir örnek türü için NMR işleme ve QC parametreleri.
 */
export interface SampleProfile {
  id: string;
  label: string;
  description: string;
  ppmPlausibleMin: number;
  ppmPlausibleMax: number;
  ppmMaxSpan: number;
  /** Geniş / örtüşen pikler için gevşek tepe eşleme veya raporlama (ppm ekseni doğrulamasında kullanılmaz). */
  broadPeakTolerance: boolean;
  /** Faz düzeltmesi kalite eşiklerini gevşet (ppm ekseni doğrulamasında kullanılmaz). */
  relaxedPhaseQuality: boolean;
  warningClass: 'standard' | 'paramagnetic' | 'metal_complex' | 'polymer';
}

/** Standart küçük molekül ¹H: tipik kimyasal kayma penceresi ve dar spektrum genişliği. */
export const DIAMAGNETIC_DEFAULT: SampleProfile = {
  id: 'diamagnetic_default',
  label: 'Diyamanyetik (varsayılan)',
  description:
    'Küçük molekül ¹H NMR için tipik ppm penceresi; standart faz ve pik genişliği beklentisi.',
  ppmPlausibleMin: -5,
  ppmPlausibleMax: 25,
  ppmMaxSpan: 60,
  broadPeakTolerance: false,
  relaxedPhaseQuality: false,
  warningClass: 'standard',
};

/** Paramanyetik örnekler: geniş kayma ve spektral genişlik. */
export const PARAMAGNETIC: SampleProfile = {
  id: 'paramagnetic',
  label: 'Paramanyetik',
  description:
    'Paramanyetik kaymalara izin veren geniş ppm penceresi; geniş pikler ve gevşek faz QC.',
  ppmPlausibleMin: -100,
  ppmPlausibleMax: 300,
  ppmMaxSpan: 500,
  broadPeakTolerance: true,
  relaxedPhaseQuality: true,
  warningClass: 'paramagnetic',
};

/** Metal kompleksleri: orta–geniş kayma aralığı. */
export const METAL_COMPLEX: SampleProfile = {
  id: 'metal_complex',
  label: 'Metal kompleksi',
  description:
    'Geçiş metali veya lantanit kompleksleri için genişletilmiş pencere; faz QC gevşetilir.',
  ppmPlausibleMin: -50,
  ppmPlausibleMax: 200,
  ppmMaxSpan: 350,
  broadPeakTolerance: false,
  relaxedPhaseQuality: true,
  warningClass: 'metal_complex',
};

/** Polimer / çok geniş hatlar: kimyasal kayma penceresi dar, geniş pik toleransı açık. */
export const POLYMER_BROAD: SampleProfile = {
  id: 'polymer_broad',
  label: 'Polimer (geniş)',
  description:
    '¹H penceresi standart kalır; son derece geniş hatlar için broadPeakTolerance açık.',
  ppmPlausibleMin: -5,
  ppmPlausibleMax: 25,
  ppmMaxSpan: 60,
  broadPeakTolerance: true,
  relaxedPhaseQuality: false,
  warningClass: 'polymer',
};

/** Tüm yerleşik profiller (kimlik → profil). */
export const BUILTIN_PROFILES: Readonly<Record<string, SampleProfile>> = {
  [DIAMAGNETIC_DEFAULT.id]: DIAMAGNETIC_DEFAULT,
  [PARAMAGNETIC.id]: PARAMAGNETIC,
  [METAL_COMPLEX.id]: METAL_COMPLEX,
  [POLYMER_BROAD.id]: POLYMER_BROAD,
};

/** Yerleşik profil kimlikleri (sıra sabit değildir; yineleme için). */
export const BUILTIN_PROFILE_IDS: readonly string[] = Object.keys(BUILTIN_PROFILES);

/**
 * Profil kimliğine göre yerleşik profili döndürür.
 *
 * @param id - Örn. `diamagnetic_default`, `paramagnetic`
 * @returns Eşleşen `SampleProfile`
 * @throws Bilinmeyen `id` için hata
 */
export function getProfileById(id: string): SampleProfile {
  const p = BUILTIN_PROFILES[id];
  if (!p) {
    throw new Error(`Unknown sample profile id: "${id}"`);
  }
  return p;
}

/**
 * Profil tabanlı ppm ekseni doğrulama sonucu.
 *
 * `broadPeakTolerance` ve `relaxedPhaseQuality` alanları raporlanır; ppm matematiği
 * yalnızca `ppmPlausibleMin` / `ppmPlausibleMax` / `ppmMaxSpan` ile yapılır.
 */
export interface PpmAxisProfileValidation {
  /** Gözlemlenen aralık profille uyumlu ve span kuralları sağlanıyorsa true. */
  plausible: boolean;
  /** Girdi dizisindeki sonlu değerlerin minimumu. */
  observedMin: number;
  /** Girdi dizisindeki sonlu değerlerin maksimumu. */
  observedMax: number;
  /** \|max − min\| (ters monoton eksenlerde de doğru genişlik). */
  span: number;
  /** [observedMin, observedMax] ile [ppmPlausibleMin, ppmPlausibleMax] aralıklarının kesişimi boş değil. */
  overlapsPlausibleWindow: boolean;
  /** span ≤ ppmMaxSpan ve span ≥ iç eşik (MIN_PPM_SPAN). */
  spanAcceptable: boolean;
  /** İnsan okunur gerekçeler veya uyarılar. */
  messages: string[];
  /** Kullanılan profilin kimliği. */
  profileId: string;
}

function finitePpmValues(ppm: number[]): number[] {
  return ppm.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Verilen ppm eksen dizisini profile göre doğrular.
 *
 * Mantık, tipik ¹H işlemedeki sabit kontrollerin genelleştirilmiş halidir:
 * - Boş veya tümü gayri sonlu → implausible
 * - Gözlemlenen aralık, profilin plausibilite penceresi ile kesişmiyorsa implausible
 * - Span çok geniş veya çok darsa implausible
 *
 * @param ppm - Eksen örnekleri (ppm); sıra monoton olmak zorunda değil
 * @param profile - `SampleProfile`
 */
export function validatePpmAxisWithProfile(
  ppm: number[],
  profile: SampleProfile
): PpmAxisProfileValidation {
  const messages: string[] = [];
  const values = finitePpmValues(ppm);

  if (values.length === 0) {
    messages.push('empty_or_non_finite_ppm');
    return {
      plausible: false,
      observedMin: Number.NaN,
      observedMax: Number.NaN,
      span: Number.NaN,
      overlapsPlausibleWindow: false,
      spanAcceptable: false,
      messages,
      profileId: profile.id,
    };
  }

  const observedMin = Math.min(...values);
  const observedMax = Math.max(...values);
  const span = Math.abs(observedMax - observedMin);

  const { ppmPlausibleMin, ppmPlausibleMax, ppmMaxSpan } = profile;

  const overlapsPlausibleWindow = !(
    observedMin > ppmPlausibleMax || observedMax < ppmPlausibleMin
  );

  if (!overlapsPlausibleWindow) {
    messages.push(
      `ppm_window_no_overlap: observed=[${observedMin.toFixed(2)}, ${observedMax.toFixed(
        2
      )}] plausible=[${ppmPlausibleMin}, ${ppmPlausibleMax}]`
    );
  }

  let spanAcceptable = true;
  if (span > ppmMaxSpan) {
    spanAcceptable = false;
    messages.push(`ppm_span_too_wide: ${span.toFixed(2)} ppm (max ${ppmMaxSpan})`);
  }
  if (span < MIN_PPM_SPAN) {
    spanAcceptable = false;
    messages.push(`ppm_span_too_narrow: ${span.toFixed(6)} ppm`);
  }

  const plausible = overlapsPlausibleWindow && spanAcceptable;

  if (plausible) {
    messages.push('ok');
  }

  return {
    plausible,
    observedMin,
    observedMax,
    span,
    overlapsPlausibleWindow,
    spanAcceptable,
    messages,
    profileId: profile.id,
  };
}
