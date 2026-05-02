# Spectrotester / SpectroMind — Kod Genişletme, Detaylandırma ve İçerik Artırma Dokümanı

**Tarih:** 21 Şubat 2026  
**Amaç:** Kodun genişletilmesi, detaylandırılması ve içerik miktarının artırılması gereken tüm alanların eksiksiz listesi.

---

## 0. MİMARİ GENİŞLETME: HTML MONOLİT → CORE + CLI + UI

### 0.1 Neden
- Kütüphane, ruleset ve coverage matrix şu an HTML içinde gömülü; JSON’lar “gelecek hedef” konumunda.
- Test/CI kurulumu zor; deterministik sürümleme ve izlenebilirlik zayıf; rapor ile engine davranışı arasında sürüklenme riski.

### 0.2 Genişletilmesi Gereken Detaylar
| Bileşen | Mevcut | Genişletme / Detay | İçerik Artışı |
|--------|--------|--------------------|---------------|
| **@spectrotester/core** (Node/TS) | Kısmen var: `Spectrotester/src/core` (engine, graph, library, verify, util) | SMILES→graph→feature extraction + spectrum synthesis + verification’ın tamamı core’da; HTML’deki kernel/constants/verify fonksiyonları core’a taşınmalı | predict/ (predict1H, predict13C, predictHSQC, predictCOSY, predictHMBC, predictIR, predictMS) modülleri eklenecek; her predictor kütüphane priors ile beslenecek |
| **@spectrotester/cli** | Yok | Batch koşu, smoke/regression, rapor export (JSON/PDF/minimal repro) | CLI komutları: `verify --smiles`, `batch --input csv`, `smoke`, `export --format pdf`; her biri için help ve örnek kullanım dokümantasyonu |
| **UI (web)** | Spectromasterv0.2tester.html + SpectroMind Next.js | Sadece görselleştirme, dosya import, rapor viewer; tüm hesaplama core’dan JSON rapor alacak | UI’da “Use Spectrotester Engine (SMILES-based)” toggle; SMILES yoksa mevcut SpectroMind simülasyon akışı; çıktı her zaman çizilebilir (peak dizileri + metadata) |

### 0.3 Kabul Kriterleri
- `npm test` / `npm run smoke` UI olmadan çalışabilmeli.
- Aynı input ile aynı rapor hash üretilebilmeli (deterministik).

---

## 1. KİMYASAL ÇEKİRDEK (SMILES → GRAF → ATOM TİPLERİ → BEKLENTİLER)

### 1.1 Aromatiklik, Kekulé / Aromatik Canonicalization (KRİTİK)

**Neden:** HTML’de aromatik normalize etme regex tabanlı (`normalizeAromaticSMILES`); bazı aromatik tespitleri hâlâ regex/heuristic. Kekulé yazılmış aromatiklerde, füzyonlu sistemlerde ve heteroaromatikte kırılgan.

**Genişletilmesi / Detaylandırılması Gerekenler:**
- Regex yerine **graph tabanlı aromaticity perception** zorunlu.
- RDKit (veya OpenBabel) ile **canonical SMILES + aromatic SMILES** üretimi; tautomer/charge normalize opsiyonlu.
- Kuralsal tarafta **GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED** kuralının gerçek engine akışına bağlanması (parse fail olursa stop; sadece raporda yazan değil).
- **İçerik artışı:** Aromatik içeren test setinde aromatic atom/halka sayımı ≥ %99 doğruluk; Kekulé ve aromatic iki yazımın aynı kernel features üretmesi.

**Dosya / Modül:**  
`Spectrotester/src/core/graph/parseSmiles.ts`, `features.ts`; HTML’deki `aromatizeSMILES`, `detectDetailedFunctionalGroups` mantığının graph tabanlı karşılığı.

### 1.2 Atom Tipleri + Protonlanma + Exchangeable H Modeli

**Neden:** Teyit tarafında “HSQC boş olabilir çünkü labile proton” açıklaması ancak gerçekten OH/NH baskınsa mantıklı. Exchangeable H oranı ve görünürlük solvente bağlı; mevcut çıktılarda bu mantık aşırı agresif.

