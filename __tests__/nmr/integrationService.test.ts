import { describe, it, expect, beforeEach } from 'vitest';
import { IntegrationService } from '@/lib/nmr/analysis/IntegrationService';

function makeLorentzianSpectrum(n: number, peakIdx: number, width: number): Float64Array {
  const data = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = i - peakIdx;
    data[i] = 1000 / (1 + (x / width) ** 2);
  }
  return data;
}

describe('IntegrationService', () => {
  let service: IntegrationService;
  const swHz = 5000;
  const refFreqHz = 400e6;
  const n = 1024;

  beforeEach(() => {
    service = new IntegrationService();
  });

  it('integrates a region with positive area', () => {
    const spectrum = makeLorentzianSpectrum(n, 512, 10);
    const ppmCenter = ((n / 2 - 512) * swHz) / (refFreqHz * n);
    const region = service.addRegion(ppmCenter - 0.001, ppmCenter + 0.001, spectrum, swHz, refFreqHz);
    expect(region.absoluteIntegral).toBeGreaterThan(0);
    expect(region.correctedIntegral).toBeGreaterThan(0);
  });

  it('bias correction reduces baseline contribution', () => {
    const spectrum = new Float64Array(n);
    for (let i = 0; i < n; i++) spectrum[i] = 100;
    spectrum[512] = 1100;

    const noBias = new IntegrationService({ biasCorrection: false });
    const withBias = new IntegrationService({ biasCorrection: true });

    const ppmCenter = ((n / 2 - 512) * swHz) / (refFreqHz * n);
    const rNoBias = noBias.addRegion(ppmCenter - 0.0005, ppmCenter + 0.0005, spectrum, swHz, refFreqHz);
    const rWithBias = withBias.addRegion(ppmCenter - 0.0005, ppmCenter + 0.0005, spectrum, swHz, refFreqHz);

    expect(rWithBias.correctedIntegral).toBeLessThan(rNoBias.absoluteIntegral);
  });

  it('normalizes to reference region with correct ratio', () => {
    const svc = new IntegrationService({ biasCorrection: false });

    const spectrum = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x1 = i - 200;
      const x2 = i - 800;
      spectrum[i] = 100 / (1 + (x1 / 10) ** 2) + 300 / (1 + (x2 / 10) ** 2);
    }

    const fullRange1Start = -20;
    const fullRange1End = 20;
    const fullRange2Start = -20;
    const fullRange2End = 20;

    const r1 = svc.addRegion(fullRange1Start, fullRange1End, spectrum, swHz, refFreqHz, 'peak1');
    const r2 = svc.addRegion(fullRange2Start, fullRange2End, spectrum, swHz, refFreqHz, 'peak2');

    svc.setReferenceRegion(r1.id, 1);
    const regions = svc.getRegions();
    const ref = regions.find(r => r.id === r1.id)!;
    expect(ref.relativeIntegral).toBeCloseTo(1, 0);
  });

  it('computes running integral', () => {
    const spectrum = makeLorentzianSpectrum(n, 512, 10);
    const ppmCenter = ((n / 2 - 512) * swHz) / (refFreqHz * n);
    const cumulative = service.computeRunningIntegral(spectrum, swHz, refFreqHz, ppmCenter - 0.001, ppmCenter + 0.001);
    expect(cumulative.length).toBeGreaterThan(0);
    expect(cumulative[cumulative.length - 1]).toBeGreaterThan(cumulative[0]);
  });

  it('removes region', () => {
    const spectrum = makeLorentzianSpectrum(n, 512, 10);
    const ppmCenter = ((n / 2 - 512) * swHz) / (refFreqHz * n);
    const region = service.addRegion(ppmCenter - 0.001, ppmCenter + 0.001, spectrum, swHz, refFreqHz);
    expect(service.getRegions()).toHaveLength(1);
    service.removeRegion(region.id);
    expect(service.getRegions()).toHaveLength(0);
  });
});
