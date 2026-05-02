/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FTIR SPECTRUM VALIDATION UTILITIES
 * Based on Silverstein "Spectrometric Identification of Organic Compounds"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file contains validation functions for FTIR spectroscopy based on
 * characteristic absorption patterns from Silverstein methodology.
 *
 * Key Features:
 * - Aldehyde C-H doublet detection (2750 cm⁻¹ - highly diagnostic!)
 * - Carboxylic acid super-broad O-H (2400-3400 cm⁻¹)
 * - Amide primary/secondary/tertiary discrimination
 * - Anhydride doublet pattern (always 2 C=O bands)
 * - Amine N-H pattern counting
 * - Nitro compound doublet validation
 * - Nitrile vs Alkyne vs Isocyanate differentiation
 * - Ester two-band C-O signature
 * - β-Diketone keto-enol tautomerization
 */

// ═════════════════════════════════════════════════════════════════════════════
// 🎯 CRITICAL: ALDEHYDE C-H DOUBLET (MOST DIAGNOSTIC!)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔬 CRITICAL PRIORITY: Aldehyde C-H Doublet Detector
 *
 * "The most characteristic feature for aldehydes in FTIR"
 *
 * Aldehydes show a unique C-H doublet pattern:
 * - 2860-2800 cm⁻¹: weak (often obscured by aliphatic C-H)
 * - 2760-2700 cm⁻¹: weak but DIAGNOSTIC (virtually unique to aldehydes!)
 *
 * This 2750 cm⁻¹ band is almost never seen in other functional groups,
 * making it one of the most reliable FTIR signatures.
 *
 * Examples from Silverstein:
 * - Nonanal (Fig 2.36): 2750 cm⁻¹ clearly visible
 * - Crotonaldehyde (Fig 2.37): conjugated, C=O ~1690 cm⁻¹
 * - Benzaldehyde (Fig 2.38): aromatic, C=O ~1700 cm⁻¹
 *
 * @param peaks - Array of FTIR peak wavenumbers (cm⁻¹)
 * @param hasCarbonyl - Whether molecule has C=O peak at 1730-1690 cm⁻¹
 *
 * @returns Aldehyde detection result
 */
export interface AldehydeDoubletDetection {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  peaks: {
    high?: number;  // 2860-2800 cm⁻¹
    low?: number;   // 2760-2700 cm⁻¹ (DIAGNOSTIC!)
  };
  interpretation: string;
  warning: string;
}