**Genişletilmesi / Detaylandırılması Gerekenler:**
- Kernel’de atom bazlı: **is_exchangeable_H** (OH/NH/SH/COOH), **solvente göre exchange_visibility_prior** (DMSO/CDCl3/D2O), **pKa/iyonlaşma** (opsiyonel).
- Solvent/impurity katalog ile bağlama (verification_library’de listelenmiş).
- **İçerik artışı:** DMSO’da fenolik OH “çoğunlukla broad + bazen görünür”; D2O’da “çoğunlukla kaybolur” davranışının rule/prior ile modellenmesi.

**Dosya / Modül:**  
`Spectrotester/src/core/graph/features.ts` (exchangeable bayrakları, solvent parametresi); verification_library `solvent_impurity_catalog`, `solvent_shift_offsets`.

### 1.3 Simetri ve “Unique C/H” Beklentisi

**Neden:** HTML’de SymmetryDetector sadece birkaç bilinen yapı ve kaba regex ile çalışıyor; yüksek simetri moleküllerde C13 sayımı yanlış fail ettiriyor.

**Genişletilmesi / Detaylandırılması Gerekenler:**
- **Graph automorphism** ile equivalence class hesaplama: **expected_unique_carbons**, **expected_unique_protons**, **simetri faktörü** (score yerine doğrudan sınıf sayısı).
- Coverage matrix’te “symmetry_high” kategorisinin gerçek simetri motoru ile beslenmesi.
- **İçerik artışı:** Benzene/cyclohexane’da 1 sinyale düşüşün doğru; daha karmaşık simetrilerde de sınıf sayısının doğru üretilmesi.

**Dosya / Modül:**  
Yeni: `Spectrotester/src/core/graph/symmetry.ts`; `features.ts`’e expected_unique_carbons/protons eklenmesi; coverage_matrix.json.

---

## 2. TEORİK SPEKTRUM ÜRETİMİ: PEAK LİSTESİNDEN FİZİK TABANLI SİMÜLASYONA

### 2.1 ¹H NMR Üretimi (Shift + Multiplicity + Integral + Line Shape)

**Genişletilmesi Gereken Detaylar:**
- **Shift modeli:** Fragment/atom-environment tabanlı (HOSE/ECFP benzeri) + solvent offset + H-bond broadening.
- **J-coupling:** Komşuluk + dihedral (Karplus yaklaşımı) + stereo (cis/trans).
- **Integral:** Atom sayımından deterministik; overlap/noise ile “apparent integral” simülasyonu opsiyonel.
- **Line shape:** Lorentz/Gauss/Voigt; linewidth prior’ları verification_library’de **peakshape_priors** bloklarına yerleşmeli.

**İçerik artışı:** Aynı input + seed ile aynı peak list / aynı spektrum vektörü; “second-order” etkilerin en azından AB/ABX sınıfında opsiyonel simüle edilebilmesi.

**Dosya / Modül:**  
Yeni: `Spectrotester/src/core/predict/predict1H.ts`; verification_library’de `functional_group_shift_priors.h1`, `J_coupling_priors`, `peakshape_priors`.

### 2.2 ¹³C NMR Üretimi (Quaternary Zayıflığı, Relaxation)

**Genişletilmesi Gereken Detaylar:**
- d1 (relaxation delay) ile “karbonil/quaternary görünmemiş olabilir” gating’in kütüphane prior + senaryo profili ile standartlaştırılması.
- **DEPT-135/APT** simülasyonu (tip doğrulaması için).
- **lowSNR scenario** ve **short d1 scenario**’nun standardize edilmesi; coverage_matrix’e senaryo profili kavramının eklenmesi.

**İçerik artışı:** Carbonyl varsa 160–220 ppm bandında sinyal üretimi; “short d1” senaryosunda kaybolma olasılığı artmalı ama açıklanabilir olmalı.

