/**
 * Inverse Elucidation Engine
 *
 * Observed spectra → candidate constraints → candidate generation →
 * forward re-simulation → multi-modal ranking → top-k report
 *
 * Architecture: pipeline of composable stages, each with typed I/O.
 */

import type {
  CandidateHypothesis,
  CandidateScoreBreakdown,
  ElucidationReport,
} from '@/packages/schemas';

// ---------------------------------------------------------------------------
// Stage 1: Observed data normalization
// ---------------------------------------------------------------------------

export interface NormalizedObservations {
  h1_peaks: Array<{ ppm: number; integral?: number; mult?: string; j?: number[] }>;
  c13_peaks: Array<{ ppm: number }>;
  hsqc_peaks: Array<{ f1: number; f2: number }>;
  cosy_peaks: Array<{ f1: number; f2: number }>;
  hmbc_peaks: Array<{ f1: number; f2: number }>;
  ir_bands: Array<{ cm: number; intensity?: string }>;
  ms_peaks: Array<{ mz: number; intensity: number }>;
  exactMass?: number;
  formulaCandidates: string[];
  solvent?: string;
  fieldMHz?: number;
  ionMode?: string;
}

// ---------------------------------------------------------------------------
// Stage 2: Constraint extraction
// ---------------------------------------------------------------------------

export interface ElucidationConstraints {
  formulaCandidates: string[];
  dbeRange: [number, number];
  minCarbons: number;
  maxCarbons: number;
  minHydrogens: number;
  maxHydrogens: number;
  requiredFunctionalGroups: string[];
  forbiddenFunctionalGroups: string[];
  hasAromatic: boolean | null;
  hasCarbonyl: boolean | null;
  hasNitrile: boolean | null;
  hasHalogen: boolean | null;
  spinSystems: Array<{
    protons: Array<{ ppm: number; mult?: string }>;
    connectivity: string;
  }>;
}

export interface MotifDetection {
  motif: string;
  evidence: string;
  confidence: number;
  source: string;
}

export interface SpinSystem {
  protons: Array<{ ppm: number; mult?: string; integral?: number }>;
  couplingPattern: string;
  suggestedFragment: string;
  confidence: number;
}

export interface SubstructureHypothesis {
  smarts: string;
  name: string;
  evidence: string[];
  confidence: number;
}

export interface AmbiguityClass {
  class: 'resolved' | 'positional_isomers' | 'stereoisomers' | 'tautomers' | 'unresolved';
  description: string;
  distinguishingExperiment?: string;
}

