export type AuthorityTier =
  | 'AUTHORITATIVE_RDKIT_2D'
  | 'AUTHORITATIVE_RDKIT_3D'
  | 'AUTHORITATIVE_FID'
  | 'OBSERVED_PROCESSED'
  | 'GRAPH_FALLBACK'
  | 'DISPLAY_ONLY_FALLBACK';

export interface CanonicalMoleculePayload {
  smiles_raw: string;
  smiles_canonical: string;
  molblock_2d: string | null;
  molblock_3d: string | null;
  sdf_3d: string | null;
  xyz_3d: string | null;
  inchi: string | null;
  inchikey: string | null;
  formula: string | null;
  exact_mass: number | null;
  atom_count: number | null;
  bond_count: number | null;
  conformer_status: 'ready' | 'failed' | 'not_requested';
  depiction_status: 'ready' | 'failed' | 'not_requested';
  authority_tier: AuthorityTier;
  source_module: string;
  source_reason: string;
}
