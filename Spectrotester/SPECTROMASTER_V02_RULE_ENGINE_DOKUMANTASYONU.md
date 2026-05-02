# SpectroMaster v0.2 Tester - Kural Motoru Dokumantasyonu

Bu dokuman, `Spectromasterv0.2tester.html` icindeki kural motorlarini ve dogrulama akislarini bastan sona teknik olarak aciklar. Odak, "uretim + teyit + veto + guven skoru" zinciridir.

## 1) Genel Mimari

Sistem iki ana katmanda calisir:

1. **Yapi/Kimya Kernel Katmani (`SpectroMasterKernel`)**
  - SMILES temizleme, atom sayimi, fonksiyonel grup cikarimi, DBE, H dagilimi, formul ve kalite kontrolleri.
2. **Spektral Teyit Katmani (`runVerification`)**
  - 1H, 13C, HSQC, COSY, HMBC, NOESY, MS, FT-IR modullerini dogrular.
  - Kural motoru (`evaluateAll`) ve yapisal veto kurallari birlikte calisir.
  - Sonunda `status`, `confidence_score`, `root_cause`, `veto_flags` ve `recommendations` uretilir.

## 2) Kernel Icindeki Kural Motorlari

### 2.1 SMILES On-Isleme Kurallari

- `preprocessSMILES`:
  - bosluk temizleme
  - tuz/fragments ayirma (`.` varsa en buyuk parcayi secme)
  - izotop temizleme (`[13C] -> C`)
- `aromatizeSMILES`:
  - Kekule kaliplarini aromatik notasyona ceviren pattern tabanli duzeltmeler
  - aromatik indeks hesaplama (lowercase aromatik + kekule fallback)

### 2.2 Molekul Grafi Kurallari

- `computeMolGraph(smiles)`:
  - SMILES'tan mininal baglantisal graf olusturur.
  - Aromatik halka, vinylic C, karbonil, CH3/CH2/CH/Cq sayimi yapar.
  - Ring closure + BFS tabanli halka yakalama uygular.
- `computeGraphFeaturesFromGraph(mg)`:
  - Parse API'den gelen graph'tan "tek dogru kaynak" ozellikleri cikarir.
  - Aromatik C/H, karbonil C, degisebilir H, nitril, halojen gibi metrikleri uretir.

### 2.3 Baglam (Context) Secim Kurallari

- `detectContext`:
  - baglamlar: `SMALL_MOLECULE`, `GLYCOPEPTIDE`, `TAXANE`, `MACROLIDE`, `POLYPHENOL`, `PEPTIDE`, `GENERAL`
  - hard precondition + skor hibridi kullanir.
  - C/N/O/aromatik/ring/fonksiyonel grup threshold'lariyla context secer.

### 2.4 Fonksiyonel Grup Kurallari

- `detectDetailedFunctionalGroups`:
  - regex + baglam + graph duzeltmeleri ile ester/amide/ketone/aldehyde/acid/lactone vb.
  - ozel guardrail'ler:
    - aromatik C tespiti (kekule fallback)
    - alkene sayiminda aromatik dislama
    - methoxy sayiminda cyclic ether veto
    - context bazli minimum grup zorlamalari (taxane/glycopeptide/macrolide)

### 2.5 Hidrojen Modeli Kurallari

- `estimateHydrogenModel`:
  - valence yaklasimi + context template (buyuk molekuller icin)
  - parity duzeltmesi (tek parity ise H+1)
- `partitionHydrogens`:
  - degisebilir protonlar icin sert veto mantigi:
    - nitrile, nitro, tertiary amine, aromatic N durumlarinda NH/OH azaltma
  - solvent faktorleri:
    - `D2O/CD3OD`: degisebilir protonu sifira ceker
    - `DMSO-d6`: gorunurluk artisi

### 2.6 DBE ve Sanity Kurallari

- DBE formul bazli hesap: `C + 1 - H_eff/2 + N_eff/2`
- `kernelSanityChecks`:
  - negatif DBE, anormal H, C=0, parity tutarsizligi, context-group uyumsuzlugu uyarilari.

## 3) Kurallarin Veri Kaynaklari

Kural motoru su kutuphaneleri kullanir:

