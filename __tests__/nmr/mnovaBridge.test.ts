import { describe, expect, it } from 'vitest';
import { mapSpectroMindXToMnovaX } from '@/lib/nmr/mnovaBridge';

describe('mnova diagnostic bridge (temporary)', () => {
  it('maps -0.716 to 8.750 anchor', () => {
    expect(mapSpectroMindXToMnovaX(-0.716)).toBeCloseTo(8.75, 6);
  });

  it('maps 7.141 to 0.800 anchor', () => {
    expect(mapSpectroMindXToMnovaX(7.141)).toBeCloseTo(0.8, 6);
  });
});

