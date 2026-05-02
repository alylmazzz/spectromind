import type { SpectrumType } from '@/lib/types';

export type FidNmrModality = '1H' | '13C';

export function normalizeObservedExperimentType(experimentType?: string): FidNmrModality {
  return String(experimentType || '1H').toUpperCase() === '13C' ? '13C' : '1H';
}

export function spectrumTypeForObservedModality(modality: FidNmrModality): SpectrumType {
  return modality === '13C' ? 'c13' : 'nmr';
}

export function defaultDomainForObservedModality(modality: FidNmrModality): [number, number] {
  return modality === '13C' ? [230, -10] : [14, -1];
}

export function modalityMismatchDiagnostic(
  spectrumType: SpectrumType,
  modality: FidNmrModality
): string | null {
  if (spectrumType === 'nmr' && modality === '13C') {
    return 'MODALITY_MISMATCH_DIAGNOSTIC_GUARD: 13C gözlenen veri 1H yüzeyinde render edilmek istendi.';
  }
  if (spectrumType === 'c13' && modality === '1H') {
    return 'MODALITY_MISMATCH_DIAGNOSTIC_GUARD: 1H gözlenen veri 13C yüzeyinde render edilmek istendi.';
  }
  return null;
}
