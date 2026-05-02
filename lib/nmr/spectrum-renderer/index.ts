/**
 * SpectroMind v2.0 - Spectrum Renderer
 * 
 * Son spektrum üretimi:
 * - Peak list → Spectrum array
 * - Cross-correlation / DTW hazırlığı
 * - İntegral normalizasyonu
 */

import {
  NMRPeakSimulated,
  SpinLine,
  SpectrumOutput,
  LineShapeParams,
} from '@/lib/types/nmr-simulation';
import {
  lorentzian,
  gaussian,
  voigt,
  generateSpectrumArray,
} from '../lineshape-engine';

// ============================================================================
// RENDERING CONFIG
// ============================================================================

export interface RenderConfig {
  ppmMin: number;
  ppmMax: number;
  numPoints: number;        // Spektrum çözünürlüğü
  fieldMHz: number;
  lineShape: 'lorentzian' | 'gaussian' | 'voigt';
  voigtEta: number;         // Voigt için L/G karışım (0-1)
  noiseLevel: number;       // 0 = no noise
  baselineDrift: number;    // 0 = no drift
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  ppmMin: -0.5,
  ppmMax: 12.5,
  numPoints: 32768,         // 32K points
  fieldMHz: 400,
  lineShape: 'voigt',
  voigtEta: 0.7,
  noiseLevel: 0.001,
  baselineDrift: 0,
};

// ============================================================================
// MAIN RENDERER
// ============================================================================

export interface RenderInput {
  peaks: NMRPeakSimulated[];
  spinLines?: SpinLine[];   // İsteğe bağlı: ham spin çizgileri
  config: RenderConfig;
}

/**
 * Ana spektrum render fonksiyonu
 */
