# Spectral Verification Library

Bu klasör, **Spectral Teyit / Verify Results** modülünün referans verisi ve şemalarını içerir.

## Konum

- **Şemalar:** `lib/spectra/library/*.json`
- **Uygulama:** Teyit motoru `Spectromasterv0.2tester.html` içinde çalışır. Sayfa sunucudan açıldığında `lib/spectra/library/ruleset.json` otomatik yüklenir (fetch); yoksa gömülü minimal kural seti kullanılır. Tüm kurallar `normalizeRuleset()` ile normalize edilir (rule_version, applies_to_engines, status_on_skip vb. varsayılanlar). Rapor çıktısı `teyit_raporu_schema.json` ile uyumludur; `feature_snapshot`, `engine_used`, `inputs_echo`, `timings_ms`, `trace` ve P1 score↔status cap (FAIL ⇒ score ≤ 69) dahildir.

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `teyit_raporu_schema.json` | TEYIT RAPORU çıktısının JSON şeması (status: PASS/FAIL/PARTIAL/INCONCLUSIVE, veto_flags, root_cause_analysis, data_completeness, missing_library_items, patch_recommendations). |
| `verification_library_schema.json` | Referans kütüphane şeması (functional_group_shift_priors, J_coupling_priors, IR_band_priors, MS_adduct_rules, solvent_impurity_catalog, isotope_rules). |
| `verification_library_seed.json` | Varsayılan referans verisi (seed); şema ile uyumlu, Node ortamında yüklenebilir. |
| `ruleset.json` | Kural tanımları (rule_id, hardness: HARD/SOFT/INFO, thresholds, evidence_capture, why_narrative). evaluateAll ile tek otorite. |
| `rule_schema.json` | Kural nesnesi JSON şeması (rule_id, modality, prerequisites, hardness, status_on_fail). |
| `verification_library_schema_v2.json` | Genişletilmiş kütüphane şeması v2: ShiftPrior (shape/mode/sigma, components), solvent peaks_1h, isotope pattern_generation, 2d_expected_connectivity_priors (hsqc/hmbc/cosy). |
| `coverage_matrix.json` | Kimyasal çeşitlilik matrisi (category → target_count, current_count, molecules[], missing_categories). validateCoverage(matrix, moleculeList) ile güncellenir. |

## Referans verisi (HTML içinde gömülü)

- **functional_group_shift_priors:** 1H/13C ppm pencereleri (aliphatic, aromatic, carbonyl, vb.).
- **J_coupling_priors:** Vikinal/trans/cis/aromatik J (Hz) aralıkları.
- **IR_band_priors:** C=O, OH/NH, C≡N, aromatik C=C bant aralıkları (cm⁻¹).
- **MS_adduct_rules:** [M+H]+/[M+Na]+/[M−H]− vb. kurallar.
- **solvent_impurity_catalog:** CDCl3, DMSO-d6, su, TMS ppm ve notları.
- **isotope_rules:** Cl/Br M+2 izotop oranları.

## Yeni SMILES için kütüphane ekleme

1. `GOLDEN_EXPECTATIONS_30.json` veya `FP_RULES` (HTML içi) ile uyumlu bir girdi ekleyin.
2. Teyit çalıştırıldığında eşleşme yoksa `missing_library_items` çıktıda listelenir; `required_parameters_to_add` ve `suggested_sources` alanlarına göre `FP_RULES` veya harici JSON güncellenebilir.
3. Referans verisi eksikliği tespiti: FP_RULES dışında solvent (solvent_impurity_catalog), IR beklenen bantlar (IR_band_priors), MS adduct eşleşmesi (MS_adduct_rules) eksikse de `missing_library_items` doldurulur.
4. **INCONCLUSIVE:** Veto yok ama kütüphane kapsamı düşükse (simulation_confidence &lt; 60) status `INCONCLUSIVE` olur.
5. **Yapılandırılmış log:** `SPECTRAL_VERIFY_LOG=1` ile her kural giriş/çıkışı `traceId` ile loglanır.

## Coverage Matrix ve Kural Motoru

- **coverage_matrix.json:** Veri seti kapsam hedefleri (aromatik, karbonil, nitril, halojen, simetri, exchangeable, overlap, no_2d). `validateCoverage(matrix, moleculeList)` (Spectromasterv0.2tester.html içinde) ile `current_count` ve `missing_categories` güncellenir; her molekül `kernel` veya `category_ids` ile kategorilere atanır.
- **ruleset.json / VERIFICATION_RULESET:** Hard-coded pushVeto kurallarının YAML/JSON tek kaynağı; hardness (HARD/SOFT/INFO), rule_priority, evidence_minimum. IR/MS için **Evidence Hardness Matrix** (ir_requirement_matrix: carbonyl HARD, nitrile SOFT, oh_nh SOFT) VERIFICATION_CONFIG içinde tanımlıdır.

## Kaynak önerileri

- NMRShiftDB benzeri veritabanları
- Şirket içi küratör setleri
- `GOLDEN_EXPECTATIONS_30.json` (30 referans molekül)

---

## 1. Unified Library Contract (Seed + Schema)

