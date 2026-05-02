/**
 * SpectroMind v2.0 - Line Shape Engine
 * 
 * Çizgi şekli ve genişleme modelleme:
 * - Lorentzian, Gaussian, Voigt
 * - Exchange broadening
 * - Solvent ve sıcaklık etkileri
 */

import { LineShape, LineShapeParams, ExchangeRegime, ExchangeSite, Solvent, SOLVENT_PRESETS, SpinLine } from '@/lib/types/nmr-simulation';

// ============================================================================
// LINE SHAPE FUNCTIONS
// ============================================================================

/**
 * Lorentzian çizgi şekli
 * L(ν) = (0.5Γ) / [(ν - ν₀)² + (0.5Γ)²]
 */
export function lorentzian(
  frequency: number,
  center: number,
  fwhmHz: number
): number {
  const halfWidth = fwhmHz / 2;
  const diff = frequency - center;
  return (halfWidth / Math.PI) / (diff * diff + halfWidth * halfWidth);
}

/**
 * Gaussian çizgi şekli
 * G(ν) = exp(-(ν - ν₀)² / (2σ²)) / (σ√(2π))
 */
export function gaussian(
  frequency: number,
  center: number,
  fwhmHz: number
): number {
  // FWHM ↔ σ: FWHM = 2√(2ln2)·σ ≈ 2.355σ
  const sigma = fwhmHz / 2.355;
  const diff = frequency - center;
  const exponent = -(diff * diff) / (2 * sigma * sigma);
  return Math.exp(exponent) / (sigma * Math.sqrt(2 * Math.PI));
}

/**
 * Pseudo-Voigt çizgi şekli
 * V(ν) ≈ η·L(ν) + (1-η)·G(ν)
 */
export function voigt(
  frequency: number,
  center: number,
  fwhmHz: number,
  eta: number = 0.5  // 0 = pure Gaussian, 1 = pure Lorentzian
): number {
  const L = lorentzian(frequency, center, fwhmHz);
  const G = gaussian(frequency, center, fwhmHz);
  return eta * L + (1 - eta) * G;
}

/**
 * Çizgi şekli seçici
 */
export function lineShapeFunction(
  frequency: number,
  center: number,
  params: LineShapeParams
): number {
  switch (params.shape) {
    case 'lorentzian':
      return lorentzian(frequency, center, params.fwhmHz);
    case 'gaussian':
      return gaussian(frequency, center, params.fwhmHz);
    case 'voigt':
      return voigt(frequency, center, params.fwhmHz, params.eta ?? 0.5);
    default:
      return lorentzian(frequency, center, params.fwhmHz);
  }
}

// ============================================================================
// LINEWIDTH CALCULATION
// ============================================================================

export interface LinewidthInput {
  baseLinewidthHz: number;
  solvent: Solvent;
  isExchangeable: boolean;
  exchangeInfo?: {
    rateK: number;
    deltaPPM: number;
    fieldMHz: number;
  };
  hbondStrength?: 'none' | 'weak' | 'medium' | 'strong';
  temperatureK?: number;
  sampleQuality?: 'clean' | 'normal' | 'dirty';
}

export interface LinewidthResult {
  totalFWHM: number;
  contributions: {
    base: number;
    solvent: number;
    exchange: number;
    hbond: number;
    quality: number;
  };
}

/**
 * Toplam linewidth hesapla
 */
export function calculateLinewidth(input: LinewidthInput): LinewidthResult {
  const {
    baseLinewidthHz,
    solvent,
    isExchangeable,
    exchangeInfo,
    hbondStrength = 'none',
    sampleQuality = 'normal',
  } = input;
  
  // Temel genişlik
  let base = baseLinewidthHz;
  
  // Solvent viskozite etkisi
  const solventFactor = SOLVENT_PRESETS[solvent].viscosityFactor;
  const solventContrib = base * (solventFactor - 1);
  
  // Exchange genişlemesi
  let exchangeContrib = 0;
  if (exchangeInfo) {
    const { rateK, deltaPPM, fieldMHz } = exchangeInfo;
    const deltaHz = Math.abs(deltaPPM) * fieldMHz;
    
    // Exchange broadening (approximate)
    // Δν_ex ≈ π × (population_a × population_b) × Δν² / k
    // Simplified version
    if (deltaHz > 0 && rateK > 0) {
      exchangeContrib = Math.min(50, (deltaHz * deltaHz) / (4 * rateK));
    }
  }
  
  // H-bond genişlemesi (exchangeable protonlar)
  let hbondContrib = 0;
  if (isExchangeable) {
    switch (hbondStrength) {
      case 'weak': hbondContrib = 2; break;
      case 'medium': hbondContrib = 5; break;
      case 'strong': hbondContrib = 10; break;
      default: hbondContrib = 3;  // Default for exchangeable
    }
    
    // DMSO'da daha geniş
    if (SOLVENT_PRESETS[solvent].hbondStrength === 'strong') {
      hbondContrib *= 1.5;
    }
  }
  
  // Örnek kalitesi
  let qualityContrib = 0;
  switch (sampleQuality) {
    case 'clean': qualityContrib = 0; break;
    case 'normal': qualityContrib = 1; break;
    case 'dirty': qualityContrib = 3; break;
  }
  
  const total = base + solventContrib + exchangeContrib + hbondContrib + qualityContrib;
  
  return {
    totalFWHM: total,
    contributions: {
      base,
      solvent: solventContrib,
      exchange: exchangeContrib,
      hbond: hbondContrib,
      quality: qualityContrib,
    },
  };
}

