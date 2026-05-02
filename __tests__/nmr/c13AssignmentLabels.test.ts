import { describe, expect, it } from 'vitest';
import { assignCarbon13Peak } from '@/lib/nmr/carbon13/assignment';

describe('c13 assignment labels', () => {
  it('maps pyridine-d5 clusters only when solvent is pyridine-like', () => {
    const py = { solvent: 'Pyridine-d5' };
    expect(assignCarbon13Peak(123.3, py).assignment_label).toMatch(/Pyridine-d5 beta-carbon residual/i);
    expect(assignCarbon13Peak(149.59, py).assignment_label).toMatch(/Pyridine-d5 alpha-carbon residual/i);
    expect(assignCarbon13Peak(135.35, py).assignment_label).toMatch(/Pyridine-d5 gamma-carbon residual/i);
    expect(assignCarbon13Peak(135.7, py).residual_flag).toBe(true);
  });

  it('does not label ~123 ppm as pyridine residual in DMSO (oleanolic olefinic window)', () => {
    const dmso = { solvent: 'DMSO-d6' };
    const a = assignCarbon13Peak(123.3, dmso);
    expect(a.assignment_label).toMatch(/C-12 olefinic CH carbon/i);
    expect(a.residual_flag).toBe(false);
    expect(a.analyte_flag).toBe(true);
  });

  it('maps oleanolic anchors explicitly', () => {
    expect(assignCarbon13Peak(179.93).assignment_label).toMatch(/C-28 carboxylic acid carbonyl/i);
    expect(assignCarbon13Peak(144.59).assignment_label).toMatch(/C-13 quaternary olefinic carbon/i);
    expect(assignCarbon13Peak(122.33).assignment_label).toMatch(/C-12 olefinic CH carbon/i);
    expect(assignCarbon13Peak(77.8).assignment_label).toMatch(/C-3 oxygenated carbon/i);
  });

  it('never returns unclassified label', () => {
    const labels = [12.1, 25.4, 41.2, 66.1, 111.2, 205.0, 300.0].map((ppm) =>
      assignCarbon13Peak(ppm).assignment_label.toLowerCase()
    );
    labels.forEach((label) => {
      expect(label).not.toContain('unclassified');
      expect(label.length).toBeGreaterThan(0);
    });
  });
});