- `VERIFICATION_CONFIG`
- `PASS_CRITERIA_REFERENCE`
- `VERIFICATION_RULESET` (harici `lib/spectra/library/ruleset.json` ile override olabilir)
- `FP_RULES` (SMILES'e ozel fingerprint zorunluluklari)
- `NMR_ANALYSIS_RULES` (HSQC/COSY/HMBC/aromatik analizi)
- `IR_band_priors`, `MS_adduct_rules`, `isotope_rules`
- `SOLVENT_DB`, `COMMON_IMPURITIES`, `solvent_impurity_catalog`

## 4) Moduler Dogrulama Motorlari

### 4.1 `verify13C`

Temel kurallar:

- C beklenen vs bulunan sinyal sayisi
- simetri toleransi (`getC13MinExpected`, `symmetryScore`)
- overlap toleransi (`getOverlapTolerance`)
- zorunlu bolgeler:
  - karbonil: 160-220 ppm
  - nitril: 115-125 ppm
- ciktilar:
  - `status`, `notes`, `recommendations`
  - `expectation_model`, `relaxation_risk`, `aromatic_redundancy`

### 4.2 `verifyMS`

Kurallar:

- adduct match (`[M+H]+`, `[M+Na]+`, `[M+K]+` vb.)
- ppm toleransi
- halojen varliginda M+2 izotop paterni kontrolu (Cl/Br)
- durum:
  - en az bir adduct uyumu -> PASS
  - fragment var ama parent yok -> WARN
  - uyum yok -> FAIL

### 4.3 `verifyIR`

Kurallar:

- yapidan beklenen bantlarin cikarimi (nitrile/carbonyl/OH-NH/aromatik/C-H vb.)
- beklenen-farkli bant kapsama hesabi (`ftir_expected_coverage`)
- requirement matrix ile HARD/SOFT karar:
  - ornek: karbonil bandi yapida varsa HARD

### 4.4 `verify1H`

Kurallar:

- integral toplami (degisebilir protonlar dislanarak)
- integral normalize denemesi (`normalizeIntegrals`)
- ppm pencere tutarliligi
- fingerprint kurallari (`FP_RULES.mustHave/forbidden`)
- J-coupling outlier kontrolu

### 4.5 `verifyMultiplicityConsistency`

Yapi-cokluk iliskisi:

- quartet icin en az 1 adet CH3 esdegeri
- septet icin en az 2 adet CH3 esdegeri
- ethyl t+q desen mantigi
- solvent overlap ve dinamik averaging durumunda gevsetme

## 5) Merkezi Rule Engine

### 5.1 `checkPrerequisites`

Her rule calismadan once context'te gerekli alanlarin olup olmadigini kontrol eder.

### 5.2 `executeRule`

`rule_id` tabanli dispatcher:

- `FORMULA_DBE_NEGATIVE_FATAL`
- `FORMULA_H_FRACTIONAL_OR_NEGATIVE_FATAL`
- `DBE_PARITY`
- `H1_INTEGRAL_TOTAL`
- `COSY_EXPECTATION_ALL_SINGLET`
- implement edilmemis rule -> `INFO`

### 5.3 `evaluateAll`

- rule listesini dolasir
- `FATAL/ERROR` -> `vetoFlags`
- `WARN` -> warnings listesi
- skor:
  - WARN: -2
  - ERROR: -10
  - FATAL: 0'a indirir

## 6) `runVerification` Icindeki Ana Karar Akisi

1. Giris ve kernel kontrolu
2. library coverage / fingerprint coverage raporu
3. formul + DBE analizi
4. sanitization:
  - `sanitizeSpectrum`
  - `filterSolventPeaks`
5. simetri:
  - `SymmetryDetector`
  - `symmetryReduction`
6. moduller:
  - 13C -> 1H -> HSQC -> COSY -> HMBC -> NOESY -> MS -> FTIR
7. `evaluateAll` sonucunu veto/warning havuzuna ekleme
8. yapisal veto kurallari (asagidaki bolum)
9. severity enrichment + root cause + confidence decomposition
10. final status + score + rekomendasyonlar

## 7) Yapisal Veto Kurallari (Kritik)

`runVerification` icinde rule-engine disinda bir "sert veto katmani" daha vardir:

- `VETO_C13_CARBONYL_STRUCTURE`  
Yapida C=O yokken 13C'de 160-220 ppm gorulurse.
- `VETO_IR_CARBONYL_STRUCTURE`  
Yapida C=O yokken IR'de 1650-1800 cm-1 bandi.
- `VETO_IR_OH_NH_STRUCTURE`  
Yapida OH/NH yokken IR 3200-3600 cm-1 bandi.
- `VETO_H1_AROMATIC_INTEGRAL`  
Aromatik yapi var ama 6-9 ppm integral beklenen aromatik H'den dusuk.
- `VETO_HMBC_CARBONYL_STRUCTURE`  
Yapida karbonil yokken HMBC'de karbonil atamasi.
- `VETO_C13_TFA_ALIPHATIC`  
TFA-benzeri yapida alifatik CH atamasi yapilmasi.
- `VETO_H1_SATURATED_HC_ABOVE_45` ve `VETO_H1_HC_SATURATED_ABOVE_45`  
Doymus hidrokarbonlarda 4.5+ ppm protonlar.
- `VETO_DBE0_AROMATIC_ALDEHYDE`  
DBE=0 iken aromatik/aldehit bolgesi sinyali.
- `VETO_DBE0_C13_CARBONYL`  
DBE=0 iken 13C karbonil bolgesi (sugar-like istisna WARN).
- `C13_OBLIGATORY_FEATURE_MISSING`  
Yapida karbonil/nitril varken 13C zorunlu bolge bos.
- `VETO_H1_LOW_HC_MISSING_UNSATURATED`  
H/C dusukse doymamis bolgelerden en az biri zorunlu.
- `H1_MULTIPLICITY_INCONSISTENT`  
quartet/septet yapisal zorunluluklari ihlali.
- `VETO_H1_NITRILE_ACID_REGION`  
nitrilde 10-14 ppm asidik bolge sinyali.
- `VETO_H1_CHCL3_SINGLET`  
CHCl3 icin ~7.26 ppm singlet zorunlulugu.
- `VETO_H1_ALDEHYDE_MISSING`  
aldehit varsa 9.3-10.5 ppm zorunlu.
- `VETO_H1_COOH_MISSING`  
asit varsa 10.5-13.8 ppm zorunlu.

## 8) HSQC/COSY/HMBC Ozel Karar Mantigi

### HSQC

- protonlu karbon beklenip HSQC verisi yoksa FAIL.
- eksik korelasyonlar nedenlendirilir:
  - low_SNR
  - fast_exchange
  - heteroatom_proton
  - adjacent_quaternary
  - electronegative_attachment
- overlap softening ile tekil eksikler yumusatilir.

### COSY

- tum protonlar singlet ise COSY yoklugu PASS.
- coupled proton varken COSY yoksa WARN.
- aromatic ortho/geminal beklentileri notlara yazilir.

### HMBC

- karbonil (ester/keton/amide) icin HMBC beklentisi.
- alpha-H yoksa karbonil HMBC zorunlulugu yumusatilir.
- nitril icin HMBC opsiyonel.

## 9) MCA (Meta-Cognitive Architecture)

Ek katmanlar:

- `RootCauseAnalyzer`:
  - sorunlari 4 sinifa ayirir:
    - DATA_MISSING
    - SYMMETRY_ARTIFACT
    - SCIENTIFIC_CONFLICT
    - THRESHOLD_FRICTION
- `SeverityGrader`:
  - baglama gore hata ciddiyeti ve penalty belirler.
- `ConfidenceDecomposer`:
  - modullere dinamik agirlik verir:
    - default: 1H 0.3, 13C 0.3, MS 0.2, 2D dagitimi
    - izomer vakasi: 1H agirligi artar
    - halojen vakasi: MS agirligi artar
- `AutoRuleSuggester`:
  - FAIL pattern'lerinden yeni kural genisletme onerileri uretir.

## 10) Sonuc Uretim Formati

`runVerification` donusu su ana alanlari icerir:

- `status`, `overall`, `summary`
- `confidence_score`, `ChemScore`, `DataScore`
- `modules` (her modalitenin detayli sonucu)
- `veto_flags`, `warnings`, `root_cause_analysis`, `root_cause`
- `library_coverage_report`, `missing_library_items`, `patch_recommendations`
- `dbe_interpretation`, `confidence_breakdown`, `suggestions`
- `provenance`, `rule_fired`, `feature_snapshot`

## 11) Kural Motorunun Operasyonel Ozetleri

- Sistem, yalniz tek bir check'e degil, **coklu modalite ve coklu seviye kural katmanina** dayanir.
- `evaluateAll` genel policy engine iken, `runVerification` icindeki structural veto katmani kimyasal tutarlilik icin ek emniyet kemeri gibidir.
- Simetri, overlap, exchangeable proton, solvent artefakti gibi NMR gercek hayat durumlari icin yumusatici heuristikler vardir.
- Buna ragmen yapisal celiskilerde sert veto uygulanir ve skor tavanlanir (`FAIL/PARTIAL` icin score cap).

## 12) Bu Dosyadaki Kural Motorlarinin En Kritik Noktalari

1. **Rule engine cift katmanli:** `evaluateAll` + yapisal vetolar.
2. **13C ve 1H zorunlu bolge mantigi:** karbonil/nitril/aromatik/aldehit/COOH.
3. **MCA ile baglama duyarlilik:** ayni hata farkli baglamda farkli siddet.
4. **Data sanitization gercekligi:** solvent/impurity/noise filtrelemesi dogrulamadan once yapilir.
5. **Coverage bilinci:** kutuphane eksiginde sonucu `INCONCLUSIVE`a cekebilen mekanizma var.

---

Bu dokuman dogrudan `Spectromasterv0.2tester.html` icindeki kural motoru kodunun analizinden uretilmistir.