**Dosya / Modül:**  
Yeni: `Spectrotester/src/core/predict/predict13C.ts`; verification_library `functional_group_shift_priors.c13`; coverage_matrix `scenario_profiles`.

### 2.3 2D NMR: HSQC / HMBC / COSY / NOESY (+ Opsiyonel HSQC-DEPT, TOCSY, JRES)

**Genişletilmesi Gereken Detaylar:**
- **HSQC:** Atom eşleştirme graph üzerinden (H–C bağlılık); ppm matching ikinci adım. HTML’deki HSQC candidate scoring carbon/proton class hatalıysa çöküyor; **graph-first** yaklaşım zorunlu.
- **HMBC:** 2J/3J yol uzunluğu graph ile; “alpha-H gating” smoke test tüm carbonyl/nitrile/aromatic substitution pattern’lerine genişletilmeli; threshold sözlüğü rule set’e taşınmalı.
- **COSY:** 3JHH beklenen komşuluk graph ile; overlap/noise ile kaybolma olasılığı (lowSNR).
- **NOESY:** 3D embed (ETKDG) + mesafe prior → beklenen cross-peak listesi.

**İçerik artışı:** Protonlu karbonların ≥ %85’i HSQC’de bir eşleşme bulmalı (lowSNR hariç); carbonyl varsa HMBC’de en az 1 mantıklı 2J/3J bağlantı (molekül sınıfına göre opsiyon).

**Dosya / Modül:**  
Yeni: `predict/predictHSQC.ts`, `predictHMBC.ts`, `predictCOSY.ts`, `predictNOESY.ts`; ruleset’te HSQC/HMBC threshold kuralları; smoke_tests_hmbc_alpha_h_gating.json genişletmesi.

---

## 3. TEYİT MOTORU (RULES + CONFIDENCE + ROOT CAUSE)

### 3.1 Rule Schema’nın “Ürünleşme” Seviyesine Çıkarılması

**Genişletilmesi Gereken Detaylar:**
- **rule_schema**’ya opsiyonel ama standardize alanlar: **rule_version**, **applies_to_engines**, **confidence_impact**, **references** (PubMed, NMRShiftDB, vendor doc), **autofix** (patch önerisi: “HSQC threshold düşür”, “13C d1 artır”).
- Her FAIL/WARN satırında raporda “hangi rule_version ile üretildi” + “autofix var mı” gösterilebilmeli.

**Dosya / Modül:**  
`Spectrotester/lib/spectra/library/rule_schema.json` (alanlar kısmen var); `verify/evaluateRules.ts`, `report.ts` (çıktıya rule_version ve autofix eklenmesi).

### 3.2 Rule Coverage: MS ve FT-IR Tarafının Gerçek Rule Set’e Taşınması

**Genişletilmesi Gereken Detaylar:**
- **MS_ISOTOPE_HALOGEN_SIGNATURE_REQUIRED**, **IR_FUNCTIONAL_GROUP_BAND_REQUIRED**; adduct match min ratio, ppm veto (HTML’de MS ppm threshold kullanılıyor; ruleset.json’da MS/IR rule’ları yok).
- Halojen varsa M+2 pattern rule en az WARN üretmeli (Cl/Br).
- Karbonil varsa IR 1650–1800 bandı yoksa FAIL (ATR/solvent senaryosu ile istisna yönetimi).

**Dosya / Modül:**  
`Spectrotester/lib/spectra/library/ruleset.json` (yeni MS/IR kuralları); HTML veya core’da bu kuralların değerlendirilmesi.

### 3.3 Skorlama / Konf Hesaplarının Standardizasyonu

**Genişletilmesi Gereken Detaylar:**
- Confidence iki eksene ayrılmalı: **Data coverage confidence** (hangi modalite var/yok, SNR, eksik tablolar) ve **Chemical plausibility confidence** (SMILES→beklenti→spektrum tutarlılığı).
- Methyl/vinylic/aromatic alt metriklerin “beklenti” tarafı graph tabanlı olmalı (şu an heuristic).
- Aynı veriyle farklı “explain” çıktıları üretilmemeli; confidence breakdown “neden düştü” her zaman rule referansı ile izlenebilir olmalı.

