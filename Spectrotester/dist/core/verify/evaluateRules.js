/**
 * Rule engine: evaluate ALL ruleset rules against context with real evaluators.
 * NO rule may silently PASS without evaluation.
 * Every result carries structured evidence.
 *
 * If a rule lacks observed data (e.g., no COSY peaks provided), it returns SKIP
 * with explicit reason — never a false PASS.
 */
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ruleApplies(rule, engineId) {
    const engines = rule.applies_to_engines;
    if (!engines || engines.length === 0)
        return true;
    return engines.includes(engineId);
}
function peaksInRange(peaks, min, max) {
    if (!peaks)
        return [];
    return peaks.filter(p => p.ppm >= min && p.ppm <= max);
}
function bandsInRange(bands, min, max) {
    if (!bands)
        return [];
    return bands.filter(b => b.cm >= min && b.cm <= max);
}
function msInRange(peaks, mz, tol) {
    if (!peaks)
        return [];
    return peaks.filter(p => Math.abs(p.mz - mz) <= tol);
}
function peaks2dInRegion(peaks, f1Min, f1Max, f2Min, f2Max) {
    if (!peaks)
        return [];
    return peaks.filter(p => p.f1 >= f1Min && p.f1 <= f1Max && p.f2 >= f2Min && p.f2 <= f2Max);
}
function skipResult(rule, reason) {
    const status = rule.status_on_skip ?? 'SKIP';
    return {
        rule_id: rule.rule_id,
        status,
        evidence: { reason },
        why: rule.why_narrative,
        rule_version: rule.rule_version,
    };
}
function pickMeta(ctx, key, fallback) {
    if (ctx.meta && key in ctx.meta)
        return ctx.meta[key];
    return fallback;
}
function makeResult(rule, status, evidence) {
    const metadataOnly = rule.enforcement_mode === 'metadata_only' || rule.metadata_only === true;
    return {
        rule_id: rule.rule_id,
        status,
        evidence: {
            ...evidence,
            metadata_only: metadataOnly,
            source_module: 'verify/evaluateRules',
        },
        why: typeof rule.why_narrative === 'string' ? rule.why_narrative : undefined,
        suggested_action: typeof rule.suggested_action === 'string' ? rule.suggested_action : undefined,
        autofix: rule.autofix ?? undefined,
        rule_version: typeof rule.rule_version === 'string' ? rule.rule_version : undefined,
    };
}
const EVALUATORS = {};
function register(ruleId, fn) {
    EVALUATORS[ruleId] = fn;
}
// ---------------------------------------------------------------------------
// FORMULA rules
// ---------------------------------------------------------------------------
register('FORMULA_DBE_NEGATIVE_FATAL', (rule, ctx) => {
    const dbe = ctx.dbeValue ?? ctx.graphFeatures.dbe;
    const status = dbe < 0 ? 'FATAL' : 'PASS';
    return makeResult(rule, status, { dbe_value: dbe, formula: ctx.formulaRef });
});
register('FORMULA_DBE_PARITY', (rule, ctx) => {
    const dbe = ctx.dbeValue ?? ctx.graphFeatures.dbe;
    const isHalfInt = Number.isInteger(dbe * 2);
    const status = isHalfInt ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        dbe_value: dbe,
        is_half_integer: isHalfInt,
        note: isHalfInt ? 'DBE is integer or half-integer' : 'DBE has unexpected fractional part',
    });
});
// ---------------------------------------------------------------------------
// GLOBAL rules
// ---------------------------------------------------------------------------
register('GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED', (rule, ctx) => {
    const ok = !!ctx.canonicalSmiles && ctx.canonicalSmiles.length > 0;
    return makeResult(rule, ok ? 'PASS' : 'FATAL', {
        parse_success: ok,
        canonical_smiles: ctx.canonicalSmiles || null,
    });
});
register('GLOBAL_GRAPH_FIRST_REQUIRED', (rule, ctx) => {
    const ok = !!ctx.graphFeatures && ctx.graphFeatures.nC_total >= 0;
    return makeResult(rule, ok ? 'PASS' : 'FATAL', {
        smiles: ctx.canonicalSmiles,
        graph_build_ok: ok,
    });
});
register('CROSS_AROMATICITY_CONSENSUS_RULE', (rule, ctx) => {
    if (!ctx.graphFeatures)
        return skipResult(rule, 'no graph features');
    const isAromatic = ctx.graphFeatures.nC_aromatic > 0;
    if (!isAromatic)
        return makeResult(rule, 'PASS', { aromatic_ring: false, note: 'no aromatic ring in structure' });
    const h1Peaks = ctx.h1?.peaks;
    const h1Aromatic = h1Peaks ? peaksInRange(h1Peaks, 6.3, 8.8) : null;
    const c13ArPeaks = ctx.c13Peaks ? peaksInRange(ctx.c13Peaks, 100, 160) : null;
    const irArBands = ctx.ftirPeaks ? bandsInRange(ctx.ftirPeaks, 1450, 1600) : null;
    let confirmed = 0;
    let total = 0;
    if (h1Peaks) {
        total++;
        if (h1Aromatic && h1Aromatic.length > 0)
            confirmed++;
    }
    if (ctx.c13Peaks) {
        total++;
        if (c13ArPeaks && c13ArPeaks.length > 0)
            confirmed++;
    }
    if (ctx.ftirPeaks) {
        total++;
        if (irArBands && irArBands.length > 0)
            confirmed++;
    }
    if (total === 0)
        return skipResult(rule, 'no observed spectra for consensus');
    const status = confirmed >= 2 ? 'PASS' : confirmed >= 1 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        aromatic_ring: true,
        modalities_checked: total,
        modalities_confirmed: confirmed,
        h1_aromatic_peaks: h1Aromatic?.length ?? null,
        c13_aromatic_peaks: c13ArPeaks?.length ?? null,
        ir_ring_bands: irArBands?.length ?? null,
    });
});
register('CROSS_CARBONYL_CONSENSUS', (rule, ctx) => {
    if (!ctx.graphFeatures.has_carbonyl)
        return makeResult(rule, 'PASS', { carbonyl_in_structure: false });
    const c13Car = ctx.c13Peaks ? peaksInRange(ctx.c13Peaks, 160, 220) : null;
    const irCar = ctx.ftirPeaks ? bandsInRange(ctx.ftirPeaks, 1630, 1800) : null;
    let confirmed = 0;
    let total = 0;
    if (ctx.c13Peaks) {
        total++;
        if (c13Car && c13Car.length > 0)
            confirmed++;
    }
    if (ctx.ftirPeaks) {
        total++;
        if (irCar && irCar.length > 0)
            confirmed++;
    }
    if (total === 0)
        return skipResult(rule, 'no 13C or IR data');
    const status = confirmed >= 1 ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        carbonyl_total: ctx.graphFeatures.nC_carbonyl,
        c13_carbonyl_peaks: c13Car?.length ?? null,
        ir_carbonyl_bands: irCar?.length ?? null,
    });
});
register('CROSS_OH_CONSENSUS', (rule, ctx) => {
    const exch = ctx.graphFeatures.nH_exchangeable;
    if (exch === 0)
        return makeResult(rule, 'PASS', { exchangeable_OH: 0 });
    const irOH = ctx.ftirPeaks ? bandsInRange(ctx.ftirPeaks, 3200, 3550) : null;
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const status = irOH && irOH.length > 0 ? 'PASS' : 'WARN';
    return makeResult(rule, status, { exchangeable_OH: exch, ir_oh_band: irOH?.length ?? 0 });
});
register('CROSS_DBE_IMPLIES_SP2_SIGNALS', (rule, ctx) => {
    const dbe = ctx.dbeValue ?? ctx.graphFeatures.dbe;
    const thresh = rule.thresholds?.dbe_high_threshold ?? 6;
    if (dbe < thresh)
        return makeResult(rule, 'PASS', { dbe, threshold: thresh, note: 'DBE below threshold' });
    const h1sp2 = ctx.h1?.peaks ? peaksInRange(ctx.h1.peaks, 4.5, 8.8) : null;
    const c13sp2 = ctx.c13Peaks ? peaksInRange(ctx.c13Peaks, 100, 160) : null;
    const hasSp2 = (h1sp2 && h1sp2.length > 0) || (c13sp2 && c13sp2.length > 0);
    if (!ctx.h1?.peaks && !ctx.c13Peaks)
        return skipResult(rule, 'no 1H or 13C data');
    return makeResult(rule, hasSp2 ? 'PASS' : 'WARN', {
        dbe, h1_sp2_peaks: h1sp2?.length ?? null, c13_sp2_peaks: c13sp2?.length ?? null,
    });
});
// ---------------------------------------------------------------------------
// 1H NMR rules
// ---------------------------------------------------------------------------
register('DBE_AROMATIC_MIN_1H_INTEGRAL', (rule, ctx) => {
    const dbe = ctx.dbeValue ?? ctx.graphFeatures.dbe;
    const thresh = rule.thresholds?.dbe_aromatic_threshold ?? 4;
    if (dbe < thresh)
        return makeResult(rule, 'PASS', { dbe, note: 'DBE below aromatic threshold' });
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const arPeaks = peaksInRange(ctx.h1.peaks, 6.0, 9.0);
    const arIntegral = arPeaks.reduce((sum, p) => sum + (p.integral ?? 1), 0);
    const minRequired = rule.thresholds?.min_aromatic_H_if_aromatic_candidate ?? 2;
    const status = arIntegral >= minRequired ? 'PASS' : 'WARN';
    return makeResult(rule, status, { dbe, aromatic_integral_found: arIntegral, expected_min: minRequired });
});
register('H1_REQUIRE_AROMATIC_REGION_IF_AROMATIC_CH', (rule, ctx) => {
    if (ctx.graphFeatures.nH_aromatic === 0)
        return makeResult(rule, 'PASS', { aromatic_CH_count: 0 });
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const arPeaks = peaksInRange(ctx.h1.peaks, 6.3, 8.8);
    return makeResult(rule, arPeaks.length > 0 ? 'PASS' : 'FAIL', {
        aromatic_CH_count: ctx.graphFeatures.nH_aromatic,
        peaks_in_6_3_8_8: arPeaks.length,
    });
});
register('H1_INTEGRAL_TOTAL_MATCH_NONEXCH', (rule, ctx) => {
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const sumIntegrals = ctx.h1.peaks.reduce((s, p) => s + (p.integral ?? 0), 0);
    const expected = ctx.graphFeatures.nH_non_exchangeable;
    if (sumIntegrals === 0)
        return skipResult(rule, 'no integral data');
    const ratio = sumIntegrals / Math.max(1, expected);
    const status = ratio >= 0.7 && ratio <= 1.3 ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        sum_integrals: sumIntegrals,
        expected_nonexchangeable_H: expected,
        ratio,
        integral_mode: ctx.integralMode ?? 'unknown',
    });
});
register('H1_INTEGRAL_PARSING_SINGLE_AUTHORITY', (rule, ctx) => {
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    if (ctx.h1.peaks.length === 0)
        return skipResult(rule, '1H peak list empty');
    const hasIntegrals = ctx.h1.peaks.some(p => p.integral !== undefined && p.integral > 0);
    const hasDecimalIntegrals = ctx.h1.peaks.some(p => p.integral !== undefined && !Number.isInteger(p.integral));
    const allPositive = ctx.h1.peaks.every(p => p.integral === undefined || p.integral >= 0);
    const issues = [];
    if (!hasIntegrals)
        issues.push('No peaks have integral values assigned');
    if (!allPositive)
        issues.push('Negative integral values detected');
    const status = hasIntegrals && allPositive ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        has_integrals: hasIntegrals,
        has_decimal_integrals: hasDecimalIntegrals,
        all_positive: allPositive,
        integral_mode: ctx.integralMode ?? 'unknown',
        issues,
    });
});
register('H1_REQUIRE_VINYLIC_REGION_IF_ALKENE_CH', (rule, ctx) => {
    const sp2NonAr = ctx.graphFeatures.nC_sp2_non_aromatic;
    if (sp2NonAr === 0)
        return makeResult(rule, 'PASS', { alkene_ch: 0 });
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const vPeaks = peaksInRange(ctx.h1.peaks, 4.5, 6.8);
    return makeResult(rule, vPeaks.length > 0 ? 'PASS' : 'FAIL', {
        alkene_ch_estimate: sp2NonAr,
        peaks_in_vinylic: vPeaks.length,
    });
});
register('H1_ETHYL_MOTIF', (rule, ctx) => {
    if (!ctx.h1?.peaks || ctx.h1.peaks.length < 2)
        return skipResult(rule, 'insufficient 1H data');
    const triplets = ctx.h1.peaks.filter(p => p.mult === 't' || p.mult === 'triplet');
    const quartets = ctx.h1.peaks.filter(p => p.mult === 'q' || p.mult === 'quartet');
    if (triplets.length === 0 && quartets.length === 0) {
        return makeResult(rule, 'INFO', { note: 'No triplet/quartet found — ethyl motif not checked' });
    }
    const hasEthyl = triplets.some(t => (t.integral ?? 0) >= 2.5) &&
        quartets.some(q => (q.integral ?? 0) >= 1.5);
    return makeResult(rule, 'INFO', {
        triplet_count: triplets.length,
        quartet_count: quartets.length,
        ethyl_motif_detected: hasEthyl,
    });
});
register('H1_ISOPROPYL_MOTIF', (rule, ctx) => {
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const doublets = ctx.h1.peaks.filter(p => (p.mult === 'd' || p.mult === 'doublet') && (p.integral ?? 0) >= 5);
    const septets = ctx.h1.peaks.filter(p => p.mult === 'sep' || p.mult === 'septet' || p.mult === 'hept' || p.mult === 'heptet');
    return makeResult(rule, 'INFO', {
        high_integral_doublets: doublets.length,
        septets: septets.length,
        isopropyl_motif_possible: doublets.length > 0 && septets.length > 0,
    });
});
register('H1_TERT_BUTYL_MOTIF', (rule, ctx) => {
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const tbCandidates = ctx.h1.peaks.filter(p => (p.mult === 's' || p.mult === 'singlet') && (p.integral ?? 0) >= 8 && p.ppm >= 0.8 && p.ppm <= 1.5);
    return makeResult(rule, 'INFO', {
        tert_butyl_candidates: tbCandidates.length,
        note: tbCandidates.length > 0 ? 'Possible tBu singlet ~9H' : 'No tBu singlet detected',
    });
});
register('H1_REQUIRE_BENZYLIC_REGION_IF_PRESENT', (rule, ctx) => {
    if (ctx.graphFeatures.nC_aromatic === 0)
        return makeResult(rule, 'PASS', { benzylic_expected: false });
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const benPeaks = peaksInRange(ctx.h1.peaks, 2.2, 3.2);
    return makeResult(rule, benPeaks.length > 0 ? 'PASS' : 'WARN', {
        aromatic_in_structure: true,
        peaks_in_benzylic_region: benPeaks.length,
    });
});
register('H1_REQUIRE_ALPHA_TO_CARBONYL_REGION_IF_PRESENT', (rule, ctx) => {
    if (!ctx.graphFeatures.has_carbonyl)
        return makeResult(rule, 'PASS', { carbonyl_in_structure: false });
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const alphaC = peaksInRange(ctx.h1.peaks, 2.0, 2.8);
    return makeResult(rule, alphaC.length > 0 ? 'PASS' : 'WARN', {
        has_carbonyl: true,
        peaks_in_alpha_carbonyl: alphaC.length,
    });
});
register('H1_SOLVENT_IMPURITY_DETECTION', (rule, ctx) => {
    if (!ctx.h1?.peaks)
        return skipResult(rule, 'no 1H data');
    const SOLVENT_PEAKS = {
        CDCl3: [7.26], 'DMSO-d6': [2.50], CD3OD: [3.31], D2O: [4.79],
        acetone_d6: [2.05], benzene_d6: [7.16], CD2Cl2: [5.32],
    };
    const solvent = ctx.solvent ?? '';
    const expected = SOLVENT_PEAKS[solvent] ?? [];
    const nearSolvent = expected.flatMap(sp => ctx.h1.peaks.filter(p => Math.abs(p.ppm - sp) < 0.05));
    return makeResult(rule, 'INFO', {
        solvent,
        solvent_peaks_expected: expected,
        peaks_near_solvent: nearSolvent.length,
    });
});
// ---------------------------------------------------------------------------
// 13C NMR rules
// ---------------------------------------------------------------------------
register('C13_CLASS_EXPECTED_VS_OBSERVED', (rule, ctx) => {
    if (ctx.c13Signals === undefined && !ctx.c13Peaks)
        return skipResult(rule, 'no 13C data');
    const observed = ctx.c13Signals ?? (ctx.c13Peaks?.length ?? 0);
    const expected = ctx.graphFeatures.expected_unique_carbons_approx;
    const ratio = observed / Math.max(1, expected);
    const status = ratio >= 0.5 && ratio <= 1.2 ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        observed_signals: observed,
        expected_total_carbons: expected,
        ratio,
    });
});
register('C13_AROMATIC_OVERLAP_RELAXATION', (rule, ctx) => {
    if (ctx.graphFeatures.nC_aromatic === 0)
        return makeResult(rule, 'PASS', { aromatic_carbons: 0 });
    return makeResult(rule, 'INFO', {
        aromatic_carbon_count: ctx.graphFeatures.nC_aromatic,
        note: 'Aromatic overlap relaxation applied — fewer unique 13C signals may be normal',
    });
});
register('C13_REQUIRE_SP2_REGION_IF_SP2_C_PRESENT', (rule, ctx) => {
    const sp2Total = ctx.graphFeatures.nC_aromatic + ctx.graphFeatures.nC_sp2_non_aromatic;
    if (sp2Total === 0)
        return makeResult(rule, 'PASS', { sp2_C_total: 0 });
    if (!ctx.c13Peaks)
        return skipResult(rule, 'no 13C peak data');
    const sp2Peaks = peaksInRange(ctx.c13Peaks, 100, 160);
    return makeResult(rule, sp2Peaks.length > 0 ? 'PASS' : 'WARN', {
        sp2_C_total: sp2Total,
        peaks_in_100_160: sp2Peaks.length,
    });
});
register('C13_REQUIRE_CARBONYL_REGION_IF_CARBONYL_PRESENT', (rule, ctx) => {
    if (!ctx.graphFeatures.has_carbonyl)
        return makeResult(rule, 'PASS', { carbonyl_C_count: 0 });
    if (!ctx.c13Peaks)
        return skipResult(rule, 'no 13C peak data');
    const carPeaks = peaksInRange(ctx.c13Peaks, 160, 220);
    return makeResult(rule, carPeaks.length > 0 ? 'PASS' : 'WARN', {
        carbonyl_C_count: ctx.graphFeatures.nC_carbonyl,
        peaks_in_160_220: carPeaks.length,
    });
});
register('C13_SYMMETRY_EXPECTATION_UNIQUE_SIGNAL_COUNT', (rule, ctx) => {
    if (!ctx.c13Peaks && ctx.c13Signals === undefined)
        return skipResult(rule, 'no 13C data');
    const observed = ctx.c13Signals ?? ctx.c13Peaks.length;
    const expected = ctx.graphFeatures.expected_unique_carbons_approx;
    const ratio = observed / Math.max(1, expected);
    const minRatio = rule.thresholds?.min_ratio_unique ?? 0.45;
    const status = ratio >= minRatio ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        unique_carbons_expected: expected,
        observed_signals: observed,
        ratio,
        min_ratio: minRatio,
    });
});
register('C13_NITRILE_RANGE_IF_CYANO_PRESENT', (rule, ctx) => {
    if (!ctx.graphFeatures.has_nitrile)
        return makeResult(rule, 'PASS', { has_nitrile: false });
    if (!ctx.c13Peaks)
        return skipResult(rule, 'no 13C peak data');
    const cnPeaks = peaksInRange(ctx.c13Peaks, 115, 125);
    return makeResult(rule, cnPeaks.length > 0 ? 'PASS' : 'WARN', {
        has_nitrile: true,
        peaks_in_115_125: cnPeaks.length,
    });
});
// ---------------------------------------------------------------------------
// HSQC rules
// ---------------------------------------------------------------------------
register('HSQC_CH_COUNT_MATCH_MIN_RATIO', (rule, ctx) => {
    if (!ctx.hsqcPeaks)
        return skipResult(rule, 'no HSQC data');
    const protonatedC = ctx.graphFeatures.nC_protonated;
    const ratio = ctx.hsqcPeaks.length / Math.max(1, protonatedC);
    const minRatio = rule.thresholds?.min_ratio ?? 0.4;
    const status = ratio >= minRatio ? 'PASS' : 'WARN';
    return makeResult(rule, status, {
        protonated_c_count: protonatedC,
        hsqc_peak_count: ctx.hsqcPeaks.length,
        assignment_ratio: ratio,
        min_ratio: minRatio,
    });
});
register('HSQC_REQUIRE_MATCH_FOR_NONEXCH_PROTONATED_CARBONS', (rule, ctx) => {
    if (!ctx.hsqcPeaks)
        return skipResult(rule, 'no HSQC data');
    const protonatedC = ctx.graphFeatures.nC_protonated;
    const matched = ctx.hsqcPeaks.length;
    const ratio = matched / Math.max(1, protonatedC);
    const threshold = ctx.snrClass === 'lowSNR' ? 0.6 : 0.8;
    return makeResult(rule, ratio >= threshold ? 'PASS' : 'WARN', {
        protonated_carbons_nonexch: protonatedC,
        matched_hsqc_pairs: matched,
        ratio,
        threshold,
    });
});
register('HSQC_SP2_PROTON_MUST_ATTACH_TO_SP2_CARBON', (rule, ctx) => {
    if (!ctx.hsqcPeaks)
        return skipResult(rule, 'no HSQC data');
    const violations = ctx.hsqcPeaks.filter(p => p.f2 >= 4.5 && p.f2 <= 8.8 && (p.f1 < 95 || p.f1 > 165));
    return makeResult(rule, violations.length === 0 ? 'PASS' : 'FAIL', {
        sp2_violations: violations.length,
        violation_details: violations.slice(0, 5).map(v => ({ H_ppm: v.f2, C_ppm: v.f1 })),
    });
});
register('HSQC_CH3_SYNC_REQUIRED', (rule, ctx) => {
    if (!ctx.hsqcPeaks)
        return skipResult(rule, 'no HSQC data');
    const expectedCH3 = ctx.graphFeatures.nCH3;
    return makeResult(rule, 'INFO', {
        expected_CH3: expectedCH3,
        hsqc_peaks_total: ctx.hsqcPeaks.length,
        note: 'CH3 sync check — full assignment matching requires edited HSQC',
    });
});
register('HSQC_OCH3_EXPECTED_IF_METHOXY_PRESENT', (rule, ctx) => {
    if (!ctx.hsqcPeaks)
        return skipResult(rule, 'no HSQC data');
    const methoxyCrosspeaks = peaks2dInRegion(ctx.hsqcPeaks, 50, 60, 3.2, 4.0);
    return makeResult(rule, 'INFO', {
        och3_region_crosspeaks: methoxyCrosspeaks.length,
        note: 'Methoxy HSQC region check',
    });
});
// ---------------------------------------------------------------------------
// COSY rules
// ---------------------------------------------------------------------------
register('COSY_EXPECTED_VICINAL_PAIRS_MIN_RATIO', (rule, ctx) => {
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    if (ctx.cosyPeaks.length === 0)
        return skipResult(rule, 'COSY data empty (0 peaks)');
    const minRatio = rule.thresholds?.cosy_expected_pair_min_ratio ?? 0.5;
    const expectedPairs = Math.max(1, ctx.graphFeatures.nC_protonated - 1);
    const ratio = ctx.cosyPeaks.length / expectedPairs;
    const status = ratio >= minRatio ? 'PASS' : ratio > 0 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        cosy_peaks: ctx.cosyPeaks.length,
        expected_vicinal_pairs: expectedPairs,
        ratio,
        min_ratio: minRatio,
    });
});
register('COSY_AROMATIC_META_OPTIONAL', (rule, ctx) => {
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    return makeResult(rule, 'INFO', {
        note: 'Aromatic meta coupling is optional (1-3 Hz); ortho coupling prioritized',
        cosy_peaks_total: ctx.cosyPeaks.length,
    });
});
register('COSY_REQUIRE_VINYLIC_CHAIN_EDGES_IF_ALKENE_CH', (rule, ctx) => {
    if (ctx.graphFeatures.nC_sp2_non_aromatic === 0)
        return makeResult(rule, 'PASS', { alkene_ch: 0 });
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    const vPeaks = peaks2dInRegion(ctx.cosyPeaks, 4.5, 6.8, 4.5, 6.8);
    return makeResult(rule, vPeaks.length > 0 ? 'PASS' : 'WARN', {
        alkene_ch: ctx.graphFeatures.nC_sp2_non_aromatic,
        vinylic_cosy_edges: vPeaks.length,
    });
});
register('COSY_GRAPH_EDGE_COVERAGE_RATIO', (rule, ctx) => {
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    if (ctx.cosyPeaks.length === 0)
        return skipResult(rule, 'COSY data empty (0 peaks)');
    const minRatio = ctx.snrClass === 'lowSNR'
        ? (rule.thresholds?.min_ratio_lowSNR ?? 0.15)
        : (rule.thresholds?.min_ratio_default ?? 0.3);
    const expectedEdges = Math.max(1, ctx.graphFeatures.nC_protonated);
    const ratio = ctx.cosyPeaks.length / expectedEdges;
    const status = ratio >= minRatio ? 'PASS' : ratio > 0 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        cosy_edges: ctx.cosyPeaks.length,
        expected_edges: expectedEdges,
        ratio,
        min_ratio: minRatio,
    });
});
register('COSY_AROMATIC_ORTHO_EDGE_EXPECTATION', (rule, ctx) => {
    if (ctx.graphFeatures.nC_aromatic === 0)
        return makeResult(rule, 'PASS', { aromatic: false });
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    const arCosy = peaks2dInRegion(ctx.cosyPeaks, 6.3, 8.8, 6.3, 8.8);
    return makeResult(rule, arCosy.length > 0 ? 'PASS' : 'WARN', {
        aromatic_ortho_cosy: arCosy.length,
    });
});
// ---------------------------------------------------------------------------
// HMBC rules
// ---------------------------------------------------------------------------
register('HMBC_CARBONYL_REQUIRED_IF_PATH_EXISTS', (rule, ctx) => {
    if (!ctx.graphFeatures.has_carbonyl)
        return makeResult(rule, 'PASS', { carbonyl_in_structure: false });
    if (!ctx.hmbcPeaks)
        return skipResult(rule, 'no HMBC data');
    const carbHmbc = peaks2dInRegion(ctx.hmbcPeaks, 160, 220, 0, 10);
    return makeResult(rule, carbHmbc.length > 0 ? 'PASS' : 'ERROR', {
        carbonyl_carbons: ctx.graphFeatures.nC_carbonyl,
        hmbc_carbonyl_found: carbHmbc.length,
    });
});
register('HMBC_NITRILE_OPTIONAL', (rule, ctx) => {
    if (!ctx.graphFeatures.has_nitrile)
        return makeResult(rule, 'PASS', { has_nitrile: false });
    return makeResult(rule, 'INFO', {
        has_nitrile: true,
        note: 'Nitrile HMBC is often weak or absent — no penalty',
    });
});
register('HMBC_AROMATIC_SUBSTITUTION_PATTERN_CHECK', (rule, ctx) => {
    if (ctx.graphFeatures.nC_aromatic === 0)
        return makeResult(rule, 'PASS', { aromatic_ring_count: 0 });
    if (!ctx.hmbcPeaks)
        return skipResult(rule, 'no HMBC data');
    const arHmbc = peaks2dInRegion(ctx.hmbcPeaks, 100, 160, 6.0, 9.0);
    return makeResult(rule, arHmbc.length > 0 ? 'PASS' : 'WARN', {
        aromatic_ring: true,
        hmbc_aromatic_crosspeaks: arHmbc.length,
    });
});
register('HMBC_CARBONYL_ALPHA_H_GATING_REQUIRED', (rule, ctx) => {
    if (!ctx.graphFeatures.has_carbonyl)
        return makeResult(rule, 'PASS', { carbonyl: false });
    if (!ctx.hmbcPeaks)
        return skipResult(rule, 'no HMBC data');
    const carbHmbc = peaks2dInRegion(ctx.hmbcPeaks, 160, 220, 1.5, 5.0);
    return makeResult(rule, carbHmbc.length > 0 ? 'PASS' : 'ERROR', {
        carbonyl_total: ctx.graphFeatures.nC_carbonyl,
        hmbc_alpha_h_crosspeaks: carbHmbc.length,
    });
});
register('HMBC_PATH_COVERAGE_MIN_RATIO', (rule, ctx) => {
    if (!ctx.hmbcPeaks)
        return skipResult(rule, 'no HMBC data');
    if (ctx.hmbcPeaks.length === 0)
        return skipResult(rule, 'HMBC data empty (0 peaks)');
    const minRatio = ctx.snrClass === 'lowSNR'
        ? (rule.thresholds?.min_ratio_lowSNR ?? 0.15)
        : (rule.thresholds?.min_ratio_default ?? 0.3);
    const expectedPaths = Math.max(1, ctx.graphFeatures.nC_total * 2);
    const ratio = ctx.hmbcPeaks.length / expectedPaths;
    const status = ratio >= minRatio ? 'PASS' : ratio > 0 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        hmbc_peaks: ctx.hmbcPeaks.length,
        expected_paths: expectedPaths,
        ratio,
        min_ratio: minRatio,
    });
});
register('HMBC_SP2_TO_SP2_LONG_RANGE_SANITY', (rule, ctx) => {
    if (!ctx.hmbcPeaks)
        return skipResult(rule, 'no HMBC data');
    const sp2Hmbc = peaks2dInRegion(ctx.hmbcPeaks, 95, 165, 4.5, 9.0);
    return makeResult(rule, 'INFO', {
        sp2_hmbc_crosspeaks: sp2Hmbc.length,
        note: 'sp2-to-sp2 HMBC sanity check',
    });
});
// ---------------------------------------------------------------------------
// NOESY rules
// ---------------------------------------------------------------------------
register('NOESY_EMPTY_IS_NA_IF_NOT_PROVIDED', (rule, ctx) => {
    if (!ctx.noesyPeaks)
        return makeResult(rule, 'SKIP', { reason: 'NOESY not provided — N/A' });
    if (ctx.noesyPeaks.length === 0)
        return makeResult(rule, 'WARN', { note: 'NOESY supplied but 0 crosspeaks' });
    return makeResult(rule, 'PASS', { noesy_crosspeaks: ctx.noesyPeaks.length });
});
register('NOESY_DISTANCE_PRIOR_CHECK', (rule, ctx) => {
    if (!ctx.noesyPeaks || ctx.noesyPeaks.length === 0)
        return skipResult(rule, 'no NOESY data');
    return makeResult(rule, 'INFO', {
        noesy_crosspeaks: ctx.noesyPeaks.length,
        note: 'Distance check requires 3D conformer — INFO only without coordinates',
    });
});
// ---------------------------------------------------------------------------
// FT-IR rules
// ---------------------------------------------------------------------------
register('IR_FUNCTIONAL_GROUP_BAND_REQUIRED', (rule, ctx) => {
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const checks = [];
    if (ctx.graphFeatures.has_carbonyl) {
        const bands = bandsInRange(ctx.ftirPeaks, 1630, 1800);
        checks.push({ group: 'C=O', expected: true, found: bands.length > 0, region: '1630-1800' });
    }
    if (ctx.graphFeatures.has_nitrile) {
        const bands = bandsInRange(ctx.ftirPeaks, 2210, 2260);
        checks.push({ group: 'C≡N', expected: true, found: bands.length > 0, region: '2210-2260' });
    }
    if (ctx.graphFeatures.nH_exchangeable > 0) {
        const bands = bandsInRange(ctx.ftirPeaks, 3200, 3600);
        checks.push({ group: 'OH/NH', expected: true, found: bands.length > 0, region: '3200-3600' });
    }
    const missingHard = checks.filter(c => c.expected && !c.found);
    const status = missingHard.length === 0 ? 'PASS' : 'WARN';
    return makeResult(rule, status, { checks, missing_count: missingHard.length });
});
register('IR_ALIPHATIC_CH_ONLY_IF_SP3_CH_PRESENT', (rule, ctx) => {
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const sp3CH = ctx.graphFeatures.nCH3 + ctx.graphFeatures.nCH2 + ctx.graphFeatures.nCH;
    const bands = bandsInRange(ctx.ftirPeaks, 2850, 2960);
    if (sp3CH === 0 && bands.length > 0) {
        return makeResult(rule, 'WARN', {
            sp3_CH_count: sp3CH,
            band_2850_2960_present: bands.length,
            note: 'Aliphatic CH band present but no sp3 CH in structure',
        });
    }
    return makeResult(rule, 'PASS', { sp3_CH_count: sp3CH, band_2850_2960_present: bands.length });
});
register('IR_AROMATIC_CH_STRETCH_REQUIRED_IF_AROMATIC', (rule, ctx) => {
    if (ctx.graphFeatures.nC_aromatic === 0)
        return makeResult(rule, 'PASS', { aromatic: false });
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const bands = bandsInRange(ctx.ftirPeaks, 3000, 3100);
    return makeResult(rule, bands.length > 0 ? 'PASS' : 'WARN', {
        aromatic: true,
        band_3000_3100: bands.length,
    });
});
register('IR_AROMATIC_RING_CC_REQUIRED_IF_AROMATIC', (rule, ctx) => {
    if (ctx.graphFeatures.nC_aromatic === 0)
        return makeResult(rule, 'PASS', { aromatic: false });
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const bands = bandsInRange(ctx.ftirPeaks, 1450, 1600);
    return makeResult(rule, bands.length > 0 ? 'PASS' : 'WARN', {
        aromatic: true,
        ring_cc_bands: bands.length,
    });
});
register('IR_CARBONYL_TYPE_DISCRIMINATION', (rule, ctx) => {
    if (!ctx.graphFeatures.has_carbonyl)
        return makeResult(rule, 'PASS', { has_carbonyl: false });
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const ester = bandsInRange(ctx.ftirPeaks, 1735, 1750);
    const amide = bandsInRange(ctx.ftirPeaks, 1630, 1690);
    const acid = bandsInRange(ctx.ftirPeaks, 1700, 1725);
    return makeResult(rule, 'INFO', {
        carbonyl_count: ctx.graphFeatures.nC_carbonyl,
        ester_bands: ester.length,
        amide_bands: amide.length,
        acid_bands: acid.length,
    });
});
register('IR_OH_BROAD_REQUIRED_IF_OH_PRESENT', (rule, ctx) => {
    if (ctx.graphFeatures.nH_exchangeable === 0)
        return makeResult(rule, 'PASS', { exchangeable_OH: 0 });
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const bands = bandsInRange(ctx.ftirPeaks, 3200, 3550);
    return makeResult(rule, bands.length > 0 ? 'PASS' : 'WARN', {
        exchangeable_OH: ctx.graphFeatures.nH_exchangeable,
        oh_broad_bands: bands.length,
    });
});
register('IR_NITRILE_REQUIRED_IF_CYANO_PRESENT', (rule, ctx) => {
    if (!ctx.graphFeatures.has_nitrile)
        return makeResult(rule, 'PASS', { has_nitrile: false });
    if (!ctx.ftirPeaks)
        return skipResult(rule, 'no IR data');
    const bands = bandsInRange(ctx.ftirPeaks, 2210, 2260);
    return makeResult(rule, bands.length > 0 ? 'PASS' : 'WARN', {
        has_nitrile: true,
        nitrile_bands: bands.length,
    });
});
// ---------------------------------------------------------------------------
// MS rules
// ---------------------------------------------------------------------------
register('MS_ISOTOPE_HALOGEN_SIGNATURE_REQUIRED', (rule, ctx) => {
    if (!ctx.graphFeatures.has_halogen)
        return makeResult(rule, 'PASS', { has_halogen: false });
    if (!ctx.msPeaks || ctx.msPeaks.length < 2)
        return skipResult(rule, 'insufficient MS data for isotope analysis');
    const sorted = [...ctx.msPeaks].sort((a, b) => b.intensity - a.intensity);
    const basePeak = sorted[0];
    const nCl = (ctx.atomCounts?.['Cl'] ?? 0);
    const nBr = (ctx.atomCounts?.['Br'] ?? 0);
    const m2Peaks = ctx.msPeaks.filter(p => Math.abs(p.mz - basePeak.mz - 2) < 0.5);
    const m2Intensity = m2Peaks.length > 0 ? m2Peaks[0].intensity / basePeak.intensity : 0;
    let expectedM2Ratio = 0;
    if (nCl === 1)
        expectedM2Ratio = 0.33;
    else if (nCl === 2)
        expectedM2Ratio = 0.65;
    else if (nBr === 1)
        expectedM2Ratio = 0.97;
    else if (nBr === 2)
        expectedM2Ratio = 1.0;
    else if (nCl === 1 && nBr === 1)
        expectedM2Ratio = 1.3;
    const ratioFit = expectedM2Ratio > 0
        ? Math.abs(m2Intensity - expectedM2Ratio) / expectedM2Ratio
        : 1.0;
    const status = ratioFit < 0.5 ? 'PASS' : ratioFit < 1.0 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        has_halogen: true,
        nCl, nBr,
        observed_m2_ratio: Math.round(m2Intensity * 100) / 100,
        expected_m2_ratio: Math.round(expectedM2Ratio * 100) / 100,
        ratio_fit_error: Math.round(ratioFit * 100) / 100,
    });
});
register('MS_ISOTOPE_CLUSTER_MATCH_REQUIRED', (rule, ctx) => {
    if (!ctx.msPeaks || ctx.msPeaks.length < 2)
        return skipResult(rule, 'insufficient MS data');
    const sorted = [...ctx.msPeaks].sort((a, b) => b.intensity - a.intensity);
    const basePeak = sorted[0];
    const m1Peaks = ctx.msPeaks.filter(p => Math.abs(p.mz - basePeak.mz - 1) < 0.5);
    const m1Ratio = m1Peaks.length > 0 ? m1Peaks[0].intensity / basePeak.intensity : 0;
    const nC = ctx.atomCounts?.['C'] ?? 0;
    const expectedM1 = nC * 0.011;
    const m1Error = expectedM1 > 0 ? Math.abs(m1Ratio - expectedM1) / expectedM1 : 1.0;
    const status = m1Error < 0.5 ? 'PASS' : m1Error < 1.5 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        base_peak_mz: basePeak.mz,
        observed_m1_ratio: Math.round(m1Ratio * 1000) / 1000,
        expected_m1_ratio_approx: Math.round(expectedM1 * 1000) / 1000,
        carbon_count: nC,
        fit_error: Math.round(m1Error * 100) / 100,
    });
});
register('MS_ISOTOPE_ENVELOPE_M_PLUS1_M_PLUS2_FIT', (rule, ctx) => {
    if (!ctx.msPeaks || ctx.msPeaks.length < 2)
        return skipResult(rule, 'insufficient MS data');
    const sorted = [...ctx.msPeaks].sort((a, b) => b.intensity - a.intensity);
    const basePeak = sorted[0];
    const m1Peaks = ctx.msPeaks.filter(p => Math.abs(p.mz - basePeak.mz - 1) < 0.5);
    const m2Peaks = ctx.msPeaks.filter(p => Math.abs(p.mz - basePeak.mz - 2) < 0.5);
    const m1Ratio = m1Peaks.length > 0 ? m1Peaks[0].intensity / basePeak.intensity : 0;
    const m2Ratio = m2Peaks.length > 0 ? m2Peaks[0].intensity / basePeak.intensity : 0;
    const nC = ctx.atomCounts?.['C'] ?? 0;
    const nS = ctx.atomCounts?.['S'] ?? 0;
    const nCl = ctx.atomCounts?.['Cl'] ?? 0;
    const nBr = ctx.atomCounts?.['Br'] ?? 0;
    const expectedM1 = nC * 0.011 + nS * 0.008;
    const expectedM2_C = (nC * (nC - 1) / 2) * 0.011 * 0.011;
    const expectedM2_S = nS * 0.044;
    const expectedM2_Cl = nCl * 0.324;
    const expectedM2_Br = nBr * 0.973;
    const expectedM2 = expectedM2_C + expectedM2_S + expectedM2_Cl + expectedM2_Br;
    const m1Err = expectedM1 > 0.001 ? Math.abs(m1Ratio - expectedM1) / expectedM1 : (m1Ratio > 0.05 ? 2.0 : 0.0);
    const m2Err = expectedM2 > 0.001 ? Math.abs(m2Ratio - expectedM2) / expectedM2 : (m2Ratio > 0.05 ? 2.0 : 0.0);
    const avgErr = (m1Err + m2Err) / 2;
    const status = avgErr < 0.5 ? 'PASS' : avgErr < 1.5 ? 'WARN' : 'FAIL';
    return makeResult(rule, status, {
        base_peak_mz: basePeak.mz,
        m1: { observed: Math.round(m1Ratio * 1000) / 1000, expected: Math.round(expectedM1 * 1000) / 1000, error: Math.round(m1Err * 100) / 100 },
        m2: { observed: Math.round(m2Ratio * 1000) / 1000, expected: Math.round(expectedM2 * 1000) / 1000, error: Math.round(m2Err * 100) / 100 },
        composition: { C: nC, S: nS, Cl: nCl, Br: nBr },
    });
});
register('MS_NEUTRAL_LOSS_H2O_REQUIRES_OH_OR_COOH', (rule, ctx) => {
    if (!ctx.msPeaks || ctx.msPeaks.length < 2)
        return skipResult(rule, 'insufficient MS data');
    const basePeak = ctx.msPeaks.reduce((max, p) => p.intensity > max.intensity ? p : max, ctx.msPeaks[0]);
    const h2oLoss = ctx.msPeaks.some(p => Math.abs(basePeak.mz - p.mz - 18.0106) < 0.5);
    if (!h2oLoss)
        return makeResult(rule, 'PASS', { h2o_loss_detected: false });
    const hasOH = ctx.graphFeatures.nH_exchangeable > 0;
    return makeResult(rule, hasOH ? 'PASS' : 'WARN', {
        h2o_loss_detected: true,
        has_oh_or_cooh: hasOH,
    });
});
register('MS_NEUTRAL_LOSS_MEOH_REQUIRES_METHOXY', (rule, ctx) => {
    if (!ctx.msPeaks || ctx.msPeaks.length < 2)
        return skipResult(rule, 'insufficient MS data');
    const basePeak = ctx.msPeaks.reduce((max, p) => p.intensity > max.intensity ? p : max, ctx.msPeaks[0]);
    const meohLoss = ctx.msPeaks.some(p => Math.abs(basePeak.mz - p.mz - 32.026) < 0.5);
    if (!meohLoss)
        return makeResult(rule, 'PASS', { meoh_loss_detected: false });
    return makeResult(rule, 'INFO', {
        meoh_loss_detected: true,
        note: 'MeOH loss detected — methoxy group check',
    });
});
register('MS_NEUTRAL_LOSS_RULES', (rule, ctx) => {
    if (!ctx.msPeaks || ctx.msPeaks.length < 2)
        return skipResult(rule, 'insufficient MS data');
    return makeResult(rule, 'INFO', {
        ms_peaks: ctx.msPeaks.length,
        note: 'Neutral loss pattern analysis — requires fragmentation tree',
    });
});
register('MS_ADDUCT_SET_COVERAGE', (rule, ctx) => {
    if (!ctx.msPeaks)
        return skipResult(rule, 'no MS data');
    return makeResult(rule, 'INFO', {
        ion_mode: ctx.ionMode ?? 'unknown',
        ms_peaks: ctx.msPeaks.length,
        note: 'Adduct set coverage check',
    });
});
// ---------------------------------------------------------------------------
// vNext OBSERVED_QC + extended family rules
// ---------------------------------------------------------------------------
register('OBS_FID_COMPLEX_DATA_PRESENT', (rule, ctx) => {
    const supplied = pickMeta(ctx, 'raw_complex_fid_present');
    if (supplied === undefined)
        return skipResult(rule, 'observed raw FID metadata missing');
    return makeResult(rule, supplied ? 'PASS' : 'INCONCLUSIVE', { raw_complex_fid_present: supplied });
});
register('OBS_ZERO_FILL_FACTOR_MIN', (rule, ctx) => {
    const zf = pickMeta(ctx, 'zero_fill_factor');
    if (zf === undefined)
        return skipResult(rule, 'zero_fill_factor missing');
    return makeResult(rule, zf >= 1 ? 'PASS' : 'WARN', { zero_fill_factor: zf, min_expected: 1 });
});
register('OBS_APODIZATION_DECLARED', (rule, ctx) => {
    const apo = pickMeta(ctx, 'apodization_type');
    return makeResult(rule, apo ? 'PASS' : 'INCONCLUSIVE', { apodization_type: apo ?? null });
});
register('OBS_FOURIER_TRANSFORM_APPLIED', (rule, ctx) => {
    const fft = ctx.meta?.fft_applied;
    if (fft === undefined)
        return skipResult(rule, 'fft_applied missing');
    return makeResult(rule, fft ? 'PASS' : 'FAIL', { fft_applied: fft });
});
register('OBS_PHASE_CORRECTION_RESIDUAL_MIN', (rule, ctx) => {
    const residual = ctx.meta?.residual_phase_error_metric;
    if (residual === undefined)
        return skipResult(rule, 'residual phase metric missing');
    return makeResult(rule, residual <= 0.15 ? 'PASS' : 'WARN', { residual_phase_error_metric: residual, max: 0.15 });
});
register('OBS_BASELINE_FLATNESS_MAX', (rule, ctx) => {
    const rms = pickMeta(ctx, 'baseline_rms');
    if (rms === undefined)
        return skipResult(rule, 'baseline_rms missing');
    return makeResult(rule, rms <= 0.05 ? 'PASS' : 'WARN', { baseline_rms: rms, max: 0.05 });
});
register('OBS_REFERENCE_ALIGNMENT_WITH_STANDARD', (rule, ctx) => {
    const target = pickMeta(ctx, 'reference_target_ppm');
    const observed = pickMeta(ctx, 'observed_reference_ppm');
    if (target === undefined || observed === undefined)
        return skipResult(rule, 'reference ppm metadata missing');
    const delta = Math.abs(target - observed);
    return makeResult(rule, delta <= 0.03 ? 'PASS' : 'WARN', { reference_target_ppm: target, observed_reference_ppm: observed, delta_ppm: delta });
});
register('OBS_LINEWIDTH_QC_WITHIN_EXPECTED', (rule, ctx) => {
    const lw = ctx.meta?.linewidth_hz;
    if (lw === undefined)
        return skipResult(rule, 'linewidth_hz missing');
    return makeResult(rule, lw <= 3.5 ? 'PASS' : 'WARN', { linewidth_hz: lw, max_expected_hz: 3.5 });
});
register('OBS_SNR_MIN_FOR_ASSIGNMENT', (rule, ctx) => {
    const cls = pickMeta(ctx, 'snr_class', ctx.snrClass);
    if (!cls)
        return skipResult(rule, 'snr_class missing');
    return makeResult(rule, cls === 'lowSNR' ? 'WARN' : 'PASS', { snr_class: cls });
});
register('OBS_DYNAMIC_RANGE_NOT_CLIPPED', (rule, ctx) => {
    const clipped = ctx.meta?.clipping_flag;
    if (clipped === undefined)
        return skipResult(rule, 'clipping_flag missing');
    return makeResult(rule, clipped ? 'FAIL' : 'PASS', { clipping_flag: clipped });
});
register('OBS_SOLVENT_SUPPRESSION_ARTIFACT_FLAG', (rule, ctx) => {
    const flag = ctx.meta?.solvent_suppression_flag;
    if (flag === undefined)
        return skipResult(rule, 'solvent_suppression_flag missing');
    return makeResult(rule, flag ? 'WARN' : 'PASS', { solvent_suppression_flag: flag });
});
register('OBS_PEAK_PICKING_REPRODUCIBILITY', (rule, ctx) => {
    const reproducible = ctx.meta?.peak_picking_reproducible;
    if (reproducible === undefined)
        return skipResult(rule, 'peak picking reproducibility missing');
    return makeResult(rule, reproducible ? 'PASS' : 'WARN', { peak_picking_reproducible: reproducible });
});
register('OBS_QC_TRACE_COMPLETE', (rule, ctx) => {
    const required = ['raw_complex_fid_present', 'zero_fill_factor', 'baseline_rms', 'observed_reference_ppm', 'reference_target_ppm'];
    const present = required.filter((k) => ctx.meta && k in ctx.meta);
    const ratio = present.length / required.length;
    return makeResult(rule, ratio >= 0.8 ? 'PASS' : 'INCONCLUSIVE', { required_fields: required, present_fields: present, completeness_ratio: ratio });
});
register('OBS_PROCESSED_FROM_RAW_OR_DECLARED_IMPORT', (rule, ctx) => {
    const fromRaw = ctx.meta?.processed_from_raw;
    const importDeclared = ctx.meta?.declared_import_pipeline;
    if (fromRaw === undefined && importDeclared === undefined)
        return skipResult(rule, 'provenance process metadata missing');
    return makeResult(rule, fromRaw || importDeclared ? 'PASS' : 'INCONCLUSIVE', {
        processed_from_raw: fromRaw ?? null,
        declared_import_pipeline: importDeclared ?? null,
    });
});
function registerMetadataPresenceRule(ruleId, key, failStatus = 'INCONCLUSIVE') {
    register(ruleId, (rule, ctx) => {
        const value = pickMeta(ctx, key);
        return makeResult(rule, value === undefined || value === null || value === '' ? failStatus : 'PASS', { [key]: value ?? null });
    });
}
registerMetadataPresenceRule('GLOBAL_REFERENCE_STANDARD_REQUIRED', 'reference_standard');
registerMetadataPresenceRule('GLOBAL_SOLVENT_DECLARATION_REQUIRED', 'solvent_name');
registerMetadataPresenceRule('GLOBAL_FIELD_STRENGTH_DECLARATION_REQUIRED', 'field_mhz');
registerMetadataPresenceRule('GLOBAL_TOLERANCE_PROFILE_DECLARED', 'tolerance_profile_id');
registerMetadataPresenceRule('GLOBAL_EXCHANGEABLE_POLICY_DECLARED', 'exchangeable_policy');
registerMetadataPresenceRule('GLOBAL_LOW_SNR_POLICY_DECLARED', 'snr_class');
register('GLOBAL_OBSERVED_SIMULATED_PROVENANCE_SEPARATION', (rule, ctx) => {
    const prov = pickMeta(ctx, 'provenance_type');
    if (!prov)
        return makeResult(rule, 'INCONCLUSIVE', { provenance_type: null });
    const ok = ['observed', 'simulated', 'library', 'hybrid'].includes(prov);
    return makeResult(rule, ok ? 'PASS' : 'WARN', { provenance_type: prov });
});
register('GLOBAL_MODALITY_UNIT_NORMALIZATION', (rule, ctx) => {
    const unitsOk = !!ctx.meta?.units_normalized;
    return makeResult(rule, unitsOk ? 'PASS' : 'WARN', { units_normalized: unitsOk });
});
function registerInfoRule(ruleId, extractor) {
    register(ruleId, (rule, ctx) => makeResult(rule, 'INFO', extractor ? extractor(ctx) : { note: 'Scenario-aware rule logged for traceability' }));
}
function registerWarnRule(ruleId, extractor) {
    register(ruleId, (rule, ctx) => makeResult(rule, 'WARN', extractor ? extractor(ctx) : { note: 'Rule requires manual review' }));
}
const formulaExtendedRules = [
    'FORMULA_EXACT_MASS_MATCH_WITH_ADDUCT',
    'FORMULA_VALENCE_SANITY',
    'FORMULA_NITROGEN_RULE',
    'FORMULA_HETEROATOM_PARITY',
    'FORMULA_CHARGE_ADDUCT_COMPATIBILITY',
    'FORMULA_ISOTOPE_LABEL_DECLARATION_REQUIRED',
];
for (const id of formulaExtendedRules)
    registerInfoRule(id, (ctx) => ({ formula_ref: ctx.formulaRef ?? null, ion_mode: ctx.ionMode ?? null }));
