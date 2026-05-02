/**
 * SpectroMind — Organic Synthesis Design System: Core Knowledge Architecture
 * Publication-quality technical DOCX for academic, industrial, and DB implementation.
 * TÜBİTAK 1812 uyumluluk ekleri (Türkçe) dahil.
 *
 * Çalıştırma: node scripts/generate-organic-synthesis-knowledge-architecture-docx.js
 * Çıktı: docs/SPECTROMIND_Organic_Synthesis_Knowledge_Architecture.docx
 */

const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} = require('docx');

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text: String(text), ...opts })],
    spacing: { after: 120 },
    alignment: opts.alignment,
  });
}

function mono(text) {
  return new Paragraph({
    children: [new TextRun({ text: String(text), font: 'Consolas', size: 18 })],
    spacing: { after: 100 },
    indent: { left: 360 },
  });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 110 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 90 },
  });
}

function h4(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 140, after: 70 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}` })],
    indent: { left: 360 },
    spacing: { after: 80 },
  });
}

function boldLine(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 80 },
  });
}

function tableFromRows(rows, header = true) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((cell) => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: String(cell), bold: header && ri === 0 })],
        })],
      })),
    })),
  });
}

function layerBlock(titlePrefix, layerTitle, contentFn) {
  return [h2(`${titlePrefix} ${layerTitle}`), ...contentFn()];
}

async function buildDocument() {
  const sections = [];

  /** ---- Cover / meta ---- */
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: 'SpectroMind Technical Reference', bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'Organic Synthesis Design System — Core Knowledge Architecture',
        bold: true,
        size: 36,
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    p('Document type: System architecture & structured knowledge specification'),
    p('Version: 1.1 (expanded: exhaustive layer expansion, industrial annexes, TÜBİTAK 1812 alignment)'),
    p(`Date: ${new Date().toISOString().slice(0, 10)}`),
    p('Classification: Technical / R&D — suitable for academic submission, industrial process design, and computational knowledge bases'),
    p('Prepared for: SpectroMind platform integration; supplementary material for TÜBİTAK 1812-style venture R&D documentation'),
    p(''),
  );

  /** ---- Abstract ---- */
  sections.push(
    h1('Abstract'),
    p('This document formalizes a layered knowledge architecture for computer-assisted organic synthesis (CAOS) within the SpectroMind ecosystem. The architecture decomposes synthetic intelligence into six interoperable layers—Reagents, Reaction Classes, Mechanisms, Selectivity, Retrosynthesis/Synthons, and Functional-Group Strategy—each specified with scientific rationale, operational design logic, machine-readable schemas, worked chemical examples, and explicit failure modes. Cross-layer integration rules connect elementary-step inventories to multistep planning, and industrial constraints (scalability, safety, cost, robustness) are embedded as first-class decision attributes. The specification is intentionally dual-purpose: it is readable as a reference text for expert chemists and directly implementable as a graph-relational rule engine backed by versioned ontologies, reaction templates, and constraint solvers.'),
    p('Extended scope (v1.1): Hard–soft acid–base (HSAB) priors for reagent pairing, explicit speciation and aggregation models for organometallic nucleophiles, pericyclic topology classes under the Woodward–Hoffmann framework as optional mechanism validators, linear free-energy relationship (LFER) hooks for selectivity priors, retrosynthetic directed acyclic graph (DAG) semantics with convergence metrics, protecting-group temporal logic with one-pot versus isolated-step robustness differences, Design of Experiments (DoE) placeholders for robustness mapping, and process analytical technology (PAT) observability links. A dedicated appendix aligns content with TÜBİTAK 1812 (BiGG Yatırım) proposal expectations: originality, commercialization, IP, TRL roadmap, measurable KPIs, risk mitigation, and compliance notes; official call documents must always be verified in PRODİS for the active period.'),
    p(''),
  );

  /** ---- TOC ---- */
  sections.push(
    h1('Table of Contents'),
    p('Note: In Microsoft Word, update the Table of Contents (References → Update Table) after opening this file to synchronize automatic page numbers. Section headings below use Word heading styles.'),
    bullet('1. Introduction and Scope (includes 1.2 Canonical Definitions)'),
    bullet('2. System Ontology and Global Data Contracts'),
    bullet('3. Layer 1 — Reagent Layer'),
    bullet('4. Layer 2 — Reaction Class Layer'),
    bullet('5. Layer 3 — Mechanism Layer'),
    bullet('6. Layer 4 — Selectivity Engine'),
    bullet('7. Layer 5 — Retrosynthesis & Synthon Layer'),
    bullet('8. Layer 6 — Functional Group Strategy (Protecting Groups & Orthogonality)'),
    bullet('9. Cross-Layer Integration and Constraint Propagation'),
    bullet('10. Industrial Scale-Up, Safety, Cost, and Robustness'),
    bullet('11. SpectroMind Mapping: From Knowledge Graph to Verification'),
    bullet('12. Appendix A — Consolidated JSON Schema Sketches'),
    bullet('13. Appendix B — TÜBİTAK 1812 (BiGG Yatırım) Uyumluluk ve Proje Sunumu (Türkçe)'),
    bullet('13A. İş Paketleri, Risk Matrisi ve Başvuru Kontrol Listesi (Appendix B içi)'),

    p(''),
  );

  /** ---- 1 Introduction ---- */
  sections.push(
    h1('1. Introduction and Scope'),
    p('Organic synthesis design is not a single inferential task; it is a constrained, multi-objective search over sequences of molecular events. A durable computational system must therefore represent (i) the inventory of molecular actors, (ii) the pattern language of permitted transformations, (iii) the mechanistic commitments that justify feasibility and selectivity, (iv) the ranking metrics that discriminate among competing pathways, (v) the strategic decomposition of targets into synthons and synthetic equivalents, and (vi) the functional-group management layer that enforces orthogonality and protecting-group temporality.'),
    p('SpectroMind’s spectroscopic verification stack motivates an additional requirement: proposed intermediates and isolates must remain spectroscopically distinguishable and consistent with expected peak patterns across NMR, IR, and MS modalities. Consequently, each layer exposes not only chemical feasibility but also observability signatures (where applicable) as optional metadata for downstream spectral consistency checks.'),
    boldLine('Operational scope boundaries:'),
    bullet('In scope: solution-phase organic synthesis, transition-metal catalysis, main-group reagents, pericyclic reactions, polar mechanisms, typical protecting-group tactics, and multistep route planning under explicit constraints.'),
    bullet('Out of scope (unless extended later): enzymatic cascades at manufacturing titers without kinetic models, electrochemical reactors without Faradaic efficiency tables, and fully ab initio barrier calculations (HF/DFT) as default gatekeepers (these may be linked as optional external compute services).'),
    h2('1.2 Canonical Definitions (Database-Ready Terminology)'),
    p('The following terms are used uniformly across schemas, rules, and decision trees. Each entry couples a chemist-facing meaning with an implementation invariant to prevent semantic drift between human review and automated planners.'),
    tableFromRows([
      ['Term', 'Definition', 'Implementation invariant'],
      ['Reaction class', 'Template family sharing electron-flow topology and boundary conditions', 'Must map to at least one validated mechanism_path_id'],
      ['Mechanism microstep', 'Minimal elementary operation (bond order change, electron pair shift)', 'Ordered in a poset; must sum to template bond changes'],
      ['Synthetic equivalent', 'Real reagent or short sequence standing in for a synthon', 'Must appear in reagent_inventory with role tags'],
      ['Chemoselectivity', 'Preference for one FG transformation over another under shared conditions', 'Scalar score + competitor feature vector archived for audit'],
      ['Orthogonal protecting group', 'PG removed under conditions that leave other PG intact by design', 'Encoded in orthogonality_matrix with condition proofs'],
      ['Selectivity engine output', 'Ranked candidate transitions with uncertainty', 'dominant_channel_id must cite evidence: TS model, prior, or measurement'],
      ['Scale tier', 'Operating regime from milligram to plant batch', 'Triggers engineering_thresholds and hazard_escalation policies'],
    ]),
    p('Real-world implication: procurement, MSDS review, and waste streams attach to reagent_id and scale_tier jointly; a step valid at milligram scale may be rejected automatically at kilogram scale unless dilution/semi-batch protocols exist in the knowledge base.'),
    p(''),
  );

  /** ---- 2 Global ontology ---- */
  sections.push(
    h1('2. System Ontology and Global Data Contracts'),
    h2('2.1 Scientific Explanation'),
    p('A synthesis design system is sound-under-mechanism if every proposed elementary step can be justified by an electron-pushing skeleton compatible with experimental literature under analogous conditions. Formally, the ontology anchors molecules as typed graphs (atoms, bonds, stereochemistry, oxidation states as derived invariants), reactions as graph rewrite rules with partial order constraints, and mechanisms as ordered sequences of microsteps that annotate those rewrites with bond-making/bond-breaking events and intermediate classes (e.g., tetrahedral intermediates, π-complexes).'),
    h2('2.2 Operational Logic'),
    p('All layers consume and emit records conforming to a versioned payload: identifiers (InChIKey, canonical SMILES), stoichiometry vectors, solvent parameters (εr, pH domain, water content), temperature windows, and safety flags. Downstream planners refuse to instantiate a step unless prerequisite functional-group states and protecting-group statuses are satisfied.'),
    h2('2.3 Data Structure Representation'),
    mono(`{
  "system_contract_version": "1.0.0",
  "molecule_record": {
    "id": "MOL_UUID",
    "identifiers": { "smiles": "…", "inchikey": "…" },
    "graph": { "atoms": [], "bonds": [], "stereo": [] },
    "fg_state_vector": { "alcohol": "free|protected|oxidized", "amine": "…" },
    "protecting_groups": [{ "tag": "TBS", "site_atom_ids": [] }],
    "safety_flags": ["pyrophoric_Zn", "peroxide_former"]
  },
  "step_record": {
    "reaction_class_id": "RC_…",
    "mechanism_path_id": "MECH_…",
    "reagents": [{ "reagent_role": "nucleophile|base|Lewis_acid|…", "reagent_id": "RGT_…" }],
    "conditions": { "solvent_ids": [], "T_min_K": 273, "T_max_K": 353 },
    "selectivity_objective": { "chemo": 0.92, "regio": 0.88, "stereo": 0.95 },
    "verification_hooks": { "expected_nmr_change": "optional schema ref" }
  }
}`),
    h2('2.4 Examples'),
    p('A Suzuki–Miyaura coupling step record links Buchwald-Hartwig-class ligand parameters, base strength, and solvent polarity to chemoselectivity against enolizable ketones; the same record may attach expected ¹H NMR simplification upon conversion of an aryl halide to a biaryl.'),
    h2('2.5 Failure Modes'),
    bullet('Schema drift: if reaction_class_id and mechanism_path_id diverge without a compatibility matrix, the planner emits mechanistically inconsistent routes.'),
    bullet('Identifier ambiguity: non-canonical SMILES for organometallics may break graph matching of reaction templates.'),
    p(''),
  );

  /** ---- Layer 1 Reagent ---- */
  sections.push(
    ...layerBlock('3.', 'Layer 1 — Reagent Layer', () => [
      h3('A. Scientific Explanation — Definitions and Principles'),
      p('Reagents are the material carriers of mechanism: they supply nucleophiles, electrophiles, bases, acids, electron reservoirs, ligand fields, and redox equivalents. Effective modeling distinguishes nominal reagents (what is added) from active species (what actually performs bond formation), which often requires speciation equilibria (e.g., "LDA" vs lithium isopropylamide aggregates). Brønsted acidity/basicity, Lewis acidity, redox potentials (where defined), and aggregation states are the mechanistic parameters that constrain which microsteps are accessible at specified temperature and concentration.'),
      h3('B. Operational Logic — Subcomponents, Decision Procedures, and Real-World Implications'),
      tableFromRows([
        ['Subcomponent', 'Role', 'Key attributes'],
        ['Reagent identity', 'Chemical inventory control', 'CAS, class, molecular graph, hygroscopicity'],
        ['Active species model', 'Mechanistic truth layer', 'pKa, aggregation state, counterion, solvent dependency'],
        ['Stoichiometry & equivalents', 'Mass-balance feasibility', 'eq., limiting reagent, excess policy'],
        ['Addition protocol', 'Kinetics & heat transfer', 'dropwise vs portionwise, inverse addition, aging'],
        ['Compatibility matrix', 'Cross-layer safety', 'incompatible solvents, oxidizers, water sensitivity'],
      ]),
      boldLine('Decision procedures:'),
      bullet('Choose reagent strength (base/nucleophile) relative to substrate pKa and leaving-group ability (pKa of conjugate acid).'),
      bullet('Select counterion and solvent to control aggregation, ion pairing, and SN2 vs elimination bifurcation.'),
      bullet('For redox systems, match reduction potential to functional-group susceptibility to avoid over-reduction.'),
      boldLine('Real-world implications:'),
      bullet('Vendor lot variability (water content in THF, molarity drift in titrated reagents) becomes the dominant uncertainty at scale; the operational layer should bind qc_assay fields to critical steps.'),
      h3('C. Data Structure Representation'),
      mono(`{
  "component": "reagent_specification",
  "inputs": ["substrate_fg_profile", "target_transformation", "scale_tier"],
  "outputs": ["reagent_id", "equivalents", "addition_protocol_id", "compat_flags"],
  "constraints": [
    "no_strong_base_with_base_sensitive_LG_unless_low_temp",
    "grignard_requires_anhydrous_THF_or_Et2O"
  ],
  "example_entry": {
    "reagent_id": "RGT_LDA",
    "active_species": "LDA_monomer_dimer_mix",
    "pKa_conj_acid_isopropylamine": "~36 (approximate in aggregate-dependent sense)",
    "typical_solvent": "THF",
    "failure_patterns": ["ester_enolate_scrambling_if_warming"] 
  }
}`),
      h3('D. Examples (Authenticated Substrate Classes)'),
      p('Tert-butyllithium as ortho-lithiation base for directed metalation on aromatics bearing DMGs; n-butyllithium for lithium–halogen exchange on aryl bromides in ether solvents at low temperature; DIBAL-H for partial reduction of esters to aldehydes at controlled temperature and inverse addition to prevent over-reduction.'),
      h3('E. Failure Modes — Misapplication and Downstream Risk'),
      bullet('Underestimating water sensitivity: organolithium/quasi-organometallic sequences collapse with low conversion and side products (protonation, Wurtz-type coupling).'),
      bullet('Wrong counterion/solvent: changing from Li to Na enolate can alter facial selectivity and regiochemistry in aldol-like pathways.'),
      bullet('Heat accumulation with heterogeneous exotherms: improper nitration or diazomethane equivalents at scale.'),
      h3('F. Extended Scientific Notes — HSAB, Speciation, Counterion and Ion Pairing'),
      p('Hard–soft acid–base (HSAB) reasoning constrains pairwise associations under kinetic control: hard nucleophiles (alkoxides, fluoroalkoxides in certain contexts) associate preferentially with harder electrophilic centers, while soft nucleophiles (phosphines, thiolates, stabilized enolates with extensive orbital mixing requirements) favor softer electrophiles (π-allyl complexes, α,β-unsaturated carbonyls in Michael additions). The architecture encodes qualitative hardness parameters and uses them as priors for selectivity_engine when quantitative barriers are unavailable.'),
      p('Speciation is pivotal for organolithium reagents: monomer–tetramer equilibria in ethers change effective basicity and nucleophilicity; the reagent_specification therefore binds not only nominal stoichiometry but also solvent donor number, concentration band, and temperature band to a speciation_class label. Magnesium and zinc reagents exhibit analogous Schlenk equilibria; incorrect speciation implies incorrect mechanism ordering (e.g., premature transmetalation hypotheses).'),
      p('Counterion and ion pairing modulate facial selectivity in carbonyl additions and stereochemical drift in enolate chemistry; the layer exposes counterion_id as a first-class field for steps where ion pairing is stereodetermining.'),
      h3('G. Supplementary Schema — Batch Quality and Lot Traceability'),
      mono(`{
  "reagent_batch_qc": {
    "lot_id": "LOT_9921",
    "assay_equivalents_per_mL": 1.03,
    "water_karl_fischer_ppm": 45,
    "max_allowed_water_ppm_for_step": 50,
    "particulate_filter_required": false,
    "verdict": "PASS_WITH_MARGIN",
    "supplier_cert_path": "URI_TO_COA"
  }
}`),
      p(''),
    ]),
  );

  /** ---- Layer 2 Reaction class ---- */
  sections.push(
    ...layerBlock('4.', 'Layer 2 — Reaction Class Layer', () => [
      h3('A. Scientific Explanation — Definitions and Principles'),
      p('Reaction classes compress infinite substrate variability into finite template families with conserved electron-flow topology. A class encodes (i) mandatory subgraph patterns (reactive centers and enabling auxiliaries), (ii) forbidden subgraph patterns (incompatibilities), (iii) typical conditions manifolds, and (iv) reported scope descriptors. This is the bridge between chemical intuition and graph rewriting algorithms used in route planning.'),
      h3('B. Operational Logic — Subcomponents, Decision Procedures, and Real-World Implications'),
      bullet('Template graph G_R: mapped nodes and edges with wildcard labels (e.g., any aryl halide bearing EWG ortho patterns).'),
      bullet('Condition manifolds: ranges of temperature, concentration, and catalyst loadings learned from literature priors.'),
      bullet('Outcome typing: bond orders created/destroyed; oxidation state deltas for redox classes.'),
      boldLine('Decision procedures:'),
      bullet('Match substrate to highest-priority eligible class under current FG state (protecting groups may enable otherwise blocked classes).'),
      bullet('Rank classes by estimated atom economy, step count penalty, and industrial hazard score.'),
      boldLine('Real-world implications:'),
      bullet('IP and freedom-to-operate reviews often cluster around named reaction classes; versioned class IDs support licensing and clearance documentation.'),
      h3('C. Data Structure Representation'),
      mono(`{
  "component": "reaction_class",
  "inputs": ["substrate_graph", "fg_state_vector", "available_catalysts"],
  "outputs": ["reaction_class_id", "matched_sites", "predicted_products_graph"],
  "constraints": ["no_beta_hydride_elimination_path_if_blocked_by_pattern"],
  "example_class": {
    "reaction_class_id": "RC_MITSUNOBU_ester",
    "graph_pattern": { "alcohol_site": "primary_or_secondary", "acid_component": "carboxylic_acid" },
    "reagents": ["DEAD_or_DIAD", "PPh3"],
    "stereo_outcome_note": "stereochemical_inversion_at_alcohol_center"
  }
}`),
      h3('D. Examples (Authenticated Substrate Classes)'),
      p('Mitsunobu esterification between 4-nitrobenzoic acid and (S)-2-butanol yields inverted configuration at the alcohol-bearing stereocenter; Pd-catalyzed Heck reaction of 4-bromoacetophenone with butyl acrylate installs E-alkene geometry under standard β-hydride elimination regimes.'),
      h3('E. Failure Modes — Misapplication and Downstream Risk'),
      bullet('Over-general patterns cause false positives (unsafe suggested couplings on sensitive polyenes).'),
      bullet('Neglect of leaving-group orthogonality leads to unintended activation (e.g., acyl chlorides vs anhydrides).'),
      h3('F. Extended Notes — Multimetallic Classes, Photoredox, and Flow Eligibility'),
      p('Reaction classes must declare catalytic_cycle_family: {single_electron_transfer_mediated, two_electron_oxidative_addition, pericyclic, purely_ionic}. Nickel- and iron-catalyzed cross-couplings often require distinct template graphs versus palladium manifolds; misclassification blocks correct transmetalation ordering. Photoredox classes require photon flux, catalyst excited-state redox windows, and quenching pathways; scale_tag may restrict batch photochemistry unless flow-photochemistry parameters exist.'),
      h3('G. Example — Ni-accelerated coupling pattern (illustrative skeleton)'),
      mono(`{
  "reaction_class_id": "RC_NI_AROM_ETHER_ILLUSTRATIVE",
  "graph_pattern": { "aryl_halide": "Ar-X", "phenol_component": "Ar-OH" },
  "catalytic_cycle_family": "two_electron_oxidative_addition",
  "notes": "Illustrative only—real class must cite validated internal or literature scope"
}`),
      p(''),
    ]),
  );

  /** ---- Layer 3 Mechanism ---- */
  sections.push(
    ...layerBlock('5.', 'Layer 3 — Mechanism Layer', () => [
      h3('A. Scientific Explanation — Definitions and Principles'),
      p('Mechanisms assign partial bonds, charges, and spin states to intermediates along a reaction coordinate. For knowledge architecture, mechanisms are modeled as partially ordered sets (posets) of microsteps; each microstep references orbital interactions (donor→acceptor), thermodynamic sinks (stable intermediates), and kinetic traps (irreversible steps). Transition states are not always computed; instead, literature-backed qualitative constraints (Hammond postulate usage, antiperiplanar requirements for E2) gate feasibility.'),
      h3('B. Operational Logic — Subcomponents, Decision Procedures, and Real-World Implications'),
      bullet('Microstep catalog: nucleophilic attack, proton transfer, β-elimination, oxidative addition, transmetallation, reductive elimination, migratory insertion, etc.'),
      bullet('Intermediate typing: carbocations, enolates, metallacycles, σ-allyl complexes.'),
      bullet('Stereo-electronic rules: Baldwin’s rules for cyclizations where ring-forming classes apply; stereochemical steering via chelation in carbonyl additions.'),
      boldLine('Decision procedures:'),
      bullet('Path validation: each bond change in the template must be explained by consecutive microsteps without impossible charge accumulation.'),
      bullet('Condition coupling: if mechanism invokes deprotonation prior to nucleophilicity generation, base strength and solvent must satisfy the microstep ordering.'),
      boldLine('Real-world implications:'),
      bullet('Regulatory filings and patents frequently require plausible mechanisms for critical steps; storing provenance links (literature DOI, internal experiment ID) on each mechanism_path_id supports audit.'),
      h3('C. Data Structure Representation'),
      mono(`{
  "component": "mechanism_path",
  "inputs": ["reaction_class_id", "substrate_graph", "conditions"],
  "outputs": ["ordered_microsteps", "intermediate_types", "TS_hypotheses[]"],
  "constraints": ["no_pentavalent_carbon_in_ground_state"],
  "example_path": {
    "mechanism_path_id": "MECH_SN2_PRIMARY_ALKYL",
    "microsteps": [
      "nucleophile_attack_backside",
      "leaving_group_departure_concerted"
    ],
    "stereo": "Walden_inversion"
  }
}`),
      h3('D. Examples (Authenticated Substrate Classes)'),
      p('Pd(0)/L catalyzed oxidative addition of 4-bromoanisole followed by transmetalation with arylboronic acid and reductive elimination delivers biaryl; Lewis-acid catalyzed Mukaiyama aldol pathway involving silyl enol ether nucleophile addition to an aldehyde electrophile with stereocontrol via closed transition state models.'),
      h3('E. Failure Modes — Misapplication and Downstream Risk'),
      bullet('Mechanistic theater: plausible arrow-pushing disconnected from conditions yields "paper chemistry."'),
      bullet('Incorrect microscopic order leads to wrong intermediate charge distribution and erroneous predictions of regioselectivity.'),
      h3('F. Pericyclic Topology — Woodward–Hoffmann Consistency (Optional Validator)'),
      p('For cycloadditions, electrocyclic closures, and sigmatropic rearrangements, a mechanism validator may require orbital symmetry alignment: suprafacial vs antarafacial components must be satisfied for thermal vs photochemical channels as appropriate. The knowledge architecture stores reaction_class_electron_count (4n vs 4n+2) and allowed_components to flag implausible photochemical–thermal interchange.'),
      h3('G. Redox Microsteps — Formal Oxidation State Discipline'),
      p('Redox mechanisms must conserve bookkeeping via oxidation_state_delta vectors on metals and main-group centers. Misassignment of formal oxidation states (e.g., ambiguous Pd(0)/Pd(II) cycles in catalytic systems with comproportionation) breaks compatibility with elementary-step libraries and invalidates stereochemical predictions tied to coordination number changes.'),
      mono(`{
  "redox_ledger_entry": {
    "center_id": "Pd",
    "OS_before": 0,
    "OS_after": 2,
    "electron_pairs_transferred": 1,
    "balanced": true
  }
}`),
      p(''),
    ]),
  );

  /** ---- Layer 4 Selectivity ---- */
  sections.push(
    ...layerBlock('6.', 'Layer 4 — Selectivity Engine', () => [
      h3('A. Scientific Explanation — Definitions and Principles'),
      p('Selectivity emerges from differences in activation barriers among competing reaction channels: chemoselectivity (which FG reacts), regioselectivity (where it reacts on π-systems), diastereoselectivity (relative stereochemistry), and enantioselectivity (enantiomeric discrimination). Quantitative treatment requires kinetic models; the knowledge architecture encodes surrogate scoring functions combining (i) steric descriptors, (ii) electronic substituent parameters, (iii) conformational preferences, (iv) catalyst-ligand bite angles, and (v) empirical literature priors.'),
      h3('B. Operational Logic — Subcomponents, Decision Procedures, and Real-World Implications'),
      tableFromRows([
        ['Engine module', 'Scientific basis', 'Typical signal inputs'],
        ['Chemoselectivity scorer', 'relative reactivity tables', 'FG susceptibility, reagent hardness/softness'],
        ['Regio model', 'polarization of π-systems', 'substituent patterns, directing effects'],
        ['Stereo model', 'steric bias & chair/closed TS', 'A¹³ strain, allylic strain (A¹²,3)'],
        ['Catalyst descriptor block', 'ligand steric map', 'Tolman cone angle, buried volume %Vbur'],
      ]),
      boldLine('Decision procedures:'),
      bullet('Compute competing transition-state hypotheses where applicable; otherwise fall back to empirical priors with explicit confidence intervals.'),
      bullet('If enantioselectivity required, enforce chiral catalyst or auxiliary presence; reject racemic pathways under constraint.'),
      boldLine('Real-world implications:'),
      bullet('Pharmaceutical IMP and GMP contexts require documented justification for stereochemical control; the engine must preserve evidence objects suitable for inclusion in development reports.'),
      h3('C. Data Structure Representation'),
      mono(`{
  "component": "selectivity_engine",
  "inputs": ["candidate_steps[]", "conformational_ensemble_ref", "lit_priors"],
  "outputs": ["ranked_steps", "confidence_intervals", "dominant_channel_id"],
  "constraints": ["ee_threshold_if_chiral_target>=0.95 unless user_overrides"],
  "rule_system_excerpt": [
    { "if": "enolate_formation_competes_with_SN2", "then": "lower_temperature_or_switch_polar_aprotic" }
  ]
}`),
      h3('D. Examples (Authenticated Substrate Classes)'),
      p('Hydride reduction of 4-acetylbenzaldehyde with NaBH4 favors aldehyde reduction over ketone under typical kinetic conditions and steric profiles; asymmetric hydrogenation of methyl (Z)-2-acetamidocinnamate with Rh-DuPhos class catalysts yields high enantiomeric excess via well-defined quadrant models.'),
      h3('E. Failure Modes — Misapplication and Downstream Risk'),
      bullet('Overconfidence in QM-neglected systems: stereochemical predictions wrong for flexible chains without conformational sampling.'),
      bullet('Ignoring trace acids/bases leads to wrong chemoselectivity (e.g., acetal migration, silyl drift).'),
      h3('F. Quantitative Hooks — Eyring Formalism and LFER Priors'),
      p('Where activation parameters are unknown, the selectivity engine may rank channels using literature-derived linear free-energy relationships (Hammett σ constants, σ* for steric–inductive blends, Charton steric parameters) as surrogates for ΔΔG‡. Prototype implementation stores {ρ, confidence_interval} per reaction_class_id. Full Eyring analysis (ΔH‡, ΔS‡) remains optional external computation.'),
      h3('G. Uncertainty Quantification and Dominant Channel Proof Obligation'),
      mono(`{
  "selectivity_record": {
    "dominant_channel_id": "CH_SN2_PRIMARY",
    "delta_delta_G_approx_kJ_per_mol": 8.4,
    "confidence_interval_kJ": [6.0, 10.8],
    "evidence_types": ["LFER_prior", "literature_analog_DOI", "internal_HTE_n"],
    "audit_required_for_GMP": true
  }
}`),
      p(''),
    ]),
  );

  /** ---- Layer 5 Retrosynthesis ---- */
  sections.push(
    ...layerBlock('7.', 'Layer 5 — Retrosynthesis & Synthon Layer', () => [
      h3('A. Scientific Explanation — Definitions and Principles'),
      p('Retrosynthesis transforms a target into precursors via disconnection rules grounded in reliable synthetic equivalents. Synthons are formal charge-bearing fragments (umpolung notation) that may not be isolable; synthetic equivalents are real reagents that stand in for synthons (e.g., acyl anion equivalent via dithiane chemistry). Strategic bonds are ranked by the likelihood of high-yielding forward reaction classes and minimal functional-group incompatibilities.'),
      h3('B. Operational Logic — Subcomponents, Decision Procedures, and Real-World Implications'),
      bullet('Disconnection library: one-group C-X, two-group, pericyclic, rearrangement-aware disconnections.'),
      bullet('FG-based transforms: interconversion rules (oxidation ladders, epimerization risk).'),
      bullet('Search policy: AND/OR graph search with branch-and-bound under step count, cost, safety budgets.'),
      boldLine('Decision procedures:'),
      bullet('Prefer disconnections that maximize convergence and minimize functional-group manipulations late in sequence.'),
      bullet('Penalize steps with poor atom economy if green metrics constraints active.'),
      boldLine('Real-world implications:'),
      bullet('Early route decisions fix raw-material markets and regulatory starting-material definitions; disconnection choices should carry supply-chain metadata where available.'),
      h3('C. Data Structure Representation'),
      mono(`{
  "component": "retrosynthesis_node",
  "inputs": ["target_graph", "constraints", "available_reaction_classes"],
  "outputs": ["child_precursor_graphs", "disconnection_labels", "synthon_map"],
  "constraints": ["max_steps<=N", "banned_intermediates[]"],
  "example": {
    "target": "aryl_ketone_from_Friedel_Crafts",
    "disconnection": "C-C_bond_aromatic_acylation",
    "synthon_equivalents": ["acyl_chloride+ArH+AlCl3_catalytic_cycle"]
  }
}`),
      h3('D. Examples (Authenticated Substrate Classes)'),
      p('1-(4-methoxyphenyl)propan-1-one disconnected via Friedel–Crafts acylation between anisole and propionyl chloride with a Lewis acid; epoxide opening retrosynth of 2-phenoxyethanol from phenol nucleophile and ethylene oxide electrophile under basic conditions.'),
      h3('E. Failure Modes — Misapplication and Downstream Risk'),
      bullet('Ignoring reactive handles on advanced intermediates causes dead-end forward plans.'),
      bullet('Incorrect umpolung assignment yields non-existent synthetic equivalents for proposed synthons.'),
      h3('F. Functional-Group Interconversion (FGI) Ladders and Oxidation-State Discipline'),
      p('Retrosynthetic transforms include FGI operators that change oxidation state of a single carbon (alcohol ↔ aldehyde ↔ acid) with explicit reagent hazards and step economy implications. The ladder attaches green chemistry scores: atom economy, PMI (process mass intensity) priors, and solvent intensity. Steps that oscillate oxidation state without strategic benefit receive high penalty in route scoring.'),
      h3('G. DAG Semantics — AND/OR Graph, Convergence, and Dead-End Marking'),
      mono(`{
  "retrosynthesis_dag": {
    "nodes": [{ "id": "T", "molecule_id": "TARGET" }, { "id": "A", "molecule_id": "PREC_A" }],
    "edges": [{ "from": "T", "to": "A", "disconnection": "DCE" }],
    "and_or_type": "OR_over_disconnections_at_T",
    "convergence_metric": { "branch_factor_max": 3, "longest_path_cap": 14 }
  }
}`),
      p(''),
    ]),
  );

  /** ---- Layer 6 FG strategy ---- */
  sections.push(
    ...layerBlock('8.', 'Layer 6 — Functional Group Strategy (Protecting Groups & Orthogonality)', () => [
      h3('A. Scientific Explanation — Definitions and Principles'),
      p('Functional group interferences—nucleophilic competition, undesired oxidation, β-elimination of activated centers—require temporary masking. Protecting groups are orthogonal when their installation, in situ stability, and deprotection windows are disjoint under distinct chemical triggers (acid/base/redox/fluoride/Lewis acid). The strategy layer is explicitly temporal: it schedules bond masking events across the multistep lattice and binds them to stability windows inferred from mechanism layer events.'),
      h3('B. Operational Logic — Subcomponents, Decision Procedures, and Real-World Implications'),
      bullet('Protection state machine per site: {free, protected(PG_A), protected(PG_B), transiently_revealed}.'),
      bullet('Orthogonality matrix: PG_i deprotection conditions must not unmask PG_j unless intentional multicascade design.'),
      bullet('Global oxidation state discipline to prevent redox leakage during multistep manipulations.'),
      boldLine('Decision procedures:'),
      bullet('Install protections before introducing incompatible reagents (e.g., silyl ethers before strong bases if alcohol must remain masked).'),
      bullet('Late-stage deprotection must align with product sensitivity (acid-labile products vs TFA deprotection schemes).'),
      boldLine('Real-world implications:'),
      bullet('Telescoping steps without isolation changes effective orthogonality (traces of acid/base carry over); the model should admit process_intent flags: "isolated" vs "one-pot".'),
      h3('C. Data Structure Representation'),
      mono(`{
  "component": "functional_group_strategy",
  "inputs": ["route_graph", "reagent_sequence", "orthogonal_sets"],
  "outputs": ["pg_plan", "temporal_schedule", "risk_flags"],
  "constraints": [
    "Fmoc_deprotection_base_must_not_trigger_Boc_if_both_present_unless_planned"
  ],
  "orthogonality_matrix_example": {
    "TBS": { "stable_to": ["weak_acid_brief"], "cleaved_by": ["TBAF", "strong_acid_extended"] },
    "Boc": { "stable_to": ["base_catalysis_many_cases"], "cleaved_by": ["strong_acid"] }
  }
}`),
      p('Note: Production stores must validate JSON strictly (escaped quotes, typed numeric fields).'),
      h3('D. Examples (Authenticated Substrate Classes)'),
      p('Cbz protection of amines for peptide coupling compatibility later removed by hydrogenolysis; TBS protection of primary alcohol during oxidation of a secondary alcohol (e.g., Dess–Martin periodinane) to avoid over-oxidation of primary; FMOC/Boc orthogonality in solid-phase peptide contexts.'),
      h3('E. Failure Modes — Misapplication and Downstream Risk'),
      bullet('Protecting-group drift under unintended acidic workups migrates silyl groups.'),
      bullet('False orthogonality: presumed base-labile protections fail when nearby functionality enables intramolecular assistance.'),
      h3('F. Peptide and Oligomer Chemistry — Resin Strategy and Repeatability'),
      p('Solid-phase contexts require Nα protection cycles (Fmoc/Boc) distinct from side-chain protections; the strategy layer binds resin_linker_lability (acid-cleavable vs photolabile) and repetitive deprotection–coupling cycles. Off-resin sequences must track repeated base washes that may erode base-sensitive side-chain protections (cyanoethyl phosphate, certain esters).'),
      h3('G. Green Chemistry and Deprotection Mass Intensity'),
      p('Each protecting group plan carries a deprotection_atom_economy_index: reagents consumed per mole of revealed functionality, including scavengers (silanes, thiols) used to quench byproducts. High-index sequences trigger substitution suggestions (e.g., switch to enzymatically labile protections in niche manufacturing contexts where registered).'),
      mono(`{
  "pg_plan_metric": {
    "total_scavenger_equiv": 6.0,
    "aqueous_waste_class": "CWW_profile_example",
    "substitution_candidates": ["PG_tag_B_lower_waste"]
  }
}`),
      p(''),
    ]),
  );

  /** ---- Cross layer ---- */
  sections.push(
    h1('9. Cross-Layer Integration and Constraint Propagation'),
    h2('9.1 Scientific Explanation'),
    p('Layers are not independent modules; they form a coupled inference stack. Reagent selection is meaningless without mechanism validation; mechanism commitments imply selectivity hypotheses; selectivity outcomes constrain acceptable retrosynthetic disconnections; retrosynthetic timing dictates protecting-group choreography.'),
    h2('9.2 Operational Integration Contracts'),
    tableFromRows([
      ['Interaction', 'Data passed', 'Invariant enforced'],
      ['Reagent ↔ Mechanism', 'active species, speciation', 'every bond change traceable to microsteps'],
      ['Mechanism ↔ Selectivity', 'TS hypotheses, steric maps', 'dominant channel aligns with electron flow'],
      ['Selectivity ↔ Retrosynthesis', 'ranked forward feasibility', 'disconnects instantiate top forward classes'],
      ['Retrosynthesis ↔ Protecting groups', 'intermediate graphs', 'no illegal FG exposure mid-sequence'],
    ]),
    h2('9.3 Pairwise Integration — Mechanistic and Strategic Coupling'),
    p('Reagent ↔ mechanism: the reagent_specification must instantiate the nucleophile/base/redox field demanded by the first kinetically committed microstep; if speciation implies a weaker base than the proposed deprotonation, the mechanism path is rejected regardless of template match.'),
    p('Mechanism ↔ selectivity: stereochemical outcome declarations (e.g., anti elimination, backside attack) flow into transition-state hypotheses; if the selectivity engine cannot realize those hypotheses under available catalyst/ligand inventories or substrate conformations, the forward class is down-ranked.'),
    p('Selectivity ↔ retrosynthesis: disconnections that imply high stereochemical debt without an accessible chiral pool or catalytic cycle are penalized; the retrosynthesis layer consumes feasibility priors from competing forward channels rather than assuming textbook yields.'),
    p('Retrosynthesis ↔ protecting groups: the temporal order of disconnections maps to which functional groups must be revealed during latent steps; premature revelation blocks otherwise attractive forward classes—this coupling is mandatory for multi-etalon syntheses of densely functionalized targets.'),
    h2('9.4 Decision Tree (Textual)'),
    mono(`BEGIN route_hypothesis H
