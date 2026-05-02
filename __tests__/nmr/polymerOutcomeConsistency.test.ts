import { describe, expect, it } from 'vitest';
import type { AIAnalysisResult, NMRPeak } from '@/lib/types';
import {
  classifyNmrInterpretationSummary,
  enforceFidPrimaryOutcomeConsistency,
  enforcePolymerModeOutcomeConsistency,
} from '@/lib/hooks/useSpectralAnalysis';

const chitosanLikePeaks: NMRPeak[] = [
  { shift: 11.46, mult: 'unresolved_multiplet', integ: 3 },
  { shift: 5.0, mult: 'unresolved_multiplet', integ: 0.8 },
  { shift: 3.22, mult: 'unresolved_multiplet', integ: 0.9 },
  { shift: 2.04, mult: 'unresolved_multiplet', integ: 2.35 },
  { shift: 7.5, mult: 'm', integ: 0.2 },
  { shift: 0.14, mult: 'm', integ: 0.2 },
  { shift: 1.3, mult: 'unresolved_multiplet', integ: 0.2 },
  { shift: 1.23, mult: 'unresolved_multiplet', integ: 0.2 },
  { shift: 0.89, mult: 'unresolved_multiplet', integ: 0.2 },
];

describe('polymer outcome consistency guards', () => {
  it('keeps class-level polymer interpretation across AcOH-d4 and DMSO-d6', () => {
    const acOH = classifyNmrInterpretationSummary(chitosanLikePeaks, 'AcOH-d4', true, [
      'OBS_PEAK_PICKING_REPRODUCIBILITY',
    ]);
    const dmso = classifyNmrInterpretationSummary(chitosanLikePeaks, 'DMSO-d6', true, [
      'OBS_PEAK_PICKING_REPRODUCIBILITY',
    ]);

    expect(acOH.polymer_mode).toBe(true);
    expect(dmso.polymer_mode).toBe(true);
    expect(acOH.candidate_structures_ranked?.[0]?.name).toMatch(/CHITOSAN-LIKE POLYMER/i);
    expect(dmso.candidate_structures_ranked?.[0]?.name).toMatch(/CHITOSAN-LIKE POLYMER/i);
  });

  it('demotes small-molecule top identity when polymer-mode is active', () => {
    const summary = classifyNmrInterpretationSummary(chitosanLikePeaks, 'AcOH-d4', true, [
      'OBS_PEAK_PICKING_REPRODUCIBILITY',
    ]);

    const wrongResult: AIAnalysisResult = {
      moleculeName: 'Oleanolic Acid',
      iupacName: 'Dummy',
      confidence: 82,
      verificationStatus: 'PARTIAL',
      formula: 'C30H48O3',
      massSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      nmrSpectrumComparison: { status: 'PARTIAL', confidence: 55, matches: [] },
      irSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      cid: 10494,
      smiles: null,
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

    const corrected = enforcePolymerModeOutcomeConsistency(wrongResult, summary);
    expect(corrected.moleculeName).toBe('CHITOSAN-LIKE POLYMER / POLYSACCHARIDE-LIKE POLYMER');
    expect(corrected.verificationStatus).toBe('INCONCLUSIVE');
    expect(corrected.confidence).toBeLessThanOrEqual(30);
    expect(corrected.alternatives?.some((x) => /Oleanolic Acid/i.test(x.moleculeName || ''))).toBe(true);
  });

  it('keeps result unchanged when polymer identity is already class-level', () => {
    const summary = classifyNmrInterpretationSummary(chitosanLikePeaks, 'AcOH-d4', false, []);
    const alreadyPolymer: AIAnalysisResult = {
      moleculeName: 'CHITOSAN-LIKE POLYMER / POLYSACCHARIDE-LIKE POLYMER',
      iupacName: 'Polymeric polysaccharide class-level interpretation',
      confidence: 32,
      verificationStatus: 'INCONCLUSIVE',
      formula: null,
      massSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      nmrSpectrumComparison: { status: 'PARTIAL', confidence: 60, matches: [] },
      irSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      cid: null,
      smiles: null,
      logP: null,
      tpsa: null,
      ringCount: null,
      hBondDonorCount: null,
      hBondAcceptorCount: null,
      source: 'Polymer-class interpretation',
      sourceConfidence: 0,
      reasoning: 'test',
      alternatives: [],
      verificationNotes: [],
    };

    const corrected = enforcePolymerModeOutcomeConsistency(alreadyPolymer, summary);
    expect(corrected).toEqual(alreadyPolymer);
  });

  it('caps confidence and demotes small-molecule candidates when fid-primary source is missing', () => {
    const summary = classifyNmrInterpretationSummary(chitosanLikePeaks, 'AcOH-d4', false, [], {
      fidPrimarySource: false,
      authoritySource: 'DISPLAY_ONLY_FALLBACK',
    });

    expect(summary.authority_source).toBe('DISPLAY_ONLY_FALLBACK');
    expect(summary.confidence_ceiling).toBeLessThanOrEqual(35);
    expect(summary.runtime_rules).toContain('AI_TEXT_FID_PRIMARY_SOURCE_REQUIRED');
    const demotedSmallMolecule = summary.candidate_structures_ranked?.filter(
      (c) => /Acetic Acid|Oleanolic Acid/i.test(c.name) && c.demoted
    );
    expect((demotedSmallMolecule || []).length).toBeGreaterThanOrEqual(2);
  });

  it('forces INCONCLUSIVE class-level output when fid-primary source missing and small-molecule result arrives', () => {
    const summary = classifyNmrInterpretationSummary(chitosanLikePeaks, 'AcOH-d4', false, [], {
      fidPrimarySource: false,
      authoritySource: 'DISPLAY_ONLY_FALLBACK',
    });
    const wrongResult: AIAnalysisResult = {
      moleculeName: 'Acetic Acid',
      iupacName: 'ethanoic acid',
      confidence: 80,
      verificationStatus: 'PARTIAL',
      formula: 'C2H4O2',
      massSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      nmrSpectrumComparison: { status: 'PARTIAL', confidence: 55, matches: [] },
      irSpectrumComparison: { status: 'NOT_AVAILABLE', confidence: 0, matches: [] },
      cid: 176,
      smiles: 'CC(=O)O',
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

    const corrected = enforceFidPrimaryOutcomeConsistency(wrongResult, summary);
    expect(corrected.verificationStatus).toBe('INCONCLUSIVE');
    expect(corrected.confidence).toBeLessThanOrEqual(30);
    expect(corrected.moleculeName).toMatch(/CHITOSAN|POLYMER/i);
    expect(corrected.cid).toBeNull();
  });
});