register('FORMULA_MOLECULAR_WEIGHT_PLAUSIBILITY', (rule, ctx) => {
    const mw = ctx.meta?.mw_calculated ?? ctx.meta?.exact_mass_neutral;
    if (mw === undefined)
        return skipResult(rule, 'mw metadata missing');
    if (mw < 10 || mw > 5000)
        return makeResult(rule, 'ERROR', { mw_calculated: mw, range: '10-5000' });
    return makeResult(rule, mw >= 50 && mw <= 1500 ? 'PASS' : 'WARN', { mw_calculated: mw, preferred_range: '50-1500' });
});
register('FORMULA_ATOM_COUNT_UPPER_LIMIT', (rule, ctx) => {
    const heavy = ctx.graphFeatures.nC_total + (ctx.atomCounts?.N ?? 0) + (ctx.atomCounts?.O ?? 0) + (ctx.atomCounts?.S ?? 0) + (ctx.atomCounts?.P ?? 0);
    if (heavy >= 100)
        return makeResult(rule, 'ERROR', { heavy_atom_count: heavy, max: 100 });
    return makeResult(rule, heavy >= 60 ? 'WARN' : 'PASS', { heavy_atom_count: heavy, warn_threshold: 60 });
});
register('FORMULA_HETEROATOM_RATIO_CHECK', (rule, ctx) => {
    const c = ctx.atomCounts?.C ?? ctx.graphFeatures.nC_total;
    const hetero = (ctx.atomCounts?.N ?? 0) + (ctx.atomCounts?.O ?? 0) + (ctx.atomCounts?.S ?? 0) + (ctx.atomCounts?.P ?? 0) + (ctx.atomCounts?.F ?? 0) + (ctx.atomCounts?.Cl ?? 0) + (ctx.atomCounts?.Br ?? 0) + (ctx.atomCounts?.I ?? 0);
    if (c <= 0)
        return makeResult(rule, 'INCONCLUSIVE', { C_count: c, heteroatom_count: hetero });
    const ratio = hetero / c;
    return makeResult(rule, ratio > 3 ? 'WARN' : 'PASS', { C_count: c, heteroatom_count: hetero, ratio });
});
register('FORMULA_NITROGEN_PARITY_RULE', (rule, ctx) => {
    const n = ctx.atomCounts?.N ?? 0;
    const nominal = ctx.meta?.mw_nominal;
    if (nominal === undefined)
        return skipResult(rule, 'mw_nominal missing');
    const oddN = n % 2 === 1;
    const oddMass = Math.round(nominal) % 2 === 1;
    return makeResult(rule, oddN === oddMass ? 'PASS' : 'WARN', { N_count: n, mw_nominal: nominal, odd_nitrogen: oddN, odd_mass: oddMass });
});
register('FORMULA_RING_STRAIN_FEASIBILITY', (rule, ctx) => {
    const c = ctx.graphFeatures.nC_total;
    const ratio = c > 0 ? ctx.graphFeatures.dbe / c : 0;
    return makeResult(rule, ratio > 1.2 ? 'INFO' : 'PASS', { C_count: c, dbe: ctx.graphFeatures.dbe, dbe_to_c_ratio: ratio });
});
register('FORMULA_ISOTOPE_LABEL_FLAG', (rule, ctx) => {
    const label = !!ctx.meta?.isotope_label;
    const isoAtoms = Object.keys(ctx.atomCounts ?? {}).filter((k) => ['D', '13C', '15N', '18O', '2H'].includes(k));
    if (isoAtoms.length && !label)
        return makeResult(rule, 'WARN', { isotope_atoms: isoAtoms, isotope_label: label });
    return makeResult(rule, isoAtoms.length ? 'INFO' : 'PASS', { isotope_atoms: isoAtoms, isotope_label: label });
});
const oneHRules = [
    'H1_ALDEHYDIC_PROTON_REGION_IF_ALDEHYDE',
    'H1_CARBOXYLIC_ACID_BROAD_SIGNAL_OPTIONAL_BUT_NONPENALIZING',
    'H1_AMIDE_NH_EXCHANGE_POLICY',
    'H1_METHOXY_REGION_IF_METHOXY_PRESENT',
    'H1_ANOMERIC_O_CH_REGION_IF_ACETAL_PRESENT',
    'H1_TERMINAL_ALKYNE_PROTON_IF_PRESENT',
    'H1_ALLYLIC_REGION_IF_ALKENE_ADJACENT_CH',
    'H1_OH_NH_LINEWIDTH_BROADNESS_IF_EXCHANGEABLE',
    'H1_DIASTEREOTOPIC_CH2_NONEQUIVALENCE_IF_STEREOCENTER_ADJACENT',
    'H1_J_VALUE_MULTIPLICITY_CONSISTENCY',
    'H1_AROMATIC_SUBSTITUTION_PATTERN_SANITY',
    'H1_FIRST_ORDER_LIMIT_FLAG_IF_DELTA_NU_OVER_J_LOW',
];
for (const id of oneHRules)
    registerInfoRule(id, (ctx) => ({ h1_peak_count: ctx.h1?.peaks?.length ?? 0, solvent: ctx.solvent ?? null }));
