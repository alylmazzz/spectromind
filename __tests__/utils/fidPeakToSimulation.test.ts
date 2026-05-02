import { describe, it, expect } from 'vitest';
import { fidPickedPeaksToNmrSimulationPeaks } from '@/lib/utils/fidPeakToSimulation';
import { generateNMRSpectrumData, lorentzianNormalized } from '@/lib/utils/spectrumGenerator';

describe('lorentzianNormalized', () => {
  it('is 1 at center', () => {
    expect(lorentzianNormalized(0, 0.01)).toBeCloseTo(1, 5);
  });

  it('decays away from center', () => {
    expect(lorentzianNormalized(0.05, 0.01)).toBeLessThan(0.1);
  });
});

describe('fidPickedPeaksToNmrSimulationPeaks', () => {
  it('maps API picks with intensity', () => {
    const out = fidPickedPeaksToNmrSimulationPeaks([
      { position: 2.05, intensity: 10, area: 100 },
      { position: 1.25, intensity: 3, area: 40 },
    ]);
    expect(out.length).toBe(2);
    expect(out[0].shift).toBeCloseTo(1.25, 4);
    expect(out[1].shift).toBeCloseTo(2.05, 4);
    expect(out[0].fidPickIntensity).toBe(3);
    expect(out[1].fidPickIntensity).toBe(10);
    expect(out.every((p) => p.hideChartLabel)).toBe(true);
  });

  it('propagates region/deconvolution metadata and linewidth', () => {
    const out = fidPickedPeaksToNmrSimulationPeaks([
      {
        position: 7.12,
        intensity: 12,
        area: 80,
        linewidth_estimate: 0.028,
        confidence: 0.77,
        region_id: 'R2',
        overlap_flag: true,
        fit_residual: 0.15,
        shape_model: 'lorentzian',
      },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].fidRegionId).toBe('R2');
    expect(out[0].fidOverlapFlag).toBe(true);
    expect(out[0].fidLinewidthEstimate).toBeCloseTo(0.028, 6);
    expect(out[0].lorentzianGammaPpm).toBeCloseTo(0.028, 6);
    expect(out[0].fidShapeModel).toBe('lorentzian');
  });
});

describe('generateNMRSpectrumData', () => {
  it('covers MestReNova-like ppm window -2..14', () => {
    const pts = generateNMRSpectrumData([
      { shift: 7.26, integ: 1, mult: 's', fidPickIntensity: 1, lorentzianGammaPpm: 0.004 },
    ]);
    expect(pts[0].x).toBeLessThanOrEqual(-1.9);
    expect(pts[pts.length - 1].x).toBeGreaterThanOrEqual(13.9);
    const maxPt = pts.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(maxPt.x - 7.26)).toBeLessThan(0.02);
  });

  it('uses fidPickIntensity for relative heights', () => {
    const pts = generateNMRSpectrumData([
      { shift: 2.0, integ: 1, mult: 's', fidPickIntensity: 100, lorentzianGammaPpm: 0.003 },
      { shift: 1.0, integ: 1, mult: 's', fidPickIntensity: 10, lorentzianGammaPpm: 0.003 },
    ]);
    const y2 = pts.find((p) => Math.abs(p.x - 2.0) < 0.01)?.y ?? 0;
    const y1 = pts.find((p) => Math.abs(p.x - 1.0) < 0.01)?.y ?? 0;
    expect(y2).toBeGreaterThan(y1 * 5);
  });
});
