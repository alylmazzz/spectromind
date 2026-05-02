/**
 * Tek "MoleculeGraph" sözleşmesi: tüm motorlar (parse, NMR, 2D, verify) bu yapıyı kullanır.
 * RDKit parse çıktısı veya JS fallback bu forma normalize edilir.
 */
export interface MoleculeGraphAtom {
  index: number;
  symbol: string;
  formalCharge: number;
  implicitHydrogens: number;
  explicitHydrogens?: number;
  isAromatic: boolean;
  hybridization?: string;
  /** Ring membership: ring size (e.g. 6 for benzene) or 0 */
  ringSize?: number;
  /** Ring count for this atom */
  ringCount?: number;
}

export interface MoleculeGraphBond {
  beginAtomIdx: number;
  endAtomIdx: number;
  bondOrder: number;
  bondType: string;
  isAromatic: boolean;
  stereo?: string;
}

export interface MoleculeGraph {
  /** Canonical SMILES (RDKit veya fallback) */
  canonicalSmiles: string;
  /** Orijinal giriş SMILES */
  inputSmiles?: string;
  atoms: MoleculeGraphAtom[];
  bonds: MoleculeGraphBond[];
  formula: string;
  /** Hill system */
  formulaHill?: string;
  /** Atom sayımları { C, H, N, O, ... } */
  atomCounts: Record<string, number>;
  /** DBE */
  dbe?: number;
  /** Kaynak: rdkit | js_fallback */
  source: 'rdkit' | 'js_fallback';
  /** Chiral merkezler */
  chiralCenters?: Array<{ atomIdx: number; type: 'R' | 'S' | 'unknown' }>;
  /** 2D/3D koordinatlar (opsiyonel) */
  coords2d?: Array<{ x: number; y: number }>;
  coords3d?: Array<{ x: number; y: number; z: number }>;
}

/**
 * Parse/standardize sonucu: başarılı ise MoleculeGraph, değilse root_cause.
 */
export interface ParseAndStandardizeResult {
  success: boolean;
  canonicalSmiles?: string;
  moleculeGraph?: MoleculeGraph;
  rootCause?: string;
  message?: string;
  /** Hata detayı (debug) */
  detail?: string;
}

/**
 * Tek doğruluk kaynağı: Coverage raporu ve Teyit raporu aynı normalize objeden hesaplanmalı.
 * İki farklı yol/iki farklı sayaç olmayacak (0.3).
 */
export interface NormalizedSpectra {
  h1: Array<{ ppm: number; integral?: number; mult?: string; assign?: string; is_ex?: boolean }>;
  c13: Array<{ ppm: number; type?: string; assign?: string }>;
  hsqc: Array<{ h: number; c: number; assign?: string }>;
  cosy: Array<{ h1_ppm: number; h2_ppm: number; assign?: string }>;
  hmbc: Array<{ h_ppm: number; c_ppm: number; assign?: string }>;
  noesy: Array<{ h1_ppm: number; h2_ppm: number; assign?: string }>;
  ms: Array<{ mz: number; intensity?: number; assign?: string }>;
  ir: Array<{ freq: number; int?: string; assign?: string }>;
  meta?: {
    scenario?: string;
    solvent?: string;
    fieldMHz?: number;
    snrClass?: 'normal' | 'lowSNR' | 'highRes';
    integral_mode?: 'absolute_h' | 'relative_area' | 'unknown';
    integral_scale?: number;
    reference_ppm_offsets?: Record<string, number>;
  };
}