// ============================================================================
// EXCHANGE LINE SHAPE
// ============================================================================

/**
 * İki-durum exchange için çizgi şekli
 */
export function twoSiteExchangeLineShape(
  frequency: number,
  nu1: number,      // Durum 1 frekansı (Hz)
  nu2: number,      // Durum 2 frekansı (Hz)
  p1: number,       // Durum 1 popülasyonu (0-1)
  rateK: number,    // Exchange hızı (s⁻¹)
  baseLinewidth: number
): number {
  const p2 = 1 - p1;
  const nuCenter = p1 * nu1 + p2 * nu2;
  const deltaNu = Math.abs(nu1 - nu2);
  
  // Rejim belirleme
  const ratio = rateK / (deltaNu || 1);
  
  if (ratio > 10) {
    // Fast exchange: tek peak, ortalamada
    const fwhm = baseLinewidth + 0.5 * Math.PI * p1 * p2 * deltaNu * deltaNu / rateK;
    return lorentzian(frequency, nuCenter, fwhm);
  }
  
  if (ratio < 0.1) {
    // Slow exchange: iki ayrı peak
    const peak1 = p1 * lorentzian(frequency, nu1, baseLinewidth);
    const peak2 = p2 * lorentzian(frequency, nu2, baseLinewidth);
    return peak1 + peak2;
  }
  
  // Intermediate: genişlemiş, karmaşık şekil (Bloch-McConnell yaklaşımı)
  // Basitleştirilmiş: tek geniş peak
  const avgFwhm = baseLinewidth + 0.3 * deltaNu;
  return lorentzian(frequency, nuCenter, avgFwhm);
}

// ============================================================================
// SPECTRUM GENERATION
// ============================================================================

export interface SpectrumGenerationInput {
  lines: SpinLine[];
  ppmMin: number;
  ppmMax: number;
  resolution: number;    // ppm step
  fieldMHz: number;
  defaultLineShape: LineShape;
  eta?: number;          // Voigt mixing
}

/**
 * Çizgilerden spektrum array üret
 */
export function generateSpectrumArray(
  input: SpectrumGenerationInput
): { ppmAxis: number[]; intensities: number[] } {
  const { lines, ppmMin, ppmMax, resolution, fieldMHz, defaultLineShape, eta = 0.7 } = input;
  
  const numPoints = Math.ceil((ppmMax - ppmMin) / resolution);
  const ppmAxis: number[] = [];
  const intensities: number[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const ppm = ppmMax - i * resolution;  // High to low ppm
    ppmAxis.push(ppm);
    intensities.push(0);
  }
  
  // Her çizgiyi ekle
  for (const line of lines) {
    const centerPPM = line.frequencyPPM;
    const fwhmPPM = line.linewidthHz / fieldMHz;
    const intensity = line.intensity;
    
    const params: LineShapeParams = {
      shape: defaultLineShape,
      fwhmHz: line.linewidthHz,
      eta,
    };
    
    // Yakın noktalara katkı ekle (±5*FWHM)
    const range = 5 * fwhmPPM;
    
    for (let i = 0; i < numPoints; i++) {
      const ppm = ppmAxis[i];
      if (Math.abs(ppm - centerPPM) > range) continue;
      
      const freqHz = ppm * fieldMHz;
      const centerHz = centerPPM * fieldMHz;
      
      const contribution = lineShapeFunction(freqHz, centerHz, params) * intensity;
      intensities[i] += contribution;
    }
  }
  
  // Normalize
  const maxInt = Math.max(...intensities);
  if (maxInt > 0) {
    for (let i = 0; i < intensities.length; i++) {
      intensities[i] /= maxInt;
    }
  }
  
  return { ppmAxis, intensities };
}

// ============================================================================
// SOLVENT REFERENCING
// ============================================================================

/**
 * Solvent residual peak referanslama
 */
export function applySolventReferencing(
  ppmValues: number[],
  solvent: Solvent,
  observedSolventPPM?: number
): number[] {
  const expectedPPM = SOLVENT_PRESETS[solvent].residualPeakPPM;
  
  if (observedSolventPPM === undefined) {
    return ppmValues;  // Düzeltme yok
  }
  
  const shift = expectedPPM - observedSolventPPM;
  
  return ppmValues.map(ppm => ppm + shift);
}
