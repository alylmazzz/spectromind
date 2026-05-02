/**
 * v33 — Teorik Spektrum Üretimi ve Teyit Motoru (The Great Correction)
 * Spectrotester V33_CHANGELOG ile uyumlu kural ve sabitler.
 *
 * I)   Q-carbon HSQC maskeleme (generate2D)
 * II)  IR Ar C=C 1500/1580 (generateIR)
 * III) GNN_GUARDRAILS hazırlığı
 * IV)  PPM clamp: EXCHANGEABLE için asit yoksa max 10.5 ppm, asit varsa 13.8
 * V)   Deferred render (HTML tarafında; burada yok)
 */

/** v33 GNN geçiş hazırlığı — ileride GNN entegrasyonu için guardrail parametreleri */
export const GNN_GUARDRAILS = {
  enabled: false,
  minC_for_gnn: 25,
  confidence_threshold: 0.6,
  veto_override: false,
  max_inference_ms: 5000,
} as const;

/** PPM penceresi (anti-hallüsinasyon): değişebilir proton için asit yoksa max 10.5, asit varsa 13.8 */
export const V33_PPM_LIMITS = {
  EXCHANGEABLE_MAX_NO_ACID: 10.5,
  EXCHANGEABLE_MAX_WITH_ACID: 13.8,
  ALDEHYDE_MIN: 9.0,
  ALDEHYDE_MAX: 10.5,
  CARBOXYLIC_MIN: 10.5,
  CARBOXYLIC_MAX: 13.8,
} as const;

/**
 * Asit (COOH) yapıda var mı? SMILES veya gruplardan türetilir.
 */
export function hasAcidInStructure(smiles: string | undefined, groups?: { acid?: number }): boolean {
  if (groups?.acid && groups.acid > 0) return true;
  if (!smiles) return false;
  return /C\(=O\)O[H\[]|COOH/.test(smiles);
}

/**
 * v33 PPM clamp: 1H teorik pik listesinde, asit olmayan yapılarda 10.5 ppm üstü sinyalleri 10.5'e çeker.
 * Glikozid/şeker bağlamında anti-hallüsinasyon (rapor: 13.8/12.8 ppm üretimi engellendi).
 *
 * @param shift - Mevcut kimyasal kayma (ppm)
 * @param isExchangeableOrUnassigned - OH/NH veya belirsiz yüksek ppm olarak işaretlendi mi
 */
export function clampPPMV33(
  shift: number,
  options: {
    smiles?: string;
    groups?: { acid?: number };
    isExchangeableOrHighPPM?: boolean;
  }
): number {
  const hasAcid = hasAcidInStructure(options.smiles, options.groups);
  const maxExch = hasAcid ? V33_PPM_LIMITS.EXCHANGEABLE_MAX_WITH_ACID : V33_PPM_LIMITS.EXCHANGEABLE_MAX_NO_ACID;
  // Sadece değişebilir / yüksek ppm bölgesinde clamp uygula (10.5 üstü)
  if (shift > maxExch && (options.isExchangeableOrHighPPM ?? shift > 10.5)) {
    return Math.min(shift, maxExch);
  }
  return shift;
}

export interface C13PeakLike {
  ppm?: number;
  shift?: number;
  type?: string;
  assignment?: string;
}

export interface HSQCPairLike {
  h: number;
  c?: number | null;
  meta?: { type?: string };
}

/**
 * v33 Q-carbon HSQC maskeleme: Q/Cq karbonlu HSQC çiftleri fiziksel olarak imkansız; üretim aşamasında çıkarılır.
 *
 * @param hsqc - HSQC çiftleri (h, c ppm)
 * @param c13Peaks - 13C pikleri (ppm, type: Q/CQ/CH/CH2/CH3)
 * @param tolerance - ppm eşleşme toleransı
 */
export function filterHSQCQCarbonV33<T extends HSQCPairLike>(
  hsqc: T[],
  c13Peaks: C13PeakLike[],
  tolerance: number = 0.05
): T[] {
  const isQCarbon = (cPpm: number): boolean => {
    const carb = c13Peaks.find(
      (c) => Math.abs((c.ppm ?? c.shift ?? 0) - cPpm) < tolerance
    );
    const t = String(carb?.type ?? '').toUpperCase();
    return !!(carb && (t === 'Q' || t === 'CQ'));
  };

  return hsqc.filter((x) => {
    if (x.c == null) return true;
    if (isQCarbon(x.c)) return false;
    if (x.meta?.type === 'Q') return false;
    return true;
  });
}

/** v33 IR aromatik iskelet bantları: 1450–1600 cm⁻¹ (Ar C=C skeletal/overtone) */
export const V33_IR_AROMATIC_BANDS = [
  { freq: 1500, int: 'Medium', assign: 'Ar C=C skeletal (Ring)' },
  { freq: 1580, int: 'Medium', assign: 'Ar C=C overtone (Ring)' },
] as const;

/**
 * Aromatik halka var mı? (aromaticC >= 6 veya SMILES deseni)
 */
export function hasAromaticRingInStructure(
  aromaticC: number | undefined,
  smiles: string | undefined
): boolean {
  if ((aromaticC ?? 0) >= 6) return true;
  if (!smiles) return false;
  const cleaned = (smiles || '').replace(/\s/g, '');
  return /c1[c,n][c,n][c,n][c,n][c,n]1|n1[c,n][c,n][c,n][c,n]1/.test(cleaned);
}
