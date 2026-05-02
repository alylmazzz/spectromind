/**
 * SpectroMind v1.5 Default Configuration
 *
 * Central configuration for all engines - follows DRY principle.
 * All magic numbers and thresholds are defined here.
 *
 * @module config/defaults
 * @version 1.5.0
 */

export const DEFAULT_CONFIG = {
  // System version
  version: '1.5.0',
  codename: 'Singularity',

  // Mixture Detection
  mixture: {
    allow_mixtures: true,
    impurity_threshold: 0.10, // 10% altı safsızlık
    min_major_component: 0.70, // Ana bileşen en az %70 olmalı
  },

  // Confidence Policies
  confidence: {
    policies: {
      research: 0.70,  // Araştırma için %70 yeterli
      patent: 0.90,    // Patent için %90 gerekli
      quality_control: 0.95, // QC için %95
    },
    default_policy: 'research' as const,
  },

  // Dynamic RMSD Tolerances (ppm)
  rmsd: {
    tolerances: {
      aromatic: 1.5,      // Aromatik yapılar
      aliphatic: 2.5,     // Alifatik yapılar
      heterocyclic: 3.0,  // Heterohalkalılar
      carbonyl: 2.0,      // Karbonil grupları
    },
    default_tolerance: 2.5,
  },

  // Solvent Effects
  solvents: {
    supported: ['DMSO-d6', 'CDCl3', 'D2O', 'CD3OD', 'Acetone-d6'] as const,
    default: 'DMSO-d6' as const,

    // OH/NH proton shifts (ppm) by solvent
    exchangeable_shifts: {
      'DMSO-d6': { OH: 4.5, NH: 7.5, NH2: 6.5 },
      'CDCl3': { OH: 2.5, NH: 4.5, NH2: 3.5 },
      'D2O': { OH: 4.8, NH: null, NH2: null }, // Exchange edilir
      'CD3OD': { OH: 4.9, NH: null, NH2: null },
      'Acetone-d6': { OH: 3.5, NH: 6.5, NH2: 5.5 },
    },
  },

  // 2D NMR Correlations
  correlations: {
    noesy: {
      min_intensity: 0.1,        // Minimum yoğunluk
      max_distance_angstrom: 5.0, // Maksimum mesafe (Å)
      r_power: -6,               // r^-6 ilişkisi
    },
    hmbc: {
      min_intensity: 0.1,
      max_bonds: 3, // 2J, 3J bağları
    },
  },

  // Carbon-13 NMR
  carbon13: {
    silent_cq_penalty: 0.0, // Silent Cq'ya ceza yok
    dept_weights: {
      dept_135: 1.0,
      dept_90: 0.8,
      dept_45: 0.6,
    },
  },

  // Genetic Assembler
  assembler: {
    population_size: 100,
    generations: 50,
    mutation_rate: 0.1,
    crossover_rate: 0.7,
    elitism_count: 5,
  },

  // Validator
  validator: {
    min_fragments: 2,           // En az 2 fragment gerekli
    max_strain_energy: 50,      // kcal/mol
    check_bredt_rule: true,     // Bredt kuralı kontrolü
    check_valence: true,        // Valans kontrolü
  },

  // Physics
  physics: {
    temperature_k: 298,         // Standart sıcaklık
    ph_neutral: 7.0,
    boltzmann_cutoff: 0.01,    // %1 altı konformerler ihmal
  },

} as const;

export type SolventType = typeof DEFAULT_CONFIG.solvents.supported[number];
export type ConfidencePolicy = keyof typeof DEFAULT_CONFIG.confidence.policies;
export type MoleculeClass = keyof typeof DEFAULT_CONFIG.rmsd.tolerances;