for (const id of [
    'H1_ALDEHYDE_CHO_REGION_REQUIRED', 'H1_NH_REGION_REQUIRED_IF_NH_PRESENT', 'H1_HETEROAROMATIC_SHIFT_RANGE_CHECK',
    'H1_DIASTEREOTOPIC_CH2_EXPECTED_SPLIT', 'H1_GEMINAL_COUPLING_J_RANGE_CHECK', 'H1_LONG_RANGE_W_COUPLING_CHECK',
    'H1_EXCHANGEABLE_H_D2O_CONSISTENCY', 'H1_COUPLING_CONSTANT_TRANS_CIS_ALKENE',
    'H1_AROMATIC_SUBSTITUTION_PATTERN_FROM_MULTIPLICITY', 'H1_OCH3_SINGLET_EXPECTED_IF_METHOXY', 'H1_CHEMICAL_SHIFT_OUTLIER_DETECTION'
])
    registerInfoRule(id, (ctx) => ({ h1_peak_count: ctx.h1?.peaks?.length ?? 0, d2o_shake: ctx.meta?.d2o_shake ?? null }));
const c13Rules = [
    'C13_O_ALKYL_REGION_IF_O_SP3_C_PRESENT',
    'C13_ALKYNE_SP_REGION_IF_CSP_PRESENT',
    'C13_ALDEHYDE_CARBONYL_WINDOW_IF_ALDEHYDE',
    'C13_KETONE_CARBONYL_WINDOW_IF_KETONE',
    'C13_ESTER_CARBONYL_WINDOW_IF_ESTER',
    'C13_AMIDE_CARBONYL_WINDOW_IF_AMIDE',
    'C13_CARBOXYLIC_ACID_CARBONYL_WINDOW_IF_ACID',
    'C13_QUATERNARY_UNDERCOUNT_ALLOWED_ONLY_WITH_SENSITIVITY_FLAG',
    'C13_DEPT_APT_CLASS_CONSISTENCY',
    'C13_SOLVENT_PEAK_FILTER_REQUIRED',
    'C13_REFERENCE_OFFSET_WITHIN_LIMIT',
    'C13_HETEROAROMATIC_IPSO_DESHIELDING_SANITY',
];
for (const id of c13Rules)
    registerInfoRule(id, (ctx) => ({ c13_peak_count: ctx.c13Peaks?.length ?? ctx.c13Signals ?? 0 }));