export function extractMotifs(obs: NormalizedObservations): MotifDetection[] {
  const motifs: MotifDetection[] = [];

  const arPeaks = obs.h1_peaks.filter(p => p.ppm >= 6.3 && p.ppm <= 8.8);
  if (arPeaks.length > 0) {
    motifs.push({ motif: 'aromatic_ring', evidence: `${arPeaks.length} peaks in 6.3-8.8 ppm`, confidence: 0.9, source: '1H' });
  }

  const tbCandidate = obs.h1_peaks.find(p => p.mult === 's' && (p.integral ?? 0) >= 8 && p.ppm >= 0.8 && p.ppm <= 1.5);
  if (tbCandidate) {
    motifs.push({ motif: 'tert_butyl', evidence: `singlet ~${tbCandidate.ppm} ppm, integral ~${tbCandidate.integral}`, confidence: 0.8, source: '1H' });
  }

  const triplets = obs.h1_peaks.filter(p => p.mult === 't');
  const quartets = obs.h1_peaks.filter(p => p.mult === 'q');
  if (triplets.length > 0 && quartets.length > 0) {
    motifs.push({ motif: 'ethyl_group', evidence: `${triplets.length} triplet(s), ${quartets.length} quartet(s)`, confidence: 0.7, source: '1H' });
  }

  const ochPeaks = obs.h1_peaks.filter(p => p.ppm >= 3.2 && p.ppm <= 4.0 && p.mult === 's' && (p.integral ?? 0) >= 2.5);
  if (ochPeaks.length > 0) {
    motifs.push({ motif: 'methoxy', evidence: `singlet ~3.5 ppm`, confidence: 0.7, source: '1H' });
  }

  const irCarbonyl = obs.ir_bands.filter(b => b.cm >= 1630 && b.cm <= 1800);
  if (irCarbonyl.length > 0) {
    const cm = irCarbonyl[0].cm;
    let subtype = 'carbonyl';
    if (cm >= 1735) subtype = 'ester_carbonyl';
    else if (cm >= 1700) subtype = 'acid_or_ketone_carbonyl';
    else if (cm >= 1630) subtype = 'amide_or_conjugated_carbonyl';
    motifs.push({ motif: subtype, evidence: `IR band at ${cm} cm-1`, confidence: 0.85, source: 'FTIR' });
  }

  const irNitrile = obs.ir_bands.filter(b => b.cm >= 2210 && b.cm <= 2260);
  if (irNitrile.length > 0) {
    motifs.push({ motif: 'nitrile', evidence: `IR band at ${irNitrile[0].cm} cm-1`, confidence: 0.9, source: 'FTIR' });
  }

  const irOH = obs.ir_bands.filter(b => b.cm >= 3200 && b.cm <= 3600);
  if (irOH.length > 0) {
    motifs.push({ motif: 'OH_or_NH', evidence: `Broad IR band ~${irOH[0].cm} cm-1`, confidence: 0.7, source: 'FTIR' });
  }

  const ms91 = obs.ms_peaks.find(p => Math.abs(p.mz - 91) < 0.5);
  if (ms91) {
    motifs.push({ motif: 'tropylium_ion', evidence: 'm/z 91 (C7H7+)', confidence: 0.9, source: 'MS' });
  }

  const ms77 = obs.ms_peaks.find(p => Math.abs(p.mz - 77) < 0.5);
  if (ms77) {
    motifs.push({ motif: 'phenyl_cation', evidence: 'm/z 77 (C6H5+)', confidence: 0.85, source: 'MS' });
  }

  return motifs;
}

export function assembleSpinSystems(obs: NormalizedObservations): SpinSystem[] {
  const systems: SpinSystem[] = [];

  const aliphatic = obs.h1_peaks.filter(p => p.ppm < 5.0);
  const aromatic = obs.h1_peaks.filter(p => p.ppm >= 6.3 && p.ppm <= 8.8);

  if (aromatic.length > 0) {
    systems.push({
      protons: aromatic,
      couplingPattern: aromatic.length <= 5 ? 'monosubstituted_or_disubstituted' : 'polysubstituted',
      suggestedFragment: aromatic.length === 5 ? 'C6H5- (phenyl)' : `Ar-H x${aromatic.length}`,
      confidence: 0.6,
    });
  }

  const triplets = aliphatic.filter(p => p.mult === 't');
  const quartets = aliphatic.filter(p => p.mult === 'q');
  if (triplets.length > 0 && quartets.length > 0) {
    systems.push({
      protons: [...triplets, ...quartets],
      couplingPattern: 'A2B3 (ethyl)',
      suggestedFragment: '-CH2CH3',
      confidence: 0.7,
    });
  }

  const doublets = aliphatic.filter(p => p.mult === 'd' && (p.integral ?? 0) >= 5);
  const septets = aliphatic.filter(p => p.mult === 'sep' || p.mult === 'hept');
  if (doublets.length > 0 && septets.length > 0) {
    systems.push({
      protons: [...doublets, ...septets],
      couplingPattern: 'A6B (isopropyl)',
      suggestedFragment: '-CH(CH3)2',
      confidence: 0.7,
    });
  }

  return systems;
}

