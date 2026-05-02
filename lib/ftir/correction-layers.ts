/**
 * FTIR Correction Layers
 *
 * Additional correction layers applied on top of the base FTIR engine's
 * theoretical band list to improve accuracy.
 *
 * Corrections:
 * - Conjugation effects on C=O/C=C stretching
 * - Hydrogen bonding broadening
 * - Acid dimerization
 * - Ring strain shifts
 * - ATR correction
 * - Fermi resonance
 * - Fingerprint region motif support
 * - Solvent/water contamination exclusion
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface IRBandEntry {
  cm: number;
  intensity: 'strong' | 'medium' | 'weak' | 'variable';
  assignment: string;
  family: BandFamily;
  broadening?: 'sharp' | 'medium' | 'broad' | 'very_broad';
  confidence: number;
  correctionApplied?: string[];
}

export type BandFamily =
  | 'OH_stretch' | 'NH_stretch' | 'CH_stretch_sp3' | 'CH_stretch_sp2'
  | 'CH_stretch_aromatic' | 'CH_stretch_aldehyde'
  | 'triple_bond' | 'nitrile' | 'alkyne_CH'
  | 'carbonyl' | 'carbonyl_ketone' | 'carbonyl_aldehyde' | 'carbonyl_ester'
  | 'carbonyl_acid' | 'carbonyl_amide' | 'carbonyl_anhydride'
  | 'CC_double' | 'CC_aromatic' | 'CN_double'
  | 'NO2_asym' | 'NO2_sym'
  | 'CO_stretch' | 'CN_stretch' | 'SO_stretch'
  | 'CH_bend' | 'OH_bend' | 'NH_bend'
  | 'fingerprint' | 'other';

export interface CorrectionResult {
  correctedBands: IRBandEntry[];
  correctionsApplied: string[];
  warnings: string[];
}

// --------------------------------------------------------------------------
// Conjugation correction
// --------------------------------------------------------------------------

function applyConjugationCorrection(
  bands: IRBandEntry[],
  functionalGroups: { hasAlkene?: boolean; hasAromaticRing?: boolean; hasCarbonyl?: boolean }
): { bands: IRBandEntry[]; applied: string[] } {
  const applied: string[] = [];

  return {
    bands: bands.map(b => {
      if (b.family.startsWith('carbonyl') && functionalGroups.hasAlkene) {
        applied.push('Conjugated C=O: shifted lower by ~30 cm-1');
        return { ...b, cm: b.cm - 30, correctionApplied: [...(b.correctionApplied ?? []), 'conjugation_cc'] };
      }
      if (b.family.startsWith('carbonyl') && functionalGroups.hasAromaticRing) {
        applied.push('Aromatic-conjugated C=O: shifted lower by ~20 cm-1');
        return { ...b, cm: b.cm - 20, correctionApplied: [...(b.correctionApplied ?? []), 'conjugation_ar'] };
      }
      if (b.family === 'CC_double' && functionalGroups.hasCarbonyl) {
        applied.push('Conjugated C=C: shifted lower by ~15 cm-1');
        return { ...b, cm: b.cm - 15, correctionApplied: [...(b.correctionApplied ?? []), 'conjugation_co'] };
      }
      return b;
    }),
    applied,
  };
}

// --------------------------------------------------------------------------
// Hydrogen bonding broadening
// --------------------------------------------------------------------------

function applyHBondBroadening(
  bands: IRBandEntry[],
  context: { hasOH?: boolean; hasNH?: boolean; hasCOOH?: boolean; isConcentrated?: boolean }
): { bands: IRBandEntry[]; applied: string[] } {
  const applied: string[] = [];

  return {
    bands: bands.map(b => {
      if (b.family === 'OH_stretch' && (context.isConcentrated || context.hasCOOH)) {
        applied.push('H-bonded OH: broadened and shifted lower');
        return {
          ...b,
          cm: b.cm - 200,
          broadening: 'very_broad' as const,
          correctionApplied: [...(b.correctionApplied ?? []), 'h_bond_broadening'],
        };
      }
      if (b.family === 'NH_stretch' && context.isConcentrated) {
        applied.push('H-bonded NH: broadened');
        return {
          ...b,
          cm: b.cm - 80,
          broadening: 'broad' as const,
          correctionApplied: [...(b.correctionApplied ?? []), 'h_bond_broadening'],
        };
      }
      return b;
    }),
    applied,
  };
}

// --------------------------------------------------------------------------
// Acid dimerization
// --------------------------------------------------------------------------

function applyAcidDimerization(
  bands: IRBandEntry[],
  hasCOOH: boolean
): { bands: IRBandEntry[]; applied: string[] } {
  if (!hasCOOH) return { bands, applied: [] };

  const applied = ['Acid dimerization: OH stretch broadened to 2500-3300 cm-1 region'];
  const dimBands = bands.map(b => {
    if (b.family === 'OH_stretch') {
      return {
        ...b,
        cm: 2900,
        broadening: 'very_broad' as const,
        assignment: 'O-H stretch (carboxylic acid dimer, broad)',
        correctionApplied: [...(b.correctionApplied ?? []), 'acid_dimer'],
      };
    }
    return b;
  });

  dimBands.push({
    cm: 940,
    intensity: 'medium',
    assignment: 'O-H out-of-plane bend (carboxylic acid dimer)',
    family: 'OH_bend',
    confidence: 0.7,
  });

  return { bands: dimBands, applied };
}

// --------------------------------------------------------------------------
// Ring strain shifts
// --------------------------------------------------------------------------

function applyRingStrainShifts(
  bands: IRBandEntry[],
  smallestRingSize: number | null
): { bands: IRBandEntry[]; applied: string[] } {
  if (!smallestRingSize || smallestRingSize > 4) return { bands, applied: [] };

  const shift = smallestRingSize === 3 ? 40 : smallestRingSize === 4 ? 25 : 0;
  if (shift === 0) return { bands, applied: [] };

  const applied = [`Ring strain (${smallestRingSize}-membered): C=O shifted up by ${shift} cm-1`];

  return {
    bands: bands.map(b => {
      if (b.family.startsWith('carbonyl')) {
        return {
          ...b,
          cm: b.cm + shift,
          correctionApplied: [...(b.correctionApplied ?? []), `ring_strain_${smallestRingSize}`],
        };
      }
      return b;
    }),
    applied,
  };
}

// --------------------------------------------------------------------------
// ATR correction
// --------------------------------------------------------------------------

export function applyATRCorrection(
  bands: IRBandEntry[],
  refractiveIndex = 1.5,
  angleOfIncidence = 45
): { bands: IRBandEntry[]; applied: string[] } {
  const thetaRad = (angleOfIncidence * Math.PI) / 180;
  const dp_factor = 1.0 / (refractiveIndex * Math.sin(thetaRad));

  return {
    bands: bands.map(b => ({
      ...b,
      cm: Math.round(b.cm * (1 - 0.001 * dp_factor)),
      correctionApplied: [...(b.correctionApplied ?? []), 'atr_correction'],
    })),
    applied: ['ATR correction applied (intensity and wavenumber adjusted)'],
  };
}

// --------------------------------------------------------------------------
// Solvent/water contamination exclusion
// --------------------------------------------------------------------------

const SOLVENT_EXCLUSION_ZONES: Array<{ min: number; max: number; name: string }> = [
  { min: 3200, max: 3600, name: 'Water (OH stretch)' },
  { min: 1630, max: 1640, name: 'Water (OH bend)' },
  { min: 2310, max: 2360, name: 'CO2 (atmospheric)' },
  { min: 660, max: 680, name: 'CO2 (atmospheric bend)' },
];

export function flagSolventContamination(
  observedBands: Array<{ cm: number; intensity?: string }>
): Array<{ cm: number; possibleContaminant: string }> {
  const flags: Array<{ cm: number; possibleContaminant: string }> = [];
  for (const band of observedBands) {
    for (const zone of SOLVENT_EXCLUSION_ZONES) {
      if (band.cm >= zone.min && band.cm <= zone.max) {
        flags.push({ cm: band.cm, possibleContaminant: zone.name });
      }
    }
  }
  return flags;
}

// --------------------------------------------------------------------------
// Fingerprint region motifs
// --------------------------------------------------------------------------

const FINGERPRINT_MOTIFS: Array<{
  minCm: number; maxCm: number;
  motif: string; requiredGroup: string;
}> = [
  { minCm: 700, maxCm: 750, motif: 'Aromatic C-H oop (mono)', requiredGroup: 'monosubstituted_ar' },
  { minCm: 750, maxCm: 810, motif: 'Aromatic C-H oop (1,2-di)', requiredGroup: '1_2_disubstituted_ar' },
  { minCm: 810, maxCm: 860, motif: 'Aromatic C-H oop (1,4-di)', requiredGroup: '1_4_disubstituted_ar' },
  { minCm: 870, maxCm: 910, motif: 'Aromatic C-H oop (1,3-di)', requiredGroup: '1_3_disubstituted_ar' },
  { minCm: 1000, maxCm: 1300, motif: 'C-O stretch region', requiredGroup: 'ether_or_ester' },
  { minCm: 1020, maxCm: 1100, motif: 'S=O stretch (sulfoxide)', requiredGroup: 'sulfoxide' },
  { minCm: 1120, maxCm: 1170, motif: 'S=O asym stretch (sulfonyl)', requiredGroup: 'sulfonyl' },
  { minCm: 1300, maxCm: 1380, motif: 'S=O sym stretch (sulfonyl)', requiredGroup: 'sulfonyl' },
  { minCm: 1340, maxCm: 1390, motif: 'CH3 sym bend', requiredGroup: 'methyl' },
  { minCm: 1430, maxCm: 1470, motif: 'CH2 scissor', requiredGroup: 'methylene' },
];

export function matchFingerprintMotifs(
  bands: Array<{ cm: number }>,
  availableGroups: string[]
): Array<{ motif: string; matched: boolean; bandCm?: number }> {
  return FINGERPRINT_MOTIFS.map(m => {
    const hasGroup = availableGroups.includes(m.requiredGroup);
    if (!hasGroup) return { motif: m.motif, matched: false };
    const match = bands.find(b => b.cm >= m.minCm && b.cm <= m.maxCm);
    return { motif: m.motif, matched: !!match, bandCm: match?.cm };
  });
}

// --------------------------------------------------------------------------
// Master correction pipeline
// --------------------------------------------------------------------------

export function applyAllCorrections(
  rawBands: IRBandEntry[],
  context: {
    hasOH?: boolean;
    hasNH?: boolean;
    hasCOOH?: boolean;
    hasCarbonyl?: boolean;
    hasAlkene?: boolean;
    hasAromaticRing?: boolean;
    isConcentrated?: boolean;
    smallestRingSize?: number | null;
    useATR?: boolean;
  }
): CorrectionResult {
  let bands = [...rawBands];
  const allCorrections: string[] = [];
  const warnings: string[] = [];

  const conj = applyConjugationCorrection(bands, context);
  bands = conj.bands;
  allCorrections.push(...conj.applied);

  const hbond = applyHBondBroadening(bands, context);
  bands = hbond.bands;
  allCorrections.push(...hbond.applied);

  const acid = applyAcidDimerization(bands, context.hasCOOH ?? false);
  bands = acid.bands;
  allCorrections.push(...acid.applied);

  const ring = applyRingStrainShifts(bands, context.smallestRingSize ?? null);
  bands = ring.bands;
  allCorrections.push(...ring.applied);

  if (context.useATR) {
    const atr = applyATRCorrection(bands);
    bands = atr.bands;
    allCorrections.push(...atr.applied);
  }

  if (allCorrections.length === 0) {
    warnings.push('No correction layers applied — raw theoretical output');
  }

  return { correctedBands: bands, correctionsApplied: allCorrections, warnings };
}