for (const id of [
    'C13_DEPT135_PHASE_CONSISTENCY', 'C13_QUATERNARY_C_ABSENCE_IN_DEPT', 'C13_CHEMICAL_SHIFT_OUTLIER_BY_TYPE',
    'C13_ALKYNE_REGION_IF_TRIPLE_BOND', 'C13_SOLVENT_PEAK_EXCLUSION', 'C13_RELAXATION_TIME_D1_WARNING',
    'C13_CF_CD_COUPLING_ARTIFACT_FLAG', 'C13_SIGNAL_COUNT_VS_MOLECULAR_FORMULA_RATIO'
])
    registerInfoRule(id, (ctx) => ({ c13_peak_count: ctx.c13Peaks?.length ?? ctx.c13Signals ?? 0, d1_sec: ctx.meta?.d1_sec ?? null }));
const hsqcRules = [
    'HSQC_QUATERNARY_CARBON_MUST_NOT_APPEAR',
    'HSQC_METHYLENE_EDITED_PHASE_SIGN_CONSISTENCY',
    'HSQC_EXCHANGEABLE_H_SUPPRESSION_NONPENALTY',
    'HSQC_ANOMERIC_OCH_CROSSPEAK_EXPECTATION',
    'HSQC_BENZYLIC_CH2_REGION_EXPECTATION',
    'HSQC_ALIPHATIC_H_TO_C_SP3_SANITY',
    'HSQC_TOLERANCE_WINDOW_DECLARED',
    'HSQC_NITRILE_CARBON_SHOULD_NOT_CROSSPEAK',
];
for (const id of hsqcRules)
    registerInfoRule(id, (ctx) => ({ hsqc_peak_count: ctx.hsqcPeaks?.length ?? 0, edited_hsqc_flag: pickMeta(ctx, 'edited_hsqc_flag') ?? null }));
