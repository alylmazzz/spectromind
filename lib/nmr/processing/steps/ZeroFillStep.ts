import { registerStep } from '../ProcessingGraph';

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

registerStep('zero_fill', (input, params) => {
  const factor = (params.factor as number) ?? 2;
  const targetSize = nextPowerOfTwo(input.size * factor);

  const real = new Float64Array(targetSize);
  real.set(input.real);

  let imag: Float64Array | undefined;
  if (input.imag) {
    imag = new Float64Array(targetSize);
    imag.set(input.imag);
  }

  return {
    ...input,
    real,
    imag,
    size: targetSize,
  };
});