**Dosya / Modül:**  
`Spectrotester/src/core/verify/scoring.ts`; HTML’deki confidence ağırlıklı birleşim; coverage_report vs final PASS/WARN/FAIL ayrımı.

### 3.4 Root Cause Analizinin “Patch Üretir” Seviyeye Çıkması

**Genişletilmesi Gereken Detaylar:**
- **RootCauseAnalyzer → PatchPlan** üretimi: param değişikliği (ppm_tol, d1, noise model), eksik modalite önerisi (“HSQC ölç”), veri bütünlüğü (“peak table eksik”).
- Patch’ler schema ile uyumlu (autofix); rapor çıktısında **patch_recommendations** yapısal olarak doldurulmalı.

**Dosya / Modül:**  
`lib/verification/constants.ts` (ROOT_CAUSE_RECOMMENDED_ACTIONS); yeni: `Spectrotester/src/core/verify/patchPlanner.ts`; teyit_raporu_schema `patch_recommendations`.

---

## 4. VERIFICATION LIBRARY (PRIORS) KAPSAMI

### 4.1 Priors’ları “Sadece min/max”tan “Dağılım + Koşul + Kaynak”a Taşıma

**Genişletilmesi Gereken Detaylar:**
- Her prior objesine: **distribution** ("uniform" | "normal" | "mixture"), **mean**, **sd** (normal ise), **conditions** (solvent, temp, concentration, pH), **confidence** (0–1), **references** (doi/url), **examples** (tipik molekül örnekleri).

**Dosya / Modül:**  
`verification_library_schema.json`, `verification_library_seed.json`; verification_library_schema_v2.json ile uyumlu genişletme.

### 4.2 Eksik / Doldurulması Gereken Bloklar

| Blok | İçerik Artışı |
|------|----------------|
| **peakshape_priors** | Lorentz/Gauss/Voigt oranları; linewidth (Hz) dağılımları (1H/13C ayrı) |
| **solvent_shift_offsets** | DMSO vs CDCl3 sistematik δ offset tabloları (FG bazlı) |
| **noise_model_priors** | lowSNR senaryolarında peak detection recall/precision prior’ı |
| **fragmentation_rules_ms** | Nötr kayıplar + motif frag’ları (HTML’deki loss families ve context presets JSON’a taşınmalı) |
| **2d_expected_connectivity_priors** | HSQC: 1 bond; HMBC: 2–3 bond; COSY: 2–3 bond; NOESY: <5Å |

**Dosya / Modül:**  
`Spectrotester/lib/spectra/library/verification_library_seed.json` (ve şema); HTML’deki sabitlerin bu bloklara taşınması.

---

## 5. COVERAGE MATRIX VE SEED DATASET

### 5.1 Kategori ve Alt Kategori Genişletmesi

**Genişletilmesi Gereken Detaylar:**
- Kategori başına **minimum seed sayısı** (örn. 20); subcategory hedefleri: Aromatic (mono/ortho/meta/para + heteroaromatik), Carbonyl (ester/amide/ketone/acid + aldehyde), Halogen (F/Cl/Br/I + multi-halogen), Exchangeable (phenol, amide NH, carboxylic acid, thiol), Overlap hard (sugar, steroid, polymer-like), No_2d_or_low_snr (“2D yok” + “SNR düşük” ayrı alt kategoriler).
- **Scenario profiles** (dosyada yok → eklenmeli): 400 MHz DMSO, 400 MHz CDCl3, 600 MHz CDCl3; lowSNR varyantları; short d1 (13C) varyantı.

### 5.2 validateCoverage Genişletmesi

**Genişletilmesi Gereken Detaylar:**
- HTML’deki `validateCoverage` kernel.groups üzerinden aromatic/carbonyl/exchangeable sayıyor; bu mantık **graph tabanlı kernel** ile daha doğru hale getirilmeli.
- Her ana kategori için en az 20 seed; her subcategory hedefi otomatik ölçülmeli; CI’da **missing_categories** raporu çıkmalı.