for (const id of [
    'HSQC_DIASTEREOTOPIC_CH2_TWO_CROSSPEAKS', 'HSQC_NH_CROSSPEAK_EXPECTED_IF_NH_PRESENT',
    'HSQC_PHASE_CONSISTENCY_CH2_VS_CH', 'HSQC_AROMATIC_CH_CROSSPEAKS_IN_SP2_BOX',
    'HSQC_ALIASING_ARTIFACT_CHECK', 'HSQC_SIGNAL_TO_NOISE_CLASS_GATING'
])
    registerInfoRule(id, (ctx) => ({ hsqc_peak_count: ctx.hsqcPeaks?.length ?? 0, snr_class: ctx.snrClass ?? null }));
register('HSQC_TOLERANCE_PPM_WINDOW_CONSISTENCY', (rule, ctx) => {
    const field = pickMeta(ctx, 'field_mhz', ctx.fieldMHz);
    if (!field)
        return makeResult(rule, 'ERROR', { field_mhz: null, note: 'field metadata required' });
    const scale = 600 / field;
    return makeResult(rule, 'PASS', { field_mhz: field, scaling_factor: scale, h_tolerance_ppm: 0.02 * scale, c_tolerance_ppm: 0.3 * scale });
});
const cosyRules = [
    'COSY_TERTBUTYL_SHOULD_NOT_FORM_NETWORK',
    'COSY_METHOXY_SINGLET_SHOULD_NOT_FORM_NETWORK',
    'COSY_GEMINAL_CH2_OPTIONAL_IF_STRONGLY_COUPLED',
    'COSY_ALKYL_CHAIN_CONTINUITY_MIN',
    'COSY_SPIN_SYSTEM_FRAGMENTATION_FLAG',
    'COSY_ALLYLIC_WEAK_EDGE_OPTIONAL',
    'COSY_PARA_AROMATIC_WEAK_OR_ABSENT_ALLOWED',
    'COSY_TOLERANCE_WINDOW_DECLARED',
];
for (const id of cosyRules)
    registerInfoRule(id, (ctx) => ({ cosy_peak_count: ctx.cosyPeaks?.length ?? 0, snr_class: ctx.snrClass ?? null }));
