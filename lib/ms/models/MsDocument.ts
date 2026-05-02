/**
 * MS Dual Model — Chromatogram + Spectrum
 *
 * Scientific design:
 *   LC/GC-MS data has two distinct but linked dimensions:
 *   1. Chromatographic (RT vs TIC/EIC intensity)
 *   2. Spectral (m/z vs intensity at a given RT or RT range)
 *
 *   These must NOT be conflated into a single ambiguous type.
 *   The MsDocument connects them while maintaining clean separation.
 *
 * Key capabilities this model enables:
 *   - EIC extraction from TIC
 *   - Spectrum extraction from chromatographic peak
 *   - Peak purity assessment
 *   - Charge state deconvolution
 *   - Molecular match / elemental composition
 *   - RT alignment across traces
 *   - Assignment to molecule atoms (fragments)
 */

export interface ChromatogramTrace {
  id: string;
  type: 'TIC' | 'EIC' | 'BPC' | 'SIC' | 'other';
  label: string;

  retentionTimes: Float64Array;
  intensities: Float64Array;

  targetMz?: number;
  mzTolerance?: number;

  detectedPeaks: ChromatographicPeak[];
  baselineCorrected: boolean;
}

export interface ChromatographicPeak {
  id: string;
  startRt: number;
  apexRt: number;
  endRt: number;
  area: number;
  height: number;
  purity: number;
  assignedSpectrumId: string | null;
}

export interface MassSpectrum {
  id: string;
  label: string;

  mzValues: Float64Array;
  intensities: Float64Array;

  retentionTime: number | null;
  retentionTimeRange: [number, number] | null;

  polarity: 'positive' | 'negative' | 'unknown';
  msLevel: number;
  precursorMz: number | null;

  detectedIons: DetectedIon[];
  baselineCorrected: boolean;
}

export interface DetectedIon {
  id: string;
  mz: number;
  intensity: number;
  relativeIntensity: number;
  chargeState: number;
  isotopePattern: IsotopeCluster | null;
  assignment: string;
  formula: string;
  adduct: string;
  confidence: 'high' | 'medium' | 'low';
  isMonoisotopic: boolean;
}

export interface IsotopeCluster {
  monoisotopicMz: number;
  peaks: { mz: number; intensity: number; isotopeIndex: number }[];
  chargeState: number;
  score: number;
}

export interface MolecularMatchResult {
  id: string;
  candidateFormula: string;
  candidateMass: number;
  massDifferencePpm: number;
  adduct: string;
  chargeState: number;
  isotopeMatchScore: number;
  overallScore: number;
  linkedMoleculeId: string | null;
  evidence: string[];
}

export interface MsAssignment {
  id: string;
  ionId: string;
  moleculeId: string;
  atomIndices: number[];
  fragmentFormula: string;
  confidence: number;
  rationale: string;
}

export interface MsDocument {
  id: string;
  documentId: string;
  title: string;

  chromatograms: ChromatogramTrace[];
  spectra: MassSpectrum[];

  molecularMatches: MolecularMatchResult[];
  assignments: MsAssignment[];

  vendor: string;
  importDate: string;
  ionMode: 'ESI+' | 'ESI-' | 'APCI+' | 'APCI-' | 'EI' | 'CI' | 'MALDI' | 'other';
}

export function createMsDocumentId(): string {
  return `ms_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyMsDocument(title: string): MsDocument {
  return {
    id: createMsDocumentId(),
    documentId: '',
    title,
    chromatograms: [],
    spectra: [],
    molecularMatches: [],
    assignments: [],
    vendor: 'unknown',
    importDate: new Date().toISOString(),
    ionMode: 'ESI+',
  };
}

export function extractSpectrum(
  chromatogram: ChromatogramTrace,
  allSpectra: MassSpectrum[],
  targetRt: number,
  tolerance: number,
): MassSpectrum | undefined {
  return allSpectra.find(s => {
    if (s.retentionTime === null) return false;
    return Math.abs(s.retentionTime - targetRt) <= tolerance;
  });
}

export function createEIC(
  spectra: MassSpectrum[],
  targetMz: number,
  mzTolerance: number,
): ChromatogramTrace {
  const sortedSpectra = [...spectra]
    .filter(s => s.retentionTime !== null)
    .sort((a, b) => (a.retentionTime ?? 0) - (b.retentionTime ?? 0));

  const rts = new Float64Array(sortedSpectra.length);
  const intensities = new Float64Array(sortedSpectra.length);

  for (let i = 0; i < sortedSpectra.length; i++) {
    rts[i] = sortedSpectra[i].retentionTime ?? 0;
    let sum = 0;
    const mzArr = sortedSpectra[i].mzValues;
    const intArr = sortedSpectra[i].intensities;
    for (let j = 0; j < mzArr.length; j++) {
      if (Math.abs(mzArr[j] - targetMz) <= mzTolerance) {
        sum += intArr[j];
      }
    }
    intensities[i] = sum;
  }

  return {
    id: `eic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'EIC',
    label: `EIC m/z ${targetMz.toFixed(4)} ± ${mzTolerance}`,
    retentionTimes: rts,
    intensities,
    targetMz,
    mzTolerance,
    detectedPeaks: [],
    baselineCorrected: false,
  };
}