export function renderSpectrum(input: RenderInput): SpectrumOutput {
  const { peaks, spinLines, config } = input;
  
  const resolution = (config.ppmMax - config.ppmMin) / config.numPoints;
  const ppmAxis: number[] = [];
  const intensities: number[] = [];
  
  // PPM ekseni oluştur (high to low)
  for (let i = 0; i < config.numPoints; i++) {
    ppmAxis.push(config.ppmMax - i * resolution);
    intensities.push(0);
  }
  
  // Spin lines varsa onları kullan (daha detaylı)
  const linesToRender = spinLines ?? peaksToSpinLines(peaks, config.fieldMHz);
  
  // Her çizgiyi render et
  for (const line of linesToRender) {
    addLineToSpectrum(
      intensities,
      ppmAxis,
      line.frequencyPPM,
      line.linewidthHz / config.fieldMHz,
      line.intensity,
      config
    );
  }
  
  // Baseline drift
  if (config.baselineDrift > 0) {
    addBaselineDrift(intensities, ppmAxis, config.baselineDrift);
  }
  
  // Noise
  if (config.noiseLevel > 0) {
    addNoise(intensities, config.noiseLevel);
  }
  
  // Normalize
  const maxInt = Math.max(...intensities);
  if (maxInt > 0) {
    for (let i = 0; i < intensities.length; i++) {
      intensities[i] /= maxInt;
    }
  }
  
  // Peak list oluştur
  const peakList = peaks.map(p => ({
    ppm: p.centerPPM,
    intensity: p.integral,
    integral: p.integral,
    multiplicity: p.multiplicity,
    jHz: p.jHz,
    assignment: p.assignment,
    protonIds: p.protonIds,
  }));
  
  return {
    ppmAxis,
    intensities,
    peakList,
    metadata: {
      fieldMHz: config.fieldMHz,
      numPoints: config.numPoints,
      lineShape: config.lineShape,
      resolution: resolution,
      ppmRange: [config.ppmMin, config.ppmMax],
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Peak'leri spin line'lara dönüştür
 */
function peaksToSpinLines(peaks: NMRPeakSimulated[], fieldMHz: number): SpinLine[] {
  const lines: SpinLine[] = [];
  
  for (const peak of peaks) {
    // Peak'in ana çizgileri varsa onları kullan
    if (peak.spinLines && peak.spinLines.length > 0) {
      lines.push(...peak.spinLines);
    } else {
      // Tek çizgi olarak ekle
      lines.push({
        frequencyHz: peak.centerPPM * fieldMHz,
        frequencyPPM: peak.centerPPM,
        intensity: peak.integral,
        linewidthHz: peak.linewidthHz ?? 1,
        sourceProtonIds: peak.protonIds,
      });
    }
  }
  
  return lines;
}

/**
 * Tek çizgiyi spektruma ekle
 */
function addLineToSpectrum(
  intensities: number[],
  ppmAxis: number[],
  centerPPM: number,
  fwhmPPM: number,
  peakIntensity: number,
  config: RenderConfig
): void {
  const range = 5 * fwhmPPM;  // ±5 FWHM
  
  for (let i = 0; i < ppmAxis.length; i++) {
    const ppm = ppmAxis[i];
    
    if (Math.abs(ppm - centerPPM) > range) continue;
    
    let value = 0;
    switch (config.lineShape) {
      case 'lorentzian':
        value = lorentzianPPM(ppm, centerPPM, fwhmPPM);
        break;
      case 'gaussian':
        value = gaussianPPM(ppm, centerPPM, fwhmPPM);
        break;
      case 'voigt':
        value = voigtPPM(ppm, centerPPM, fwhmPPM, config.voigtEta);
        break;
    }
    
    intensities[i] += value * peakIntensity;
  }
}

/**
 * PPM cinsinden Lorentzian
 */
function lorentzianPPM(ppm: number, center: number, fwhm: number): number {
  const halfWidth = fwhm / 2;
  const diff = ppm - center;
  return (halfWidth / Math.PI) / (diff * diff + halfWidth * halfWidth);
}

/**
 * PPM cinsinden Gaussian
 */
function gaussianPPM(ppm: number, center: number, fwhm: number): number {
  const sigma = fwhm / 2.355;
  const diff = ppm - center;
  return Math.exp(-(diff * diff) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * PPM cinsinden pseudo-Voigt
 */
function voigtPPM(ppm: number, center: number, fwhm: number, eta: number): number {
  return eta * lorentzianPPM(ppm, center, fwhm) + (1 - eta) * gaussianPPM(ppm, center, fwhm);
}

/**
 * Baseline drift ekle
 */
function addBaselineDrift(
  intensities: number[],
  ppmAxis: number[],
  amplitude: number
): void {
  const n = intensities.length;
  
  // Sinüsoidal drift
  for (let i = 0; i < n; i++) {
    const phase = (i / n) * 2 * Math.PI;
    intensities[i] += amplitude * Math.sin(phase * 0.5);
  }
}

/**
 * Rastgele noise ekle
 */
function addNoise(intensities: number[], level: number): void {
  for (let i = 0; i < intensities.length; i++) {
    intensities[i] += (Math.random() - 0.5) * 2 * level;
  }
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * İki spektrumu karşılaştır (cross-correlation)
 */
export function crossCorrelation(
  spec1: number[],
  spec2: number[]
): number {
  if (spec1.length !== spec2.length) {
    throw new Error('Spectra must have same length');
  }
  
  const n = spec1.length;
  
  // Mean subtraction
  const mean1 = spec1.reduce((a, b) => a + b, 0) / n;
  const mean2 = spec2.reduce((a, b) => a + b, 0) / n;
  
  let num = 0;
  let den1 = 0;
  let den2 = 0;
  
  for (let i = 0; i < n; i++) {
    const d1 = spec1[i] - mean1;
    const d2 = spec2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }
  
  const den = Math.sqrt(den1 * den2);
  return den === 0 ? 0 : num / den;
}

/**
 * Basit DTW distance (spektrum karşılaştırma)
 */
export function dtwDistance(
  spec1: number[],
  spec2: number[]
): number {
  const n = spec1.length;
  const m = spec2.length;
  
  // Basit versiyon: aynı uzunluk varsayımı
  if (n !== m) {
    throw new Error('DTW requires same length spectra in this implementation');
  }
  
  // Local distance
  let totalDist = 0;
  for (let i = 0; i < n; i++) {
    totalDist += Math.abs(spec1[i] - spec2[i]);
  }
  
  return totalDist / n;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * JCAMP-DX formatında export
 */
export function exportToJCAMP(spectrum: SpectrumOutput): string {
  const meta = spectrum.metadata as any || {};
  const lines: string[] = [];
  
  lines.push('##TITLE= SpectroMind Simulated Spectrum');
  lines.push('##JCAMP-DX= 5.00');
  lines.push('##DATA TYPE= NMR SPECTRUM');
  lines.push('##XUNITS= PPM');
  lines.push('##YUNITS= ARBITRARY UNITS');
  lines.push(`##FIRSTX= ${meta.ppmRange?.[0] ?? 0}`);
  lines.push(`##LASTX= ${meta.ppmRange?.[1] ?? 12}`);
  lines.push(`##NPOINTS= ${spectrum.ppmAxis.length}`);
  lines.push(`##.OBSERVE FREQUENCY= ${meta.fieldMHz ?? 400}`);
  lines.push('##XYDATA= (X++(Y..Y))');
  
  // Data points
  const step = 8;  // 8 Y values per line
  for (let i = 0; i < spectrum.ppmAxis.length; i += step) {
    const ppm = spectrum.ppmAxis[i].toFixed(4);
    const yValues = spectrum.intensities
      .slice(i, i + step)
      .map(y => y.toExponential(4))
      .join(' ');
    lines.push(`${ppm} ${yValues}`);
  }
  
  lines.push('##END=');
  
  return lines.join('\n');
}

/**
 * CSV formatında export
 */
export function exportToCSV(spectrum: SpectrumOutput): string {
  const lines: string[] = ['ppm,intensity'];
  
  for (let i = 0; i < spectrum.ppmAxis.length; i++) {
    lines.push(`${spectrum.ppmAxis[i].toFixed(6)},${spectrum.intensities[i].toExponential(8)}`);
  }
  
  return lines.join('\n');
}

/**
 * Peak list tablosu
 */
export function exportPeakTable(spectrum: SpectrumOutput): string {
  const lines: string[] = ['ppm,multiplicity,J (Hz),integral,assignment'];
  
  for (const peak of spectrum.peakList) {
    const jStr = peak.jHz.length > 0 ? peak.jHz.map(j => j.toFixed(1)).join('; ') : '-';
    lines.push(`${peak.ppm.toFixed(2)},${peak.multiplicity},${jStr},${peak.integral.toFixed(1)},${peak.assignment || '-'}`);
  }
  
  return lines.join('\n');
}