**Dosya / Modül:**  
`Spectrotester/lib/spectra/library/coverage_matrix.json`; HTML veya core’da validateCoverage; CI script’i.

---

## 6. SMOKE TESTLER → GERÇEK REGRESYON TEST SUITE

**Genişletilmesi Gereken Detaylar:**
- **Smoke test paketleri:** SMILES parse & canonicalization; Aromatic perception (Kekulé vs aromatic); 13C relaxation senaryosu (short d1 → carbonyl missing WARN); HSQC match ratio (graph-first); IR carbonyl band required; MS isotope halogen signature; Solvent impurity removal (CDCl3 7.26 vs sample aromatic).
- Her **rule_id** için en az 2 test: PASS case + FAIL case.
- Her bug fix için “repro → golden” test zorunluluğu.

**Dosya / Modül:**  
`Spectrotester/scripts/run_smoke_tests.mjs` (genişletme); `smoke_tests_hmbc_alpha_h_gating.json`; yeni: `smoke_tests_aromatic.json`, `smoke_tests_c13_relaxation.json`, `smoke_tests_hsqc.json`, vb.; `run_core_smoke.mjs` (mevcut) ile entegrasyon.

---

## 7. RAPORLAMA / İZLENEBİLİRLİK

**Genişletilmesi Gereken Detaylar:**
- **artifact_hashes:** input peak table hash, config hash, library hash, ruleset hash (mevcut core’da kısmen var; tümü standartlaştırılmalı).
- **engine_used:** engine name + version + git commit.
- **trace:** Rule evaluation adımları (hangi evidence ile fail etti).
- **export:** JSON + PDF + “minimal repro” blob.
- Bir rapor “tek başına” debug edilebilir olmalı: aynı input + aynı hashes → aynı sonuç.

**Dosya / Modül:**  
`Spectrotester/src/core/verify/report.ts`; `teyit_raporu_schema.json`; export modülü (PDF/minimal repro).

---

## 8. ÜRÜNLEŞME (COMPLIANCE + GÜVENLİK + ENTEGRASYON)

**Genişletilmesi Gereken Detaylar (yüksek seviye):**
- **Kullanıcı/rol (RBAC)**; **Audit trail** (kim neyi teyit etti); **Elektronik imza** (Part 11 uyumu); **Data retention & immutability**; **On-prem / air-gapped deploy** opsiyonu.

**Dosya / Modül:**  
Backend/auth servisleri; veritabanı şemaları; deployment dokümantasyonu.

---

## 9. CORE MODÜLÜ ÖZELİNDE GENİŞLETME / DETAY / İÇERİK ARTIRIMI

### 9.1 Mevcut Core Yapısı (Referans)
- `graph/`: parseSmiles, features  
- `library/`: loadLibrary, loadRules, schemas, nodeLoader  
- `verify/`: evaluateRules, scoring, report  
- `util/`: hash, seed, timers  
- `engine.ts`, `index.ts`

