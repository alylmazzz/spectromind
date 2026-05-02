import { describe, expect, it } from 'vitest';
import type { AIAnalysisResult, Carbon13Peak, NMRPeak } from '@/lib/types';
import {
  classifyC13InterpretationSummary,
  enforceC13AliphaticAromaticDriftGuard,
  enforceExactIdentityUpgradeIfEligible,
  enforceIdentityMetadataParity,
} from '@/lib/hooks/useSpectralAnalysis';
import { OLEANOLIC_ACID_ISOMERIC_SMILES, OLEANOLIC_ACID_PUBCHEM_CID } from '@/lib/chem/oleanolicReference';

const h1LikeOleanolic: NMRPeak[] = [
  { shift: 1.02, mult: 'unresolved_multiplet', integ: 3 },
  { shift: 1.28, mult: 'unresolved_multiplet', integ: 1.52 },
  { shift: 1.24, mult: 'unresolved_multiplet', integ: 1.5 },
  { shift: 0.9, mult: 'unresolved_multiplet', integ: 1.38 },
  { shift: 0.95, mult: 'unresolved_multiplet', integ: 1.28 },
  { shift: 5.49, mult: 'unresolved_multiplet', integ: 0.29 },
  { shift: 7.21, mult: 'unresolved_multiplet', integ: 0.63 },
  { shift: 7.57, mult: 'unresolved_multiplet', integ: 0.38 },
];

const c13LikeOleanolic: Carbon13Peak[] = [
  { ppm: 179.93 },
  { ppm: 149.86 },
  { ppm: 144.59 },
  { ppm: 135.7 },
  { ppm: 123.41 },
  { ppm: 123.16 },
  { ppm: 55.6 },
  { ppm: 47.91 },
  { ppm: 46.45 },
  { ppm: 45.85 },
  { ppm: 42.0 },
  { ppm: 41.95 },
  { ppm: 39.54 },
  { ppm: 39.16 },
  { ppm: 38.97 },
  { ppm: 37.17 },
  { ppm: 37.06 },
  { ppm: 36.98 },
  { ppm: 34.01 },
  { ppm: 33.07 },
  { ppm: 31.92 },
  { ppm: 30.75 },
  { ppm: 29.79 },
  { ppm: 29.4 },
  { ppm: 28.57 },
  { ppm: 27.86 },
  { ppm: 26.0 },
  { ppm: 23.72 },
  { ppm: 23.61 },
  { ppm: 22.73 },
  { ppm: 18.59 },
  { ppm: 17.21 },
  { ppm: 16.33 },
  { ppm: 15.34 },
  { ppm: 14.09 },
];

