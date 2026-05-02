import { buildCanonicalMoleculePayload } from '@/lib/chem/canonicalMolecule';

interface ParseSmilesResult {
  canonical_smiles?: string;
  formula?: string;
  atoms?: unknown[];
  bonds?: unknown[];
  coords3d?: unknown[];
}

export class RDKitAuthorityService {
  static fromParseSmiles(smiles: string, result: ParseSmilesResult) {
    return buildCanonicalMoleculePayload({
      smilesRaw: smiles,
      smilesCanonical: result.canonical_smiles ?? smiles,
      formula: result.formula ?? null,
      atomCount: Array.isArray(result.atoms) ? result.atoms.length : null,
      bondCount: Array.isArray(result.bonds) ? result.bonds.length : null,
      authorityTier: 'AUTHORITATIVE_RDKIT_2D',
      depictionStatus: 'ready',
      conformerStatus: Array.isArray(result.coords3d) && result.coords3d.length > 0 ? 'ready' : 'failed',
      sourceModule: 'services/v2/RDKitAuthorityService',
      sourceReason: 'RDKit parse-smiles authority normalization',
    });
  }

  static fromDraw2D(smiles: string, atomCount?: number, bondCount?: number) {
    return buildCanonicalMoleculePayload({
      smilesRaw: smiles,
      smilesCanonical: smiles,
      atomCount: atomCount ?? null,
      bondCount: bondCount ?? null,
      authorityTier: 'AUTHORITATIVE_RDKIT_2D',
      depictionStatus: 'ready',
      conformerStatus: 'not_requested',
      sourceModule: 'services/v2/RDKitAuthorityService',
      sourceReason: 'RDKit draw-2d authority normalization',
    });
  }

  static fromGenerateSdf(smiles: string, sdf3d: string) {
    return buildCanonicalMoleculePayload({
      smilesRaw: smiles,
      smilesCanonical: smiles,
      sdf3d,
      authorityTier: 'AUTHORITATIVE_RDKIT_3D',
      depictionStatus: 'not_requested',
      conformerStatus: 'ready',
      sourceModule: 'services/v2/RDKitAuthorityService',
      sourceReason: 'RDKit generate-sdf authority normalization',
    });
  }

  static fromSdfTo3D(molBlock3d: string | null, atomCount: number | null, success: boolean) {
    return buildCanonicalMoleculePayload({
      smilesRaw: '',
      smilesCanonical: '',
      molblock3d: molBlock3d,
      sdf3d: molBlock3d,
      atomCount,
      conformerStatus: success ? 'ready' : 'failed',
      depictionStatus: 'not_requested',
      authorityTier: 'AUTHORITATIVE_RDKIT_3D',
      sourceModule: 'services/v2/RDKitAuthorityService',
      sourceReason: 'RDKit sdf-to-3d authority normalization',
    });
  }
}
