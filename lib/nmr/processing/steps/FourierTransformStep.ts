import { registerStep, type SpectrumBuffer } from '../ProcessingGraph';

/**
 * Radix-2 Cooley-Tukey FFT.
 * Input arrays are modified in place.
 */
function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;

    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const theta = angle * k;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;

        const tReal = cosT * real[oddIdx] - sinT * imag[oddIdx];
        const tImag = sinT * real[oddIdx] + cosT * imag[oddIdx];

        real[oddIdx] = real[evenIdx] - tReal;
        imag[oddIdx] = imag[evenIdx] - tImag;
        real[evenIdx] += tReal;
        imag[evenIdx] += tImag;
      }
    }
  }
}

function fftShift(arr: Float64Array): Float64Array {
  const n = arr.length;
  const half = Math.floor(n / 2);
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = arr[(i + half) % n];
  }
  return result;
}

registerStep('ft', (input, _params) => {
  const n = input.size;
  const real = new Float64Array(input.real);
  const imag = input.imag ? new Float64Array(input.imag) : new Float64Array(n);

  fft(real, imag);

  const shiftedReal = fftShift(real);
  const shiftedImag = fftShift(imag);

  return {
    real: shiftedReal,
    imag: shiftedImag,
    size: n,
    domain: 'frequency' as const,
    referenceFreqHz: input.referenceFreqHz,
    spectralWidthHz: input.spectralWidthHz,
  };
});