### 9.2 Eklenecek / Detaylandırılacak Modüller
| Modül | Genişletme | Detay | İçerik Artışı |
|-------|-------------|-------|----------------|
| **graph/parseSmiles** | apiBase + precomputedGraph (var) | RDKit/OpenBabel fallback; GLOBAL_PARSE fail’de FATAL dönüş | Hata mesajları ve root_cause kodları genişletilmeli |
| **graph/features** | CH3/CH2/CH, exchangeable (var) | Simetri sınıfları; sp2/aromatic ayrımı güçlendirilmeli | Ring size, heteroatom sayıları, fonksiyonel grup bayrakları |
| **graph/symmetry** | Yok | Yeni: equivalence class, expected_unique_carbons/protons | Otomorfizm hesabı (kütüphane veya basit heuristic) |
| **library/schemas** | Minimal rule/report (var) | Ajv ile tam JSON Schema doğrulama (verification_library, ruleset, teyit_raporu) | Tüm şema dosyalarına karşı validate; hata path’leri |
| **predict/** | Yok | predict1H, predict13C, predictHSQC, predictCOSY, predictHMBC, predictIR, predictMS | Her biri library priors + graph features kullanacak |
| **verify/evaluateRules** | DBE + pass-through (var) | Tüm ruleset kurallarının gerçek değerlendirmesi; prerequisite ve threshold kullanımı | Evidence capture; rule_version, autofix çıktıya |
| **verify/scoring** | aggregateScoring (var) | İki eksenli confidence; coverage vs final karar ayrımı | Modül ağırlıkları; data_completeness vs chemical_plausibility |
| **verify/patchPlanner** | Yok | Root cause → PatchPlan; autofix ile birleşik | Patch şeması ve rapor alanı |

### 9.3 HTML (Spectromasterv0.2tester) Tarafında Düzeltmeler
- **HSQC:** “OH/NH exchange” açıklaması sadece gerçek exchangeable H için; CH/CH2 boşluğu için kullanılmamalı.
- **Methyl:** CH3 beklentisi sadece grafta CH3 varken; QC_METHYL_CLASS_MISSING CH3 içermeyen moleküllerde tetiklenmemeli.
- **Sp2/Vinylic:** expected_sp2_C graph tabanlı; 13C 100–160 dağılımı sp² ile uyumlu; “vinylic” etiketlemesi doğru sınıftan.
- **Coverage vs final:** Coverage score ile final PASS/WARN/FAIL ayrımı; “Score 91 ama FAIL” çelişkisinin UI metni ile giderilmesi.

---

## 10. DEBUG CHECKLİSTİ (KAPSAM GENİŞLETME İLE ENTEGRE)

Aşağıdaki checklist CI + manuel debug akışına eklenmeli; her madde “detaylandırılması gereken” bir kontrol noktasıdır.

1. **Input doğrulama:** SMILES trim/canonicalize geçti mi? Formula/DBE tutarlı mı?  
2. **Kernel doğrulama:** aromaticC > 0 bekleniyor mu (graph)? carbonyl/nitrile/halogen/exchangeable doğru mu?  
3. **1H üretim kontrolü:** δ dağılımı solvente mantıklı mı? integral = atom sayımı ile uyumlu mu? multiplet/J’ler komşulukla uyumlu mu?  
4. **13C üretim kontrolü:** carbonyl varsa 160–220 var mı? aromatic varsa 110–160 bandı dolu mu? d1 kısa senaryoda “WARN ama açıklamalı” mı?  
5. **2D kontrol:** HSQC’de protonlu C sayısı kadar crosspeak bekleniyor mu? HMBC’de carbonyl varsa 2–3 bond korelasyon var mı? COSY vicinal ağ mantıklı mı?  
6. **MS/IR kontrol:** adduct en az 1 match var mı? halojen varsa M+2 pattern var mı? karbonil varsa IR band var mı?  
7. **Rapor tutarlılığı:** coverage report vs teyit modül sayımları çelişiyor mu? root cause → evidence alanları dolu mu? artifact_hashes + trace mevcut mu?

---

## 11. ÖNCELİK SIRASI (EN HIZLI DEĞER → EN ÇOK RİSK AZALTMA)

1. SMILES→graph + aromatic canonicalization (kırılgan regex’leri kaldır)  
2. Graph-first HSQC/HMBC/COSY üretimi ve teyidi (2D tutarlılık)  
3. 13C / 1H shift priors + solvent offset + line shape (peak list kalitesi)  
4. MS isotope + IR band rule’ları ruleset’e resmi ekleme  
5. Coverage matrix senaryoları + seed dataset büyütme  
6. Smoke/regression CI  
7. Audit/trace/artifact hash  
8. Ürünleşme (RBAC, audit, Part 11)

---

**Doküman sonu.**  
Bu liste, kodun genişletilmesi, detaylandırılması ve içerik miktarının artırılması gereken tüm alanları kapsar; her başlık altında neden, nasıl ve ne kadar (kabul kriteri / içerik artışı) belirtilmiştir.
