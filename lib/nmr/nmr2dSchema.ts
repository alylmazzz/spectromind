/**
 * 2D NMR gözlemlenen veri şeması, deney türü yönlendirmesi ve dosya/ipucu ile 2D tespiti.
 * Saf TypeScript; UI bağımlılığı yok.
 */

/**
 * Desteklenen 2D NMR deney aileleri.
 */
export enum Nmr2dExperimentType {
  COSY = 'COSY',
  HSQC = 'HSQC',
  HMBC = 'HMBC',
  NOESY = 'NOESY',
  ROESY = 'ROESY',
  TOCSY = 'TOCSY',
}

/**
 * İşlenmiş veya içe aktarılmış 2D spektrum gözlemi (kontur / matris).
 */
export interface Nmr2dObservedData {
  experimentType: Nmr2dExperimentType;
  /** F1 (genelde dolaylı boyut) ppm ekseni. */
  f1Ppm: number[];
  /** F2 (genelde doğrudan tespit) ppm ekseni. */
  f2Ppm: number[];
  /** Satırlar F1, sütunlar F2 ile uyumlu yoğunluk matrisi. */
  matrix: number[][];
  f1Nucleus: string;
  f2Nucleus: string;
  metadata: Record<string, unknown>;
  contourLevels?: number[];
  provenance: {
    vendor: string;
    processingSteps: Array<{ step: string; ok: boolean; detail?: string }>;
    debugId: string;
  };
  quality: {
    overallStatus: string;
    f1AxisPlausible: boolean;
    f2AxisPlausible: boolean;
  };
}

/** 2D ile ilişkilendirilebilecek dosya uzantıları (küçük harfe normalize edilerek bakılır). */
const SUSPECT_2D_EXTENSIONS = new Set([
  '.rr',
  '.rsr',
  '.rsc',
  '.seq',
  '.mnova',
  '.nmrpipe',
  '.ft2',
  '.dat',
]);

/** Dosya yolunda veya adında aranan 2D deney ipuçları (küçük harf). */
const RAW_FILE_2D_KEYWORDS = [
  '2d',
  '2_d',
  'cosy',
  'hsqc',
  'hmbc',
  'noesy',
  'roesy',
  'tocsy',
  'hjres',
  'inadeq',
];

/**
 * Boyut veya dosya adlarına göre kabaca 2D deney olup olmadığını tahmin eder.
 *
 * @param dimensionHint - Örn. üst veri "2D", "2", "2D_NMR"
 * @param rawFiles - Ham dosya yolları veya adları
 */
export function is2dExperiment(dimensionHint: string | undefined, rawFiles: string[]): boolean {
  if (dimensionHint !== undefined && dimensionHint.trim() !== '') {
    const d = dimensionHint.trim().toLowerCase();
    if (d === '2' || d === '2d' || d.includes('2d') || d.includes('two-d') || d.includes('twod')) {
      return true;
    }
  }

  for (const path of rawFiles) {
    if (!path || typeof path !== 'string') continue;
    const lower = path.toLowerCase();
    const base = lower.split(/[/\\]/).pop() ?? lower;

    for (const ext of SUSPECT_2D_EXTENSIONS) {
      if (base.endsWith(ext)) return true;
    }
    for (const kw of RAW_FILE_2D_KEYWORDS) {
      if (lower.includes(kw)) return true;
    }
  }

  return false;
}

/**
 * Hangi deney türlerinin en az iskelet (adapter + şema) desteğine sahip olduğu.
 * Diğer türler `route2dExperiment` içinde `supported: false` dönebilir.
 */
export const SUPPORTED_2D_EXPERIMENTS: readonly Nmr2dExperimentType[] = [
  Nmr2dExperimentType.COSY,
  Nmr2dExperimentType.HSQC,
  Nmr2dExperimentType.HMBC,
] as const;

const ADAPTER_BY_TYPE: Partial<Record<Nmr2dExperimentType, string>> = {
  [Nmr2dExperimentType.COSY]: 'spectromind.2d.cosy',
  [Nmr2dExperimentType.HSQC]: 'spectromind.2d.hsqc',
  [Nmr2dExperimentType.HMBC]: 'spectromind.2d.hmbc',
  [Nmr2dExperimentType.NOESY]: 'spectromind.2d.noesy',
  [Nmr2dExperimentType.ROESY]: 'spectromind.2d.roesy',
  [Nmr2dExperimentType.TOCSY]: 'spectromind.2d.tocsy',
};

/**
 * 2D veriyi uygun işleyici adaptöre yönlendirir.
 *
 * @param data - `Nmr2dObservedData`
 * @returns `adapterId` ve `supported` bayrağı; destek yoksa `reason`
 */
export function route2dExperiment(data: Nmr2dObservedData): {
  adapterId: string;
  supported: boolean;
  reason?: string;
} {
  const adapterId = ADAPTER_BY_TYPE[data.experimentType] ?? 'spectromind.2d.unknown';
  const supported = (SUPPORTED_2D_EXPERIMENTS as readonly string[]).includes(data.experimentType);

  if (supported) {
    return { adapterId, supported: true };
  }

  const reasons: Partial<Record<Nmr2dExperimentType, string>> = {
    [Nmr2dExperimentType.NOESY]:
      'NOESY için spektromind.2d iskeleti henüz tam işlenmemiş; yalnızca şema ve yönlendirme kimliği rezerve.',
    [Nmr2dExperimentType.ROESY]:
      'ROESY adaptörü henüz üretim dışı; veri şeması kabul edilir fakat görüntüleme/ayıklama bağlanmadı.',
    [Nmr2dExperimentType.TOCSY]:
      'TOCSY için kontur eşleme ve spin sistemi bağlantıları henüz desteklenmiyor.',
  };

  return {
    adapterId,
    supported: false,
    reason:
      reasons[data.experimentType] ??
      `Deney türü "${data.experimentType}" için iskelet desteği tanımlı değil.`,
  };
}
