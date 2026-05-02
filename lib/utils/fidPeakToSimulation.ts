import type { NMRPeak } from '@/lib/types';

/** ¹H profesyonel tam pencere: MestReNova ile uyumlu (yüksek ppm solda). */
export const H1_SIMULATION_PPM_DOMAIN = { min: -2, max: 14 } as const;

/**
 * FID işleme `peak_list` / `observed_spectrum.peaks` girdisini,
 * ana NMR grafiğinde Lorentzian toplamı ile çizilecek `NMRPeak[]` yapar.
 * Genlik oranları `intensity` (height) ile korunur; yoksa `area` ile kaba ölçeklenir.
 */
export function fidPickedPeaksToNmrSimulationPeaks(
  picks: ReadonlyArray<{
    position: number;
    intensity?: number;
    area?: number;
    linewidth_estimate?: number;
    confidence?: number;
    region_id?: string;
    overlap_flag?: boolean;
    fit_residual?: number;
    shape_model?: string;
  }>
): NMRPeak[] {
  const valid = picks.filter(
    (p) => Number.isFinite(p.position) && p.position >= H1_SIMULATION_PPM_DOMAIN.min - 1 && p.position <= H1_SIMULATION_PPM_DOMAIN.max + 1
  );
  if (valid.length === 0) return [];

  const maxI = Math.max(
    ...valid.map((p) => (p.intensity != null && p.intensity > 0 ? p.intensity : (p.area ?? 0) / 20)),
    1e-12
  );

  return valid
    .map((p) => {
      const hasH = p.intensity != null && Number.isFinite(p.intensity) && p.intensity > 0;
      const h = hasH ? p.intensity! : Math.max((p.area ?? 0) / 20, maxI * 1e-4);

      const relH = h / maxI;
      const gammaFromWidth =
        p.linewidth_estimate != null && Number.isFinite(p.linewidth_estimate)
          ? Math.max(0.006, Math.min(0.06, Number(p.linewidth_estimate)))
          : undefined;
      const gamma =
        gammaFromWidth ??
        (relH > 0.3 ? 0.012 : relH > 0.05 ? 0.018 : 0.025);

      return {
        shift: p.position,
        integ: 1,
        mult: 'm',
        fidPickIntensity: h,
        fidPickArea: p.area,
        fidRegionId: p.region_id,
        fidOverlapFlag: Boolean(p.overlap_flag),
        fidLinewidthEstimate: p.linewidth_estimate,
        fidShapeModel: p.shape_model,
        fidFitResidual: p.fit_residual,
        fidConfidence: p.confidence,
        lorentzianGammaPpm: gamma,
        hideChartLabel: true,
        label: `FID δ${p.position.toFixed(3)}`,
      } satisfies NMRPeak;
    })
    .sort((a, b) => a.shift - b.shift);
}