for (const id of [
    'COSY_NH_CH_VICINAL_IF_NH_ADJACENT_CH', 'COSY_LONG_RANGE_4J_ALLYLIC_CHECK', 'COSY_HOMOALLYLIC_5J_FLAG',
    'COSY_FIELD_DEPENDENT_J_RESOLUTION'
])
    registerInfoRule(id, (ctx) => ({ cosy_peak_count: ctx.cosyPeaks?.length ?? 0, field_mhz: ctx.fieldMHz ?? null }));
register('COSY_DIAGONAL_ARTIFACT_EXCLUSION', (rule, ctx) => {
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    const diag = ctx.cosyPeaks.filter((p) => Math.abs(p.f1 - p.f2) <= 0.05).length;
    return makeResult(rule, diag > 0 ? 'ERROR' : 'PASS', { diagonal_like_peaks: diag, tolerance_ppm: 0.05 });
});
register('COSY_SYMMETRY_CROSS_PEAK_REQUIRED', (rule, ctx) => {
    if (!ctx.cosyPeaks)
        return skipResult(rule, 'no COSY data');
    const tol = 0.05;
    let asym = 0;
    for (const p of ctx.cosyPeaks) {
        const match = ctx.cosyPeaks.some((q) => Math.abs(q.f1 - p.f2) <= tol && Math.abs(q.f2 - p.f1) <= tol);
        if (!match)
            asym++;
    }
    const ratio = ctx.cosyPeaks.length ? asym / ctx.cosyPeaks.length : 0;
    return makeResult(rule, ratio > 0.2 ? 'ERROR' : ratio > 0 ? 'WARN' : 'PASS', { asymmetry_ratio: ratio, asymmetric_peaks: asym });
});
const hmbcRules = [
    'HMBC_METHOXY_TO_IPSO_AROMATIC_EXPECTATION',
    'HMBC_ESTER_ALKOXY_TO_CARBONYL_EXPECTATION',
    'HMBC_ALDEHYDIC_H_LONG_RANGE_EXPECTATION',
    'HMBC_QUATERNARY_CARBON_ACCESS_REQUIRED',
    'HMBC_IMPOSSIBLE_ONE_BOND_CONTAMINATION_FLAG',
    'HMBC_TWO_BOND_VS_THREE_BOND_PRIORITY',
    'HMBC_HETEROAROMATIC_SUBSTITUTION_PATH_SANITY',
    'HMBC_TOLERANCE_WINDOW_DECLARED',
    'HMBC_INTENSITY_CLASS_SOFTENING_FOR_LONG_RANGE',
];
for (const id of hmbcRules)
    registerInfoRule(id, (ctx) => ({ hmbc_peak_count: ctx.hmbcPeaks?.length ?? 0 }));
