import { describe, it, expect } from 'vitest';
import { fidPickedPeaksToNmrSimulationPeaks, H1_SIMULATION_PPM_DOMAIN } from '@/lib/utils/fidPeakToSimulation';
import { generateNMRSpectrumData, lorentzianNormalized } from '@/lib/utils/spectrumGenerator';
import { H1_DEFAULT_X_DOMAIN, H1_PRO_FIRST_VIEW_PPM } from '@/lib/nmr/nmrChartScaling';

const USER_PEAK_LIST = [
  { ppm: 1.2476, height: 6.719819, area: 98.684799 },
  { ppm: 0.6599, height: 6.715783, area: 106.743895 },
  { ppm: 1.2943, height: 2.073854, area: 31.277318 },
  { ppm: 1.2994, height: 0.551074, area: 7.724717 },
  { ppm: 1.3206, height: 0.288679, area: 4.479168 },
  { ppm: 1.1725, height: 0.235566, area: 3.694586 },
  { ppm: 1.2621, height: 0.223139, area: 3.470637 },
  { ppm: 1.3667, height: 0.101922, area: 1.575572 },
];

function apiPeakFormat(p: { ppm: number; height: number; area: number }) {
  return { position: p.ppm, intensity: p.height, area: p.area };
}

describe('Observed/Simulated X-axis contract', () => {
  it('simulation ppm domain covers full 1H range -2..14', () => {
    expect(H1_SIMULATION_PPM_DOMAIN.min).toBeLessThanOrEqual(-2);
    expect(H1_SIMULATION_PPM_DOMAIN.max).toBeGreaterThanOrEqual(14);
  });

  it('chart default domain is 0..14 (consistent with NMR convention)', () => {
    expect(H1_DEFAULT_X_DOMAIN.min).toBe(0);
    expect(H1_DEFAULT_X_DOMAIN.max).toBe(14);
  });

  it('first-view preset is [14, -1] meaning high ppm left', () => {
    expect(H1_PRO_FIRST_VIEW_PPM[0]).toBe(14);
    expect(H1_PRO_FIRST_VIEW_PPM[1]).toBe(-1);
  });
});

describe('FID peak simulation alignment with user data', () => {
  const simPeaks = fidPickedPeaksToNmrSimulationPeaks(USER_PEAK_LIST.map(apiPeakFormat));

  it('preserves peak ppm positions exactly', () => {
    const simPositions = simPeaks.map((p) => p.shift);
    for (const src of USER_PEAK_LIST) {
      const found = simPositions.find((s) => Math.abs(s - src.ppm) < 1e-6);
      expect(found, `Peak at ${src.ppm} ppm should exist in simulation`).toBeDefined();
    }
  });

  it('preserves relative intensity ordering', () => {
    const p1 = simPeaks.find((p) => Math.abs(p.shift - 1.2476) < 0.001);
    const p2 = simPeaks.find((p) => Math.abs(p.shift - 1.3667) < 0.001);
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1!.fidPickIntensity!).toBeGreaterThan(p2!.fidPickIntensity!);
  });

  it('uses gamma wide enough to be visible at graph resolution', () => {
    for (const p of simPeaks) {
      expect(p.lorentzianGammaPpm).toBeGreaterThanOrEqual(0.01);
    }
  });
});

describe('Lorentzian simulation produces visible peaks at correct positions', () => {
  const simPeaks = fidPickedPeaksToNmrSimulationPeaks(USER_PEAK_LIST.map(apiPeakFormat));
  const spectrumData = generateNMRSpectrumData(simPeaks);

  it('spectrum covers -2 to 14 ppm', () => {
    expect(spectrumData[0].x).toBeLessThanOrEqual(-1.9);
    expect(spectrumData[spectrumData.length - 1].x).toBeGreaterThanOrEqual(13.9);
  });

  it('peaks near 1.25 ppm produce visible intensity', () => {
    const nearPeak = spectrumData.filter((p) => p.x >= 1.20 && p.x <= 1.30);
    const maxY = Math.max(...nearPeak.map((p) => p.y));
    expect(maxY).toBeGreaterThan(0.1);
  });

  it('peaks near 0.66 ppm produce visible intensity', () => {
    const nearPeak = spectrumData.filter((p) => p.x >= 0.60 && p.x <= 0.70);
    const maxY = Math.max(...nearPeak.map((p) => p.y));
    expect(maxY).toBeGreaterThan(0.1);
  });

  it('no false peak compression - peaks are not all squeezed into < 1 ppm width', () => {
    const significantPoints = spectrumData.filter((p) => p.y > 0.01);
    const ppmValues = significantPoints.map((p) => p.x);
    const span = Math.max(...ppmValues) - Math.min(...ppmValues);
    expect(span).toBeGreaterThan(0.3);
  });

  it('baseline is near zero outside peak regions', () => {
    const farFromPeaks = spectrumData.filter((p) => p.x >= 5 && p.x <= 10);
    const maxBaseline = Math.max(...farFromPeaks.map((p) => p.y));
    const peakMax = Math.max(...spectrumData.map((p) => p.y));
    expect(maxBaseline / peakMax).toBeLessThan(0.01);
  });
});

describe('No double-reversal bug', () => {
  it('simulation data is in ascending ppm order', () => {
    const simPeaks = fidPickedPeaksToNmrSimulationPeaks(USER_PEAK_LIST.map(apiPeakFormat));
    const data = generateNMRSpectrumData(simPeaks);
    for (let i = 1; i < data.length; i++) {
      expect(data[i].x).toBeGreaterThan(data[i - 1].x);
    }
  });
});
