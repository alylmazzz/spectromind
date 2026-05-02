/**
 * Spectrotester genişletme/detay/içerik artırma dokümanını DOCX olarak üretir.
 * Çalıştırma: node scripts/generate-spectrotester-docx.js
 * Çıktı: docs/SPECTROTESTER_GENISLETME_DETAY_DOKUMANI.docx
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
  BorderStyle,
} = require('docx');

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...opts })],
    ...opts.paragraph,
  });
}

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}` })],
    indent: { left: 360 },
    spacing: { after: 60 },
  });
}

function bold(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true })],
    spacing: { after: 60 },
  });
}

function tableFromRows(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row) => new TableRow({
      children: row.map((cell) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: cell })] })],
        shading: {},
      })),
    })),
  });
}

async function buildDocument() {
  const sections = [
    h1('Spectrotester / SpectroMind — Kod Genişletme, Detaylandırma ve İçerik Artırma Dokümanı'),
    p('Tarih: 21 Şubat 2026'),
    p('Amaç: Kodun genişletilmesi, detaylandırılması ve içerik miktarının artırılması gereken tüm alanların eksiksiz listesi.'),
    p(''),

    h2('0. MİMARİ GENİŞLETME: HTML MONOLİT → CORE + CLI + UI'),
    h3('0.1 Neden'),
    bullet('Kütüphane, ruleset ve coverage matrix şu an HTML içinde gömülü; JSON\'lar "gelecek hedef" konumunda.'),
    bullet('Test/CI kurulumu zor; deterministik sürümleme ve izlenebilirlik zayıf; rapor ile engine davranışı arasında sürüklenme riski.'),
    h3('0.2 Genişletilmesi Gereken Detaylar'),
    tableFromRows([
      ['Bileşen', 'Mevcut', 'Genişletme / Detay', 'İçerik Artışı'],
      ['@spectrotester/core (Node/TS)', 'Kısmen var: Spectrotester/src/core', 'SMILES→graph→feature extraction + spectrum synthesis + verification tamamı core\'da; HTML kernel/constants/verify core\'a taşınmalı', 'predict/ (predict1H, predict13C, predictHSQC, predictCOSY, predictHMBC, predictIR, predictMS) modülleri; her predictor kütüphane priors ile beslenecek'],
      ['@spectrotester/cli', 'Yok', 'Batch koşu, smoke/regression, rapor export (JSON/PDF/minimal repro)', 'CLI: verify --smiles, batch --input csv, smoke, export --format pdf; help ve örnek dokümantasyon'],
      ['UI (web)', 'Spectromasterv0.2tester.html + SpectroMind Next.js', 'Sadece görselleştirme, dosya import, rapor viewer; hesaplama core\'dan JSON rapor', 'UI: "Use Spectrotester Engine (SMILES-based)" toggle; SMILES yoksa mevcut simülasyon; çıktı çizilebilir'],
    ]),
    h3('0.3 Kabul Kriterleri'),
    bullet('npm test / npm run smoke UI olmadan çalışabilmeli.'),
    bullet('Aynı input ile aynı rapor hash üretilebilmeli (deterministik).'),
    p(''),

    h2('1. KİMYASAL ÇEKİRDEK (SMILES → GRAF → ATOM TİPLERİ → BEKLENTİLER)'),
    h3('1.1 Aromatiklik, Kekulé / Aromatik Canonicalization (KRİTİK)'),
    bold('Neden:'),
    p('HTML\'de aromatik normalize regex tabanlı (normalizeAromaticSMILES); aromatik tespitleri regex/heuristic. Kekulé yazılmış aromatiklerde, füzyonlu sistemlerde ve heteroaromatikte kırılgan.'),
    bold('Genişletilmesi / Detaylandırılması Gerekenler:'),
    bullet('Regex yerine graph tabanlı aromaticity perception zorunlu.'),
    bullet('RDKit (veya OpenBabel) ile canonical SMILES + aromatic SMILES; tautomer/charge normalize opsiyonlu.'),
    bullet('GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED kuralının gerçek engine akışına bağlanması (parse fail => stop).'),
    bullet('İçerik artışı: Aromatik test setinde aromatic atom/halka sayımı ≥ %99; Kekulé ve aromatic iki yazım aynı kernel features üretmeli.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/src/core/graph/parseSmiles.ts, features.ts; HTML aromatizeSMILES, detectDetailedFunctionalGroups → graph tabanlı karşılık.'),
    h3('1.2 Atom Tipleri + Protonlanma + Exchangeable H Modeli'),
    bold('Neden:'),
    p('"HSQC boş olabilir çünkü labile proton" ancak gerçekten OH/NH baskınsa mantıklı. Exchangeable H oranı solvente bağlı; mevcut mantık aşırı agresif.'),
    bold('Genişletilmesi Gerekenler:'),
    bullet('Kernel\'de atom bazlı: is_exchangeable_H (OH/NH/SH/COOH), solvente göre exchange_visibility_prior (DMSO/CDCl3/D2O), pKa/iyonlaşma (opsiyonel).'),
    bullet('Solvent/impurity katalog ile bağlama.'),
    bullet('İçerik artışı: DMSO\'da fenolik OH "broad + bazen görünür"; D2O\'da "çoğunlukla kaybolur" rule/prior ile.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/src/core/graph/features.ts; verification_library solvent_impurity_catalog, solvent_shift_offsets.'),
    h3('1.3 Simetri ve "Unique C/H" Beklentisi'),
    bold('Neden:'),
    p('HTML\'de SymmetryDetector birkaç bilinen yapı + kaba regex; yüksek simetri moleküllerde C13 sayımı yanlış fail.'),
    bold('Genişletilmesi Gerekenler:'),
    bullet('Graph automorphism ile equivalence class: expected_unique_carbons, expected_unique_protons, simetri faktörü.'),
    bullet('Coverage matrix "symmetry_high" gerçek simetri motoru ile beslenmeli.'),
    bullet('İçerik artışı: Benzene/cyclohexane 1 sinyal doğru; karmaşık simetrilerde sınıf sayısı doğru.'),
    bold('Dosya / Modül:'),
    p('Yeni: Spectrotester/src/core/graph/symmetry.ts; features.ts expected_unique_carbons/protons; coverage_matrix.json.'),
    p(''),

    h2('2. TEORİK SPEKTRUM ÜRETİMİ: PEAK LİSTESİNDEN FİZİK TABANLI SİMÜLASYONA'),
    h3('2.1 ¹H NMR Üretimi'),
    bullet('Shift modeli: Fragment/atom-environment (HOSE/ECFP benzeri) + solvent offset + H-bond broadening.'),
    bullet('J-coupling: Komşuluk + dihedral (Karplus) + stereo (cis/trans).'),
    bullet('Integral: Atom sayımından deterministik; overlap/noise ile apparent integral opsiyonel.'),
    bullet('Line shape: Lorentz/Gauss/Voigt; peakshape_priors verification_library\'de.'),
    bullet('İçerik artışı: Aynı input + seed => aynı peak list / spektrum vektörü; second-order AB/ABX opsiyonel.'),
    bold('Dosya / Modül:'),
    p('Yeni: Spectrotester/src/core/predict/predict1H.ts; verification_library functional_group_shift_priors.h1, J_coupling_priors, peakshape_priors.'),
    h3('2.2 ¹³C NMR Üretimi'),
    bullet('d1 ile karbonil/quaternary gating kütüphane prior + senaryo profili ile standart.'),
    bullet('DEPT-135/APT simülasyonu.'),
    bullet('lowSNR ve short d1 senaryoları; coverage_matrix scenario_profiles.'),
    bullet('İçerik artışı: Carbonyl varsa 160–220 ppm; short d1\'de kaybolma olasılığı açıklanabilir.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/src/core/predict/predict13C.ts; verification_library c13 priors; coverage_matrix scenario_profiles.'),
    h3('2.3 2D NMR: HSQC / HMBC / COSY / NOESY'),
    bullet('HSQC: Atom eşleştirme graph üzerinden (H–C bağlılık); graph-first zorunlu.'),
    bullet('HMBC: 2J/3J yol uzunluğu graph; alpha-H gating tüm carbonyl/nitrile/aromatic pattern\'lere; threshold rule set\'e.'),
    bullet('COSY: 3JHH komşuluk graph; lowSNR overlap/noise.'),
    bullet('NOESY: 3D embed (ETKDG) + mesafe prior => cross-peak listesi.'),
    bullet('İçerik artışı: Protonlu C\'lerin ≥ %85\'i HSQC\'de eşleşme; carbonyl varsa HMBC\'de en az 1 2J/3J.'),
    bold('Dosya / Modül:'),
    p('predict/predictHSQC.ts, predictHMBC.ts, predictCOSY.ts, predictNOESY.ts; ruleset HSQC/HMBC threshold; smoke_tests_hmbc genişletmesi.'),
    p(''),

    h2('3. TEYİT MOTORU (RULES + CONFIDENCE + ROOT CAUSE)'),
    h3('3.1 Rule Schema Ürünleşme'),
    bullet('rule_schema: rule_version, applies_to_engines, confidence_impact, references, autofix (patch önerisi).'),
    bullet('Her FAIL/WARN satırında raporda rule_version + autofix gösterilmeli.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/lib/spectra/library/rule_schema.json; verify/evaluateRules.ts, report.ts.'),
    h3('3.2 MS ve FT-IR Rule Set\'e Taşınması'),
    bullet('MS_ISOTOPE_HALOGEN_SIGNATURE_REQUIRED, IR_FUNCTIONAL_GROUP_BAND_REQUIRED; adduct match min ratio, ppm veto.'),
    bullet('Halojen varsa M+2 pattern en az WARN; karbonil varsa IR 1650–1800 yoksa FAIL (ATR/solvent istisna).'),
    bold('Dosya / Modül:'),
    p('Spectrotester/lib/spectra/library/ruleset.json yeni MS/IR kuralları.'),
    h3('3.3 Skorlama / Konf Standardizasyonu'),
    bullet('Confidence iki eksen: Data coverage confidence + Chemical plausibility confidence.'),
    bullet('Methyl/vinylic/aromatic beklenti graph tabanlı; aynı veriyle farklı explain üretilmemeli; confidence breakdown rule referansı ile.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/src/core/verify/scoring.ts; coverage vs final PASS/WARN/FAIL ayrımı.'),
    h3('3.4 Root Cause → Patch Üretimi'),
    bullet('RootCauseAnalyzer → PatchPlan: param değişikliği, eksik modalite önerisi, veri bütünlüğü.'),
    bullet('Patch\'ler autofix ile uyumlu; rapor patch_recommendations dolu.'),
    bold('Dosya / Modül:'),
    p('lib/verification/constants.ts; yeni Spectrotester/src/core/verify/patchPlanner.ts; teyit_raporu_schema patch_recommendations.'),
    p(''),

    h2('4. VERIFICATION LIBRARY (PRIORS) KAPSAMI'),
    h3('4.1 Priors: Dağılım + Koşul + Kaynak'),
    bullet('Her prior: distribution (uniform/normal/mixture), mean, sd, conditions (solvent, temp, pH), confidence, references, examples.'),
    h3('4.2 Doldurulması Gereken Bloklar'),
    tableFromRows([
      ['Blok', 'İçerik Artışı'],
      ['peakshape_priors', 'Lorentz/Gauss/Voigt oranları; linewidth (Hz) dağılımları 1H/13C ayrı'],
      ['solvent_shift_offsets', 'DMSO vs CDCl3 sistematik δ offset tabloları (FG bazlı)'],
      ['noise_model_priors', 'lowSNR peak detection recall/precision prior'],
      ['fragmentation_rules_ms', 'Nötr kayıplar + motif frag\'ları; HTML loss families JSON\'a'],
      ['2d_expected_connectivity_priors', 'HSQC 1 bond; HMBC 2–3 bond; COSY 2–3 bond; NOESY <5Å'],
    ]),
    bold('Dosya / Modül:'),
    p('Spectrotester/lib/spectra/library/verification_library_seed.json ve şema.'),
    p(''),

    h2('5. COVERAGE MATRIX VE SEED DATASET'),
    bullet('Kategori başına minimum seed (örn. 20); subcategory: Aromatic, Carbonyl, Halogen, Exchangeable, Overlap hard, No_2d_or_low_snr (2D yok + SNR düşük ayrı).'),
    bullet('Scenario profiles eklenmeli: 400 MHz DMSO/CDCl3, 600 MHz CDCl3; lowSNR; short d1 (13C).'),
    bullet('validateCoverage graph tabanlı kernel ile; her subcategory otomatik ölçüm; CI missing_categories raporu.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/lib/spectra/library/coverage_matrix.json; validateCoverage; CI script.'),
    p(''),

    h2('6. SMOKE TESTLER → REGRESYON TEST SUITE'),
    bullet('Paketler: SMILES parse & canonicalization; Aromatic (Kekulé vs aromatic); 13C relaxation (short d1 => carbonyl WARN); HSQC match (graph-first); IR carbonyl band; MS isotope halogen; Solvent impurity (CDCl3 7.26).'),
    bullet('Her rule_id için en az 2 test: PASS + FAIL case.'),
    bullet('Her bug fix için repro → golden test zorunlu.'),
    bold('Dosya / Modül:'),
    p('Spectrotester/scripts/run_smoke_tests.mjs; smoke_tests_aromatic.json, smoke_tests_c13_relaxation.json, smoke_tests_hsqc.json vb.; run_core_smoke.mjs entegrasyonu.'),
    p(''),

    h2('7. RAPORLAMA / İZLENEBİLİRLİK'),
    bullet('artifact_hashes: input peak table, config, library, ruleset hash; engine_used: name + version + git commit; trace: rule evaluation adımları + evidence.'),
    bullet('Export: JSON + PDF + minimal repro blob.'),
    bullet('Aynı input + aynı hashes => aynı sonuç (tek başına debug edilebilir rapor).'),
    bold('Dosya / Modül:'),
    p('Spectrotester/src/core/verify/report.ts; teyit_raporu_schema.json; export modülü (PDF/minimal repro).'),
    p(''),

    h2('8. ÜRÜNLEŞME (COMPLIANCE + GÜVENLİK)'),
    bullet('Kullanıcı/rol (RBAC); Audit trail (kim neyi teyit etti); Elektronik imza (Part 11); Data retention & immutability; On-prem / air-gapped deploy.'),
    bold('Dosya / Modül:'),
    p('Backend/auth; veritabanı şemaları; deployment dokümantasyonu.'),
    p(''),

    h2('9. CORE MODÜLÜ GENİŞLETME / DETAY / İÇERİK ARTIRIMI'),
    h3('9.1 Eklenecek / Detaylandırılacak Modüller'),
    tableFromRows([
      ['Modül', 'Genişletme', 'Detay', 'İçerik Artışı'],
      ['graph/parseSmiles', 'apiBase + precomputedGraph (var)', 'RDKit/OpenBabel fallback; GLOBAL_PARSE FATAL', 'Hata mesajları, root_cause kodları'],
      ['graph/features', 'CH3/CH2/CH, exchangeable (var)', 'Simetri sınıfları; sp2/aromatic ayrımı', 'Ring size, heteroatom, FG bayrakları'],
      ['graph/symmetry', 'Yok', 'Yeni: equivalence class, expected_unique', 'Otomorfizm veya heuristic'],
      ['library/schemas', 'Minimal (var)', 'Ajv tam JSON Schema', 'Tüm şemalara validate; hata path'],
      ['predict/*', 'Yok', 'predict1H, predict13C, predictHSQC, COSY, HMBC, IR, MS', 'Library priors + graph features'],
      ['verify/evaluateRules', 'DBE + pass-through (var)', 'Tüm ruleset kuralları; prerequisite, threshold', 'Evidence; rule_version, autofix çıktı'],
      ['verify/scoring', 'aggregateScoring (var)', 'İki eksenli confidence; coverage vs final', 'Modül ağırlıkları; data_completeness vs chemical_plausibility'],
      ['verify/patchPlanner', 'Yok', 'Root cause → PatchPlan; autofix', 'Patch şeması ve rapor alanı'],
    ]),
    h3('9.2 HTML (Spectromasterv0.2tester) Düzeltmeleri'),
    bullet('HSQC: "OH/NH exchange" sadece gerçek exchangeable H için; CH/CH2 boşluğu için kullanılmamalı.'),
    bullet('Methyl: CH3 beklentisi sadece grafta CH3 varken; QC_METHYL_CLASS_MISSING CH3 içermeyen moleküllerde tetiklenmemeli.'),
    bullet('Sp2/Vinylic: expected_sp2_C graph tabanlı; 13C 100–160 sp² ile uyumlu; vinylic etiketlemesi doğru.'),
    bullet('Coverage vs final: Coverage score ile PASS/WARN/FAIL ayrımı; "Score 91 ama FAIL" UI metni ile giderilmeli.'),
    p(''),

    h2('10. DEBUG CHECKLİSTİ (CI + MANUEL)'),
    bullet('Input: SMILES trim/canonicalize geçti mi? Formula/DBE tutarlı mı?'),
    bullet('Kernel: aromaticC > 0 (graph)? carbonyl/nitrile/halogen/exchangeable doğru mu?'),
    bullet('1H: δ solvente mantıklı? integral = atom sayımı? multiplet/J komşulukla uyumlu?'),
    bullet('13C: carbonyl 160–220? aromatic 110–160? d1 kısa senaryoda WARN açıklamalı?'),
    bullet('2D: HSQC protonlu C kadar crosspeak? HMBC carbonyl 2–3 bond? COSY vicinal ağ mantıklı?'),
    bullet('MS/IR: adduct match? halojen M+2? karbonil IR band?'),
    bullet('Rapor: coverage vs teyit çelişki yok? root cause → evidence dolu? artifact_hashes + trace var?'),
    p(''),

    h2('11. ÖNCELİK SIRASI'),
    bullet('1. SMILES→graph + aromatic canonicalization (regex kaldır)'),
    bullet('2. Graph-first HSQC/HMBC/COSY üretimi ve teyidi'),
    bullet('3. 13C/1H shift priors + solvent offset + line shape'),
    bullet('4. MS isotope + IR band rule\'ları ruleset\'e'),
    bullet('5. Coverage matrix senaryoları + seed dataset'),
    bullet('6. Smoke/regression CI'),
    bullet('7. Audit/trace/artifact hash'),
    bullet('8. Ürünleşme (RBAC, audit, Part 11)'),
    p(''),
    new Paragraph({
      children: [new TextRun({ text: 'Doküman sonu. Bu liste, kodun genişletilmesi, detaylandırılması ve içerik miktarının artırılması gereken tüm alanları kapsar.', italic: true })],
    }),
  ];

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outDir = path.join(__dirname, '..', 'docs');
  const outPath = path.join(outDir, 'SPECTROTESTER_GENISLETME_DETAY_DOKUMANI.docx');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log('DOCX yazıldı:', outPath);
}

buildDocument().catch((err) => {
  console.error(err);
  process.exit(1);
});
