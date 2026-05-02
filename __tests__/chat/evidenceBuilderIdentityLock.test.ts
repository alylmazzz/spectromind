import { describe, expect, it } from 'vitest';
import { buildStructuredEvidence } from '@/lib/chat/evidenceBuilder';

describe('buildStructuredEvidence identity lock', () => {
  it('EXACT_ID_LOCK identity_surface ile tüm yüzey kaynakları final_verdict_lock olur', () => {
    const ev = buildStructuredEvidence({
      modality: '13C',
      solvent: 'Pyridine-d5',
      qcStatus: 'PASS',
      authorityTier: 'AUTHORITATIVE_OBSERVED',
      moleculeRegions: [],
      residualRegions: [],
      artifactRegions: [],
      contradictions: [],
      identitySurface: {
        display_molecule: 'Oleanolic Acid',
        display_iupac: '3beta-Hydroxy-olean-12-en-28-oic acid',
        display_formula: 'C30H48O3',
        display_smiles: 'CC',
        final_identity_source: 'PUBCHEM_CID_10494_EXACT_ID_LOCK',
        exact_id_active: true,
        parity_status: 'LOCKED',
        verdict_mode: 'EXACT_ID_CONFIDENCE_CEILING',
        display_verification_status: 'PASS',
      },
      observability: {
        iupac_source: 'final_verdict_lock',
        formula_source: 'final_verdict_lock',
        smiles_source: 'final_verdict_lock',
        verdict_source: 'lib/verification/finalVerdict.ts',
        parity_status: 'LOCKED',
        fallback_leak_detected: false,
        authority_breach_detected: false,
        assistant_response_mode: 'deterministic_or_llm',
        assistant_language_mode: 'tr',
      },
    });
    expect(ev.formula_source).toBe('final_verdict_lock');
    expect(ev.iupac_source).toBe('final_verdict_lock');
    expect(ev.smiles_source).toBe('final_verdict_lock');
    expect(ev.structure_card_source).toBe('final_verdict_lock');
    expect(ev.export_source).toBe('final_verdict_lock');
  });
});
