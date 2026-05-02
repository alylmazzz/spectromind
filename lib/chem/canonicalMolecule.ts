import type { AuthorityTier, CanonicalMoleculePayload } from '@/lib/types/v2';

interface CanonicalMoleculeInput {
  smilesRaw: string;
  smilesCanonical: string;
  formula?: string | null;
  exactMass?: number | null;
  atomCount?: number | null;
  bondCount?: number | null;
  molblock2d?: string | null;
  molblock3d?: string | null;
  sdf3d?: string | null;
  xyz3d?: string | null;
  inchi?: string | null;
  inchikey?: string | null;
  conformerStatus?: CanonicalMoleculePayload['conformer_status'];
  depictionStatus?: CanonicalMoleculePayload['depiction_status'];
  authorityTier: AuthorityTier;
  sourceModule: string;
  sourceReason: string;
}

export function buildCanonicalMoleculePayload(input: CanonicalMoleculeInput): CanonicalMoleculePayload {
  return {
    smiles_raw: input.smilesRaw,
    smiles_canonical: input.smilesCanonical,
    molblock_2d: input.molblock2d ?? null,
    molblock_3d: input.molblock3d ?? null,
    sdf_3d: input.sdf3d ?? null,
    xyz_3d: input.xyz3d ?? null,
    inchi: input.inchi ?? null,
    inchikey: input.inchikey ?? null,
    formula: input.formula ?? null,
    exact_mass: input.exactMass ?? null,
    atom_count: input.atomCount ?? null,
    bond_count: input.bondCount ?? null,
    conformer_status: input.conformerStatus ?? 'not_requested',
    depiction_status: input.depictionStatus ?? 'not_requested',
    authority_tier: input.authorityTier,
    source_module: input.sourceModule,
    source_reason: input.sourceReason,
  };
}
