import { describe, expect, it } from 'vitest';
import { buildForensicOutput, isForensicMessage } from '@/lib/chat/forensicMode';
import { buildStructuredEvidence } from '@/lib/chat/evidenceBuilder';

describe('forensic mode', () => {
  it('root-cause anahtar kelimelerini yakalar', () => {
    expect(isForensicMessage('root cause nedir, parity drift var mi?')).toBe(true);
    expect(isForensicMessage('normal bir soru')).toBe(false);
  });

  it('structured forensic çıktı üretir', () => {
    const evidence = buildStructuredEvidence({
      modality: '1H',
      solvent: 'AcOH-d4',
      qcStatus: 'FAIL_WITH_CONFIDENCE_CEILING',
      authorityTier: 'DISPLAY_ONLY_FALLBACK',
      moleculeRegions: ['3.1-4.2 ppm'],
      residualRegions: ['2.0 ppm'],
      artifactRegions: [],
      contradictions: ['title/body mismatch'],
    });
    const forensic = buildForensicOutput('why is this happening', evidence);
    expect(forensic.authority_source).toBe('DISPLAY_ONLY_FALLBACK');
    expect(forensic.next_best_remediation.length).toBeGreaterThan(0);
  });
});
