# SpectroLibrary Expansion — Değişiklik Özeti

Bu belge, **SpectroLibrary Expansion Engineer** görevine göre yapılan tüm eklentileri listeler. Geriye uyumluluk korundu; yeni alanlar opsiyonel + varsayılan ile eklendi.

---

## 1) coverage_matrix.json — 5 işlevsel eklenti

| Eklenti | Açıklama | Neden |
|--------|----------|--------|
| **Molekül standardı** | Her molekülde `mol_id`, `name`, `smiles`, `category_ids`, `expected_modalities`, `edge_case_tags`, `scenarios` | validateCoverage ve test/benchmark otomasyonu için hangi modülleri zorladığını bilmek |
| **Seed moleküller** | Her ana kategoriye en az 5 gerçek SMILES (aromatic, carbonyl, nitrile, halogen, symmetry_high, exchangeable, overlap_hard, no_2d_or_low_snr) | current_count=0 ve molecules boşluğunu doldurmak; coverage metriğinin anlamlı çalışması |
| **scenario_profiles** | 400MHz_DMSO, 400MHz_CDCl3, 600MHz_CDCl3, 400MHz_DMSO_lowSNR, 600MHz_CDCl3_lowSNR | Aynı SMILES farklı koşul; no_2d_or_low_snr senaryo ile anlam kazanır |
| **missing_categories (obje)** | `{ category_id, missing_count, suggested_molecules[], notes }` | Rapor üretirken "eksik olanı doldurmak için ne eklemeliyim?" aksiyon listesi |
| **coverage_rules** | aromatic/carbonyl/halogen alt kategori min çeşit koşulları | Sadece sayı değil dağılım; model yanlış kalibre olmasın |

---

## 2) ruleset.json — 5 yeni kural

| Kural | Modality | Amaç | Neden |
|-------|----------|------|--------|
| **HSQC_CH_COUNT_MATCH_MIN_RATIO** | HSQC | Protonlu karbon sayısı ile HSQC peak sayısı min oranı | HSQC kalitesizken yanlış fail; kontrollü yönetim |
| **HMBC_AROMATIC_SUBSTITUTION_PATTERN_CHECK** | HMBC | Aromatik halkada ortho/meta HMBC örüntüsü tutarlılığı | Aromatiklik parse hatası kritik risk |
| **MS_ISOTOPE_HALOGEN_SIGNATURE_REQUIRED** | MS | Cl/Br/I varsa M+2/M+4 izotop imzası | Halojenli yapılarda MS en güçlü teyit; seed’de isotope_rules vardı, kural yoktu |
| **IR_FUNCTIONAL_GROUP_BAND_REQUIRED** | FT-IR | Carbonyl/nitrile/amine varsa ilgili band kontrolü | IR üretimi minimal; band doğrulaması gerekli |
| **GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED** | GLOBAL | Parse/canonicalize başarısızsa deterministik FAIL/INCONCLUSIVE | "No 1H" gibi belirsiz mesaj yerine kök neden |

Tüm yeni kurallar `rule_version`, `applies_to_engines`, `confidence_impact` ile eklendi (rule_schema ile uyumlu).

---

## 3) rule_schema.json — 5 şema eklentisi

| Alan | Tip | Varsayılan / Açıklama |
|------|-----|------------------------|
| **rule_version** | string | "1.0.0" — kural sürümü |
| **applies_to_engines** | array enum | spectromind, spectrotester, hybrid |
| **confidence_impact** | number 0..1 | Skorlamada etkisi |
| **references** | array { type, value } | doi/url/text — bilimsel referans |
| **autofix** | { patch_type, patch_hint } \| null | Raporda otomatik patch önerisi |

Eski kurallar bu alanları içermiyorsa loader default ile doldurmalı (backward compatible).

---

## 4) verification_library_seed.json — bölüm başı +5 (veya daha fazla)

| Bölüm | Eklenen priorlar |
|-------|------------------|
| **H1** | benzylic_ch, alpha_to_carbonyl, amide_nh_exchangeable, phenolic_oh, anomeric_o_ch |
| **C13** | aromatic_quaternary, acetal_anomeric, alkyne_sp, carbonyl_acid, carbonyl_amide |
| **J** | allylic_3J, long_range_4J_aromatic, vinyl_geminal, axial_axial_cyclohexane, axial_equatorial_cyclohexane |
| **IR** | CO_ester, CO_amide, CO_acid, NH_stretch, CCl_stretch |
| **MS adduct** | [M+NH4]+, [M+ACN+H]+, [2M+H]+; [M+Cl]-, [M+CH3COO]- |
| **solvent_impurity** | DMF-d7, THF-d8, EtOAc, hexane, DCM |
| **isotope_rules** | I, S, Si, B, multi_halogen |

Neden: Kütüphane dar kalınca doğrulama ve fallback simülasyonlar boş/yanlış olabiliyordu.

---

## 5) verification_library_schema.json — 5 yeni blok

| Blok | Açıklama |
|------|----------|
| **peakshape_priors** | Lorentz/Gauss/Voigt; linewidth aralıkları |
| **solvent_shift_offsets** | DMSO/CDCl3 sistematik kaymalar |
| **noise_model_priors** | low_snr senaryosu |
| **fragmentation_rules_ms** | Temel frag motifleri |
| **2d_expected_connectivity_priors** | HSQC/HMBC beklenen bağ mesafeleri |

