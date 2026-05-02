import { registerStep, type SpectrumBuffer } from '../ProcessingGraph';

/**
 * Polynomial baseline correction.
 * Uses least-squares fit on noise regions.
 */
function polynomialBaseline(
  buffer: SpectrumBuffer,
  degree: number
): SpectrumBuffer {
  const n = buffer.size;
  const real = new Float64Array(buffer.real);

  // Identify noise regions: first/last 5% and regions < median/2
  const sorted = Array.from(buffer.real).sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const threshold = median * 0.3;

  const noiseIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Math.abs(buffer.real[i]) < threshold || i < n * 0.05 || i > n * 0.95) {
      noiseIndices.push(i);
    }
  }

  if (noiseIndices.length < degree + 1) {
    return buffer;
  }

  // Vandermonde matrix for noise points
  const m = noiseIndices.length;
  const d = degree + 1;

  // Normal equations: (A^T A) c = A^T y
  const ata = new Float64Array(d * d);
  const aty = new Float64Array(d);

  for (let idx = 0; idx < m; idx++) {
    const x = noiseIndices[idx] / n;
    const y = buffer.real[noiseIndices[idx]];
    let xpow = 1;
    for (let j = 0; j < d; j++) {
      aty[j] += xpow * y;
      let xpow2 = 1;
      for (let k = 0; k < d; k++) {
        ata[j * d + k] += xpow * xpow2;
        xpow2 *= x;
      }
      xpow *= x;
    }
  }

  // Solve using simple Gaussian elimination
  const aug = new Float64Array(d * (d + 1));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      aug[i * (d + 1) + j] = ata[i * d + j];
    }
    aug[i * (d + 1) + d] = aty[i];
  }

  for (let col = 0; col < d; col++) {
    let maxRow = col;
    for (let row = col + 1; row < d; row++) {
      if (Math.abs(aug[row * (d + 1) + col]) > Math.abs(aug[maxRow * (d + 1) + col])) {
        maxRow = row;
      }
    }
    for (let j = 0; j <= d; j++) {
      [aug[col * (d + 1) + j], aug[maxRow * (d + 1) + j]] =
        [aug[maxRow * (d + 1) + j], aug[col * (d + 1) + j]];
    }
    const pivot = aug[col * (d + 1) + col];
    if (Math.abs(pivot) < 1e-15) continue;
    for (let row = col + 1; row < d; row++) {
      const factor = aug[row * (d + 1) + col] / pivot;
      for (let j = col; j <= d; j++) {
        aug[row * (d + 1) + j] -= factor * aug[col * (d + 1) + j];
      }
    }
  }

  const coeffs = new Float64Array(d);
  for (let i = d - 1; i >= 0; i--) {
    let sum = aug[i * (d + 1) + d];
    for (let j = i + 1; j < d; j++) {
      sum -= aug[i * (d + 1) + j] * coeffs[j];
    }
    const diag = aug[i * (d + 1) + i];
    coeffs[i] = Math.abs(diag) > 1e-15 ? sum / diag : 0;
  }

  // Subtract baseline
  for (let i = 0; i < n; i++) {
    const x = i / n;
    let baseline = 0;
    let xpow = 1;
    for (let j = 0; j < d; j++) {
      baseline += coeffs[j] * xpow;
      xpow *= x;
    }
    real[i] -= baseline;
  }

  return { ...buffer, real };
}

registerStep('baseline', (input, params) => {
  const algorithm = (params.algorithm as string) ?? 'polynomial';
  const degree = (params.degree as number) ?? 5;

  switch (algorithm) {
    case 'polynomial':
    case 'bernstein':
      return polynomialBaseline(input, degree);
    default:
      return polynomialBaseline(input, degree);
  }
});
