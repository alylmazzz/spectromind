/**
 * Canonical Solvent Definition
 *
 * Unifies the two divergent Solvent types:
 *   - lib/types/index.ts: 14 members, user-facing names (DMSO, MeOD, Acetone, etc.)
 *   - lib/types/nmr-simulation.ts: 7 members, IUPAC-style names (DMSO-d6, CD3OD, etc.)
 *
 * This bridge provides:
 *   1. A canonical Solvent type that is the superset of both.
 *   2. A mapping table for display names, NMR reference values, and synonyms.
 *   3. Converters from legacy types to canonical.
 */

export type CanonicalSolvent =
  | 'CDCl3'
  | 'DMSO-d6'
  | 'Acetone-d6'
  | 'D2O'
  | 'CD3OD'
  | 'C6D6'
  | 'CD2Cl2'
  | 'CD3CN'
  | 'THF-d8'
  | 'Toluene-d8'
  | 'Pyridine-d5'
  | 'DMF-d7'
  | 'AcOH-d4'
  | 'TFA-d';

export interface SolventInfo {
  canonical: CanonicalSolvent;
  displayName: string;
  aliases: string[];
  h1ReferencePpm: number;
  c13ReferencePpm: number;
  residualH1Ppm: number[];
  residualC13Ppm: number[];
}

export const SOLVENT_DATABASE: Record<CanonicalSolvent, SolventInfo> = {
  'CDCl3': {
    canonical: 'CDCl3',
    displayName: 'Chloroform-d',
    aliases: ['CDCl3', 'Chloroform'],
    h1ReferencePpm: 7.26,
    c13ReferencePpm: 77.16,
    residualH1Ppm: [7.26],
    residualC13Ppm: [77.16],
  },
  'DMSO-d6': {
    canonical: 'DMSO-d6',
    displayName: 'DMSO-d6',
    aliases: ['DMSO', 'DMSO-d6', 'Dimethylsulfoxide-d6'],
    h1ReferencePpm: 2.50,
    c13ReferencePpm: 39.52,
    residualH1Ppm: [2.50],
    residualC13Ppm: [39.52],
  },
  'Acetone-d6': {
    canonical: 'Acetone-d6',
    displayName: 'Acetone-d6',
    aliases: ['Acetone', 'Acetone-d6'],
    h1ReferencePpm: 2.05,
    c13ReferencePpm: 29.84,
    residualH1Ppm: [2.05],
    residualC13Ppm: [29.84, 206.26],
  },
  'D2O': {
    canonical: 'D2O',
    displayName: 'D2O',
    aliases: ['D2O', 'Deuterium oxide'],
    h1ReferencePpm: 4.79,
    c13ReferencePpm: 0,
    residualH1Ppm: [4.79],
    residualC13Ppm: [],
  },
  'CD3OD': {
    canonical: 'CD3OD',
    displayName: 'Methanol-d4',
    aliases: ['MeOD', 'CD3OD', 'Methanol-d4'],
    h1ReferencePpm: 3.31,
    c13ReferencePpm: 49.00,
    residualH1Ppm: [3.31, 4.87],
    residualC13Ppm: [49.00],
  },
  'C6D6': {
    canonical: 'C6D6',
    displayName: 'Benzene-d6',
    aliases: ['C6D6', 'Benzene', 'Benzene-d6'],
    h1ReferencePpm: 7.16,
    c13ReferencePpm: 128.06,
    residualH1Ppm: [7.16],
    residualC13Ppm: [128.06],
  },
  'CD2Cl2': {
    canonical: 'CD2Cl2',
    displayName: 'Dichloromethane-d2',
    aliases: ['CD2Cl2', 'DCM-d2'],
    h1ReferencePpm: 5.32,
    c13ReferencePpm: 53.84,
    residualH1Ppm: [5.32],
    residualC13Ppm: [53.84],
  },
  'CD3CN': {
    canonical: 'CD3CN',
    displayName: 'Acetonitrile-d3',
    aliases: ['CD3CN', 'MeCN-d3'],
    h1ReferencePpm: 1.94,
    c13ReferencePpm: 1.32,
    residualH1Ppm: [1.94],
    residualC13Ppm: [1.32, 118.26],
  },
  'THF-d8': {
    canonical: 'THF-d8',
    displayName: 'THF-d8',
    aliases: ['THF', 'THF-d8'],
    h1ReferencePpm: 1.72,
    c13ReferencePpm: 25.31,
    residualH1Ppm: [1.72, 3.58],
    residualC13Ppm: [25.31, 67.21],
  },
  'Toluene-d8': {
    canonical: 'Toluene-d8',
    displayName: 'Toluene-d8',
    aliases: ['Toluene-d8'],
    h1ReferencePpm: 2.08,
    c13ReferencePpm: 20.43,
    residualH1Ppm: [2.08, 6.97, 7.01, 7.09],
    residualC13Ppm: [20.43, 125.13, 127.96, 128.87, 137.48],
  },
  'Pyridine-d5': {
    canonical: 'Pyridine-d5',
    displayName: 'Pyridine-d5',
    aliases: ['Pyridine', 'Pyridine-d5'],
    h1ReferencePpm: 7.22,
    c13ReferencePpm: 123.87,
    residualH1Ppm: [7.22, 7.58, 8.74],
    residualC13Ppm: [123.87, 135.91, 149.90],
  },
  'DMF-d7': {
    canonical: 'DMF-d7',
    displayName: 'DMF-d7',
    aliases: ['DMF-d7'],
    h1ReferencePpm: 2.75,
    c13ReferencePpm: 29.76,
    residualH1Ppm: [2.75, 2.92, 8.03],
    residualC13Ppm: [29.76, 34.89, 162.62],
  },
  'AcOH-d4': {
    canonical: 'AcOH-d4',
    displayName: 'Acetic acid-d4',
    aliases: ['AcOH-d4'],
    h1ReferencePpm: 2.04,
    c13ReferencePpm: 20.00,
    residualH1Ppm: [2.04, 11.65],
    residualC13Ppm: [20.00, 175.00],
  },
  'TFA-d': {
    canonical: 'TFA-d',
    displayName: 'TFA-d',
    aliases: ['TFA-d'],
    h1ReferencePpm: 11.50,
    c13ReferencePpm: 116.60,
    residualH1Ppm: [11.50],
    residualC13Ppm: [116.60, 164.20],
  },
};

const aliasMap = new Map<string, CanonicalSolvent>();
for (const [key, info] of Object.entries(SOLVENT_DATABASE)) {
  for (const alias of info.aliases) {
    aliasMap.set(alias.toLowerCase(), key as CanonicalSolvent);
  }
}

export function resolveCanonicalSolvent(input: string): CanonicalSolvent | null {
  return aliasMap.get(input.toLowerCase()) ?? null;
}

export function getSolventInfo(input: string): SolventInfo | null {
  const canonical = resolveCanonicalSolvent(input);
  if (!canonical) return null;
  return SOLVENT_DATABASE[canonical];
}
