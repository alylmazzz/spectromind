/**
 * Tek otorite integral parsing (0.1).
 * "2H" → 2, "0.634" → 0.634, "0,634" → 0.634, null/"" → 0.
 * replace(/\D/g,"") KULLANMA — ondalık noktayı siler.
 */
export declare function parseIntegralValue(raw: unknown): number;
export type IntegralMode = 'absolute_h' | 'relative_area' | 'unknown';
/**
 * Değerlerin çoğu < 1.2 ise relative_area; çoğu tamsayıya yakınsa absolute_h.
 */
export declare function detectIntegralMode(integralValues: number[], _expectedNonexchangeableH?: number): IntegralMode;