export function generateSubstructureHypotheses(
  motifs: MotifDetection[],
  spinSystems: SpinSystem[],
  obs: NormalizedObservations
): SubstructureHypothesis[] {
  const hypotheses: SubstructureHypothesis[] = [];

  const hasAromatic = motifs.some(m => m.motif === 'aromatic_ring');
  const hasCarbonyl = motifs.some(m => m.motif.includes('carbonyl'));
  const hasEthyl = motifs.some(m => m.motif === 'ethyl_group');
  const hasMethoxy = motifs.some(m => m.motif === 'methoxy');
  const hasTropylium = motifs.some(m => m.motif === 'tropylium_ion');

  if (hasAromatic && hasCarbonyl) {
    hypotheses.push({
      smarts: '[#6]1:[#6]:[#6]:[#6]:[#6]:[#6]:1-[#6](=[#8])',
      name: 'Aromatic ketone/aldehyde',
      evidence: ['Aromatic 1H peaks', 'Carbonyl IR band'],
      confidence: 0.6,
    });
  }

  if (hasTropylium) {
    hypotheses.push({
      smarts: '[#6]1:[#6]:[#6]:[#6]:[#6]:[#6]:1-[#6]',
      name: 'Benzyl-containing structure',
      evidence: ['m/z 91 tropylium', hasAromatic ? 'Aromatic 1H' : ''].filter(Boolean),
      confidence: 0.8,
    });
  }

  if (hasEthyl && hasCarbonyl) {
    hypotheses.push({
      smarts: '[#6]-[#6]-[#6](=[#8])',
      name: 'Ethyl adjacent to carbonyl',
      evidence: ['Ethyl spin system (t+q)', 'Carbonyl IR band'],
      confidence: 0.5,
    });
  }

  if (hasMethoxy) {
    hypotheses.push({
      smarts: '[#6]-[#8]-[#6]',
      name: 'Methoxy group',
      evidence: ['Singlet ~3.5 ppm'],
      confidence: 0.6,
    });
  }

  return hypotheses;
}

export function classifyAmbiguity(
  candidates: CandidateHypothesis[]
): AmbiguityClass {
  if (candidates.length === 0) {
    return { class: 'unresolved', description: 'No candidates found' };
  }
  if (candidates.length === 1) {
    return { class: 'resolved', description: 'Single candidate with high confidence' };
  }

  const formulas = new Set(candidates.map(c => c.formula));
  if (formulas.size === 1) {
    return {
      class: 'positional_isomers',
      description: `${candidates.length} isomers of ${[...formulas][0]}`,
      distinguishingExperiment: 'NOESY or HMBC correlation analysis may distinguish positional isomers',
    };
  }

  return {
    class: 'unresolved',
    description: `${candidates.length} candidates across ${formulas.size} formulas`,
    distinguishingExperiment: 'High-resolution MS for exact mass determination',
  };
}

export function extractConstraints(obs: NormalizedObservations): ElucidationConstraints {
  const constraints: ElucidationConstraints = {
    formulaCandidates: obs.formulaCandidates,
    dbeRange: [0, 50],
    minCarbons: 0,
    maxCarbons: 100,
    minHydrogens: 0,
    maxHydrogens: 200,
    requiredFunctionalGroups: [],
    forbiddenFunctionalGroups: [],
    hasAromatic: null,
    hasCarbonyl: null,
    hasNitrile: null,
    hasHalogen: null,
    spinSystems: [],
  };

  const motifs = extractMotifs(obs);

  constraints.hasAromatic = motifs.some(m => m.motif === 'aromatic_ring') ? true : null;
  constraints.hasCarbonyl = motifs.some(m => m.motif.includes('carbonyl')) ? true : null;
  constraints.hasNitrile = motifs.some(m => m.motif === 'nitrile') ? true : null;

  const irOH = obs.ir_bands.filter(b => b.cm >= 3200 && b.cm <= 3600);
  if (irOH.length > 0) constraints.requiredFunctionalGroups.push('OH_or_NH');
  if (constraints.hasCarbonyl) constraints.requiredFunctionalGroups.push('carbonyl');
  if (constraints.hasNitrile) constraints.requiredFunctionalGroups.push('nitrile');

  if (obs.c13_peaks.length > 0) {
    constraints.minCarbons = Math.max(1, obs.c13_peaks.length);
  }

  if (obs.ms_peaks.length > 0) {
    const sorted = [...obs.ms_peaks].sort((a, b) => b.mz - a.mz);
    const possibleM = sorted[0];
    if (possibleM) {
      const nCl = obs.ms_peaks.filter(p => Math.abs(p.mz - possibleM.mz - 2) < 0.5).length > 0;
      if (nCl) constraints.hasHalogen = true;
    }
  }

  const spinSystems = assembleSpinSystems(obs);
  constraints.spinSystems = spinSystems.map(ss => ({
    protons: ss.protons,
    connectivity: ss.couplingPattern,
  }));

  return constraints;
}

