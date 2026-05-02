import { NMRPeak, FTIRPeak } from '@/lib/types';
import { H1_SIMULATION_PPM_DOMAIN } from '@/lib/utils/fidPeakToSimulation';

/**
 * Normalleştirilmiş Lorentzian: merkezde 1, kanatlarda 1/(1+(Δ/γ)²).
 * γ = yarım yükseklikteki genişlik (ppm) — NMR’de dar pikler için tipik 0.003–0.01 ppm.
 */
export function lorentzianNormalized(deltaPpm: number, gammaPpm: number): number {
  const g = Math.max(gammaPpm, 1e-9);
  const u = deltaPpm / g;
  return 1 / (1 + u * u);
}

const DEFAULT_RESOLUTION_PPM = 0.005;

/**
 * Pik listesinden ¹H NMR çizgisi (Lorentzian toplamı).
 *
 * PPM aralığı: -2 … 14 (MestReNova tam pencere ile uyumlu).
 * Çizgi genişliği: MestReNova'daki görsel darbe genişliğini taklit eden
 * daha gerçekçi gamma değerleri (tipik 1H NMR: 1-3 Hz ≈ 0.003-0.008 ppm @400 MHz,
 * ama grafik çözünürlüğünde görülebilmesi için minimum ~0.015 ppm kullanılır).
 *
 * `fidPickIntensity` varsa genlik olarak kullanılır (FID pik oranları).
 * Yoksa: `integ * 100` (manuel giriş).
 */
export function generateNMRSpectrumData(peaks: NMRPeak[]): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  const { min: ppmStart, max: ppmEnd } = H1_SIMULATION_PPM_DOMAIN;

  for (let x = ppmStart; x <= ppmEnd; x += DEFAULT_RESOLUTION_PPM) {
    let y = 0;

    for (const peak of peaks) {
      const gamma =
        peak.lorentzianGammaPpm != null && peak.lorentzianGammaPpm > 0
          ? peak.lorentzianGammaPpm
          : peak.isBroad
            ? 0.08
            : 0.018;

      const amplitude =
        peak.fidPickIntensity != null && peak.fidPickIntensity > 0
          ? peak.fidPickIntensity
          : peak.integ * 100;

      y += amplitude * lorentzianNormalized(x - peak.shift, gamma);
    }

    data.push({ x: parseFloat(x.toFixed(5)), y });
  }

  return data;
}

/**
 * Generate FTIR spectrum data points from peaks
 * Uses Lorentzian peak shape for more realistic FTIR peaks
 */
export function generateFTIRSpectrumData(peaks: FTIRPeak[]): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  const startWN = 4000;
  const endWN = 400;
  const resolution = 1800; // Number of points
  const step = (startWN - endWN) / resolution;

  // Generate data points from 4000 to 400 cm⁻¹
  for (let i = 0; i <= resolution; i++) {
    const currentWN = startWN - i * step;
    let transmittance = 100; // Baseline at 100%

    // Subtract peaks using Lorentzian shape
    for (const peak of peaks) {
      if (peak.wavenumber) {
        const center = peak.wavenumber;

        // Get intensity
        let intensity = peak.intensity;
        if (!intensity || intensity === 0) {
          if (peak.type === 'strong') intensity = 85;
          else if (peak.type === 'weak') intensity = 40;
          else intensity = 60; // medium default
        }

        // Width calculation (same as old project: 40-80 cm⁻¹ range)
        const baseWidth = 50;
        const widthMultiplier = intensity / 100;
        const calculatedWidth = baseWidth * (0.8 + widthMultiplier * 0.4); // 40-80 cm⁻¹
        const width = peak.width || calculatedWidth;

        const delta = currentWN - center;
        // Lorentzian shape for FTIR absorption dip
        const drop = (intensity * 0.9) / (1 + Math.pow(delta / (width / 2), 2));

        transmittance -= drop;
      }
    }

    // Deterministic theoretical spectrum: no random noise in core path.
    // For instrument-like synthetic spectra, use a separate seeded generator.
    transmittance = Math.max(0, Math.min(100, transmittance));

    data.push({ x: Math.round(currentWN), y: transmittance });
  }

  return data;
}
