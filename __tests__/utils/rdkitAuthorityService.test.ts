import { describe, expect, it } from 'vitest';
import { RDKitAuthorityService } from '@/lib/services/v2/RDKitAuthorityService';

describe('RDKitAuthorityService', () => {
  it('builds canonical parse-smiles payload', () => {
    const payload = RDKitAuthorityService.fromParseSmiles('C[C@H](O)Cl', {
      canonical_smiles: 'C[C@H](O)Cl',
      formula: 'C2H5ClO',
      atoms: [{}, {}, {}, {}],
      bonds: [{}, {}, {}],
      coords3d: [{}, {}, {}, {}],
    });
    expect(payload.smiles_canonical).toBe('C[C@H](O)Cl');
    expect(payload.authority_tier).toBe('AUTHORITATIVE_RDKIT_2D');
    expect(payload.conformer_status).toBe('ready');
  });

  it('marks sdf-to-3d failure explicitly', () => {
    const payload = RDKitAuthorityService.fromSdfTo3D(null, null, false);
    expect(payload.authority_tier).toBe('AUTHORITATIVE_RDKIT_3D');
    expect(payload.conformer_status).toBe('failed');
  });
});
