import { describe, it, expect } from 'vitest';
import {
  DIAMAGNETIC_DEFAULT,
  PARAMAGNETIC,
  METAL_COMPLEX,
  POLYMER_BROAD,
  getProfileById,
  validatePpmAxisWithProfile,
  BUILTIN_PROFILE_IDS,
} from '@/lib/nmr/sampleProfiles';

describe('getProfileById', () => {
  it('returns diamagnetic_default profile', () => {
    const p = getProfileById('diamagnetic_default');
    expect(p.id).toBe('diamagnetic_default');
    expect(p.ppmPlausibleMin).toBe(-5);
  });

  it('returns paramagnetic profile', () => {
    const p = getProfileById('paramagnetic');
    expect(p.ppmMaxSpan).toBe(500);
  });

  it('throws for unknown id', () => {
    expect(() => getProfileById('nonexistent')).toThrow();
  });
});

describe('BUILTIN_PROFILE_IDS', () => {
  it('has 4 profiles', () => {
    expect(BUILTIN_PROFILE_IDS.length).toBe(4);
  });
});

describe('validatePpmAxisWithProfile', () => {
  it('marks normal 1H range as plausible with diamagnetic profile', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => i * 0.14);
    const result = validatePpmAxisWithProfile(ppm, DIAMAGNETIC_DEFAULT);
    expect(result.plausible).toBe(true);
    expect(result.profileId).toBe('diamagnetic_default');
  });

  it('marks wide paramagnetic range as plausible with paramagnetic profile', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => -80 + i * 3);
    const result = validatePpmAxisWithProfile(ppm, PARAMAGNETIC);
    expect(result.plausible).toBe(true);
  });

  it('marks wide paramagnetic range as implausible with diamagnetic profile', () => {
    const ppm = Array.from({ length: 100 }, (_, i) => -80 + i * 3);
    const result = validatePpmAxisWithProfile(ppm, DIAMAGNETIC_DEFAULT);
    expect(result.plausible).toBe(false);
  });

  it('returns implausible for empty ppm', () => {
    const result = validatePpmAxisWithProfile([], DIAMAGNETIC_DEFAULT);
    expect(result.plausible).toBe(false);
    expect(result.messages).toContain('empty_or_non_finite_ppm');
  });

  it('marks too-narrow span as implausible', () => {
    const result = validatePpmAxisWithProfile([5.0, 5.0001], DIAMAGNETIC_DEFAULT);
    expect(result.plausible).toBe(false);
    expect(result.spanAcceptable).toBe(false);
  });
});
