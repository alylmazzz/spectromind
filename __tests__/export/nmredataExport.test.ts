import { describe, it, expect } from 'vitest';
import { exportToNmredata } from '@/lib/export/nmredataExport';

describe('exportToNmredata', () => {
  it('produces valid SDF envelope', () => {
    const sdf = exportToNmredata([
      { shift: 7.26, intensity: 1.0, multiplicity: 's' },
      { shift: 2.10, intensity: 0.5, multiplicity: 't', integration: 3 },
    ], { compoundName: 'TestMol', solvent: 'CDCl3' });

    expect(sdf).toContain('$$$$');
    expect(sdf).toContain('V2000');
    expect(sdf).toContain('SPECTROMIND_NMREDATA_META');
    expect(sdf).toContain('nuclide=1H');
    expect(sdf).toContain('peak_count=2');
    expect(sdf).toContain('shift_ppm=7.26');
    expect(sdf).toContain('solvent=CDCl3');
  });

  it('handles empty peak list', () => {
    const sdf = exportToNmredata([], {});
    expect(sdf).toContain('$$$$');
    expect(sdf).toContain('peak_count=0');
  });

  it('uses custom field name', () => {
    const sdf = exportToNmredata(
      [{ shift: 1.0 }],
      {},
      { peakListFieldName: 'MY_PEAKS' }
    );
    expect(sdf).toContain('> <MY_PEAKS>');
  });
});
