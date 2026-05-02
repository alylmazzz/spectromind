import { describe, it, expect } from 'vitest';
import { computeIsotopeEnvelope, scoreIsotopeMatch } from '../lib/ms/isotope-engine';

describe('Isotope Engine', () => {
  it('computes methane isotope envelope', () => {
    const result = computeIsotopeEnvelope({ C: 1, H: 4 });
    expect(result.peaks.length).toBeGreaterThanOrEqual(1);
    expect(result.monoisotopicMass).toBeCloseTo(16.031, 2);
    expect(result.peaks[0].relativeIntensity).toBe(1);
  });

  it('computes benzene (C6H6) with M+1 ~ 6.6%', () => {
    const result = computeIsotopeEnvelope({ C: 6, H: 6 });
    expect(result.peaks.length).toBeGreaterThanOrEqual(2);
    const m1 = result.peaks.find(p => p.label === 'M+1');
    expect(m1).toBeDefined();
    expect(m1!.relativeIntensity).toBeGreaterThan(0.04);
    expect(m1!.relativeIntensity).toBeLessThan(0.15);
  });

  it('computes chlorobenzene with M+2 ~33%', () => {
    const result = computeIsotopeEnvelope({ C: 6, H: 5, Cl: 1 });
    expect(result.peaks.length).toBeGreaterThanOrEqual(2);
    const m2 = result.peaks.find(p => p.label === 'M+2');
    expect(m2).toBeDefined();
    expect(m2!.relativeIntensity).toBeGreaterThan(0.2);
    expect(m2!.relativeIntensity).toBeLessThan(0.5);
  });

  it('computes bromobenzene with M+2 ~97%', () => {
    const result = computeIsotopeEnvelope({ C: 6, H: 5, Br: 1 });
    const m2 = result.peaks.find(p => p.label === 'M+2');
    expect(m2).toBeDefined();
    expect(m2!.relativeIntensity).toBeGreaterThan(0.8);
  });

  it('scores isotope match correctly for good fit', () => {
    const envelope = computeIsotopeEnvelope({ C: 6, H: 6 });
    const observed = envelope.peaks.map(p => ({
      mz: p.mass,
      intensity: p.relativeIntensity * 100,
    }));
    const score = scoreIsotopeMatch(envelope, observed, 0.5);
    expect(score.score).toBeGreaterThan(70);
    expect(score.verdict).toBe('consistent');
  });

  it('scores isotope match poorly for bad fit', () => {
    const envelope = computeIsotopeEnvelope({ C: 6, H: 6 });
    const observed = [
      { mz: envelope.peaks[0].mass, intensity: 100 },
      { mz: envelope.peaks[0].mass + 1, intensity: 80 },
    ];
    const score = scoreIsotopeMatch(envelope, observed, 0.5);
    expect(score.score).toBeLessThan(70);
  });

  it('handles empty formula', () => {
    const result = computeIsotopeEnvelope({});
    expect(result.peaks.length).toBeGreaterThanOrEqual(1);
    expect(result.monoisotopicMass).toBe(0);
  });
});
