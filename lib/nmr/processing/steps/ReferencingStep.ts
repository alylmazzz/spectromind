import { registerStep, type SpectrumBuffer } from '../ProcessingGraph';

/**
 * NMR Chemical Shift Referencing
 *
 * Methods:
 *  - manual:  User specifies a point in the spectrum (pointIndex) that should appear at targetPpm.
 *             The entire real/imag arrays are circularly shifted so that point maps to targetPpm.
 *  - solvent: Auto-detect largest peak near known solvent position and shift to match.
 *  - tms:     Auto-detect peak near 0 ppm and set as reference (targetPpm = 0).
 *
 * Scientific note:
 *   Referencing does NOT alter intensities. It shifts the frequency-domain data along the
 *   spectral axis so that a known reference signal appears at its canonical position.
 *   For a spectrum with N points spanning SW Hz, each point shift = (offsetHz / SW) * N.
 */

const SOLVENT_REFERENCES: Record<string, { h1: number; c13: number }> = {
  CDCl3:       { h1: 7.26,  c13: 77.16  },
  DMSO:        { h1: 2.50,  c13: 39.52  },
  'DMSO-d6':   { h1: 2.50,  c13: 39.52  },
  D2O:         { h1: 4.79,  c13: 0      },
  MeOD:        { h1: 3.31,  c13: 49.00  },
  'CD3OD':     { h1: 3.31,  c13: 49.00  },
  Acetone:     { h1: 2.05,  c13: 29.84  },
  'Acetone-d6':{ h1: 2.05,  c13: 29.84  },
  Benzene:     { h1: 7.16,  c13: 128.06 },
  'C6D6':      { h1: 7.16,  c13: 128.06 },
  Pyridine:    { h1: 7.22,  c13: 123.87 },
  THF:         { h1: 1.72,  c13: 25.31  },
  'THF-d8':    { h1: 1.72,  c13: 25.31  },
  TMS:         { h1: 0.00,  c13: 0.00   },
};

function findPeakIndex(real: Float64Array, searchStart: number, searchEnd: number): number {
  let maxVal = -Infinity;
  let maxIdx = searchStart;
  const lo = Math.max(0, searchStart);
  const hi = Math.min(real.length - 1, searchEnd);
  for (let i = lo; i <= hi; i++) {
    const absVal = Math.abs(real[i]);
    if (absVal > maxVal) {
      maxVal = absVal;
      maxIdx = i;
    }
  }
  return maxIdx;
}

function circularShift(arr: Float64Array, shift: number): Float64Array {
  const n = arr.length;
  const intShift = Math.round(shift);
  if (intShift === 0) return arr;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const target = ((i + intShift) % n + n) % n;
    result[target] = arr[i];
  }
  return result;
}

registerStep('reference', (input: SpectrumBuffer, params: Record<string, unknown>): SpectrumBuffer => {
  const method = (params.method as string) ?? 'manual';
  const targetPpm = (params.ppm as number) ?? 0;
  const nucleus = (params.nucleus as string) ?? '1H';
  const solventName = (params.solvent as string) ?? 'CDCl3';

  const n = input.real.length;
  const sw = input.spectralWidthHz ?? 3000;
  const refFreq = input.referenceFreqHz ?? 400e6;

  const ppmPerPoint = (sw / refFreq) / n;

  if (method === 'manual') {
    const pointIndex = (params.pointIndex as number) ?? Math.floor(n / 2);
    const currentPpm = (n / 2 - pointIndex) * ppmPerPoint;
    const deltaPpm = targetPpm - currentPpm;
    const pointShift = deltaPpm / ppmPerPoint;

    return {
      ...input,
      real: circularShift(input.real, pointShift),
      imag: input.imag ? circularShift(input.imag, pointShift) : undefined,
      referenceFreqHz: refFreq,
    };
  }

  if (method === 'solvent' || method === 'tms') {
    const solventRef = SOLVENT_REFERENCES[solventName] ?? SOLVENT_REFERENCES['CDCl3'];
    const refPpm = method === 'tms' ? 0.0 : (nucleus === '13C' ? solventRef.c13 : solventRef.h1);

    const searchWindowPpm = nucleus === '13C' ? 3.0 : 0.5;
    const centerIndex = Math.floor(n / 2 - (refPpm / ppmPerPoint));
    const windowPoints = Math.ceil(searchWindowPpm / ppmPerPoint);

    const peakIdx = findPeakIndex(input.real, centerIndex - windowPoints, centerIndex + windowPoints);
    const foundPpm = (n / 2 - peakIdx) * ppmPerPoint;
    const deltaPpm = refPpm - foundPpm;
    const pointShift = deltaPpm / ppmPerPoint;

    return {
      ...input,
      real: circularShift(input.real, pointShift),
      imag: input.imag ? circularShift(input.imag, pointShift) : undefined,
      referenceFreqHz: refFreq,
    };
  }

  return input;
});
