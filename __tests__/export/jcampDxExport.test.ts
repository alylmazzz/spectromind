import { describe, it, expect } from 'vitest';
import { exportToJcampDx } from '@/lib/export/jcampDxExport';

describe('exportToJcampDx', () => {
  it('produces valid JCAMP-DX header and END marker', () => {
    const jdx = exportToJcampDx({
      ppm: [14, 12, 10, 8, 6, 4, 2, 0],
      intensity: [0, 0.1, 0.5, 1.0, 0.3, 0.8, 0.2, 0],
      metadata: { sourceMode: 'observed', nucleus: '1H' },
    });
    expect(jdx).toContain('##JCAMP-DX= 5.01');
    expect(jdx).toContain('##DATA TYPE= NMR SPECTRUM');
    expect(jdx).toContain('##XUNITS= PPM');
    expect(jdx).toContain('##NPOINTS= 8');
    expect(jdx).toContain('##.OBSERVE NUCLEUS= 1H');
    expect(jdx).toContain('##END=');
  });

  it('includes observe frequency when provided', () => {
    const jdx = exportToJcampDx({
      ppm: [10, 5, 0],
      intensity: [1, 2, 3],
      metadata: { sourceMode: 'observed', observeFrequency: 400 },
    });
    expect(jdx).toContain('##OBSERVE FREQUENCY= 400');
  });

  it('handles empty arrays gracefully', () => {
    const jdx = exportToJcampDx({
      ppm: [],
      intensity: [],
      metadata: { sourceMode: 'simulated' },
    });
    expect(jdx).toContain('##NPOINTS= 0');
    expect(jdx).toContain('##END=');
  });

  it('includes solvent when provided', () => {
    const jdx = exportToJcampDx({
      ppm: [1, 2, 3],
      intensity: [0.1, 0.2, 0.3],
      metadata: { sourceMode: 'observed', solvent: 'DMSO-d6' },
    });
    expect(jdx).toContain('##SOLVENT NAME= DMSO-d6');
  });
});
