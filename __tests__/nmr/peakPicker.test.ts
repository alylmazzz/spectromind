import { describe, it, expect } from 'vitest';
import { PeakPicker } from '@/lib/nmr/analysis/PeakPicker';

function makeTestSpectrum(peakPositions: number[], noiseLevel: number, n: number): Float64Array {
  const data = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() - 0.5) * noiseLevel * 2;
  }
  for (const pos of peakPositions) {
    const idx = Math.round(pos);
    if (idx >= 0 && idx < n) {
      const peakHeight = noiseLevel * 20;
      for (let j = -5; j <= 5; j++) {
        const k = idx + j;
        if (k >= 0 && k < n) {
          data[k] += peakHeight * Math.exp(-0.5 * (j / 2) ** 2);
        }
      }
    }
  }
  return data;
}

describe('PeakPicker', () => {
  it('detects peaks above noise threshold', () => {
    const spectrum = makeTestSpectrum([100, 300, 500], 1, 1024);
    const picker = new PeakPicker({ thresholdMultiplier: 3, minSNR: 2, minDistancePoints: 3 });
    const peaks = picker.pick(spectrum, 5000, 400e6);
    expect(peaks.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects peaks below minSNR', () => {
    const spectrum = makeTestSpectrum([512], 100, 1024);
    const picker = new PeakPicker({ thresholdMultiplier: 3, minSNR: 50 });
    const peaks = picker.pick(spectrum, 5000, 400e6);
    expect(peaks.length).toBeLessThanOrEqual(1);
  });

  it('merges nearby peaks within minDistancePoints', () => {
    const spectrum = makeTestSpectrum([500, 502], 1, 1024);
    const picker = new PeakPicker({ minDistancePoints: 5 });
    const peaks = picker.pick(spectrum, 5000, 400e6);
    const nearPeaks = peaks.filter(p => p.index >= 498 && p.index <= 505);
    expect(nearPeaks.length).toBe(1);
  });

  it('flags solvent peaks when configured', () => {
    const spectrum = makeTestSpectrum([512], 1, 1024);
    const expectedPpm = ((1024 / 2 - 512) * 5000) / (400e6 * 1024);
    const picker = new PeakPicker({
      solventPeaksPpm: [expectedPpm],
      solventTolerancePpm: 0.1,
    });
    const peaks = picker.pick(spectrum, 5000, 400e6);
    const solventPeaks = peaks.filter(p => p.isSolvent);
    expect(solventPeaks.length).toBeGreaterThanOrEqual(1);
  });

  it('reports SNR and confidence for each peak', () => {
    const spectrum = makeTestSpectrum([300], 1, 1024);
    const picker = new PeakPicker();
    const peaks = picker.pick(spectrum, 5000, 400e6);
    expect(peaks.length).toBeGreaterThanOrEqual(1);
    for (const p of peaks) {
      expect(p.snr).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(p.confidence);
      expect(typeof p.linewidthHz).toBe('number');
    }
  });
});