IF reaction_class_match(H.step) is EMPTY -> FAIL
IF mechanism_validate(H.step) is FALSE -> PRUNE
IF selectivity_score(H.step) < threshold AND user_strict -> PRUNE
IF retrosynth_expand(H.target) yields_cycles -> PRUNE_OR_MARK
IF PG_schedule(H.sequence) violates orthogonality -> FAIL with counterexample
END`),
    h2('9.5 Message-Passing Interpretation (Algorithmic Contract)'),
    p('Implementation of cross-layer consistency can be viewed as constraint message passing: mechanism_layer emits feasibility_messages to selectivity_engine; selectivity_engine emits rank_messages to retrosynthesis_layer; functional_group_strategy emits legality_messages blocking illegal substrate states. A step is schedulable only when all inbound messages are satisfiable simultaneously.'),
    mono(`{
  "message_types": [
    { "from": "mechanism", "to": "selectivity", "payload": { "TS_family": "SN2_backside", "steric_gate": true } },
    { "from": "selectivity", "to": "retrosynth", "payload": { "feasibility_score": 0.87, "confidence": 0.74 } },
    { "from": "fg_strategy", "to": "reagent", "payload": { "forbidden_reagents": ["strong_brønsted_acid"] } }
  ]
}`),
    h2('9.6 Failure Modes'),
    bullet('Local optima in AND/OR search without cross-layer penalties yield long, fragile sequences.'),
    bullet('Inconsistent versioning between class templates and mechanism microstep catalogs desynchronizes validation.'),
    bullet('Circular dependencies when protecting-group updates change reactivity graphs without invalidating cached reaction_class matches.'),
    p(''),
  );

  /** ---- Industrial ---- */
  sections.push(
    h1('10. Industrial Scale-Up, Safety, Cost, and Robustness'),
    h2('10.1 Scalability'),
    p('Lab-scale kinetics rarely translate linearly. Heat removal, mass transfer in heterogeneous catalysis, and filterability of byproducts dominate at scale. The architecture attaches a scale_tag {mg, g, kg, pilot, plant} to each step and raises engineering constraints (maximum adiabatic temperature rise, dilution policy, continuous vs batch eligibility).'),
    h2('10.2 Safety'),
    p('Process safety integrates DSC/ARC mindset at knowledge level: exothermic accumulations, gas evolution, peroxide formers, shock-sensitive intermediates, and incompatible solvent pairs. Each reagent_record and step_record includes normalized hazard classes aligned with GHS-like taxonomies and allowable upper temperature ramps.'),
    h2('10.3 Cost Efficiency'),
    p('Cost is modeled via multi-criteria weights: raw material cost proxies, catalyst loading, solvent volume, chromatography dependency (purification pain index), and yield expectation distributions from literature priors.'),
    h2('10.4 Robustness'),
    p('Robustness scores summarize sensitivity to water, oxygen, feedstock purity, and minor temperature excursions. Robust sequences dominate under manufacturing quality systems (e.g., Design Space thinking).'),
    tableFromRows([
      ['Attribute', 'Knowledge field', 'Example rule'],
      ['Scalability', 'engineering_thresholds', 'if ΔT_adiabatic > 120 K -> require dilution or semibatch'],
      ['Safety', 'hazard_flags', 'if diazonium_path -> forbid scale>g without engineering review'],
      ['Cost', 'economic_prior', 'if noble_metal_load_high -> trigger recycling subprocess node'],
      ['Robustness', 'sensitivity_priors', 'if moisture_sensitive_organometallic -> inert_atmosphere mandatory'],
    ]),
    h2('10.5 Design of Experiments (DoE) and Robustness Mapping'),
    p('Industrial process development encodes multivariate sensitivities. The architecture reserves doe_profile objects on critical steps: factors (temperature, equivalents, catalyst loading, feed rate), response variables (conversion, impurity profile, EE), and experimental design type (fractional factorial, D-optimal). SpectroMind may link PAT results (NMR, IR, MS on streams) to update posterior robustness distributions for selectivity priors.'),
    h2('10.6 Process Analytical Technology (PAT) Linkage'),
    p('Where PAT sensors are available (IR flow cells, HPLC/LCMS, online NMR), observability blocks attach step_id to real-time acceptance criteria: maximum impurity area percent, drift limits on key absorbance bands, and statistical process control limits. This closes the loop between synthesis knowledge architecture and manufacturing execution systems.'),
    mono(`{
  "pat_link": {
    "step_id": "STEP_024",
    "sensor_channels": ["mid_IR_flow", "HPLC_area_percent_impurity"],
    "acceptance_rules": [{ "metric": "impurity_peak_area", "max_percent": 2.0 }]
  }
}`),
    p(''),
  );

  /** ---- SpectroMind mapping ---- */
  sections.push(
    h1('11. SpectroMind Mapping: From Knowledge Graph to Verification'),
    p('SpectroMind already reasons about analytical modalities (NMR/IR/MS) and structure identity. The synthesis architecture feeds proposed intermediates into spectral expectation templates: NMR shift domains for newly introduced stereocenters, IR carbonyl shifts upon oxidation state changes, MS isotope patterns for halogenated coupling partners. Each synthetic step optionally registers a verification delta object consumed by the verification engine, reducing hallucinated structure proposals inconsistent with spectroscopic evidence.'),
    mono(`{
  "spectromind_bridge": {
    "step_id": "STEP_014",
    "structure_before_inchikey": "…",
    "structure_after_inchikey": "…",
    "expected_observables": {
      "1H": { "new_multiplets": [], "disappearing_signals": [] },
      "13C": { "new_carbonyl_window": [200, 210] },
      "IR": { "carbonyl_stretch_cm-1_range": [1680, 1720] }
    }
  }
}`),
    p(''),
  );

  /** ---- Appendix A schemas ---- */
  sections.push(
    h1('12. Appendix A — Consolidated JSON Schema Sketches'),
    h2('12.1 Entity-Relationship Master Sketch'),
    p('The following master sketch summarizes cross-linked entities for database implementation (PostgreSQL JSONB + graph extension, or document store with edge index).'),
    mono(`{
  "entities": {
    "Molecule": ["graph", "identifiers", "fg_state", "pg_state"],
    "Reagent": ["speciation_model", "hazards", "cost_proxy"],
    "ReactionClass": ["template_graph", "conditions_manifold"],
    "MechanismPath": ["ordered_microsteps"],
    "SelectivityModel": ["scorers", "priors"],
    "Synthon": ["charge_class", "equivalent_reagents"],
    "Route": ["ordered_steps", "constraints_satisfied"]
  },
  "relations": [
    "ReactionClass_IMPLEMENTED_BY_MechanismPath",
    "MechanismPath_REQUIRES_ReagentRole",
    "Route_SATISFIES_FunctionalGroupStrategy",
    "Step_EMITS_SpectroMindVerificationDelta"
  ]
}`),
    h2('12.2 Rule Engine and Evaluation Record'),
    p('Production implementations should version every evaluated rule and persist inputs/outputs for reproducibility (aligns with industrial data-integrity expectations).'),
    mono(`{
  "rule_evaluation": {
    "rule_id": "R_SYN_014_mechanism_class_consistency",
    "rule_version": "2026.04.03",
    "inputs": { "reaction_class_id": "RC_…", "mechanism_path_id": "MECH_…", "substrate_inchikey": "…" },
    "outputs": { "verdict": "PASS|WARN|FAIL", "evidence": ["microstep_coverage_ok"], "confidence": 0.91 },
    "constraints": ["mechanism_path must cite literature_or_internal_RUN_ID"],
    "autofix_suggestions": []
  }
}`),
    p(''),
  );

  /** ---- TÜBİTAK 1812 Turkish appendix ---- */
  sections.push(
    h1('13. Appendix B — TÜBİTAK 1812 Uyumluluk ve Proje Sunumu (Türkçe)'),
    p('Bu ek, Yatırım Tabanlı Girişimcilik (BiGG Yatırım — 1812) tipi başvurularda sıkça beklenen teknik-iş öğeleri ile ana mimari belgeyi ilişkilendirir. Resmi şartname her çağrı döneminde güncellenebileceği için PRODİS üzerinden güncel kılavuz mutlaka doğrulanmalıdır.'),
    h2('13.1 Teknolojinin Özgünlüğü ve Yenilikçi Yönü'),
    bullet('Katmanlı (reaktif, tepkime sınıfı, mekanizma, seçicilik, retrosentez, fonksiyonel grup stratejisi) bilgi mimarisi; spektroskopik doğrulama ile sentetik planın çapraz bağlanması (hallüsinasyon azaltımı).'),
    bullet('Versiyonlanmış ontoloji + kural motoru + güven skorları ile izlenebilir karar zinciri.'),
    h2('13.2 Ticarileşme ve Pazar Uygulanabilirliği'),
    bullet('Hedef kullanıcılar: ilaç ar-ge’si (erken rota keşfi), özel kimya (FTE), üniversite laboratuvarları (eğitim/ön dizayn), proses geliştirme ekipleri (ölçeklenebilirlik kısıtları).'),
    bullet('Ürünleştirme biçimleri: kurumsal lisans (on-prem), API tabanlı planlama servisi, SpectroMind ile entegre SaaS modülü.'),
    h2('13.3 Fikri Mülkiyet (FSE) ve Bilgi Güvenliği'),
    bullet('Özgün yazılım telifleri, veri şemaları ve kural setleri ticari sır / tescilli veri tabanı olarak ayrıştırılabilir.'),
    bullet('Müşteri molekülleri için şifreleme, erişim kontrolleri ve denetim izi (audit trail) zorunluluğu.'),
    h2('13.4 Teknoloji Olgunluk Seviyesi (TRL) ve Yol Haritası'),
    tableFromRows([
      ['TRL', 'Örnek olgunluk', 'Bu belgeyle ilişki'],
      ['TRL 3-4', 'Kavram kanıtı / bileşen doğrulama', 'Şema + kural sistemlerinin prototipi'],
      ['TRL 5-6', 'İlgili ortamda doğrulama', 'Seçili tepkime aileleri ile uçtan uca test'],
      ['TRL 7-8', 'Operasyonel demo / sistem tamamlama', 'SpectroMind entegrasyonlu pilot müşteri sahası'],
    ]),
    h2('13.5 Riskler ve Azaltım'),
    bullet('Model/kapsam riski: literatür öncül bilgisinin eksikliği → sürekli katalog genişletme ve uzman-in-the-loop onayı.'),
    bullet('Regülasyon ve güvenlik: önerilen reaktiflerin SDS uyumu ve süreç güvenliği bayrakları.'),
    h2('13.6 Ölçülebilir Çıktılar (Örnek KPI)'),
    bullet('Rota önerisi başına mekanistik tutarlılık oranı; spektrum-teyit uyumu skoru; kullanıcı başına adım tasarrufu.'),
    bullet('Regresyon test kapsamı: tepkime şablonları için PASS/FAIL vaka sayısı ve sürüm hash izleri.'),
    h2('13.7 Kurumsal ve Yasal Uyum Notu'),
    p('Sağlık ve kimyasal güvenlik için kurumsal QHSE süreçleriyle uyum; veri işleme için KVKK/GDPR kapsamında aydınlatma ve veri işleme sözleşmeleri; ithalatlı kimyasallar için mevzuat kontrolleri ilgili müşteri senaryosuna bağlıdır.'),
    h2('13.8 Önerilen İş Paketleri (Örnek WBS) — BiGG Yatırım R&D Uyumu'),
    p('Aşağıdaki iş paketleri örnek çerçevedir; resmi başvuru formu ve karakter sınırları PRODİS’teki güncel şablona göre uyarlanmalıdır.'),
    tableFromRows([
      ['WP', 'Başlık', 'Çıktı', 'Süre örneği'],
      ['WP1', 'Ontoloji ve şema sürümleme altyapısı', 'Reaksiyon sınıfı + mekanizma mikro-adım katalogları v1', 'Ay 1–4'],
      ['WP2', 'Seçicilik motoru (LFER/prior + güven aralığı)', 'Seçicilik skor API’si, denetim günlüğü', 'Ay 2–6'],
      ['WP3', 'Retrosentez arama + PG zamanlaması', 'AND/OR DAG planlayıcı prototipi', 'Ay 3–8'],
      ['WP4', 'SpectroMind köprüsü (adım→beklenen spektrum deltas)', 'Doğrulama delta şeması, örnek vakalar', 'Ay 4–9'],
      ['WP5', 'Endüstriyel kısıt motoru (ölçek/güvenlik/maliyet)', 'policy_engine kuralları, SDS entegrasyonu iskeleti', 'Ay 5–10'],
      ['WP6', 'Pilot müşteri / saha doğrulama', 'TRL ilerleme raporu, regresyon test seti', 'Ay 8–12'],
    ]),
    h2('13.9 Risk Matrisi (Özet)'),
    tableFromRows([
      ['Risk', 'Olasılık', 'Etki', 'Azaltım'],
      ['Literatür kapsamı eksikliği', 'Orta', 'Yüksek', 'Uzman-in-the-loop + sürekli katalog genişletme'],
      ['Yanlış mekanistik öneri', 'Düşük–Orta', 'Çok yüksek', 'Mekanizma–sınıf tutarlılık kuralı + kanıt zorunluluğu'],
      ['Müşteri veri sızıntısı', 'Düşük', 'Çok yüksek', 'Şifreleme, erişim kontrolü, SOC2 benzeri süreç hedefi'],
      ['Ölçek güvenliği', 'Orta', 'Yüksek', 'Adyabatik ısınma bayrakları + proses güvenlik incelemesi'],
    ]),
    h2('13.10 Başvuru Öncesi Kontrol Listesi (Özet)'),
    bullet('PRODİS’te ilan türü, hibe oranı, eş finansman ve başvuru penceresi doğrulandı mı?'),
    bullet('Şirket (veya girişim) statüsü, ortaklık yapısı ve mali belgeler güncel mi?'),
    bullet('ArGe hedefleri ölçülebilir mi (KPI: doğruluk, kullanıcı süresi, hata oranı, TRL)?'),
    bullet('Fikri mülkiyet stratejisi (telif, ticari sır, patent) ve özgünlük iddiası net mi?'),
    bullet('Pazar, rekabet ve gelir modeli (SaaS, lisans, kurumsal proje) tanımlı mı?'),
    bullet('Proje ekibi ve iş birlikleri (üniversite, danışman) CV/uygunluk dokümanları tam mı?'),
    h2('13.11 Araştırma Ahlakı ve Etik'),
    p('İnsan kaynaklı veri yoksa dahi, müşteri ve iş ortağı verileri için aydınlatma metinleri; çıkar çatışması beyanları; kimyasal güvenlik ve çevresel etki değerlendirmesi (atık, solvent seçimi) proje raporlamasına entegre edilmelidir.'),
    h2('13.12 Sürdürülebilirlik ve Yeşil Kimya Göstergeleri'),
    p('Platform; atom ekonomisi, solvent seçimi, PMI ve geri dönüştürülebilir katalizör politikaları için skor alanları içerir. Endüstriyel raporlarda bu göstergelerin nasıl üretileceği (veri kaynağı, hesaplama, doğrulama) açıkça yazılmalıdır.'),
    p(''),
    new Paragraph({
      children: [new TextRun({
        text: '— End of document —',
        italics: true,
      })],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outDir = path.join(__dirname, '..', 'docs');
  const outPath = path.join(outDir, 'SPECTROMIND_Organic_Synthesis_Knowledge_Architecture.docx');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log('DOCX yazıldı:', outPath);
}

buildDocument().catch((err) => {
  console.error(err);
  process.exit(1);
});
