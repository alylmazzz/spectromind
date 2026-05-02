/**
 * Temporary diagnostic bridge for previously broken SpectroMind x-axis mapping.
 *
 * IMPORTANT:
 * - This is NOT a scientific final solution.
 * - Use only for debugging parity mismatch against Mnova anchors.
 * - Final rendering must consume authoritative ppm_axis_referenced directly.
 */
export function mapSpectroMindXToMnovaX(x: number): number {
  return -1.0118365788 * x + 8.0255250095;
}