for (const id of [
    'HMBC_QUATERNARY_C_REQUIRES_HMBC_EVIDENCE', 'HMBC_ONE_BOND_SUPPRESSION_CHECK', 'HMBC_FOUR_BOND_PATH_OPTIONAL',
    'HMBC_ESTER_CARBONYL_TWO_SIDE_CORRELATION', 'HMBC_AMIDE_NH_TO_CO_CORRELATION',
    'HMBC_AROMATIC_IPSO_CARBON_REQUIRED', 'HMBC_HETEROAROMATIC_RING_CLOSURE_CHECK', 'HMBC_SIGNAL_TO_NOISE_CLASS_GATING'
])
    registerInfoRule(id, (ctx) => ({ hmbc_peak_count: ctx.hmbcPeaks?.length ?? 0, snr_class: ctx.snrClass ?? null }));
const noesyRules = [
    'NOESY_EXCHANGE_PEAK_EXCLUSION',
    'NOESY_MIXING_TIME_DECLARED',
    'NOESY_SPIN_DIFFUSION_GUARD',
    'NOESY_CONFORMER_ENSEMBLE_REQUIRED_FOR_DISTANCE_SCORING',
    'NOESY_RIGID_RING_CIS_CONTACT_EXPECTATION',
    'NOESY_DIASTEREOTOPIC_CH2_LOCAL_CONTACT_OPTIONAL',
    'NOESY_AROMATIC_STACKING_CAUTION',
    'NOESY_METHYL_METHYL_PROXIMITY_IF_TERTIARY_CENTER',
];
for (const id of noesyRules)
    registerInfoRule(id, (ctx) => ({ noesy_peak_count: ctx.noesyPeaks?.length ?? 0, mixing_time_ms: pickMeta(ctx, 'mixing_time_ms') ?? null }));
for (const id of [
    'NOESY_ROE_VS_NOE_SIGN_CHECK', 'NOESY_SPIN_DIFFUSION_FLAG', 'NOESY_STEREO_ASSIGNMENT_CONSISTENCY',
    'NOESY_CIS_TRANS_ALKENE_VALIDATION', 'NOESY_AXIAL_EQUATORIAL_CYCLOHEXANE', 'NOESY_EXCHANGE_PEAK_DISCRIMINATION'
])
    registerInfoRule(id, (ctx) => ({ noesy_peak_count: ctx.noesyPeaks?.length ?? 0, mixing_time_ms: pickMeta(ctx, 'mixing_time_ms') ?? null }));
const irRules = [
    'IR_ALKENE_CC_REQUIRED_IF_ALKENE',
    'IR_TERMINAL_ALKYNE_CH_REQUIRED_IF_TERMINAL_ALKYNE',
    'IR_ALKYNE_CC_WEAK_ALLOWED_IF_INTERNAL_ALKYNE',
    'IR_ETHER_CO_STRETCH_REQUIRED_IF_ETHER',
    'IR_ESTER_CO_DUAL_BAND_EXPECTATION',
    'IR_AMIDE_II_BAND_EXPECTATION_IF_AMIDE',
    'IR_PRIMARY_AMINE_DOUBLE_NH_EXPECTATION',
    'IR_SECONDARY_AMINE_SINGLE_NH_EXPECTATION',
    'IR_ALDEHYDE_FERMI_DOUBLET_EXPECTATION',
    'IR_ACID_VERY_BROAD_OH_EXPECTATION',
    'IR_NITRO_ASYM_SYM_PAIR_EXPECTATION',
    'IR_SULFOXIDE_SO_EXPECTATION',
    'IR_SULFONE_SO2_PAIR_EXPECTATION',
    'IR_AROMATIC_OOP_SUBSTITUTION_PATTERN',
    'IR_WATER_CO2_CONTAMINATION_EXCLUSION_WINDOWS',
];
for (const id of irRules)
    registerInfoRule(id, (ctx) => ({ ir_peak_count: ctx.ftirPeaks?.length ?? 0, sampling_mode: pickMeta(ctx, 'sampling_mode') ?? null }));
for (const id of [
    'IR_NH_STRETCH_REQUIRED_IF_NH_PRESENT', 'IR_THIOL_SH_BAND_IF_THIOL_PRESENT', 'IR_ALKYNE_TRIPLE_BOND_BAND',
    'IR_ANHYDRIDE_DOUBLE_CARBONYL_BAND', 'IR_PEROXIDE_OO_STRETCH_IF_PEROXIDE', 'IR_CARBAMATE_URETHANE_BAND',
    'IR_SULFONE_SULFONAMIDE_SO2_BANDS', 'IR_PHOSPHATE_PHOSPHONATE_PO_BAND', 'IR_BASELINE_QUALITY_FLAG'
])
    registerInfoRule(id, (ctx) => ({ ir_peak_count: ctx.ftirPeaks?.length ?? 0, transmission_pct: ctx.meta?.ir_transmission_pct ?? null }));
const msRules = [
    'MS_EXACT_MASS_PPM_WITHIN_LIMIT',
    'MS_CHARGE_STATE_ISOTOPE_SPACING',
    'MS_NITROGEN_RULE_CONSISTENCY',
    'MS_SULFUR_M_PLUS2_EXPECTATION',
    'MS_MULTIHALOGEN_PATTERN_SCALING',
    'MS_ADDUCT_MASS_DELTA_EXACTNESS',
    'MS_DIMER_VS_MONOMER_ADDUCT_DISCRIMINATION',
    'MS_BASE_PEAK_STABLE_CATION_SANITY',
    'MS_TROPYLIUM_DIAGNOSTIC_IF_BENZYL_PRESENT',
    'MS_MCLAFFERTY_ALLOWED_ONLY_IF_GAMMA_H_PRESENT',
    'MS_CO2_LOSS_REQUIRES_CARBOXYLATE_OR_ACID',
    'MS_CO_LOSS_PLAUSIBILITY_IF_CARBONYL_PRESENT',
    'MS_HCL_OR_HBR_LOSS_REQUIRES_HALOGENATED_SUBSTRATE',
    'MS_RADICAL_CATION_VS_PROTONATED_MODE_COMPATIBILITY',
    'MS_ISOTOPE_ENVELOPE_NORMALIZATION_REQUIRED',
    'MS_IN_SOURCE_FRAGMENT_VS_PARENT_ADDUCT_CLASSIFIER',
];
for (const id of msRules)
    registerInfoRule(id, (ctx) => ({ ms_peak_count: ctx.msPeaks?.length ?? 0, ion_mode: ctx.ionMode ?? pickMeta(ctx, 'ion_mode') ?? null }));
for (const id of [
    'MS_MOLECULAR_ION_BASE_PEAK_IDENTIFICATION', 'MS_CHARGE_STATE_CONSISTENCY', 'MS_IN_SOURCE_FRAGMENTATION_FLAG',
    'MS_EI_FRAGMENTATION_COMMON_LOSSES', 'MS_NEUTRAL_LOSS_CO2_REQUIRES_COOH', 'MS_NEUTRAL_LOSS_NH3_REQUIRES_AMINE_OR_AMIDE',
    'MS_MALDI_MATRIX_ADDUCT_EXCLUSION', 'MS_DIMER_ADDUCT_CHECK', 'MS_FRAGMENTATION_COVERAGE_STRUCTURAL_SUPPORT',
    'MS_NEGATIVE_MODE_DEPROTONATION_CHECK'
])
    registerInfoRule(id, (ctx) => ({ ms_peak_count: ctx.msPeaks?.length ?? 0, ion_mode: ctx.ionMode ?? null }));
