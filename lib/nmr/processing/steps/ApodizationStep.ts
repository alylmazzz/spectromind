import { registerStep, type SpectrumBuffer } from '../ProcessingGraph';

function applyExponential(buffer: SpectrumBuffer, lbHz: number): SpectrumBuffer {
  const n = buffer.size;
  const real = new Float64Array(n);
  const imag = buffer.imag ? new Float64Array(n) : undefined;

  const dwellTime = buffer.spectralWidthHz ? 1 / buffer.spectralWidthHz : 1 / n;

  for (let i = 0; i < n; i++) {
    const t = i * dwellTime;
    const decay = Math.exp(-Math.PI * lbHz * t);
    real[i] = buffer.real[i] * decay;
    if (imag && buffer.imag) {
      imag[i] = buffer.imag[i] * decay;
    }
  }

  return { ...buffer, real, imag };
}

function applyGaussian(buffer: SpectrumBuffer, gbHz: number, lbHz: number): SpectrumBuffer {
  const n = buffer.size;
  const real = new Float64Array(n);
  const imag = buffer.imag ? new Float64Array(n) : undefined;

  const dwellTime = buffer.spectralWidthHz ? 1 / buffer.spectralWidthHz : 1 / n;
  const tmax = n * dwellTime;

  for (let i = 0; i < n; i++) {
    const t = i * dwellTime;
    const expDecay = Math.exp(-Math.PI * lbHz * t);
    const gaussEnhance = Math.exp((Math.PI * lbHz * t * t) / (2 * gbHz * tmax));
    const weight = expDecay * gaussEnhance;
    real[i] = buffer.real[i] * weight;
    if (imag && buffer.imag) {
      imag[i] = buffer.imag[i] * weight;
    }
  }

  return { ...buffer, real, imag };
}

function applySineBell(buffer: SpectrumBuffer, phase: number): SpectrumBuffer {
  const n = buffer.size;
  const real = new Float64Array(n);
  const imag = buffer.imag ? new Float64Array(n) : undefined;

  for (let i = 0; i < n; i++) {
    const fraction = i / (n - 1);
    const weight = Math.sin(phase + (Math.PI - phase) * fraction);
    real[i] = buffer.real[i] * Math.max(0, weight);
    if (imag && buffer.imag) {
      imag[i] = buffer.imag[i] * Math.max(0, weight);
    }
  }

  return { ...buffer, real, imag };
}

registerStep('apodization', (input, params) => {
  const window = (params.window as string) ?? 'exp';
  const lbHz = (params.lbHz as number) ?? 0.5;

  switch (window) {
    case 'exp':
      return applyExponential(input, lbHz);
    case 'gauss':
      return applyGaussian(input, (params.gbHz as number) ?? 0.3, lbHz);
    case 'sine':
      return applySineBell(input, (params.phase as number) ?? 0);
    case 'cosine':
      return applySineBell(input, Math.PI / 2);
    default:
      return applyExponential(input, lbHz);
  }
});