describe('c13 triterpenic drift guard', () => {
  it('prioritizes oleanolic-like class when aliphatic dominant + acid carbonyl pattern exists', () => {
    const summary = classifyC13InterpretationSummary(
      c13LikeOleanolic,
      h1LikeOleanolic,
      'DMSO',
      false,
      []
    );

    expect(summary.candidate_structures_ranked?.[0]?.name).toMatch(/OLEANOLIC-ACID-LIKE TRITERPENIC ACID/i);
    expect(summary.candidate_structures_ranked?.[0]?.support || 0).toBeGreaterThan(0.7);
    expect(summary.contradiction_analysis?.join(' | ')).toMatch(/drift veto|alifatik/i);
    expect(summary.runtime_rules).toContain('AI_TEXT_PYRIDINE_TRIPLET_MASK_REQUIRED');
    expect(summary.runtime_rules).toContain('AI_TEXT_PYRIDINE_D5_MASK_REQUIRED');
    expect(summary.runtime_rules).toContain('AI_TEXT_BENZOIC_VETO_IF_TRITERPENOID_ANCHORS');
    expect(summary.runtime_rules).toContain('AI_TEXT_STRUCTURE_CARD_SOURCE_PARITY_REQUIRED');
    expect(summary.runtime_rules).toContain('AI_TEXT_TURKISH_OUTPUT_REQUIRED_WHEN_REQUESTED');
    expect(
      (summary.residual_regions || []).some((x) => /pyridine-d5 (alpha|beta|gamma)-carbon residual cluster/i.test(x.label))
    ).toBe(true);
  });

  it('isolates DMSO residual from analyte anchors', () => {
    const summary = classifyC13InterpretationSummary(c13LikeOleanolic, h1LikeOleanolic, 'DMSO', false, []);
    const analyte = summary.analyte_regions || [];
    expect((summary.residual_regions || []).some((x) => /DMSO residual/i.test(x.label))).toBe(true);
    expect(analyte.some((x) => /39\.5|DMSO/i.test(`${x.region || ''} ${x.label}`))).toBe(false);
  });

  it('demotes benzoic drift result to class-level triterpenic interpretation', () => {
    const summary = classifyC13InterpretationSummary(
      c13LikeOleanolic,
      h1LikeOleanolic,
      'DMSO',
      false,
      []
    );

    const wrongResult: AIAnalysisResult = {
      moleculeName: 'benzoic acid',
      iupacName: 'benzoic acid',
      confidence: 78,
      verificationStatus: 'PARTIAL',
      formula: 'C7H6O2',
      massSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      nmrSpectrumComparison: { status: 'PARTIAL', confidence: 55, matches: [] },
      irSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      cid: 243,
      smiles: 'C1=CC=C(C=C1)C(=O)O',
      logP: null,
      tpsa: null,
      ringCount: null,
      hBondDonorCount: null,
      hBondAcceptorCount: null,
      source: 'PubChem',
      sourceConfidence: 0,
      reasoning: 'test',
      alternatives: [],
      verificationNotes: [],
    };

    const corrected = enforceC13AliphaticAromaticDriftGuard(wrongResult, summary);
    expect(corrected.moleculeName).toMatch(/OLEANOLIC-ACID-LIKE TRITERPENIC ACID/i);
    expect(corrected.verificationStatus).toBe('INCONCLUSIVE');
    expect(corrected.cid).toBeNull();
    expect((corrected.verificationNotes || []).join(' | ')).toMatch(/DRIFT_GUARD/i);
  });

  it('upgrades to exact oleanolic acid when anchor set is complete', () => {
    const summary = classifyC13InterpretationSummary(
      c13LikeOleanolic,
      h1LikeOleanolic,
      'DMSO',
      false,
      []
    );
    const base: AIAnalysisResult = {
      moleculeName: 'OLEANOLIC-ACID-LIKE TRITERPENIC ACID (CLASS-LEVEL)',
      iupacName: 'class-level',
      confidence: 70,
      verificationStatus: 'PARTIAL',
      formula: 'C30H48O3',
      massSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      nmrSpectrumComparison: { status: 'PARTIAL', confidence: 55, matches: [] },
      irSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      cid: null,
      smiles: null,
      logP: null,
      tpsa: null,
      ringCount: null,
      hBondDonorCount: null,
      hBondAcceptorCount: null,
      source: 'test',
      sourceConfidence: 0,
      reasoning: 'test',
      alternatives: [],
      verificationNotes: [],
    };
    const upgraded = enforceExactIdentityUpgradeIfEligible(base, {
      ...summary,
      exact_id_eligibility: {
        eligible: true,
        candidate: 'Oleanolic Acid',
        reasons: ['test'],
      },
    });
    expect(upgraded.moleculeName).toBe('Oleanolic Acid');
    expect(upgraded.verificationStatus).toBe('PASS');
    expect(upgraded.smiles).toBe(OLEANOLIC_ACID_ISOMERIC_SMILES);
    expect(upgraded.cid).toBe(OLEANOLIC_ACID_PUBCHEM_CID);
    expect((upgraded.verificationNotes || []).join(' | ')).toMatch(/EXACT_ID_UPGRADE/i);
  });

  it('fixes benzoic metadata when identity is oleanolic acid', () => {
    const inconsistent: AIAnalysisResult = {
      moleculeName: 'Oleanolic Acid',
      iupacName: 'benzoic acid',
      confidence: 82,
      verificationStatus: 'PASS',
      formula: 'C7H6O2',
      massSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      nmrSpectrumComparison: { status: 'PARTIAL', confidence: 55, matches: [] },
      irSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      cid: 243,
      smiles: 'C1=CC=C(C=C1)C(=O)O',
      logP: null,
      tpsa: null,
      ringCount: null,
      hBondDonorCount: null,
      hBondAcceptorCount: null,
      source: 'test',
      sourceConfidence: 0,
      reasoning: 'test',
      alternatives: [],
      verificationNotes: [],
    };

    const fixed = enforceIdentityMetadataParity(inconsistent);
    expect(fixed.iupacName).toMatch(/olean-12-en-28-oic/i);
    expect(fixed.formula).toBe('C30H48O3');
    expect(fixed.smiles).toBe(OLEANOLIC_ACID_ISOMERIC_SMILES);
    expect(fixed.cid).toBe(OLEANOLIC_ACID_PUBCHEM_CID);
    expect((fixed.verificationNotes || []).join(' | ')).toMatch(/METADATA_PARITY/i);
  });
});
