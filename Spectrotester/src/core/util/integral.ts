/**
 * Tek otorite integral parsing (0.1).
 * "2H" → 2, "0.634" → 0.634, "0,634" → 0.634, null/"" → 0.
 * replace(/\D/g,"") KULLANMA — ondalık noktayı siler.
 */

export function parseIntegralValue(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  const m = str.match(/^(\d+)[.,]?(\d*)\s*H?$/i);
  if (!m) return Number(str) || 0;
  const frac = (m[2] || '').replace(/,/g, '.');
  return frac ? parseFloat(m[1] + '.' + frac) : parseInt(m[1], 10);
}

export type IntegralMode = 'absolute_h' | 'relative_area' | 'unknown';

/**
 * Değerlerin çoğu < 1.2 ise relative_area; çoğu tamsayıya yakınsa absolute_h.
 */
export function detectIntegralMode(
  integralValues: number[],
  _expectedNonexchangeableH?: number
): IntegralMode {
  const vals = (integralValues || []).filter((v) => typeof v === 'number' && v > 0);
  if (vals.length === 0) return 'unknown';
  const mostlyBelow = vals.filter((v) => v < 1.2).length;
  if (mostlyBelow >= vals.length * 0.7) return 'relative_area';
  const mostlyInteger = vals.filter((v) => Math.abs(v - Math.round(v)) < 0.01).length;
  if (mostlyInteger >= vals.length * 0.7) return 'absolute_h';
  return 'unknown';
}