Tüm referans verisi `verification_library_seed.json` ile sağlanır ve `verification_library_schema.json` ile doğrulanır. Sözleşme:

- **Request (simulate/verify):** `{ smiles, solvent?, fieldMHz?, params? }` — opsiyonel alanlar varsayılanlarla doldurulur.
- **Response:** Teyit raporu `teyit_raporu_schema.json` ile uyumlu; `status`, `overall`, `confidence_score`, `veto_flags`, `engine_used`, `inputs_echo`, `timings_ms` alanlarını içerir.
- Seed dosyası yüklenirken şema ile validate edilmeli; yeni bloklar (peakshape_priors, solvent_shift_offsets, noise_model_priors, fragmentation_rules_ms, 2d_expected_connectivity_priors) opsiyoneldir, yoksa boş obje kabul edilir.

## 2. How to add a Rule

1. **rule_schema.json** alanları: `rule_id` (zorunlu), `hardness` (zorunlu), `modality`, `prerequisites`, `thresholds`, `evidence_capture`, `why_narrative`, `suggested_action`, `status_on_fail`. Opsiyonel: `rule_version` (varsayılan "1.0.0"), `applies_to_engines` (spectromind/spectrotester/hybrid), `confidence_impact` (0–1), `references` (doi/url/text), `autofix` (patch_type, patch_hint).
2. **ruleset.json** içine yeni nesne ekleyin. Örnek:
   ```json
   {
     "rule_id": "YENI_KURAL_ID",
     "modality": "1H",
     "prerequisites": ["kernel", "h1"],
     "hardness": "SOFT",
     "priority": 50,
     "thresholds": { "min_ratio": 0.5 },
     "evidence_capture": ["observed", "expected"],
     "why_narrative": "Açıklama.",
     "suggested_action": "Kontrol edin.",
     "rule_version": "1.0.0",
     "applies_to_engines": ["spectrotester", "hybrid"],
     "confidence_impact": 0.5
   }
   ```
3. Threshold değerleri config’ten okunmalı; varsayılanlar README veya rule içinde belirtilir.

## 3. How to add Priors (H1 / C13 / J / IR / MS)

- **H1/C13:** `verification_library_seed.json` → `functional_group_shift_priors.h1` veya `c13` altına yeni anahtar: `{ "min": number, "max": number, "context": "string" }`.
- **J:** `J_coupling_priors` altına: `{ "min": number, "max": number, "unit": "Hz", "note": "string" }`.
- **IR:** `IR_band_priors` altına: `{ "min": number, "max": number, "intensity": "strong|medium|weak|broad", "assign": "string" }`.
- **MS adduct:** `MS_adduct_rules.positive` veya `negative` dizisine: `{ "label": "[M+…]", "massDelta": number, "name": "string" }`.
- **Solvent impurity:** `solvent_impurity_catalog` dizisine: `{ "name": "string", "ppm_1h": number, "pattern": "string", "note": "string" }`.
- **Isotope:** `isotope_rules` altına element anahtarı: `{ "M2_ratio_min", "M2_ratio_max", "per_atom": true }`.
- Her yeni prior için `typical_examples` (molecule ids) eklenebilir; şema `additionalProperties` ile esnek.

## 4. Coverage Seeding Guide (coverage_matrix.json)

- **Molekül standardı:** Her molekül en az `mol_id`, `name`, `smiles`, `category_ids`, `expected_modalities` (["1H","13C","HSQC",…]), `edge_case_tags` (overlap, symmetry, exchangeable, halogen, low_snr), `scenarios` (örn. 400MHz_DMSO) içermalı.
- **Senaryo profilleri:** `scenario_profiles` dizisi (id, fieldMHz, solvent, snr) tanımlı; molekülün `scenarios` alanı bu id’lere referans verir.
- **Eksik kategoriler:** `missing_categories` elemanları obje: `{ category_id, missing_count, suggested_molecules[], notes }`; rapor üretirken “ne eklemeli?” aksiyon listesi çıkar.
- **Coverage kuralları:** `coverage_rules` ile alt kategori min çeşitleri (ör. aromatic: heteroaromatic_min 2, carbonyl: ester_min 2) tanımlanır; sadece sayı değil dağılım da hedeflenir.

## 5. Smoke Tests (run_smoke_tests)

- **Dosya:** `smoke_tests_hmbc_alpha_h_gating.json` — HMBC carbonyl alpha-H gating kuralı için test vakaları.
- **Runner:** `Spectrotester/scripts/run_smoke_tests.mjs` — Node ile çalıştırılır:
  ```bash
  node Spectrotester/scripts/run_smoke_tests.mjs
  ```
- **Beklenen çıktı:** Her test case için PASS/FAIL; son satırda `Total: N passed, M failed`. Exit code 0 (tümü PASS) veya 1 (en az bir FAIL).
- **Yeni vaka ekleme:** `test_cases` dizisine `id`, `smiles`, `expected_has_alpha_h_for_carbonyl`, `expected_hmbc_carbonyl_required`, `description` ile yeni obje ekleyin. Gating mantığı: karbonil var + alpha C–H var ⇒ HMBC carbonyl required.