export function detectAldehydeCHDoublet(
  peaks: number[],
  hasCarbonyl?: boolean
): AldehydeDoubletDetection {
  // Find peaks in aldehyde C-H region
  const highBand = peaks.find(p => p >= 2800 && p <= 2860);
  const lowBand = peaks.find(p => p >= 2700 && p <= 2760);

  // CRITICAL: 2750 cm⁻¹ band is virtually diagnostic
  if (lowBand) {
    if (hasCarbonyl) {
      return {
        detected: true,
        confidence: 'high',
        peaks: { high: highBand, low: lowBand },
        interpretation: `⭐⭐ ALDEHYDE DETECTED! The ${lowBand.toFixed(0)} cm⁻¹ band is HIGHLY DIAGNOSTIC for R-CHO.`,
        warning: `🔬 CRITICAL: The 2750 cm⁻¹ band is virtually unique to aldehydes. Combined with C=O, aldehyde is almost certain.`
      };
    } else {
      return {
        detected: true,
        confidence: 'medium',
        peaks: { high: highBand, low: lowBand },
        interpretation: `Aldehyde C-H doublet detected at ${lowBand.toFixed(0)} cm⁻¹`,
        warning: `⚠️ 2750 cm⁻¹ band present but no C=O detected. Check for C=O at 1730-1690 cm⁻¹.`
      };
    }
  }

  // Only high band present (weak evidence)
  if (highBand && !lowBand) {
    return {
      detected: false,
      confidence: 'low',
      peaks: { high: highBand },
      interpretation: `Weak aldehyde C-H at ${highBand.toFixed(0)} cm⁻¹ (high band only)`,
      warning: `💡 Diagnostic low band (2750 cm⁻¹) not detected. Aldehyde less likely.`
    };
  }

  return {
    detected: false,
    confidence: 'low',
    peaks: {},
    interpretation: 'No aldehyde C-H doublet detected',
    warning: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔥 CARBOXYLIC ACID SUPER-BROAD O-H
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔥 CRITICAL: Carboxylic Acid Super-Broad O-H Detector
 *
 * "The most characteristic feature in the spectrum" - Silverstein
 *
 * Carboxylic acids show an extremely broad O-H stretch due to strong
 * hydrogen bonding in dimers:
 * - 3400-2400 cm⁻¹: VERY BROAD, strong (often obscures C-H completely!)
 * - ~1710 cm⁻¹: C=O (dimer, H-bonded)
 * - ~1260 cm⁻¹: C-O stretch
 * - ~930 cm⁻¹: O-H out-of-plane bend
 *
 * Key: The breadth of this band (1000 cm⁻¹ wide!) is unique to COOH.
 *
 * @param hasBroadOH - Whether broad absorption from 2400-3400 cm⁻¹ exists
 * @param carbonylPeak - C=O peak position (cm⁻¹)
 * @param hasCOStretch - Whether C-O stretch at ~1260 cm⁻¹ exists
 *
 * @returns Carboxylic acid detection
 */
export interface CarboxylicAcidDetection {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  features: {
    superBroadOH: boolean;    // 2400-3400 cm⁻¹
    dimerCO: boolean;         // ~1710 cm⁻¹
    COStretch: boolean;       // ~1260 cm⁻¹
  };
  interpretation: string;
  suggestion: string;
}

export function detectCarboxylicAcid(
  hasBroadOH: boolean,
  carbonylPeak?: number,
  hasCOStretch?: boolean
): CarboxylicAcidDetection {
  const isDimerCO = carbonylPeak && carbonylPeak >= 1700 && carbonylPeak <= 1720;
  const isMonomerCO = carbonylPeak && carbonylPeak >= 1750 && carbonylPeak <= 1770;

  // All features present → HIGH confidence
  if (hasBroadOH && isDimerCO && hasCOStretch) {
    return {
      detected: true,
      confidence: 'high',
      features: {
        superBroadOH: true,
        dimerCO: true,
        COStretch: true
      },
      interpretation: `⭐⭐ CARBOXYLIC ACID CONFIRMED! Super-broad O-H (2400-3400 cm⁻¹) + dimer C=O (${carbonylPeak.toFixed(0)} cm⁻¹) + C-O stretch`,
      suggestion: `🔥 "If this broad H-bonded band is present with proper C=O, carboxylic acid is almost certainly indicated." - Silverstein`
    };
  }

  // Broad O-H + dimer C=O (strong evidence)
  if (hasBroadOH && isDimerCO) {
    return {
      detected: true,
      confidence: 'high',
      features: {
        superBroadOH: true,
        dimerCO: true,
        COStretch: !!hasCOStretch
      },
      interpretation: `⭐ CARBOXYLIC ACID DETECTED! Super-broad O-H + dimer C=O (${carbonylPeak.toFixed(0)} cm⁻¹)`,
      suggestion: `Carboxylic acid highly likely. The extremely broad O-H (1000 cm⁻¹ width!) is characteristic of strong H-bonding in COOH dimers.`
    };
  }

  // Broad O-H + monomer C=O (dilute solution)
  if (hasBroadOH && isMonomerCO) {
    return {
      detected: true,
      confidence: 'medium',
      features: {
        superBroadOH: true,
        dimerCO: false,
        COStretch: !!hasCOStretch
      },
      interpretation: `Carboxylic acid (monomer form): C=O at ${carbonylPeak.toFixed(0)} cm⁻¹`,
      suggestion: `Monomer C=O suggests dilute solution or gas phase. In neat liquid/solid, expect dimer C=O at 1710 cm⁻¹.`
    };
  }

  // Only broad O-H (weak evidence)
  if (hasBroadOH && !carbonylPeak) {
    return {
      detected: false,
      confidence: 'low',
      features: {
        superBroadOH: true,
        dimerCO: false,
        COStretch: false
      },
      interpretation: 'Broad O-H detected but no C=O',
      suggestion: `⚠️ Broad O-H could be carboxylic acid, phenol, or alcohol. Check for C=O at 1710 cm⁻¹ to confirm COOH.`
    };
  }

  return {
    detected: false,
    confidence: 'low',
    features: {
      superBroadOH: false,
      dimerCO: false,
      COStretch: false
    },
    interpretation: 'No carboxylic acid features detected',
    suggestion: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 💊 AMIDE PRIMARY/SECONDARY/TERTIARY DISCRIMINATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 💊 HIGH PRIORITY: Amide Type Discriminator
 *
 * Amides can be distinguished by N-H stretch patterns:
 *
 * Primary amide (R-CONH₂):
 * - 3350 cm⁻¹: N-H asymmetric
 * - 3180 cm⁻¹: N-H symmetric (TWO bands!)
 * - 1700-1640 cm⁻¹: C=O
 * - 1640-1620 cm⁻¹: N-H bend (strong, broad)
 *
 * Secondary amide (R-CONHR):
 * - ~3300 cm⁻¹: N-H (ONE band)
 * - ~3100 cm⁻¹: Fermi resonance overtone (weak)
 * - 1700-1640 cm⁻¹: C=O
 * - ~1550 cm⁻¹: N-H bend + C-N stretch
 *
 * Tertiary amide (R-CONR₂):
 * - NO N-H bands!
 * - 1680-1630 cm⁻¹: C=O only
 *
 * @param nhBandCount - Number of N-H bands in 3500-3000 cm⁻¹ region
 * @param carbonylPeak - C=O peak position
 * @param hasNHBend - Whether N-H bend at 1640-1550 cm⁻¹ exists
 *
 * @returns Amide type classification
 */
export interface AmideTypeClassification {
  type: 'primary' | 'secondary' | 'tertiary' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function classifyAmideType(
  nhBandCount: number,
  carbonylPeak?: number,
  hasNHBend?: boolean
): AmideTypeClassification {
  const hasCarbonyl = carbonylPeak && carbonylPeak >= 1630 && carbonylPeak <= 1700;

  // Primary amide: 2 N-H bands
  if (nhBandCount === 2) {
    return {
      type: 'primary',
      confidence: hasCarbonyl ? 'high' : 'medium',
      interpretation: `⭐ PRIMARY AMIDE (R-CONH₂): TWO N-H bands detected (3350 + 3180 cm⁻¹)`,
      suggestion: `Primary amides show characteristic N-H doublet due to asymmetric + symmetric stretching. ${hasCarbonyl ? `C=O at ${carbonylPeak.toFixed(0)} cm⁻¹ confirms amide.` : 'Check for C=O at 1680-1640 cm⁻¹.'}`
    };
  }

  // Secondary amide: 1 N-H band
  if (nhBandCount === 1) {
    return {
      type: 'secondary',
      confidence: hasCarbonyl ? 'high' : 'medium',
      interpretation: `⭐ SECONDARY AMIDE (R-CONHR): ONE N-H band detected (~3300 cm⁻¹)`,
      suggestion: `Secondary amides show single N-H band. ${hasNHBend ? 'N-H bend at 1550 cm⁻¹ confirms secondary amide.' : 'Check for N-H bend at 1550 cm⁻¹.'} ${hasCarbonyl ? `C=O at ${carbonylPeak.toFixed(0)} cm⁻¹.` : ''}`
    };
  }

  // Tertiary amide: 0 N-H bands
  if (nhBandCount === 0 && hasCarbonyl) {
    return {
      type: 'tertiary',
      confidence: 'high',
      interpretation: `⭐ TERTIARY AMIDE (R-CONR₂): NO N-H bands, C=O at ${carbonylPeak?.toFixed(0)} cm⁻¹`,
      suggestion: `Tertiary amides have no N-H groups, only C=O. Easily distinguished from primary/secondary by absence of 3300 cm⁻¹ band.`
    };
  }

  return {
    type: 'unknown',
    confidence: 'low',
    interpretation: `Cannot classify amide type (N-H bands: ${nhBandCount}, C=O: ${hasCarbonyl ? 'yes' : 'no'})`,
    suggestion: 'Count N-H bands in 3500-3000 cm⁻¹: 2 bands → primary, 1 band → secondary, 0 bands → tertiary'
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔄 ANHYDRIDE SYMMETRIC/ASYMMETRIC DOUBLET
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔄 CRITICAL: Anhydride C=O Doublet Detector
 *
 * "Anhydrides are easily recognized by TWO strong C=O bands" - Silverstein
 *
 * Anhydrides ALWAYS show two C=O bands due to symmetric + asymmetric stretching:
 *
 * Normal aliphatic anhydride:
 * - 1830-1800 cm⁻¹: asymmetric C=O stretch
 * - 1775-1740 cm⁻¹: symmetric C=O stretch
 *
 * Cyclic anhydride (ring strain):
 * - Higher frequencies (e.g., 1860 + 1780 cm⁻¹ for 5-membered ring)
 *
 * Example: Propionic anhydride (Fig 2.57)
 *
 * @param peaks - FTIR peak wavenumbers
 *
 * @returns Anhydride detection
 */
export interface AnhydrideDoubletDetection {
  detected: boolean;
  type?: 'aliphatic' | 'cyclic';
  confidence: 'high' | 'medium' | 'low';
  peaks: {
    asymmetric?: number;  // 1830-1800 cm⁻¹
    symmetric?: number;   // 1775-1740 cm⁻¹
  };
  interpretation: string;
  suggestion: string;
}

export function detectAnhydrideDoublet(peaks: number[]): AnhydrideDoubletDetection {
  // Find asymmetric C=O (higher frequency)
  const asymmetric = peaks.find(p => p >= 1800 && p <= 1860);

  // Find symmetric C=O (lower frequency)
  const symmetric = peaks.find(p => p >= 1740 && p <= 1790);

  // Both bands present → HIGH confidence
  if (asymmetric && symmetric) {
    const isCyclic = asymmetric > 1840; // Ring strain shifts asymmetric higher

    return {
      detected: true,
      type: isCyclic ? 'cyclic' : 'aliphatic',
      confidence: 'high',
      peaks: { asymmetric, symmetric },
      interpretation: `⭐⭐ ${isCyclic ? 'CYCLIC' : 'ALIPHATIC'} ANHYDRIDE DETECTED! TWO C=O bands: ${asymmetric.toFixed(0)} cm⁻¹ (asym) + ${symmetric.toFixed(0)} cm⁻¹ (sym)`,
      suggestion: `Anhydrides are easily recognized by TWO strong C=O bands. This is characteristic and diagnostic. ${isCyclic ? 'Higher frequency suggests cyclic anhydride (ring strain).' : ''}`
    };
  }

  // Only one band (weak evidence)
  if (asymmetric || symmetric) {
    const singlePeak = asymmetric || symmetric;
    return {
      detected: false,
      confidence: 'low',
      peaks: asymmetric ? { asymmetric } : { symmetric },
      interpretation: `Single C=O at ${singlePeak?.toFixed(0)} cm⁻¹ (not anhydride doublet)`,
      suggestion: `⚠️ Anhydrides MUST show TWO C=O bands. Single C=O suggests ester, ketone, or acid, not anhydride.`
    };
  }

  return {
    detected: false,
    confidence: 'low',
    peaks: {},
    interpretation: 'No anhydride C=O doublet detected',
    suggestion: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 👥 AMINE PRIMARY/SECONDARY/TERTIARY N-H PATTERNS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 👥 HIGH PRIORITY: Amine Type Discriminator
 *
 * Amines are distinguished by N-H stretch patterns:
 *
 * Primary amine (R-NH₂):
 * - 3400 cm⁻¹: N-H asymmetric
 * - 3300 cm⁻¹: N-H symmetric (TWO bands)
 * - ~3200 cm⁻¹: Fermi resonance overtone (shoulder)
 * - 1640-1560 cm⁻¹: N-H bend (medium-strong, broad)
 * - ~800 cm⁻¹: N-H out-of-plane
 *
 * Secondary aliphatic (R₂NH):
 * - ~3300 cm⁻¹: N-H (ONE band, VERY WEAK!)
 *
 * Secondary aromatic (Ar-NH-R):
 * - ~3400 cm⁻¹: N-H (ONE band, stronger than aliphatic)
 * - ~1500 cm⁻¹: N-H bend
 *
 * Tertiary amine (R₃N):
 * - NO N-H bands!
 *
 * @param nhBandCount - Number of N-H bands in 3500-3200 cm⁻¹
 * @param isAromatic - Whether amine is aromatic
 * @param hasNHBend - Whether N-H bend at 1640-1500 cm⁻¹ exists
 *
 * @returns Amine type classification
 */
export interface AmineTypeClassification {
  type: 'primary' | 'secondary-aliphatic' | 'secondary-aromatic' | 'tertiary' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function classifyAmineType(
  nhBandCount: number,
  isAromatic?: boolean,
  hasNHBend?: boolean
): AmineTypeClassification {
  // Primary amine: 2 N-H bands
  if (nhBandCount === 2) {
    return {
      type: 'primary',
      confidence: hasNHBend ? 'high' : 'medium',
      interpretation: `⭐ PRIMARY AMINE (R-NH₂): TWO N-H bands (3400 + 3300 cm⁻¹)`,
      suggestion: `Primary amines show N-H doublet (asymmetric + symmetric). ${hasNHBend ? 'N-H bend at 1640-1560 cm⁻¹ confirms primary amine.' : 'Check for N-H bend at 1640-1560 cm⁻¹.'}`
    };
  }

  // Secondary amine: 1 N-H band
  if (nhBandCount === 1) {
    if (isAromatic) {
      return {
        type: 'secondary-aromatic',
        confidence: 'high',
        interpretation: `⭐ SECONDARY AROMATIC AMINE (Ar-NH-R): ONE N-H band (~3400 cm⁻¹)`,
        suggestion: `Aromatic secondary amines show stronger N-H band than aliphatic. ${hasNHBend ? 'N-H bend at ~1500 cm⁻¹ confirms.' : ''}`
      };
    } else {
      return {
        type: 'secondary-aliphatic',
        confidence: 'medium',
        interpretation: `SECONDARY ALIPHATIC AMINE (R₂NH): ONE N-H band (~3300 cm⁻¹, very weak)`,
        suggestion: `Aliphatic secondary amines show very weak N-H band. Easily missed in spectra.`
      };
    }
  }

  // Tertiary amine: 0 N-H bands
  if (nhBandCount === 0) {
    return {
      type: 'tertiary',
      confidence: 'high',
      interpretation: `⭐ TERTIARY AMINE (R₃N): NO N-H bands`,
      suggestion: `Tertiary amines have no N-H groups. Absence of 3300 cm⁻¹ band is diagnostic.`
    };
  }

  return {
    type: 'unknown',
    confidence: 'low',
    interpretation: `Cannot classify amine type (N-H bands: ${nhBandCount})`,
    suggestion: 'Count N-H bands: 2 → primary, 1 → secondary, 0 → tertiary'
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 💥 NITRO COMPOUND DIAGNOSTIC DOUBLET
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 💥 HIGH PRIORITY: Nitro Compound Doublet Validator
 *
 * Nitro compounds show characteristic N=O doublet:
 *
 * Aliphatic nitro (R-NO₂):
 * - 1600-1530 cm⁻¹: N=O asymmetric (strong)
 * - 1390-1300 cm⁻¹: N=O symmetric (medium)
 *
 * Aromatic nitro (Ar-NO₂):
 * - 1550-1490 cm⁻¹: N=O asymmetric (strong)
 * - 1355-1315 cm⁻¹: N=O symmetric (strong, nearly equal!)
 *
 * Key: Aromatic shows TWO bands of EQUAL intensity
 *
 * Example: Nitrobenzene (Fig 2.66): 1525 + 1350 cm⁻¹
 *
 * @param peaks - FTIR peak wavenumbers
 * @param isAromatic - Whether nitro is on aromatic ring
 *
 * @returns Nitro compound detection
 */
export interface NitroDoubletDetection {
  detected: boolean;
  type?: 'aliphatic' | 'aromatic';
  confidence: 'high' | 'medium' | 'low';
  peaks: {
    asymmetric?: number;  // 1600-1490 cm⁻¹
    symmetric?: number;   // 1390-1300 cm⁻¹
  };
  interpretation: string;
  suggestion: string;
}

export function detectNitroDoublet(
  peaks: number[],
  isAromatic?: boolean
): NitroDoubletDetection {
  // Find asymmetric N=O
  const asymmetric = peaks.find(p => p >= 1490 && p <= 1600);

  // Find symmetric N=O
  const symmetric = peaks.find(p => p >= 1300 && p <= 1390);

  if (asymmetric && symmetric) {
    // Determine if aromatic based on peak positions
    const isAromaticPattern = asymmetric >= 1490 && asymmetric <= 1550 &&
                              symmetric >= 1315 && symmetric <= 1355;

    const type = isAromatic || isAromaticPattern ? 'aromatic' : 'aliphatic';

    return {
      detected: true,
      type,
      confidence: 'high',
      peaks: { asymmetric, symmetric },
      interpretation: `⭐ ${type.toUpperCase()} NITRO COMPOUND: ${asymmetric.toFixed(0)} cm⁻¹ (asym) + ${symmetric.toFixed(0)} cm⁻¹ (sym)`,
      suggestion: `${type === 'aromatic' ? 'Aromatic nitro shows TWO bands of nearly EQUAL intensity. This is diagnostic.' : 'Aliphatic nitro shows asymmetric band stronger than symmetric.'}`
    };
  }

  // Only one band
  if (asymmetric || symmetric) {
    return {
      detected: false,
      confidence: 'low',
      peaks: asymmetric ? { asymmetric } : { symmetric },
      interpretation: `Single N=O band at ${(asymmetric || symmetric)?.toFixed(0)} cm⁻¹`,
      suggestion: `⚠️ Nitro compounds show TWO characteristic bands. Single band may not be NO₂.`
    };
  }

  return {
    detected: false,
    confidence: 'low',
    peaks: {},
    interpretation: 'No nitro doublet detected',
    suggestion: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🎯 NITRILE vs ALKYNE vs ISOCYANATE DIFFERENTIATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🎯 CRITICAL: Triple Bond Differentiation
 *
 * Three functional groups absorb near 2200 cm⁻¹:
 *
 * Nitrile (R-C≡N):
 * - 2270-2210 cm⁻¹: C≡N stretch (medium, sharp)
 * - Aliphatic: ~2250 cm⁻¹
 * - Aromatic: ~2230 cm⁻¹ (conjugation lowers)
 * - NO band at 3300 cm⁻¹
 *
 * Alkyne (R-C≡C-H):
 * - ~3300 cm⁻¹: ≡C-H stretch (sharp, strong)
 * - ~2150 cm⁻¹: C≡C stretch (weak, broad)
 * - BOTH bands present
 *
 * Isocyanate (R-N=C=O):
 * - ~2270 cm⁻¹: N=C=O (broad, VERY INTENSE!)
 * - Much broader and stronger than nitrile
 *
 * @param peaks - FTIR peak wavenumbers
 * @param hasTerminalCH - Whether ≡C-H at 3300 cm⁻¹ exists
 * @param peakIntensity - Relative intensity of 2200 cm⁻¹ band
 *
 * @returns Triple bond type classification
 */
export interface TripleBondClassification {
  type: 'nitrile' | 'alkyne' | 'isocyanate' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function classifyTripleBond(
  peaks: number[],
  hasTerminalCH?: boolean,
  peakIntensity?: 'weak' | 'medium' | 'strong' | 'very strong'
): TripleBondClassification {
  const nitrileRegion = peaks.find(p => p >= 2210 && p <= 2270);
  const alkyneRegion = peaks.find(p => p >= 2100 && p <= 2200);

  // Alkyne: BOTH 3300 cm⁻¹ and 2150 cm⁻¹
  if (hasTerminalCH && alkyneRegion) {
    return {
      type: 'alkyne',
      confidence: 'high',
      interpretation: `⭐ TERMINAL ALKYNE (R-C≡C-H): ≡C-H at 3300 cm⁻¹ + C≡C at ${alkyneRegion.toFixed(0)} cm⁻¹`,
      suggestion: `Terminal alkynes show BOTH bands. Sharp 3300 cm⁻¹ is diagnostic for ≡C-H.`
    };
  }

  // Isocyanate: ~2270 cm⁻¹ VERY INTENSE and BROAD
  if (nitrileRegion && peakIntensity === 'very strong') {
    return {
      type: 'isocyanate',
      confidence: 'high',
      interpretation: `⭐ ISOCYANATE (R-N=C=O): ${nitrileRegion.toFixed(0)} cm⁻¹ (VERY intense and broad)`,
      suggestion: `Isocyanates show exceptionally strong and broad absorption at 2270 cm⁻¹. Much stronger than nitrile.`
    };
  }

  // Nitrile: ~2250 cm⁻¹, no 3300 cm⁻¹
  if (nitrileRegion && !hasTerminalCH) {
    return {
      type: 'nitrile',
      confidence: 'high',
      interpretation: `⭐ NITRILE (R-C≡N): ${nitrileRegion.toFixed(0)} cm⁻¹ (medium, sharp)`,
      suggestion: `Nitriles show sharp medium band at 2250 cm⁻¹. Aromatic nitriles slightly lower (~2230) due to conjugation.`
    };
  }

  // Internal alkyne: 2150 cm⁻¹ only (no terminal C-H)
  if (alkyneRegion && !hasTerminalCH) {
    return {
      type: 'alkyne',
      confidence: 'medium',
      interpretation: `INTERNAL ALKYNE (R-C≡C-R'): ${alkyneRegion.toFixed(0)} cm⁻¹ (weak)`,
      suggestion: `Internal alkynes show weak C≡C stretch, no terminal C-H. Symmetric alkynes may not show C≡C band at all.`
    };
  }

  return {
    type: 'unknown',
    confidence: 'low',
    interpretation: 'No triple bond detected',
    suggestion: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🎨 ESTER TWO-BAND C-O SIGNATURE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🎨 HIGH PRIORITY: Ester C-O Two-Band Pattern Detector
 *
 * Esters show characteristic C-O pattern that distinguishes them from ketones:
 *
 * Normal ester (R-COO-R):
 * - 1750-1735 cm⁻¹: C=O (strong)
 * - 1300-1150 cm⁻¹: C-O "acid side" (VERY strong, broad)
 * - 1150-1000 cm⁻¹: C-O "alcohol side" (weaker)
 *
 * Compare to ketone:
 * - Ketone C-O: 1300-1100 cm⁻¹ (weaker, narrower)
 * - Ester C-O: 1300-1000 cm⁻¹ (stronger, broader, TWO bands)
 *
 * @param carbonylPeak - C=O position
 * @param hasStrongCO - Whether strong C-O at 1300-1150 cm⁻¹
 * @param hasWeakCO - Whether weaker C-O at 1150-1000 cm⁻¹
 *
 * @returns Ester detection
 */
export interface EsterCOPatternDetection {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  interpretation: string;
  suggestion: string;
}

export function detectEsterCOPattern(
  carbonylPeak: number,
  hasStrongCO: boolean,
  hasWeakCO: boolean
): EsterCOPatternDetection {
  const isEsterCO = carbonylPeak >= 1735 && carbonylPeak <= 1750;

  // All features present
  if (isEsterCO && hasStrongCO && hasWeakCO) {
    return {
      detected: true,
      confidence: 'high',
      interpretation: `⭐⭐ ESTER CONFIRMED! C=O at ${carbonylPeak.toFixed(0)} cm⁻¹ + TWO strong C-O bands`,
      suggestion: `Esters distinguished from ketones by STRONG and BROAD C-O bands in 1300-1000 cm⁻¹. The two-band pattern (acid side + alcohol side) is characteristic.`
    };
  }

  // C=O + strong C-O
  if (isEsterCO && hasStrongCO) {
    return {
      detected: true,
      confidence: 'high',
      interpretation: `⭐ ESTER DETECTED! C=O + strong C-O (acid side)`,
      suggestion: `Strong broad C-O at 1300-1150 cm⁻¹ confirms ester. Check for weaker C-O at 1150-1000 cm⁻¹ (alcohol side).`
    };
  }

  // Only C=O (ambiguous)
  if (isEsterCO && !hasStrongCO) {
    return {
      detected: false,
      confidence: 'low',
      interpretation: `C=O at ${carbonylPeak.toFixed(0)} cm⁻¹ but no strong C-O`,
      suggestion: `⚠️ Could be ester or ketone. Check for strong C-O bands at 1300-1000 cm⁻¹ to confirm ester.`
    };
  }

  return {
    detected: false,
    confidence: 'low',
    interpretation: 'No ester C-O pattern detected',
    suggestion: ''
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔀 β-DIKETONE KETO-ENOL TAUTOMERIZATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔀 ADVANCED: β-Diketone Keto-Enol Tautomer Detector
 *
 * β-Diketones (e.g., 2,4-pentanedione) exist in equilibrium:
 *
 * Keto form:
 * - 1723 cm⁻¹: symmetric C=O stretch
 * - 1706 cm⁻¹: asymmetric C=O stretch (doublet!)
 * - Two distinct C=O bands
 *
 * Enol form:
 * - 1622 cm⁻¹: C=O (hydrogen-bonded, significantly lowered!)
 * - 3200-2400 cm⁻¹: O-H (broad, weak)
 * - Single lowered C=O
 *
 * Example: 2,4-pentanedione (Fig 2.42)
 *
 * AI should predict BOTH forms if β-diketone detected!
 *
 * @param peaks - FTIR peak wavenumbers
 * @param hasBroadOH - Whether broad O-H exists
 *
 * @returns Tautomer detection
 */
export interface DiketoneTautomerDetection {
  ketoForm: boolean;
  enolForm: boolean;
  interpretation: string;
  suggestion: string;
}

export function detectDiketoneTautomers(
  peaks: number[],
  hasBroadOH: boolean
): DiketoneTautomerDetection {
  // Keto form: TWO C=O peaks near 1720-1700 cm⁻¹
  const ketoCO1 = peaks.find(p => p >= 1715 && p <= 1730);
  const ketoCO2 = peaks.find(p => p >= 1700 && p <= 1715);
  const ketoForm = !!(ketoCO1 && ketoCO2);

  // Enol form: LOWERED C=O near 1620 cm⁻¹ + broad O-H
  const enolCO = peaks.find(p => p >= 1615 && p <= 1630);
  const enolForm = !!(enolCO && hasBroadOH);

  if (ketoForm && enolForm) {
    return {
      ketoForm: true,
      enolForm: true,
      interpretation: `⭐⭐ β-DIKETONE TAUTOMERIZATION! BOTH keto (${ketoCO1?.toFixed(0)} + ${ketoCO2?.toFixed(0)} cm⁻¹) and enol (${enolCO?.toFixed(0)} cm⁻¹) forms detected`,
      suggestion: `β-Diketones exist in keto-enol equilibrium. Keto shows C=O doublet, enol shows lowered H-bonded C=O at 1622 cm⁻¹. Both forms present confirms β-diketone structure.`
    };
  }

  if (ketoForm) {
    return {
      ketoForm: true,
      enolForm: false,
      interpretation: `Keto form detected: C=O doublet at ${ketoCO1?.toFixed(0)} + ${ketoCO2?.toFixed(0)} cm⁻¹`,
      suggestion: `Two C=O bands suggest β-diketone keto form. Check for enol form (lowered C=O at 1622 cm⁻¹ + broad O-H).`
    };
  }

  if (enolForm) {
    return {
      ketoForm: false,
      enolForm: true,
      interpretation: `Enol form detected: lowered C=O at ${enolCO?.toFixed(0)} cm⁻¹ + broad O-H`,
      suggestion: `Lowered H-bonded C=O suggests enol form. Check for keto form (C=O doublet at 1720-1700 cm⁻¹).`
    };
  }

  return {
    ketoForm: false,
    enolForm: false,
    interpretation: 'No β-diketone tautomers detected',
    suggestion: ''
  };
}