Hepsi opsiyonel; library loader yoksa boş obje kabul etmeli.

---

## 6) teyit_raporu_schema.json — 5 rapor alanı

| Alan | Açıklama |
|------|----------|
| **engine_used** | spectromind | spectrotester | hybrid |
| **inputs_echo** | smiles, solvent, fieldMHz, params |
| **timings_ms** | parse, generate, verify (ms) |
| **artifact_hashes** | Çıktı hashleri (immutability) |
| **trace** | parse_summary, peak_counts, fallback_flags (debug) |

Neden: "No spectrum" gibi belirsiz hatalar kök nedeni saklıyordu; rapor izlenebilir olmalı.

---

## 7) smoke_tests_hmbc_alpha_h_gating.json — 5 yeni test case

| ID | SMILES | expected_has_alpha_h | expected_hmbc_required |
|----|--------|----------------------|-------------------------|
| ST-016 | c1ccccc1 (benzene) | false | false |
| ST-017 | O=CO (formic acid) | false | false |
| ST-018 | c1ccccc1C=O (benzaldehyde) | true | true |
| ST-019 | CC(=O)NC (N-methylacetamide) | true | true |
| ST-020 | CCOC(=O)c1ccccc1 (ethyl benzoate) | true | true |

**Runner:** `Spectrotester/scripts/run_smoke_tests.mjs`  
Çalıştırma: `node Spectrotester/scripts/run_smoke_tests.mjs` (spectromind kökünden) veya `npm run smoke:library`.  
Neden: Tek testle regresyon yakalanmaz; gating kritik doğrulama katmanı.

---

## 8) README.md — 5 dokümantasyon eklentisi

1. **Unified Library Contract** — Seed + şema, request/response sözleşmesi.  
2. **How to add a Rule** — rule_schema alanları + örnek kural.  
3. **How to add Priors** — H1/C13/J/IR/MS/impurity/isotope formatları.  
4. **Coverage Seeding Guide** — coverage_matrix molekül standardı, scenario_profiles, missing_categories, coverage_rules.  
5. **Smoke Tests** — run_smoke_tests.mjs nasıl çalıştırılır, beklenen çıktı.

---

## Backward compatibility

- Tüm yeni şema alanları **opsiyonel**; mevcut loader’lar eski dosyalarla çalışmaya devam eder.
- ruleset.json’daki mevcut kurallar değiştirilmedi; sadece 5 yeni kural eklendi.
- coverage_matrix’teki `categories[].molecules` artık dolu; `validateCoverage` aynı arayüzle çağrılabilir.

---

## verification_library_schema_v2.json ve P0 kernel/motor

| Öğe | Açıklama |
|-----|----------|
| **verification_library_schema_v2.json** | Genişletilmiş kütüphane şeması: ShiftPrior (shape, mode_ppm, sigma_ppm, components, applicability, detection), SolventProfile.peaks_1h (çoklu pik), isotope_rules.pattern_generation, 2d_expected_connectivity_priors (hsqc/hmbc/cosy allowed_bond_distance, exchangeable_h_policy, carbonyl_gate). Geriye uyumlu; mevcut seed ile kullanılabilir. |
| **P0 Aromatik algı** | aromatizeSMILES: aromaticIndex = max(lowercase [cnops], Kekulé 6-halka sayısı×6). detectDetailedFunctionalGroups: aromaticC = max(lowercase c sayısı, this.aromaticIndex). Böylece Kekulé form (C1=CC=CC=C1) aromatik olarak sayılır. |
| **P0 13C band sanity** | Aromatik karbon varken (k.groups.aromaticC > 0) 13C 90–165 ppm sinyal sayısı &lt; min(aromaticC/2, 4) ise VETO_C13_AROMATIC_BAND_SANITY ve c13 status FAIL. |
| **P0 HSQC gating** | HSQC veri yok (realHsqc.length === 0): C_protonated > 0 ise FAIL, yoksa SKIP. Protonlu C &gt; 0 ve HSQC pik = 0 iken PASS atanmıyor (tek gerçeklik). |
| **P0 Methyl/vinylic QC** | QC_METHYL_* (class mismatch, missing, sync) sadece expected_methyls.length &gt; 0 veya totalHMethylGroups/totalCMethyl &gt; 0 ise çalışır. QC_VINYLIC_C_LOW sadece expectedVinylicC = alkene×2 &gt; 0 ise çalışır. |

---

## Smoke test sonucu

Smoke test runner ortam yoluna (Türkçe karakter) bağlı olarak IDE veya terminalden çalıştırılmalıdır:

- **Spectrotester klasöründen:** `node scripts/run_smoke_tests.mjs`
- **spectromind kökünden:** `npm run smoke:library`

Beklenen: Tüm vakalar PASS; exit code 0. Heuristik (karbonil + alpha C–H) test beklentileriyle uyumludur; bir vaka tutarsızsa `run_smoke_tests.mjs` içindeki `hasAlphaHForCarbonyl` güncellenebilir.
