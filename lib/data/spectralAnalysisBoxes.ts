/**
 * Spectral Analysis Boxes
 * Based on: Silverstein "Spectrometric Identification of Organic Compounds"
 *
 * Each compound type includes:
 * - Chemical shift ranges (δ in ppm)
 * - Coupling constants (J in Hz)
 * - Multiplicity patterns
 * - Diagnostic features
 */

export interface CouplingInfo {
  type: string;
  range: [number, number]; // [min, max] in Hz
  description: string;
}

export interface ChemicalShiftRange {
  group: string;
  range: [number, number]; // [min, max] in ppm
  description: string;
  typicalMultiplicity?: string[];
}

export interface SpectralAnalysisBox {
  compoundType: string;
  category: string;
  chemicalShifts: ChemicalShiftRange[];
  couplingConstants: CouplingInfo[];
  diagnosticFeatures: string[];
  examples?: string[];
}

/**
 * Complete spectral analysis reference library
 */
export const SPECTRAL_ANALYSIS_BOXES: SpectralAnalysisBox[] = [
  // ==================== ALKANES ====================
  {
    compoundType: 'Alkanes',
    category: 'Saturated Hydrocarbons',
    chemicalShifts: [
      {
        group: 'Methyl (CH₃)',
        range: [0.7, 1.3],
        description: 'Primary carbon, typically upfield',
        typicalMultiplicity: ['t', 'd', 's']
      },
      {
        group: 'Methylene (CH₂)',
        range: [1.2, 1.4],
        description: 'Secondary carbon, middle region',
        typicalMultiplicity: ['q', 'quint', 'm']
      },
      {
        group: 'Methine (CH)',
        range: [1.4, 1.7],
        description: 'Tertiary carbon, most downfield in alkanes',
        typicalMultiplicity: ['sept', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [6, 8],
        description: 'Aliphatic H-C-C-H coupling, typically 6-8 Hz'
      },
      {
        type: '²J (geminal)',
        range: [10, 15],
        description: 'H-C-H geminal coupling (rarely observed)'
      }
    ],
    diagnosticFeatures: [
      'Simple splitting patterns (s, d, t, q)',
      'All peaks in aliphatic region (0.7-1.7 ppm)',
      'No peaks beyond 2 ppm indicates no functional groups',
      'Integration ratios match molecular formula'
    ],
    examples: ['Hexane', 'Isooctane', 'Cyclohexane']
  },

  // ==================== ALKENES ====================
  {
    compoundType: 'Alkenes',
    category: 'Unsaturated Hydrocarbons',
    chemicalShifts: [
      {
        group: 'Vinyl (C=C-H)',
        range: [4.5, 6.5],
        description: 'Olefinic protons, diagnostic for C=C',
        typicalMultiplicity: ['dd', 'dt', 'ddd', 'm']
      },
      {
        group: 'Allylic (C=C-C-H)',
        range: [1.6, 2.6],
        description: 'Protons on carbon adjacent to C=C',
        typicalMultiplicity: ['d', 't', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J_trans',
        range: [11, 18],
        description: 'Trans coupling across C=C (larger J value)'
      },
      {
        type: '³J_cis',
        range: [6, 15],
        description: 'Cis coupling across C=C (smaller J value)'
      },
      {
        type: '²J (geminal)',
        range: [0, 3],
        description: 'Geminal coupling on same carbon of C=C'
      },
      {
        type: '⁴J (allylic)',
        range: [0, 3],
        description: 'Long-range coupling through C=C-C-H'
      }
    ],
    diagnosticFeatures: [
      'Vinyl H appear at 4.5-6.5 ppm (KEY diagnostic)',
      'Complex splitting patterns (dd, ddd)',
      'J_trans > J_cis distinguishes stereochemistry',
      'Allylic protons appear downfield from alkane CH₂ (1.6-2.6 vs 1.2-1.4)'
    ],
    examples: ['1-Hexene', 'Styrene', 'Cyclohexene']
  },

  // ==================== AROMATICS ====================
  {
    compoundType: 'Aromatic Compounds',
    category: 'Aromatic Hydrocarbons',
    chemicalShifts: [
      {
        group: 'Aromatic H',
        range: [6.5, 8.0],
        description: 'Benzene ring protons, typically ~7.0-7.3 ppm',
        typicalMultiplicity: ['s', 'd', 't', 'dd', 'm']
      },
      {
        group: 'Benzylic H (Ar-CH₂)',
        range: [2.3, 2.7],
        description: 'Protons on carbon directly attached to benzene',
        typicalMultiplicity: ['s', 'd', 't']
      }
    ],
    couplingConstants: [
      {
        type: '³J_ortho',
        range: [7, 10],
        description: 'Ortho coupling (adjacent H on benzene ring)'
      },
      {
        type: '⁴J_meta',
        range: [2, 3],
        description: 'Meta coupling (2 carbons apart on ring)'
      },
      {
        type: '⁵J_para',
        range: [0, 1],
        description: 'Para coupling (opposite sides, very weak)'
      }
    ],
    diagnosticFeatures: [
      'Aromatic H at 6.5-8.0 ppm (MAJOR diagnostic)',
      'Integration of aromatic region reveals # of aromatic H',
      'Substitution pattern from coupling (s = symmetric, complex = unsymmetric)',
      'Benzylic CH₂ appears as singlet if no vicinal H'
    ],
    examples: ['Benzene', 'Toluene', 'Ethylbenzene', 'p-Xylene']
  },

  // ==================== ALKYNES ====================
  {
    compoundType: 'Alkynes',
    category: 'Unsaturated Hydrocarbons',
    chemicalShifts: [
      {
        group: 'Acetylenic (≡C-H)',
        range: [1.7, 2.7],
        description: 'Terminal alkyne H (anisotropic shielding!)',
        typicalMultiplicity: ['s', 't']
      },
      {
        group: 'Propargylic (≡C-C-H)',
        range: [1.6, 2.6],
        description: 'Protons on carbon adjacent to C≡C',
        typicalMultiplicity: ['d', 't', 'q']
      }
    ],
    couplingConstants: [
      {
        type: '⁴J (long-range)',
        range: [2, 3],
        description: 'H-C≡C-C-H coupling through triple bond'
      }
    ],
    diagnosticFeatures: [
      'Acetylenic H is UNUSUALLY UPFIELD (1.7-2.7 ppm) due to anisotropic shielding',
      'Often appears as sharp singlet or small triplet',
      'IR spectroscopy needed to confirm C≡C (2100-2260 cm⁻¹)',
      'Internal alkynes have NO acetylenic H'
    ],
    examples: ['1-Hexyne', 'Phenylacetylene', 'Propyne']
  },

  // ==================== ALKYL HALIDES ====================
  {
    compoundType: 'Alkyl Halides',
    category: 'Halogenated Compounds',
    chemicalShifts: [
      {
        group: 'C-H-I',
        range: [2.0, 4.0],
        description: 'Proton on carbon bearing iodine',
        typicalMultiplicity: ['d', 't', 'q', 'm']
      },
      {
        group: 'C-H-Br',
        range: [2.7, 4.1],
        description: 'Proton on carbon bearing bromine',
        typicalMultiplicity: ['d', 't', 'q', 'm']
      },
      {
        group: 'C-H-Cl',
        range: [3.1, 4.1],
        description: 'Proton on carbon bearing chlorine',
        typicalMultiplicity: ['d', 't', 'q', 'm']
      },
      {
        group: 'C-H-F',
        range: [4.2, 4.8],
        description: 'Proton on carbon bearing fluorine',
        typicalMultiplicity: ['d', 't', 'dd', 'dt']
      }
    ],
    couplingConstants: [
      {
        type: '²J_HF (geminal)',
        range: [45, 55],
        description: 'H-C-F coupling (VERY LARGE, diagnostic for F)'
      },
      {
        type: '³J_HF (vicinal)',
        range: [15, 25],
        description: 'H-C-C-F coupling (still large)'
      },
      {
        type: '³J_HH (normal)',
        range: [6, 8],
        description: 'Normal H-C-C-H coupling in halides'
      }
    ],
    diagnosticFeatures: [
      'Shift increases with halogen electronegativity: I < Br < Cl < F',
      'Fluorine compounds show LARGE coupling constants (²J ≈ 50 Hz)',
      'CH₂Cl₂ appears as singlet at 5.3 ppm (common solvent peak)',
      'Geminal coupling appears for CH₂X groups'
    ],
    examples: ['Chloroform (CHCl₃)', 'Bromoethane', 'Fluorobenzene']
  },

  // ==================== ALCOHOLS ====================
  {
    compoundType: 'Alcohols',
    category: 'Oxygen-Containing Compounds',
    chemicalShifts: [
      {
        group: 'O-H',
        range: [0.5, 5.5],
        description: 'Hydroxyl proton (broad, variable with concentration/temp)',
        typicalMultiplicity: ['br s', 'br']
      },
      {
        group: 'C-H-OH',
        range: [3.3, 4.0],
        description: 'Proton on carbon bearing OH group',
        typicalMultiplicity: ['d', 't', 'q', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [6, 8],
        description: 'Normal aliphatic coupling (if no H-bonding)'
      }
    ],
    diagnosticFeatures: [
      'O-H peak is BROAD and VARIABLE (exchange with trace water)',
      'O-H chemical shift depends on concentration and temperature',
      'D₂O shake test: O-H peak disappears upon D₂O addition',
      'C-H-OH appears at 3.3-4.0 ppm (downfield from alkanes)'
    ],
    examples: ['Ethanol', 'Isopropanol', 'Benzyl alcohol']
  },

  // ==================== ETHERS ====================
  {
    compoundType: 'Ethers',
    category: 'Oxygen-Containing Compounds',
    chemicalShifts: [
      {
        group: 'C-H-O-C (aliphatic)',
        range: [3.3, 4.0],
        description: 'Protons on carbon next to ether oxygen',
        typicalMultiplicity: ['s', 't', 'q', 'm']
      },
      {
        group: 'C-H-O-Ar (aromatic ether)',
        range: [3.7, 4.3],
        description: 'Protons on carbon next to aryl ether (anisole-type)',
        typicalMultiplicity: ['s']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [6, 8],
        description: 'Normal aliphatic coupling'
      }
    ],
    diagnosticFeatures: [
      'No O-H peak (distinguishes from alcohols)',
      'C-H-O region (3.3-4.0 ppm) is diagnostic',
      'Symmetrical ethers show fewer peaks',
      'Aromatic methyl ethers (OCH₃) appear as sharp singlet ~3.8 ppm'
    ],
    examples: ['Diethyl ether', 'THF', 'Anisole (methoxybenzene)']
  },

  // ==================== ALDEHYDES ====================
  {
    compoundType: 'Aldehydes',
    category: 'Carbonyl Compounds',
    chemicalShifts: [
      {
        group: 'CHO (aldehyde H)',
        range: [9.0, 10.0],
        description: 'Aldehyde proton (VERY DOWNFIELD, diagnostic)',
        typicalMultiplicity: ['s', 'd', 't']
      },
      {
        group: 'α-H (C-C(=O)H)',
        range: [2.0, 2.7],
        description: 'Protons on carbon adjacent to carbonyl',
        typicalMultiplicity: ['d', 't', 'q', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [1, 3],
        description: 'Small coupling for CHO to α-CH (if present)'
      }
    ],
    diagnosticFeatures: [
      'Aldehyde H at 9-10 ppm is HIGHLY DIAGNOSTIC',
      'Integration = 1H for CHO peak',
      'α-protons shifted downfield vs normal alkanes',
      'IR carbonyl stretch at 1720-1740 cm⁻¹ confirms C=O'
    ],
    examples: ['Benzaldehyde', 'Acetaldehyde', 'Propanal']
  },

  // ==================== KETONES ====================
  {
    compoundType: 'Ketones',
    category: 'Carbonyl Compounds',
    chemicalShifts: [
      {
        group: 'α-H (C-C(=O)-C)',
        range: [2.0, 2.7],
        description: 'Protons on carbons adjacent to carbonyl',
        typicalMultiplicity: ['s', 't', 'q', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [6, 8],
        description: 'Normal aliphatic coupling'
      }
    ],
    diagnosticFeatures: [
      'NO aldehyde H (distinguishes from aldehydes)',
      'α-protons at 2.0-2.7 ppm',
      'Symmetric ketones (acetone) show singlet',
      'IR carbonyl at 1705-1725 cm⁻¹'
    ],
    examples: ['Acetone', 'Acetophenone', '2-Butanone']
  },

  // ==================== CARBOXYLIC ACIDS ====================
  {
    compoundType: 'Carboxylic Acids',
    category: 'Carbonyl Compounds',
    chemicalShifts: [
      {
        group: 'COOH',
        range: [10.0, 13.0],
        description: 'Carboxylic acid proton (VERY BROAD, far downfield)',
        typicalMultiplicity: ['br s']
      },
      {
        group: 'α-H (C-COOH)',
        range: [2.0, 2.5],
        description: 'Protons on carbon adjacent to carboxyl',
        typicalMultiplicity: ['s', 't', 'q', 'm']
      }
    ],
    couplingConstants: [],
    diagnosticFeatures: [
      'COOH peak at 10-13 ppm is EXTREMELY DIAGNOSTIC',
      'Very broad peak due to H-bonding and exchange',
      'D₂O shake test: COOH peak disappears',
      'Often most downfield peak in spectrum'
    ],
    examples: ['Acetic acid', 'Benzoic acid', 'Propionic acid']
  },

  // ==================== ESTERS ====================
  {
    compoundType: 'Esters',
    category: 'Carbonyl Compounds',
    chemicalShifts: [
      {
        group: 'O-C-H (ester alkyl)',
        range: [3.7, 4.8],
        description: 'Protons on carbon attached to ester oxygen',
        typicalMultiplicity: ['s', 't', 'q', 'm']
      },
      {
        group: 'α-H to C=O',
        range: [2.0, 2.5],
        description: 'Protons on carbon adjacent to carbonyl',
        typicalMultiplicity: ['s', 't', 'q', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [6, 8],
        description: 'Normal aliphatic coupling'
      }
    ],
    diagnosticFeatures: [
      'O-CH₂ or O-CH₃ at 3.7-4.8 ppm (key diagnostic)',
      'Methyl ester (OCH₃) appears as sharp singlet ~3.7 ppm',
      'Ethyl ester shows quartet (OCH₂) + triplet (CH₃) pattern',
      'IR carbonyl at 1735-1750 cm⁻¹'
    ],
    examples: ['Ethyl acetate', 'Methyl benzoate', 'Butyl propanoate']
  },

  // ==================== AMINES ====================
  {
    compoundType: 'Amines',
    category: 'Nitrogen-Containing Compounds',
    chemicalShifts: [
      {
        group: 'N-H',
        range: [0.5, 5.0],
        description: 'Amine proton (broad, variable, exchangeable)',
        typicalMultiplicity: ['br s', 'br']
      },
      {
        group: 'C-H-NH₂',
        range: [2.2, 2.9],
        description: 'Protons on carbon bearing amine group',
        typicalMultiplicity: ['d', 't', 'q', 'm']
      }
    ],
    couplingConstants: [
      {
        type: '³J (vicinal)',
        range: [6, 8],
        description: 'Normal aliphatic coupling (if no N-H coupling)'
      }
    ],
    diagnosticFeatures: [
      'N-H peak is broad and exchangeable (D₂O test)',
      'Primary amines (RNH₂) show broad peak integrating for 2H',
      'Secondary amines (R₂NH) show broad peak for 1H',
      'Tertiary amines (R₃N) have NO N-H peak',
      'Aromatic amines (aniline) have N-H at 3-5 ppm'
    ],
    examples: ['Ethylamine', 'Diethylamine', 'Aniline']
  },

  // ==================== AMIDES ====================
  {
    compoundType: 'Amides',
    category: 'Nitrogen-Containing Compounds',
    chemicalShifts: [
      {
        group: 'N-H',
        range: [5.0, 9.0],
        description: 'Amide proton (broader than amine, less exchangeable)',
        typicalMultiplicity: ['br s']
      },
      {
        group: 'α-H to C=O',
        range: [2.0, 2.5],
        description: 'Protons on carbon adjacent to carbonyl',
        typicalMultiplicity: ['s', 't', 'q', 'm']
      }
    ],
    couplingConstants: [],
    diagnosticFeatures: [
      'N-H at 5-9 ppm (more downfield than simple amines)',
      'Primary amides (RCONH₂) show 2 broad peaks or 1 very broad peak',
      'N-H exchange is SLOWER than alcohols/amines',
      'IR shows carbonyl at 1650-1690 cm⁻¹ + N-H stretch'
    ],
    examples: ['Acetamide', 'Benzamide', 'N-Methylacetamide']
  }
];

/**
 * Get spectral analysis box for a compound type
 */
export function getSpectralAnalysisBox(compoundType: string): SpectralAnalysisBox | undefined {
  return SPECTRAL_ANALYSIS_BOXES.find(
    box => box.compoundType.toLowerCase() === compoundType.toLowerCase()
  );
}

/**
 * Predict possible compound types based on chemical shift
 */
export function predictCompoundTypes(shift: number): SpectralAnalysisBox[] {
  const matches: SpectralAnalysisBox[] = [];

  SPECTRAL_ANALYSIS_BOXES.forEach(box => {
    box.chemicalShifts.forEach(csRange => {
      if (shift >= csRange.range[0] && shift <= csRange.range[1]) {
        if (!matches.includes(box)) {
          matches.push(box);
        }
      }
    });
  });

  return matches;
}

/**
 * Get all compound type categories
 */
export function getCompoundCategories(): string[] {
  const categories = new Set<string>();
  SPECTRAL_ANALYSIS_BOXES.forEach(box => categories.add(box.category));
  return Array.from(categories);
}

/**
 * Get all boxes in a category
 */
export function getBoxesByCategory(category: string): SpectralAnalysisBox[] {
  return SPECTRAL_ANALYSIS_BOXES.filter(box => box.category === category);
}

/**
 * Multiplet Skewing (Roof Effect) - Section 5.17
 *
 * When two multiplets are coupled to each other, they "lean" toward each other.
 * This phenomenon is called "multiplet skewing" or the "roof effect".
 *
 * Example:
 *   Triplet → Doublet
 *   /|\      /|\
 *  / | \    / | \
 * 1  2  3  1  2
 * (lean →) (← lean)
 *
 * The triplet leans RIGHT toward the doublet
 * The doublet leans LEFT toward the triplet
 *
 * This visual cue helps identify which multiplets are coupled to each other.
 */
export interface MultipletSkewingInfo {
  description: string;
  visualExample: string;
  diagnosticValue: string;
  aiPromptContext: string;
}

export const MULTIPLET_SKEWING_INFO: MultipletSkewingInfo = {
  description:
    'Multiplet skewing (roof effect): Coupled multiplets lean toward each other. ' +
    'The outer peaks of each multiplet are smaller on the side facing away from the coupled partner.',

  visualExample:
    'Example: Ethyl group (CH₃-CH₂-)\n' +
    '  Triplet (CH₃):  /|\\  → leans toward quartet\n' +
    '  Quartet (CH₂): /|\\ ← leans toward triplet\n' +
    'The multiplets point at each other like arrows.',

  diagnosticValue:
    'Use skewing to identify coupling partners:\n' +
    '1. If two multiplets lean toward each other → they are coupled\n' +
    '2. Direction of lean shows which peaks interact\n' +
    '3. Stronger coupling = more pronounced skewing',

  aiPromptContext:
    'IMPORTANT NMR ANALYSIS CONTEXT:\n' +
    'Multiplet Skewing (Roof Effect): When analyzing NMR data, coupled multiplets exhibit ' +
    '"skewing" or "leaning" toward each other. This means:\n' +
    '- Coupled peaks are not perfectly symmetric\n' +
    '- The multiplet intensities slope toward the coupling partner\n' +
    '- This helps identify which protons are coupled (adjacent in structure)\n' +
    '- Example: In an ethyl group, the CH₃ triplet leans toward the CH₂ quartet, ' +
    'confirming they are coupled (J_CH₃-CH₂)\n' +
    'Use this information when determining connectivity and coupling patterns.'
};

/**
 * Get AI prompt context about multiplet skewing
 */
export function getMultipletSkewingContext(): string {
  return MULTIPLET_SKEWING_INFO.aiPromptContext;
}
