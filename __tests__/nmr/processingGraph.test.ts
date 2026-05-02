import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingGraph, type SpectrumBuffer } from '@/lib/nmr/processing/ProcessingGraph';
import '@/lib/nmr/processing/steps';

function makeSineFid(n: number, freqHz: number, swHz: number): SpectrumBuffer {
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  const dt = 1 / swHz;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    real[i] = Math.cos(2 * Math.PI * freqHz * t) * Math.exp(-t * 5);
    imag[i] = Math.sin(2 * Math.PI * freqHz * t) * Math.exp(-t * 5);
  }
  return { real, imag, size: n, domain: 'time', spectralWidthHz: swHz, referenceFreqHz: 400e6 };
}

describe('ProcessingGraph', () => {
  let graph: ProcessingGraph;
  let fid: SpectrumBuffer;

  beforeEach(() => {
    graph = new ProcessingGraph();
    fid = makeSineFid(1024, 500, 5000);
  });

  it('executes empty pipeline returning original FID', () => {
    const state = graph.execute(fid);
    expect(state.finalSpectrum).toBeDefined();
    expect(state.finalSpectrum!.real.length).toBe(1024);
  });

  it('applies apodization + zero fill + FT pipeline', () => {
    graph.addStep({ kind: 'apodization', params: { type: 'exponential', lb: 2.0 }, enabled: true });
    graph.addStep({ kind: 'zero_fill', params: { factor: 2 }, enabled: true });
    graph.addStep({ kind: 'ft', params: {}, enabled: true });

    const state = graph.execute(fid);
    expect(state.finalSpectrum!.domain).toBe('frequency');
    expect(state.finalSpectrum!.real.length).toBeGreaterThan(1024);
    expect(state.afterFt).toBeDefined();
  });

  it('skips disabled steps', () => {
    graph.addStep({ kind: 'apodization', params: { type: 'exponential', lb: 2.0 }, enabled: false });
    graph.addStep({ kind: 'ft', params: {}, enabled: true });

    const state = graph.execute(fid);
    expect(state.finalSpectrum!.domain).toBe('frequency');
  });

  it('toggles step enabled state', () => {
    graph.addStep({ kind: 'ft', params: {}, enabled: true });
    expect(graph.getSteps()[0].enabled).toBe(true);
    graph.toggleStep(0);
    expect(graph.getSteps()[0].enabled).toBe(false);
  });

  it('moves steps', () => {
    graph.addStep({ kind: 'apodization', params: { type: 'exponential', lb: 1 }, enabled: true });
    graph.addStep({ kind: 'ft', params: {}, enabled: true });
    graph.moveStep(1, 0);
    expect(graph.getSteps()[0].kind).toBe('ft');
    expect(graph.getSteps()[1].kind).toBe('apodization');
  });

  it('serializes to/from template', () => {
    graph.addStep({ kind: 'apodization', params: { type: 'gaussian', lb: 1, gb: 0.3 }, enabled: true });
    graph.addStep({ kind: 'ft', params: {}, enabled: true });

    const template = graph.toTemplate();
    expect(template.steps).toHaveLength(2);
    expect(template.id).toContain('tmpl_');

    const restored = ProcessingGraph.fromTemplate(template);
    expect(restored.getSteps()).toHaveLength(2);
    expect(restored.getSteps()[0].kind).toBe('apodization');
  });

  it('updates step parameters', () => {
    graph.addStep({ kind: 'apodization', params: { type: 'exponential', lb: 1 }, enabled: true });
    graph.updateStepParams(0, { lb: 5.0 });
    expect(graph.getSteps()[0].params.lb).toBe(5.0);
    expect(graph.getSteps()[0].params.type).toBe('exponential');
  });
});

describe('Processing Steps — Scientific Correctness', () => {
  it('exponential apodization decays signal', () => {
    const fid = makeSineFid(256, 100, 2000);
    const graph = new ProcessingGraph();
    graph.addStep({ kind: 'apodization', params: { type: 'exponential', lb: 10 }, enabled: true });
    const state = graph.execute(fid);

    const lastOriginal = Math.abs(fid.real[255]);
    const lastProcessed = Math.abs(state.finalSpectrum!.real[255]);
    expect(lastProcessed).toBeLessThan(lastOriginal);
  });

  it('zero filling doubles length by default', () => {
    const fid = makeSineFid(100, 100, 2000);
    const graph = new ProcessingGraph();
    graph.addStep({ kind: 'zero_fill', params: { factor: 2 }, enabled: true });
    const state = graph.execute(fid);
    expect(state.finalSpectrum!.real.length).toBe(256);
  });

  it('FFT converts to frequency domain', () => {
    const fid = makeSineFid(512, 200, 5000);
    const graph = new ProcessingGraph();
    graph.addStep({ kind: 'ft', params: {}, enabled: true });
    const state = graph.execute(fid);
    expect(state.finalSpectrum!.domain).toBe('frequency');

    const spectrum = state.finalSpectrum!.real;
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxVal) { maxVal = spectrum[i]; maxIdx = i; }
    }
    expect(maxIdx).toBeGreaterThan(0);
  });

  it('phase correction preserves spectral energy (real^2 + imag^2)', () => {
    const fid = makeSineFid(512, 300, 5000);
    const graphA = new ProcessingGraph();
    graphA.addStep({ kind: 'ft', params: {}, enabled: true });
    const stateA = graphA.execute(fid);
    const specA = stateA.finalSpectrum!;
    const energyA = specA.real.reduce((s, v) => s + v * v, 0) +
      (specA.imag?.reduce((s, v) => s + v * v, 0) ?? 0);

    const graphB = new ProcessingGraph();
    graphB.addStep({ kind: 'ft', params: {}, enabled: true });
    graphB.addStep({ kind: 'phase', params: { mode: 'manual', ph0: 45, ph1: 0 }, enabled: true });
    const stateB = graphB.execute(fid);
    const specB = stateB.finalSpectrum!;
    const energyB = specB.real.reduce((s, v) => s + v * v, 0) +
      (specB.imag?.reduce((s, v) => s + v * v, 0) ?? 0);

    expect(energyB).toBeGreaterThan(0);
    expect(Math.abs(energyB - energyA) / energyA).toBeLessThan(0.01);
  });
});