// ---------------------------------------------------------------------------
// Stage 3: Candidate retrieval/generation
// ---------------------------------------------------------------------------

export interface CandidateSource {
  name: string;
  search(constraints: ElucidationConstraints): Promise<CandidateHypothesis[]>;
}

export class LibraryCandidateSource implements CandidateSource {
  name = 'internal_library';

  async search(_constraints: ElucidationConstraints): Promise<CandidateHypothesis[]> {
    // Placeholder: search internal enhanced_library
    return [];
  }
}

export class PubChemCandidateSource implements CandidateSource {
  name = 'pubchem';

  async search(constraints: ElucidationConstraints): Promise<CandidateHypothesis[]> {
    if (constraints.formulaCandidates.length === 0) return [];

    const candidates: CandidateHypothesis[] = [];
    for (const formula of constraints.formulaCandidates.slice(0, 3)) {
      try {
        const res = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/formula/${formula}/JSON?MaxRecords=5`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const data = await res.json();
          const compounds = data?.PC_Compounds ?? [];
          for (let i = 0; i < Math.min(compounds.length, 5); i++) {
            const c = compounds[i];
            const smiles = c?.props?.find((p: any) => p.urn?.label === 'SMILES' && p.urn?.name === 'Canonical')?.value?.sval;
            const name = c?.props?.find((p: any) => p.urn?.label === 'IUPAC Name')?.value?.sval;
            if (smiles) {
              candidates.push({
                rank: candidates.length + 1,
                smiles,
                name: name ?? undefined,
                formula,
                exactMass: 0,
                source: 'pubchem',
                scores: emptyScores(),
                contradictions: [],
                supporting_evidence: [],
              });
            }
          }
        }
      } catch {
        // PubChem unavailable
      }
    }
    return candidates;
  }
}

// ---------------------------------------------------------------------------
// Stage 4: Scoring
// ---------------------------------------------------------------------------

function emptyScores(): CandidateScoreBreakdown {
  return {
    total: 0,
    formula_score: 0,
    nmr_shift_score: 0,
    multiplicity_score: 0,
    c13_score: 0,
    hsqc_coverage: 0,
    cosy_coverage: 0,
    hmbc_coverage: 0,
    ftir_score: 0,
    ms_score: 0,
    cross_modal_score: 0,
  };
}

export function scoreCandidate(
  candidate: CandidateHypothesis,
  observations: NormalizedObservations,
  _constraints: ElucidationConstraints
): CandidateHypothesis {
  const scores = emptyScores();

  // Formula match score
  if (observations.formulaCandidates.includes(candidate.formula)) {
    scores.formula_score = 1.0;
  }

  // Simple NMR shift overlap scoring (basic implementation)
  if (observations.h1_peaks.length > 0 && candidate.forwardSpectra?.nmr1h?.peaks) {
    const theoreticalPpms = candidate.forwardSpectra.nmr1h.peaks.map(p => p.ppm_or_mz);
    let matched = 0;
    for (const obs of observations.h1_peaks) {
      if (theoreticalPpms.some(t => Math.abs(t - obs.ppm) < 0.3)) {
        matched++;
      }
    }
    scores.nmr_shift_score = observations.h1_peaks.length > 0
      ? matched / observations.h1_peaks.length
      : 0;
  }

  // Total score (weighted average)
  const weights = {
    formula: 0.25,
    nmr_shift: 0.20,
    multiplicity: 0.10,
    c13: 0.10,
    ftir: 0.10,
    ms: 0.15,
    cross_modal: 0.10,
  };

  scores.total =
    weights.formula * scores.formula_score +
    weights.nmr_shift * scores.nmr_shift_score +
    weights.multiplicity * scores.multiplicity_score +
    weights.c13 * scores.c13_score +
    weights.ftir * scores.ftir_score +
    weights.ms * scores.ms_score +
    weights.cross_modal * scores.cross_modal_score;

  return {
    ...candidate,
    scores,
  };
}

// ---------------------------------------------------------------------------
// Stage 5: Main pipeline
// ---------------------------------------------------------------------------

export async function runElucidation(
  observations: NormalizedObservations,
  options?: {
    sources?: CandidateSource[];
    maxCandidates?: number;
  }
): Promise<ElucidationReport & {
  motifs: MotifDetection[];
  spinSystems: SpinSystem[];
  substructureHypotheses: SubstructureHypothesis[];
  ambiguityClass: AmbiguityClass;
}> {
  const motifs = extractMotifs(observations);
  const spinSystems = assembleSpinSystems(observations);
  const constraints = extractConstraints(observations);
  const substructureHypotheses = generateSubstructureHypotheses(motifs, spinSystems, observations);

  const sources = options?.sources ?? [
    new LibraryCandidateSource(),
    new PubChemCandidateSource(),
  ];

  let allCandidates: CandidateHypothesis[] = [];
  for (const source of sources) {
    try {
      const candidates = await source.search(constraints);
      allCandidates.push(...candidates);
    } catch {
      // Source unavailable
    }
  }

  const scored = allCandidates.map(c => scoreCandidate(c, observations, constraints));
  scored.sort((a, b) => b.scores.total - a.scores.total);

  const maxK = options?.maxCandidates ?? 10;
  const topCandidates = scored.slice(0, maxK);
  topCandidates.forEach((c, i) => { c.rank = i + 1; });

  const ambiguityClass = classifyAmbiguity(topCandidates);

  let status: ElucidationReport['status'];
  if (topCandidates.length === 0) {
    status = 'no_candidates';
  } else if (topCandidates.length === 1 && topCandidates[0].scores.total > 0.8) {
    status = 'resolved';
  } else if (topCandidates.length > 0 && topCandidates[0].scores.total > 0.5) {
    status = 'ambiguous';
  } else {
    status = 'inconclusive';
  }

  const modalitiesProvided = [
    ...(observations.h1_peaks.length > 0 ? ['1H'] : []),
    ...(observations.c13_peaks.length > 0 ? ['13C'] : []),
    ...(observations.hsqc_peaks.length > 0 ? ['HSQC'] : []),
    ...(observations.cosy_peaks.length > 0 ? ['COSY'] : []),
    ...(observations.hmbc_peaks.length > 0 ? ['HMBC'] : []),
    ...(observations.ir_bands.length > 0 ? ['FTIR'] : []),
    ...(observations.ms_peaks.length > 0 ? ['MS'] : []),
  ];
  const modalityCount = modalitiesProvided.length;

  return {
    status,
    top_candidate: topCandidates[0] ?? null,
    alternatives: topCandidates.slice(1),
    constraints_used: {
      formula_candidates: constraints.formulaCandidates,
      dbe_range: constraints.dbeRange,
      functional_groups_required: constraints.requiredFunctionalGroups,
      functional_groups_forbidden: constraints.forbiddenFunctionalGroups,
    },
    data_quality: {
      modalities_provided: modalitiesProvided,
      modalities_missing: [
        ...(observations.h1_peaks.length === 0 ? ['1H'] : []),
        ...(observations.c13_peaks.length === 0 ? ['13C'] : []),
        ...(observations.ir_bands.length === 0 ? ['FTIR'] : []),
        ...(observations.ms_peaks.length === 0 ? ['MS'] : []),
      ],
      overall_quality: modalityCount >= 4 ? 'high' : modalityCount >= 2 ? 'medium' : 'low',
    },
    motifs,
    spinSystems,
    substructureHypotheses,
    ambiguityClass,
  };
}
