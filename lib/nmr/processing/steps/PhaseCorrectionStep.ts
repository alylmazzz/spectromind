import { registerStep, type SpectrumBuffer } from '../ProcessingGraph';

function applyPhase(
  buffer: SpectrumBuffer,
  ph0Deg: number,
  ph1Deg: number
): SpectrumBuffer {
  const n = buffer.size;
  const real = new Float64Array(n);
  const imag = buffer.imag ? new Float64Array(n) : undefined;

  const ph0Rad = (ph0Deg * Math.PI) / 180;
  const ph1Rad = (ph1Deg * Math.PI) / 180;

  const re = buffer.real;
  const im = buffer.imag ?? new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const fraction = i / (n - 1);
    const totalPhase = ph0Rad + ph1Rad * fraction;
    const cosP = Math.cos(totalPhase);
    const sinP = Math.sin(totalPhase);

    real[i] = re[i] * cosP - im[i] * sinP;
    if (imag) {
      imag[i] = re[i] * sinP + im[i] * cosP;
    }
  }

  return { ...buffer, real, imag };
}

/**
 * Simple entropy-based automatic phase correction.
 * Minimizes negative intensity by grid search on ph0.
 */
function autoPhase0(buffer: SpectrumBuffer): { ph0: number; ph1: number } {
  let bestPh0 = 0;
  let bestScore = Infinity;

  for (let ph0 = -180; ph0 <= 180; ph0 += 1) {
    const phased = applyPhase(buffer, ph0, 0);
    let negArea = 0;
    for (let i = 0; i < phased.size; i++) {
      if (phased.real[i] < 0) negArea -= phased.real[i];
    }
    if (negArea < bestScore) {
      bestScore = negArea;
      bestPh0 = ph0;
    }
  }

  // Fine grid around best
  for (let ph0 = bestPh0 - 1; ph0 <= bestPh0 + 1; ph0 += 0.1) {
    const phased = applyPhase(buffer, ph0, 0);
    let negArea = 0;
    for (let i = 0; i < phased.size; i++) {
      if (phased.real[i] < 0) negArea -= phased.real[i];
    }
    if (negArea < bestScore) {
      bestScore = negArea;
      bestPh0 = ph0;
    }
  }

  return { ph0: Math.round(bestPh0 * 10) / 10, ph1: 0 };
}

registerStep('phase', (input, params) => {
  const mode = (params.mode as string) ?? 'auto';

  if (mode === 'manual') {
    const ph0 = (params.ph0 as number) ?? 0;
    const ph1 = (params.ph1 as number) ?? 0;
    return applyPhase(input, ph0, ph1);
  }

  const { ph0, ph1 } = autoPhase0(input);
  return applyPhase(input, ph0, ph1);
});
