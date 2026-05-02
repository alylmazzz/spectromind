import { describe, expect, it } from 'vitest';
import { buildStructuredEvidence } from '@/lib/chat/evidenceBuilder';
import { enforceParityGuard } from '@/lib/chat/parityGuard';

describe('golden chatbot regression suite', () => {
  const scenarios = [
    'polymer-like weak acidic-solvent spectrum',
    'triterpenoid-like strong aliphatic spectrum',
    'small aromatic acid spectrum',
    'pyridine residual case',
    'DMSO residual case',
    'AcOH-d4 residual case',
    'overfragmented unresolved case',
    'same sample across solvents class-consistency case',
    'modality routing case',
    'helper contamination invariance case',
  ];

  it.each(scenarios)('%s için evidence object tek kaynak olmalı', (name) => {
    const evidence = buildStructuredEvidence({
      modality: '1H',
      solvent: name.includes('DMSO') ? 'DMSO' : name.includes('AcOH') ? 'AcOH-d4' : 'CDCl3',
      qcStatus: 'WARN',
      authorityTier: 'AUTHORITATIVE_OBSERVED',
      moleculeRegions: ['region-a'],
      residualRegions: ['res-a'],
      artifactRegions: ['art-a'],
      contradictions: [],
      candidateStructures: [{ name: 'class-level', support: 0.7 }],
    });
    expect(evidence.title_source).toBe(evidence.body_source);
    expect(evidence.body_source).toBe(evidence.summary_source);
    expect(evidence.summary_source).toBe(evidence.export_source);
    expect(evidence.evidence_version).toBe('evidence.v2');
  });

  it('title/body/summary/export/chat parity case hard-block çalışmalı', () => {
    const evidence = buildStructuredEvidence({
      modality: '1H',
      solvent: 'DMSO',
      qcStatus: 'PASS',
      authorityTier: 'AUTHORITATIVE_OBSERVED',
      moleculeRegions: [],
      residualRegions: [],
      artifactRegions: [],
      contradictions: [],
    });
    evidence.export_source = 'verification_report';
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
    expect(result.reasons).toContain('PARITY_VIOLATION');
  });

  it('preview/main/tooltip/export parity için source mismatch yakalanmalı', () => {
    const evidence = buildStructuredEvidence({
      modality: '13C',
      solvent: 'DMSO',
      qcStatus: 'PASS',
      authorityTier: 'AUTHORITATIVE_OBSERVED',
      moleculeRegions: [],
      residualRegions: [],
      artifactRegions: [],
      contradictions: [],
    });
    evidence.summary_source = 'different_source';
    const result = enforceParityGuard(evidence);
    expect(result.parity_ok).toBe(false);
  });
});
