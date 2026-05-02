/**
 * 13C NMR Molecule Library
 * Contains common organic molecules with their 13C NMR chemical shifts
 */

import { Carbon13Peak } from '@/lib/types';

export interface Carbon13Molecule {
  name: string;
  formula: string;
  cid?: number;
  peaks: Carbon13Peak[];
  solvent?: string;
  frequency?: number;
  category?: string;
}

export interface Carbon13Category {
  name: string;
  molecules: Carbon13Molecule[];
}

/**
 * 13C NMR Molecule Database
 * Organized by chemical categories
 */
export const carbon13MoleculeDatabase: Carbon13Category[] = [
  {
    name: 'Aldehydes & Ketones',
    molecules: [
      {
        name: 'Vanillin',
        formula: 'C8H8O3',
        cid: 1183,
        category: 'Aldehyde',
        solvent: 'DMSO',
        peaks: [
          { ppm: 191.5, carbonType: 'CH', assignment: 'CHO (aldehyde)' },
          { ppm: 153.2, carbonType: 'Cq', assignment: 'C-OH (aromatic)' },
          { ppm: 148.5, carbonType: 'Cq', assignment: 'C-OCH3 (aromatic)' },
          { ppm: 130.5, carbonType: 'Cq', assignment: 'C-1 (aromatic)' },
          { ppm: 127.0, carbonType: 'CH', assignment: 'C-6 (aromatic)' },
          { ppm: 115.8, carbonType: 'CH', assignment: 'C-5 (aromatic)' },
          { ppm: 110.2, carbonType: 'CH', assignment: 'C-2 (aromatic)' },
          { ppm: 56.0, carbonType: 'CH3', assignment: 'OCH3' }
        ]
      },
      {
        name: 'Acetophenone',
        formula: 'C8H8O',
        cid: 7410,
        category: 'Ketone',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 198.1, carbonType: 'Cq', assignment: 'C=O' },
          { ppm: 137.0, carbonType: 'Cq', assignment: 'C-1 (aromatic)' },
          { ppm: 133.0, carbonType: 'CH', assignment: 'C-2,6 (aromatic)' },
          { ppm: 128.5, carbonType: 'CH', assignment: 'C-3,5 (aromatic)' },
          { ppm: 128.2, carbonType: 'CH', assignment: 'C-4 (aromatic)' },
          { ppm: 26.5, carbonType: 'CH3', assignment: 'CH3' }
        ]
      },
      {
        name: 'Benzaldehyde',
        formula: 'C7H6O',
        cid: 240,
        category: 'Aldehyde',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 192.3, carbonType: 'CH', assignment: 'CHO' },
          { ppm: 136.5, carbonType: 'Cq', assignment: 'C-1 (aromatic)' },
          { ppm: 134.2, carbonType: 'CH', assignment: 'C-2,6 (aromatic)' },
          { ppm: 129.6, carbonType: 'CH', assignment: 'C-4 (aromatic)' },
          { ppm: 128.7, carbonType: 'CH', assignment: 'C-3,5 (aromatic)' }
        ]
      }
    ]
  },
  {
    name: 'Carboxylic Acids & Esters',
    molecules: [
      {
        name: 'Acetic Acid',
        formula: 'C2H4O2',
        cid: 176,
        category: 'Carboxylic Acid',
        solvent: 'D2O',
        peaks: [
          { ppm: 178.5, carbonType: 'Cq', assignment: 'COOH' },
          { ppm: 20.8, carbonType: 'CH3', assignment: 'CH3' }
        ]
      },
      {
        name: 'Ethyl Acetate',
        formula: 'C4H8O2',
        cid: 8857,
        category: 'Ester',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 171.2, carbonType: 'Cq', assignment: 'C=O' },
          { ppm: 60.3, carbonType: 'CH2', assignment: 'OCH2' },
          { ppm: 20.9, carbonType: 'CH3', assignment: 'CH3CO' },
          { ppm: 14.2, carbonType: 'CH3', assignment: 'CH3CH2' }
        ]
      },
      {
        name: 'Benzoic Acid',
        formula: 'C7H6O2',
        cid: 243,
        category: 'Carboxylic Acid',
        solvent: 'DMSO',
        peaks: [
          { ppm: 167.8, carbonType: 'Cq', assignment: 'COOH' },
          { ppm: 130.5, carbonType: 'Cq', assignment: 'C-1 (aromatic)' },
          { ppm: 129.8, carbonType: 'CH', assignment: 'C-2,6 (aromatic)' },
          { ppm: 129.0, carbonType: 'CH', assignment: 'C-4 (aromatic)' },
          { ppm: 128.4, carbonType: 'CH', assignment: 'C-3,5 (aromatic)' }
        ]
      }
    ]
  },
  {
    name: 'Alcohols & Phenols',
    molecules: [
      {
        name: 'Ethanol',
        formula: 'C2H6O',
        cid: 702,
        category: 'Alcohol',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 58.0, carbonType: 'CH2', assignment: 'CH2OH' },
          { ppm: 18.2, carbonType: 'CH3', assignment: 'CH3' }
        ]
      },
      {
        name: 'Phenol',
        formula: 'C6H6O',
        cid: 996,
        category: 'Phenol',
        solvent: 'DMSO',
        peaks: [
          { ppm: 157.3, carbonType: 'Cq', assignment: 'C-OH' },
          { ppm: 130.1, carbonType: 'CH', assignment: 'C-2,6' },
          { ppm: 120.5, carbonType: 'CH', assignment: 'C-4' },
          { ppm: 115.8, carbonType: 'CH', assignment: 'C-3,5' }
        ]
      }
    ]
  },
  {
    name: 'Aromatic Compounds',
    molecules: [
      {
        name: 'Benzene',
        formula: 'C6H6',
        cid: 241,
        category: 'Aromatic',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 128.4, carbonType: 'CH', assignment: 'Aromatic C-H' }
        ]
      },
      {
        name: 'Toluene',
        formula: 'C7H8',
        cid: 1140,
        category: 'Aromatic',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 137.8, carbonType: 'Cq', assignment: 'C-1 (aromatic)' },
          { ppm: 129.2, carbonType: 'CH', assignment: 'C-3,5 (aromatic)' },
          { ppm: 128.3, carbonType: 'CH', assignment: 'C-2,6 (aromatic)' },
          { ppm: 125.4, carbonType: 'CH', assignment: 'C-4 (aromatic)' },
          { ppm: 21.4, carbonType: 'CH3', assignment: 'CH3' }
        ]
      },
      {
        name: 'Anisole',
        formula: 'C7H8O',
        cid: 7519,
        category: 'Aromatic Ether',
        solvent: 'CDCl3',
        peaks: [
          { ppm: 159.8, carbonType: 'Cq', assignment: 'C-OCH3' },
          { ppm: 129.5, carbonType: 'CH', assignment: 'C-2,6' },
          { ppm: 120.7, carbonType: 'CH', assignment: 'C-4' },
          { ppm: 114.1, carbonType: 'CH', assignment: 'C-3,5' },
          { ppm: 55.2, carbonType: 'CH3', assignment: 'OCH3' }
        ]
      }
    ]
  }
];

/**
 * Load and return all 13C NMR molecules from the database
 */
export async function loadCarbon13Library(): Promise<Carbon13Category[]> {
  return carbon13MoleculeDatabase;
}

/**
 * Get all molecules as a flat array
 */
export function getAllCarbon13Molecules(): Carbon13Molecule[] {
  return carbon13MoleculeDatabase.flatMap(cat => cat.molecules);
}

/**
 * Search molecules by name
 */
export function searchCarbon13MoleculeByName(query: string): Carbon13Molecule[] {
  const lowerQuery = query.toLowerCase();
  return getAllCarbon13Molecules().filter(mol =>
    mol.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search molecules by formula
 */
export function searchCarbon13MoleculeByFormula(formula: string): Carbon13Molecule[] {
  return getAllCarbon13Molecules().filter(mol =>
    mol.formula === formula
  );
}