register('MS_HRMS_EXACT_MASS_PPM_ERROR', (rule, ctx) => {
    const observed = ctx.meta?.exact_mass_observed;
    const theo = ctx.meta?.exact_mass_theoretical;
    const resolution = ctx.meta?.ms_resolution;
    if (observed === undefined || theo === undefined)
        return skipResult(rule, 'exact mass pair missing');
    const ppm = Math.abs((observed - theo) / theo) * 1e6;
    if (resolution && resolution < 10000)
        return makeResult(rule, 'INFO', { ppm_error: ppm, ms_resolution: resolution, note: 'LRMS mode' });
    return makeResult(rule, ppm > 5 ? 'FAIL' : ppm > 2 ? 'WARN' : 'PASS', { ppm_error: ppm, ms_resolution: resolution ?? null, strict_ppm: 2, tolerant_ppm: 5 });
});
registerWarnRule('GLOBAL_MODALITY_COVERAGE_MINIMUM', (ctx) => {
    const modalities = ctx.meta?.supplied_modalities;
    const count = modalities?.length ?? 0;
    const confidence = Number(ctx.meta?.confidence_score ?? 0);
    return { supplied_modalities: modalities ?? [], count, confidence_score: confidence };
});
registerInfoRule('GLOBAL_STEREO_CENTER_ANNOTATION_CHECK', (ctx) => ({ chiral_centers: ctx.meta?.chiral_centers ?? null, stereo_annotations: ctx.meta?.stereo_annotations ?? null }));
registerInfoRule('GLOBAL_IONIZATION_STATE_CONSISTENCY', (ctx) => ({ pH: ctx.meta?.pH ?? null, ion_mode: ctx.ionMode ?? null }));
registerInfoRule('GLOBAL_TAUTOMER_AMBIGUITY_FLAG', (ctx) => ({ tautomer_score: ctx.meta?.tautomer_score ?? null }));
registerInfoRule('CROSS_NITROGEN_CONSENSUS', (ctx) => ({ N_count: ctx.atomCounts?.N ?? 0, nh_region: ctx.meta?.nh_region ?? null }));
registerInfoRule('CROSS_HALOGEN_CONSENSUS', (ctx) => ({ halogen_count: (ctx.atomCounts?.Cl ?? 0) + (ctx.atomCounts?.Br ?? 0) + (ctx.atomCounts?.F ?? 0) + (ctx.atomCounts?.I ?? 0) }));
register('GLOBAL_SOLVENT_FIELD_METADATA_REQUIRED', (rule, ctx) => {
    const solvent = pickMeta(ctx, 'solvent_name', ctx.solvent);
    const field = pickMeta(ctx, 'field_mhz', ctx.fieldMHz);
    if (!solvent)
        return makeResult(rule, 'ERROR', { solvent_name: null, field_mhz: field ?? null });
    if (!field)
        return makeResult(rule, 'WARN', { solvent_name: solvent, field_mhz: null });
    return makeResult(rule, 'PASS', { solvent_name: solvent, field_mhz: field });
});
register('GLOBAL_CONFIDENCE_AGGREGATION_PROTOCOL', (rule, ctx) => makeResult(rule, 'PASS', {
    hard_fail_blocks_score: true,
    fatal_zeroes_confidence: true,
    weighting_model: 'weighted_confidence_model',
}));
// Final repair authority/provenance rules
register('GLOBAL_PROVENANCE_REQUIRED', (rule, ctx) => {
    const p = ctx.meta?.provenance_type;
    const a = ctx.meta?.authority_tier;
    return makeResult(rule, p && a ? 'PASS' : 'ERROR', { provenance_type: p ?? null, authority_tier: a ?? null });
});
register('GLOBAL_FALLBACK_NOT_AUTHORITATIVE', (rule, ctx) => {
    const flag = !!ctx.meta?.fallback_visible_but_non_authoritative;
    return makeResult(rule, flag || !ctx.meta?.has_fallback ? 'PASS' : 'ERROR', { fallback_visible_but_non_authoritative: flag, has_fallback: !!ctx.meta?.has_fallback });
});
register('GLOBAL_SCORE_EXCLUDES_DISPLAY_FALLBACK', (rule, ctx) => {
    const excluded = ctx.meta?.fallback_excluded_from_scoring;
    return makeResult(rule, excluded === false ? 'ERROR' : 'PASS', { fallback_excluded_from_scoring: excluded ?? true });
});
register('GLOBAL_FILE_PROTOCOL_GRAPH_FALLBACK_REQUIRED', (rule, ctx) => {
    const fileProtocol = !!ctx.meta?.is_file_protocol;
    if (!fileProtocol)
        return makeResult(rule, 'PASS', { is_file_protocol: false });
    const graphOk = !!ctx.meta?.graph_build_ok;
    return makeResult(rule, graphOk ? 'PASS' : 'ERROR', { is_file_protocol: true, graph_build_ok: graphOk });
});
for (const id of [
    'H1_NO_SYNTHETIC_PATCH_PEAK', 'H1_UNRESOLVED_REMAINDER_REPORT_ONLY', 'H1_CONTEXT_AWARE_INTEGRAL_TOLERANCE', 'H1_EXCHANGEABLE_POOL_SEPARATION_REQUIRED',
    'HSQC_MISSING_CAUSE_ATOM_BASED_ONLY', 'HSQC_EXCHANGEABLE_REASON_ONLY_FOR_TRUE_XH', 'HSQC_FALLBACK_REUSE_NONPENALTY', 'HSQC_LOW_ASSIGNMENT_ONLY_IF_AUTHORITATIVE',
    'HSQC_TYPE_MISMATCH_ONLY_IF_AUTHORITATIVE', 'HSQC_CARBON_REUSE_CAP_AUTHORITATIVE', 'HSQC_GRAPH_PROTONATED_CARBON_REQUIRED',
    'COSY_FALLBACK_DISPLAY_ONLY', 'COSY_SCORE_OBSERVED_ONLY',
    'HMBC_FALLBACK_DISPLAY_ONLY', 'HMBC_HSQC_ANCHOR_OBSERVED_ONLY', 'HMBC_OME_TO_CARBONYL_ONLY_IF_GRAPH_PATH',
    'NOESY_FALLBACK_DISPLAY_ONLY', 'NOESY_SYMMETRY_ONLY_IF_OBSERVED', 'NOESY_MIXTIME_MISSING_NOTE_ONLY', 'NOESY_CONTEXT_NOTE_NOT_VETO',
    'MS_ISOTOPE_COMPANION_NOT_MASS_ERROR', 'MS_MAIN_PEAK_PPM_EXCLUDES_M_PLUS1', 'MS_HALOGEN_PATTERN_AUTHORITATIVE',
    'IR_BAND_ABSENT_VS_UNRESOLVED_SEPARATED', 'IR_MULTI_CARBONYL_SUBTYPE_ALLOWED',
    'LIBRARY_EXACT_FP_OPTIONAL_BUT_NOT_SILENT', 'LIBRARY_CLASS_FP_DOWNGRADE_NOT_FAIL', 'LIBRARY_COVERAGE_EVIDENCE_WEIGHTED'
]) {
    registerInfoRule(id, (ctx) => ({
        provenance_type: ctx.meta?.provenance_type ?? null,
        authority_tier: ctx.meta?.authority_tier ?? null,
        fallback_excluded_from_scoring: ctx.meta?.fallback_excluded_from_scoring ?? true,
    }));
}
// ---------------------------------------------------------------------------
// Rule dependency graph
// ---------------------------------------------------------------------------
const RULE_PREREQUISITES = {
    FORMULA_DBE_PARITY: ['GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED'],
    FORMULA_DBE_NEGATIVE_FATAL: ['GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED'],
    CROSS_AROMATICITY_CONSENSUS_RULE: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    CROSS_CARBONYL_CONSENSUS: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    CROSS_OH_CONSENSUS: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    CROSS_DBE_IMPLIES_SP2_SIGNALS: ['FORMULA_DBE_NEGATIVE_FATAL'],
    DBE_AROMATIC_MIN_1H_INTEGRAL: ['FORMULA_DBE_NEGATIVE_FATAL'],
    H1_REQUIRE_AROMATIC_REGION_IF_AROMATIC_CH: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    H1_INTEGRAL_TOTAL_MATCH_NONEXCH: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    HSQC_SP2_PROTON_MUST_ATTACH_TO_SP2_CARBON: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    HMBC_CARBONYL_REQUIRED_IF_PATH_EXISTS: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    HMBC_CARBONYL_ALPHA_H_GATING_REQUIRED: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    MS_ISOTOPE_HALOGEN_SIGNATURE_REQUIRED: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
    MS_ISOTOPE_CLUSTER_MATCH_REQUIRED: ['GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED'],
    MS_ISOTOPE_ENVELOPE_M_PLUS1_M_PLUS2_FIT: ['GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED'],
    IR_FUNCTIONAL_GROUP_BAND_REQUIRED: ['GLOBAL_GRAPH_FIRST_REQUIRED'],
};
const RULE_CONFLICTS = [
    ['C13_CLASS_EXPECTED_VS_OBSERVED', 'C13_SYMMETRY_EXPECTATION_UNIQUE_SIGNAL_COUNT', 'If both fail, C13 coverage is insufficient — report the stronger failure'],
];
function checkPrerequisites(ruleId, results) {
    const prereqs = RULE_PREREQUISITES[ruleId];
    if (!prereqs)
        return { ok: true };
    for (const prereq of prereqs) {
        const prereqResult = results.get(prereq);
        if (!prereqResult)
            return { ok: false, reason: `prerequisite ${prereq} not yet evaluated` };
        if (prereqResult.status === 'FATAL' || prereqResult.status === 'ERROR') {
            return { ok: false, reason: `prerequisite ${prereq} is ${prereqResult.status}` };
        }
    }
    return { ok: true };
}
// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export function evaluateRules(rules, ctx) {
    const resultMap = new Map();
    const prereqFirst = ['GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED', 'GLOBAL_GRAPH_FIRST_REQUIRED'];
    const sorted = [
        ...rules.filter(r => prereqFirst.includes(r.rule_id)),
        ...rules.filter(r => !prereqFirst.includes(r.rule_id)),
    ];
    for (const rule of sorted) {
        if (!ruleApplies(rule, ctx.engineId)) {
            const result = skipResult(rule, 'engine not in applies_to_engines');
            resultMap.set(rule.rule_id, result);
            continue;
        }
        const prereqCheck = checkPrerequisites(rule.rule_id, resultMap);
        if (!prereqCheck.ok) {
            const result = skipResult(rule, `prerequisite failed: ${prereqCheck.reason}`);
            resultMap.set(rule.rule_id, result);
            continue;
        }
        const evaluator = EVALUATORS[rule.rule_id];
        if (!evaluator) {
            const metadataOnly = rule.enforcement_mode === 'metadata_only' || rule.metadata_only === true;
            const result = {
                rule_id: rule.rule_id,
                status: metadataOnly ? 'INFO' : 'INCONCLUSIVE',
                evidence: {
                    reason: 'No runtime evaluator registered for this rule',
                    rule_id: rule.rule_id,
                    metadata_only_unenforced: metadataOnly,
                    source_module: 'verify/evaluateRules',
                    authority_tier: String(ctx.meta?.authority_tier ?? 'UNKNOWN'),
                },
                why: metadataOnly
                    ? 'Metadata-only rule has no runtime evaluator; logged as INFO for audit trace.'
                    : 'Missing evaluator — rule is loaded but evaluator is absent, marked as INCONCLUSIVE for audit safety',
                rule_version: rule.rule_version,
            };
            resultMap.set(rule.rule_id, result);
            continue;
        }
        try {
            const result = evaluator(rule, ctx);
            resultMap.set(rule.rule_id, result);
        }
        catch (err) {
            const result = {
                rule_id: rule.rule_id,
                status: 'ERROR',
                evidence: {
                    error: err instanceof Error ? err.message : String(err),
                    rule_id: rule.rule_id,
                    source_module: 'verify/evaluateRules',
                    authority_tier: String(ctx.meta?.authority_tier ?? 'UNKNOWN'),
                },
                why: `Evaluator threw an error: ${err instanceof Error ? err.message : String(err)}`,
                rule_version: rule.rule_version,
            };
            resultMap.set(rule.rule_id, result);
        }
    }
    return Array.from(resultMap.values());
}
/**
 * Get the rule dependency graph for documentation/auditing.
 */
export function getRuleDependencyGraph() {
    return {
        prerequisites: { ...RULE_PREREQUISITES },
        conflicts: [...RULE_CONFLICTS],
    };
}
/**
 * Generate a coverage report showing which rules have evaluators.
 */
export function generateCoverageReport(rules) {
    const missing = [];
    for (const rule of rules) {
        if (!EVALUATORS[rule.rule_id]) {
            missing.push(rule.rule_id);
        }
    }
    return {
        total: rules.length,
        implemented: rules.length - missing.length,
        missing,
        coverage: rules.length > 0 ? (rules.length - missing.length) / rules.length : 0,
    };
}
