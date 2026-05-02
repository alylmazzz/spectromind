# SpectroMind / SpectroMaster Validation Upgrade OS
## OMNISCIENT MASTER PROMPT — Uygulanabilir Mühendislik Planı

**Versiyon:** 1.0.0 | **Tarih:** 2025-02-04 | **Deterministik • Rule-Engine • Production-Ready**

---

## 1) Executive Summary (15 Madde)

1. **Aromatik integral parse hatası (P0):** `parseInt(String(s.integ).replace(/\D/g, ""), 10)` ondalık integral bozuyor; `parseIntegForAromatic` ile parseFloat tabanlı çözüm uygulanmalı. [Evidence: Audit raporu, Spectromasterv0.2tester.html ~16490]

2. **VETO_H1_AROMATIC_INTEGRAL yanlış pozitif:** Parse hatası + exchangeable OH/NH 6–9 ppm bölgesinde; Symmetry Correction Factor ve exchangeable exclusion ile düzeltilmeli.

3. **Symmetry Correction Factor:** Benzen, aseton, p-ksilen, THF vb. simetrik moleküllerde C_found < C_expected normal; `symmetryFactor = f(aromaticC, groups.ester, ringCount)` ile beklenen C sayısı düşürülmeli. [Evidence: SPECTROMASTER_MIMARI_VE_KURALLAR 9.3]

4. **Değişebilir proton mantığı:** OH/NH integral 0.1–0.6 simülasyonu; `exchInteg = 0.5 + rnd()*0.5` + integral check’ten hariç tutma. Çözücüye göre ppm aralıkları: CDCl3 4–12, DMSO 3–11, CD3OD 3.5–10. [Varsayım A1: exclude_exchangeable_from_integral_check=true]

5. **13C karbonil 160–220 ppm eksik:** Peak picking threshold / relaxation delay (d1) varsayımı; `d1_13c_sec` metadata ile eşik ayarlanmalı. d1<2s → quaternary eksikliği WARN, >5s → FAIL. [Varsayım A2]

6. **HSQC düşük atama (%33–40):** Overlapping sinyaller + exchangeable; overlap-aware scoring + missingness flag. `expectedHsycCorr = CH_count - exchH`; ratio = found/expectedHsycCorr. [Varsayım A3]

7. **NOESY boş:** SMALL_MOLECULE’da cfg.noesy.onlyIfMacroOrGlyco → skip. "NOT_PROVIDED" vs "PARSER_FAIL" ayrımı zorunlu; veri yoksa uydurma yok. [Varsayım A4]

8. **IR aromatik bant 1450–1600 "gözlenmedi":** IR_band_priors Ar C=C zayıf; SDBS/NIST referanslı kalibrasyon + intensity threshold 0.15 (medium). [Varsayım A5]

9. **FP_RULES kapsamı:** 40 molekülün çoğunda fingerprint yok; GOLDEN_EXPECTATIONS_30.json → FP_RULES pipeline. Coverage stratejisi: önce 30 golden, sonra NATURAL_PRODUCTS.

10. **Skorlama iki katman:** ChemScore (yapısal tutarlılık) + DataScore (modalite var/yok, SNR). HardVeto → FAIL; DataScore<50 → NEEDS_REVIEW. [Evidence: SPECTROMIND_THREE_AXES_AND_PHASE2_SPEC 1.3]

11. **Experiment Metadata katmanı:** nmr_field_mhz, solvent, temperature_c, d1_13c_sec, snr_estimate, peakpick_mode. Metadata yoksa varsayılan (CDCl3, 400 MHz, d1=2). [BLOCKER: UI’dan metadata girişi]

12. **GNN fallback:** Karmaşık çekirdeklerde (C>25, doğal ürün) rule-engine belirsizse GNN devreye girer. Guardrail: GNN skoru veto override edemez; sadece INFO/WARN öneri. [Alt-A3: missingness-aware scoring]

13. **Determinizm:** seed pinleme, rng_version (mulberry32-v1), FP_RULES hash, VERIFICATION_CONFIG hash. Aynı girdi + seed + sürüm → ±0.01 skor toleransı.

14. **False-pass önleme:** NEEDS_REVIEW state; belirsizse PASS verme. Aromatik integral veto yanlış pozitif ≤5% (golden set). HSQC recall ≥70% (overlap-aware).

15. **Test harness:** GOLDEN_EXPECTATIONS_30.json 30 molekül + 10 regression senaryosu. CI: her PR’da golden set çalıştır; veto/score değişimi FAIL.

---

## 2) Hata Analizi → Kök Neden Haritası

| Hata Kodu / Bulgu | Kök Neden | Kanıt | Öncelik | Aksiyon |
|-------------------|-----------|-------|---------|---------|
| VETO_H1_AROMATIC_INTEGRAL | CODE_BUG (parse) | parseInt replace ondalık bozuyor | P0 | parseIntegForAromatic |
| H1_INTEGRAL_TOTAL / MISMATCH | LOGIC_BUG (broadContrib) | v>=0.5 ? v : 1 tutarsız | P1 | Exchangeable politika |
| 0.x integralli protonlar | DESIGN (simülasyon) | exchInteg 0.1–0.6 | P1 | exchInteg 0.5–1.0 |
| QC_C13_COUNT_LOW (simetrik) | RULE_DESIGN | Simetri faktörü yok | P2 | Symmetry Correction Factor |
| QC_HSQC_LOW_ASSIGNMENT | DATA_QUALITY + THRESHOLD | Overlap, exchangeable | P2 | overlap-aware scoring |
| WARN_FTIR Ar C=C | THRESHOLD + LIBRARY_GAP | Band detect threshold yüksek | P2 | IR_band_priors kalibrasyon |
| LIBRARY_FINGERPRINT_NOT_FOUND | LIBRARY_GAP | FP_RULES eksik | P3 | FP_RULES genişletme |
| NOESY boş | RULE_DESIGN | onlyIfMacroOrGlyco | P3 | NOT_PROVIDED vs PARSER_FAIL |
| C13_OBLIGATORY_FEATURE_MISSING | THRESHOLD / PEAK_PICK | d1 quaternary kaybı | P2 | d1_13c_sec metadata |
| MS 13C adduct ppm veto | THRESHOLD | İzotop peak ppm yüksek | P2 | 13C adduct exclude |

---

## 3) Mimari: Validation Engine vNext

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Validation Engine vNext                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Girdi: SMILES, h1[], c13[], ms[], ir[], corr{}, experiment_metadata{}      │
│         seed, config_version                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Kernel + MoleculeGraph (structure-grounded)                              │
│     - parseAtomCounts, detectDetailedFunctionalGroups                        │
│     - [vNext] Ring perception, shortestPath, substituent positions           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. Experiment Metadata Resolver                                             │
│     - Default: CDCl3, 400 MHz, d1=2s                                         │
│     - Override: nmr_field_mhz, solvent, d1_13c_sec, snr_estimate             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. Modül Doğrulamaları (paralelizable)                                      │
│     ┌─────────┐ ┌─────────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌────┐ ┌────┐     │
│     │ verify1H│ │verify13C│ │verify │ │verify │ │verify │ │MS  │ │IR  │     │
│     │+exch    │ │+symmetry│ │HSQC   │ │COSY   │ │HMBC   │ │    │ │    │     │
│     └────┬────┘ └────┬────┘ └───┬───┘ └───┬───┘ └───┬───┘ └─┬──┘ └─┬──┘     │
│          │           │          │         │         │       │      │         │
│          └───────────┴──────────┴─────────┴─────────┴───────┴──────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. Veto / Override Katmanı                                                  │
│     HARD_VETO → FAIL (override: false)                                       │
│     SOFT_FAIL → Score penalty                                                │
│     WARN → Notes                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. Skorlama Katmanı (ChemScore + DataScore)                                 │
│     ChemScore = f(modül sonuçları, DBE, motif)                               │
│     DataScore = f(modalite var/yok, SNR, coverage)                           │
│     FinalScore = w1*ChemScore + w2*DataScore                                 │
│     HardVeto → status=FAIL                                                   │
│     DataScore<50 & no HardVeto → NEEDS_REVIEW                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. Çıktı: Teyit Raporu                                                     │
│     status, overall, ChemScore, DataScore, veto_flags, evidence[],           │
│     root_cause_analysis, traceId, seed, config_hash                          │
└─────────────────────────────────────────────────────────────────────────────┘

State Machine: INIT → MODULES → VETO → SCORE → (PASS | FAIL | NEEDS_REVIEW)
```

---

## 4) Algoritma & Kural Motoru Tasarımı

### 4.1 1H NMR
- **Problem Statement:** Aromatik integral parse hatası ve exchangeable 0.x integral tutarsızlığı VETO_H1_AROMATIC_INTEGRAL yanlış tetikliyor.
- **Evidence:** Audit raporu; Spectromasterv0.2tester.html ~16490 parseInt; ~15541 broadContrib; ~4079 exchInteg.
- **Proposed Fix:** parseIntegForAromatic; exclude_exchangeable_from_integral_check; broadContrib tutarlı politika.
- **Algorithm:** Bölüm 5, 6.
- **Data Requirements:** h1[].integ (string/number), h1[].is_ex, h1[].ppm, solvent metadata.
- **Determinism Notes:** parseIntegForAromatic deterministik; rnd() sadece simülasyonda, verify'da yok.
- **Acceptance Criteria:** VETO_H1_AROMATIC yanlış pozitif ≤5%; fenol/aspirin PASS veya WARN (FAIL değil).
- **Failure Modes:** (1) Parse başarısız → WARN; (2) Çözücü pik yanlış etiketlenir; (3) Overlap integral fazla sayar; (4) D2O exchange flag yoksa OH integral belirsiz; (5) Solvent metadata yanlış.
- **Tests:** Unit: parseIntegForAromatic("0.547")=0.547, ("4H")=4. Integration: fenol, aspirin golden. Golden: M006, M009.

### 4.2 13C NMR
- **Problem:** Simetri ile C_found < C_expected; karbonil 160–220 ppm eksik.
- **Proposed Fix:** Symmetry Correction Factor; d1_13c_sec metadata ile quaternary beklentisi.
- **Algorithm:** [Bölüm 7]
- **Thresholds:** c13_symmetry_floor_ratio=0.5; d1_quaternary_threshold_sec=2.
- **Failure Modes:** (1) Simetri yanlış tespit; (2) d1 metadata eksik; (3) Overlap sinyali iki karbon sayılır; (4) DEPT eksik; (5) SNR düşük quaternary kaybı.

### 4.3 2D NMR (HSQC/HMBC/COSY)
- **Problem:** HSQC düşük atama; overlap; exchangeable CH.
- **Proposed Fix:** expectedHsycCorr = CH_count - exchH; overlap-aware ratio.
- **Algorithm:** ratio = min(1, foundCorr / max(1, expectedHsycCorr)); ratio<0.6 → WARN.
- **Thresholds:** hsqc_ratio_warn=0.6; overlap_bonus=0.1 (found+overlap_count).
- **Failure Modes:** (1) CH_count yanlış; (2) Exchangeable CH sayılmamalı; (3) Veto aşırı sık; (4) Parser crosspeak kaybı; (5) ppm tolerance geniş çakışma.

### 4.4 IR
- **Problem:** Ar C=C 1450–1600 "gözlenmedi".
- **Proposed Fix:** IR_band_priors kalibrasyon; intensity threshold 0.15.
- **Algorithm:** [Bölüm 9]
- **Thresholds:** band_tolerance_soft=25 cm⁻¹; intensity_min=0.15.
- **Failure Modes:** (1) Baseline yanlış; (2) Overlap band; (3) Heterosiklik farklı bölge; (4) Solvent band bastırma; (5) Prior tablosu eksik.

### 4.5 MS
- **Problem:** 13C adduct ppm veto; izotop M+2.
- **Proposed Fix:** 13C adduct ppm veto hariç; require_isotope_pattern Cl/Br için.
- **Algorithm:** Ana [M+H]+/[M+Na]+ ppm ≤ ms_ppm_veto; 13C peak ayrı rapor.
- **Thresholds:** ms_ppm_match=5, ms_ppm_veto=10.
- **Failure Modes:** (1) Adduct yanlış seçilir; (2) Matrix etkisi; (3) M+2 oranı sapması; (4) Formül ambiguity; (5) Resolution yetersiz.

---

## 5) Symmetry Correction Factor

### Tanım
Simetrik moleküllerde 13C sinyal sayısı formül karbon sayısından az olabilir (örn. benzen 6C → 1 peak, aseton 3C → 2 peak).

### Matematik
```
expectedC_symmetric = C_total - symmetry_reduction
symmetry_reduction = sum over groups:
  - aromatic_ring_6: 5 (benzen → 1 peak)
  - methyl_equivalent_3: 2 (3 eşdeğer CH3 → 1 peak)
  - ring_symmetry_4: floor(C_ring/2) (THF 4C → 2 peak)
```
```javascript
// Pseudocode
function symmetryReduction(kernel) {
  let r = 0;
  if (kernel.groups?.aromaticC >= 6) r += 5;  // monosubstituted benzene
  if (kernel.groups?.ester >= 1 && kernel.groups?.ketone >= 1) r += 1;  // acetate
  if (kernel.context === "SMALL_MOLECULE" && /C1CCOC1|C1COCCO1/.test(kernel.smiles)) r += 2;  // THF, dioxane
  return Math.min(r, kernel.counts.C - 1);
}
expectedC = kernel.counts.C - symmetryReduction(kernel);
```

### Örnekler
| Molekül | C_total | symmetry_reduction | expectedC |
|---------|---------|-------------------|-----------|
| Benzen | 6 | 5 | 1 |
| Toluen | 7 | 4 | 3 |
| Aseton | 3 | 1 | 2 |
| THF | 4 | 2 | 2 |
| p-ksilen | 8 | 6 | 2 |

### Edge Cases
- Disubstituted benzene ortho/meta/para farkı; para en simetrik.
- Heteroaromatic (piridin): 5C → 5 peak (simetri yok).
- Lactone/ester: iki eşdeğer O=C-O varsa reduction.

---

## 6) Değişebilir Proton Mantığı

### Çözücüye Göre Dinamik Aralıklar (ppm)
| Solvent | OH/NH ppm (tipik) | COOH ppm |
|---------|-------------------|----------|
| CDCl3 | 4–12 | 10.5–13.8 |
| DMSO-d6 | 3–11 | 11–13 |
| CD3OD | 3.5–10 (exchange hızlı) | 11–12 |
| D2O | — (kaybolur) | — |

### Integral / Assignment Etkisi
- **exclude_exchangeable_from_integral_check:** true (varsayılan). expectedHForIntegral = totalH - exchH.
- **broadContrib:** exchangeable için `min(1, v)` veya `v` (0.5–1.0 aralığında tutarlı).
- **Aromatik 6–9 ppm:** OH (fenol) 4–7 ppm’de olabilir; aromatik integral hesabına OH dahil edilmemeli (ppm>9 veya is_ex=true filtresi).

### Algoritma
```javascript
const exchangeable_ppm_ranges_by_solvent = {
  CDCl3: { min: 4, max: 12, cooh_min: 10.5 },
  "DMSO-d6": { min: 3, max: 11, cooh_min: 11 },
  "CD3OD": { min: 3.5, max: 10, cooh_min: 11 }
};
function isExchangeableInAromaticRegion(s, solvent) {
  if (!s.is_ex) return false;
  const r = exchangeable_ppm_ranges_by_solvent[solvent] || exchangeable_ppm_ranges_by_solvent.CDCl3;
  return s.ppm >= 6 && s.ppm <= 9 && s.ppm < r.cooh_min;  // fenol OH 6-7
}
// Aromatik integral: 6-9 ppm'deki sinyallerden is_ex=true olanları ÇIKAR
h1AromaticIntegral = h1AromaticSignals
  .filter(s => !isExchangeableInAromaticRegion(s, solvent))
  .reduce((sum, s) => sum + parseIntegForAromatic(s.integ), 0);
```

---

## 7) Peak Picking & 13C Karbonil Sorunu

### Eşik / Relaxation Modellemesi
- **d1_13c_sec:** 13C relaxation delay. d1<2s → quaternary karbonlar zayıf/eksik.
- **Kural:** d1<2 → quaternary eksikliği WARN (C13_QUATERNARY_MAY_BE_SUPPRESSED); d1≥5 ve carbonyl expected ama 160–220 ppm boş → FAIL.

### Fix Planı
1. **Metadata:** d1_13c_sec alanı; yoksa 2 varsayılan.
2. **Beklenti:** carbonyl_expected = groups.ester + groups.ketone + groups.amide + groups.aldehyde + groups.acid.
3. **Kural:**
   - carbonyl_expected>0, c13CarbonylRegion.length===0, d1_13c_sec>=5 → VETO_C13_CARBONYL_MISSING
   - carbonyl_expected>0, c13CarbonylRegion.length===0, d1_13c_sec<2 → WARN (relaxation)

### Acceptance Criteria
- 13C carbonyl detection recall ≥90% (d1≥5, golden set).
- d1<2 durumda false veto ≤1%.

---

## 8) HSQC/HMBC/NOESY Entegrasyonu

### Overlap Çözümü
- **Overlap bonus:** Aynı (H_ppm, C_ppm) civarında 2+ crosspeak varsa overlap say; expectedHsycCorr’a ekstra kredi verilmez ama found’a 1 eklenebilir (merged peak).
- **Veto gevşetme:** Overlap bölgesinde strict type veto (CH3 vs CH2) kaldırılabilir; sadece Q veto kalır.

### Missingness-Aware Scoring
```javascript
// NOESY
if (!corr.noesy || corr.noesy.length === 0) {
  if (context === "MACROLIDE" || context === "GLYCOPEPTIDE") {
    status = "WARN"; reason = "NOESY_NOT_PROVIDED_OR_EMPTY";
  } else {
    status = "PASS"; reason = "NOESY_NOT_EXPECTED_FOR_CONTEXT";
  }
} else {
  // parse noesy; PARSER_FAIL vs valid
}
```
- **NOT_PROVIDED:** Veri gelmemiş.
- **PARSER_FAIL:** Veri var ama parse edilemedi.
- **BELOW_SNR:** Crosspeak sayısı < threshold.

---

## 9) IR_band_priors Kalibrasyonu

### Prior Tablosu (SDBS/NIST Referanslı)
| Band | cm⁻¹ | Intensity | Not |
|------|------|-----------|-----|
| C=O ester | 1730–1750 | strong | |
| C=O amide | 1650–1680 | strong | |
| C=O acid | 1700–1725 | strong | |
| Ar C=C | 1450–1600 | medium | **Kalibrasyon: 1480, 1520, 1580** |
| C-H aliphatic | 2850–2960 | medium | |
| OH/NH | 3200–3600 | broad | |
| C≡N | 2210–2260 | medium | |
| S=O sulfoxide | 1020–1070 | strong | |

### Aromatik / Heterosiklik Güçlendirme
- **Piridin:** 1580–1620 Ar C=N; 1430–1480 ring.
- **Furan:** 1500–1550.
- **Tiyofen:** 1400–1450.
- **Intensity threshold:** 0.15 (weak=0.1, medium=0.15, strong=0.25).

### Algoritma
```javascript
function findIRBand(bands, prior) {
  const { min, max, intensity_min = 0.15 } = prior;
  return bands.some(b => b.freq >= min && b.freq <= max && (b.int || 1) >= intensity_min);
}
```

---

## 10) FP_RULES & Dataset Genişletme Planı

### JSON Şeması (FP_RULES Genişletme)
```json
{
  "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O",
  "name": "Aspirin",
  "expectedH": 8,
  "mustHave": [
    { "type": "regionCountAtLeast", "args": { "ppmMin": 6, "ppmMax": 9, "n": 4 }, "message": "Aromatik 4H+", "severity": "WARN" },
    { "type": "peakNear", "args": { "ppm": 2.35, "tolerance": 0.3 }, "message": "Asetil CH3", "severity": "WARN" }
  ],
  "forbidden": [
    { "type": "regionCountAtLeast", "args": { "ppmMin": 10.5, "ppmMax": 13, "n": 0 }, "message": "COOH yok (ester)" }
  ]
}
```

### Coverage Stratejisi
1. **Faz 1:** GOLDEN_EXPECTATIONS_30.json 30 molekül → FP_RULES.
2. **Faz 2:** NATURAL_PRODUCTS modülü (NMRShiftDB, ChEBI).
3. **Faz 3:** In-house curated + kullanıcı önerileri.

### BLOCKER
- GOLDEN_EXPECTATIONS must_have/must_not_have → FP_RULES format dönüşüm scripti gerekli.

---

## 11) GNN Entegrasyonu

### Ne Zaman Devreye Girer
- context = GENERAL veya doğal ürün; C>25; rule-engine confidence < 0.6.
- Sadece **öneri** (INFO/WARN); veto override yok.

### Risk / Guardrails
- GNN false positive → sadece "GNN suggests PASS" notu; karar rule-engine’de.
- Model versiyon + hash raporlanmalı.
- Determinism: GNN inference seed pinleme.

### Doğrulama
- Golden set üzerinde GNN vs rule-engine uyumu ≥85%.
- GNN tek başına PASS vermez.

---

## 12) Skorlama, Veto, NEEDS_REVIEW Politikası

| Durum | Koşul | status |
|-------|-------|--------|
| HardVeto | veto_flags.length > 0 | FAIL |
| DataScore < 50 | no HardVeto | NEEDS_REVIEW |
| ChemScore < 60 | no HardVeto | NEEDS_REVIEW |
| Diğer | | PASS veya PARTIAL |

### False-Pass Önleyici Tasarım
- Veto override: false (sabit).
- NEEDS_REVIEW: belirsiz vakalarda PASS verme.
- Açıklanabilirlik: her karar için evidence[].

---

## 13) Test Harness & QA

### Golden Set
- GOLDEN_EXPECTATIONS_30.json 30 molekül.
- Her biri için: expected status, expected veto_flags (boş veya tanımlı), expected score aralığı.

### Regression
- 10 senaryo (Audit raporu Bölüm 7).
- Her PR’da: `npm run test:golden` → veto/score değişimi FAIL.

### Metrikler
| Metrik | Eşik |
|--------|------|
| False-PASS oranı | ≤2% |
| HSQC correlation recall | ≥70% |
| 13C carbonyl detection recall | ≥90% |
| Aromatik integral veto yanlış pozitif | ≤5% |
| NOESY NOT_PROVIDED vs PARSER_FAIL ayrımı | %100 |
| IR aromatik band detection accuracy | ≥85% |
| NEEDS_REVIEW oranı (belirsiz) | Tradeoff: FP düşer, NEEDS_REVIEW artar |

---

## 14) Prompt Pack (40 Prompt)

### Phase A: Symmetry Correction Factor

**A1) Master Prompt**
```
SpectroMaster Spectromasterv0.2tester.html içinde 13C modülüne Symmetry Correction Factor ekle.
- symmetryReduction(kernel) fonksiyonu: aromatic_ring_6, methyl_equivalent, THF/dioxane ring.
- expectedC = counts.C - symmetryReduction; c13 modülünde C_expected yerine kullan.
- Versiyon: config_version "v32-symmetry".
- JSON şema: lib/spectra/library/symmetry_config_schema.json.
- Unit test: benzen C6→1, aseton C3→2, THF C4→2.
- Çıktı: tree + Spectromasterv0.2tester.html değişiklikleri + npm run test:golden.
```

**A2) Debug Prompt**
```
Symmetry Correction uygulandıktan sonra benzen hâlâ QC_C13_COUNT_LOW veriyor. Loglarda C_expected, C_found, symmetry_reduction değerlerini göster. Minimal diff ile düzelt.
```

**A3) Refactor Prompt**
```
symmetryReduction fonksiyonunu ayrı modül symmetry_utils.js'e taşı. Spectromasterv0.2tester.html import et. Testleri güncelle.
```

**A4) Validation Prompt**
```
Symmetry Correction'ın bilimsel doğruluğunu kontrol et. Benzen, toluen, p-ksilen, aseton, THF için beklenen C sayısı literatürle uyumlu mu? Determinism: seed aynı, 10 run aynı sonuç.
```

### Phase B: Exchangeable Proton Logic

**B1) Master Prompt**
```
SpectroMaster verify1H ve aromatik integral hesabına değişebilir proton mantığı ekle.
- exclude_exchangeable_from_integral_check=true; expectedHForIntegral = totalH - exchH.
- parseIntegForAromatic kullan; is_ex veya ppm 4-12 (solvente göre) aromatik integralden çıkar.
- exchInteg simülasyonu: 0.5 + rnd()*0.5.
- calculateTotalIntegral broadContrib: min(1, max(0.5, v)).
- exchangeable_ppm_ranges_by_solvent tablosu.
- Unit test: fenol 5H aromatik + 1H OH; asetik asit COOH.
- JSON şema: exchangeable_config_schema.json.
```

**B2) Debug Prompt**
```
Fenol analizi hâlâ VETO_H1_AROMATIC_INTEGRAL veriyor. expectedAromaticH, h1AromaticIntegral, is_ex filtre loglarını ekle.
```

**B3) Refactor Prompt**
```
Exchangeable proton mantığını exchangeable_proton_service.js'e taşı. verify1H ve generate1H'dan çağır.
```

**B4) Validation Prompt**
```
Değişebilir proton kuralları: CDCl3, DMSO, CD3OD için ppm aralıkları SDBS ile karşılaştır. D2O exchange flag varsa OH integral 0 beklenir.
```

### Phase C: Peak Picking + Carbonyl Fix

**C1) Master Prompt**
```
13C karbonil 160-220 ppm eksikliği için d1_13c_sec metadata desteği ekle.
- experiment_metadata: { d1_13c_sec: 2 } varsayılan.
- d1<2: quaternary eksik WARN; d1>=5: carbonyl expected ama yok → VETO.
- Peak picking threshold config'ten okunabilir.
```

**C2) Debug Prompt**
```
C3H6O (aseton) C13_OBLIGATORY_FEATURE_MISSING veriyor; 13C'de 200 ppm sinyal var. Karbonil bölge tespiti logunu incele.
```

**C3) Refactor Prompt**
```
d1_13c_sec ve peak picking threshold'u VERIFICATION_CONFIG'e taşı. experiment_metadata resolver ayrı fonksiyon.
```

**C4) Validation Prompt**
```
d1=1, 2, 5 için aseton, DMF, benzoik asit test et. d1=1'de veto tetiklenmemeli; d1=5'te carbonyl yoksa veto.
```

### Phase D: HSQC Overlap Resolution

**D1) Master Prompt**
```
HSQC expectedHsycCorr = CH_count - exchH. Overlap: aynı (H,C) ±tolerance 2+ peak → 1 say. ratio = found/expectedHsycCorr; <0.6 WARN. overlap_bonus parametresi.
```

**D2) Debug Prompt**
```
Doğal ürün X HSQC ratio %33; CH_count doğru mu? Log: expectedHsycCorr, found, exchH.
```

**D3) Refactor Prompt**
```
HSQC scoring'i verifyHSQC modülüne taşı; overlap detection ayrı fonksiyon.
```

**D4) Validation Prompt**
```
Overlap-aware scoring: 2 peak 0.05 ppm içinde → 1 CH. Golden set HSQC recall ≥70%.
```

### Phase E: NOESY Ingestion

**E1) Master Prompt**
```
NOESY: NOT_PROVIDED vs PARSER_FAIL vs BELOW_SNR ayrımı. Veri yoksa uydurma yok. MACROLIDE/GLYCOPEPTIDE dışı PASS (not expected).
```

**E2) Debug Prompt**
```
NOESY boş; PARSER_FAIL mı NOT_PROVIDED mı anlaşılmıyor. Reason kodu ekle.
```

**E3) Refactor Prompt**
```
NOESY parser ayrı modül; runVerification'da sadece sonucu kullan.
```

**E4) Validation Prompt**
```
NOESY coverage: 3 durum ayrımı %100. SMALL_MOLECULE NOESY skip doğru.
```

### Phase F: IR Priors Calibration

**F1) Master Prompt**
```
IR_band_priors Ar C=C 1450-1600; intensity_min 0.15. SDBS referanslı aromatik/heterosiklik ekle. Band detect threshold config.
```

**F2) Debug Prompt**
```
Fenol IR'de 1500 cm⁻¹ band var ama "gözlenmedi". Intensity ve tolerance değerlerini logla.
```

**F3) Refactor Prompt**
```
IR prior tablosu verification_library.json'dan yükle; hardcode kaldır.
```

**F4) Validation Prompt**
```
IR aromatik band: fenol, toluen, nitrobenzen golden set. Accuracy ≥85%.
```

### Phase G: FP_RULES Expansion

**G1) Master Prompt**
```
GOLDEN_EXPECTATIONS_30.json → FP_RULES dönüşüm scripti. must_have/must_not_have → regionCountAtLeast, peakNear. 30 molekül ekle.
```

**G2) Debug Prompt**
```
M005 (siklohekzan) FP_RULES'ta var ama LIBRARY_FINGERPRINT_NOT_FOUND. SMILES eşleşmesini kontrol et.
```

**G3) Refactor Prompt**
```
FP_RULES harici JSON dosyadan yükle; build sırasında bundle.
```

**G4) Validation Prompt**
```
30 golden molekül için FP_RULES coverage %100. Eşleşme: canonical SMILES normalize.
```

### Phase H: GNN Fallback

**H1) Master Prompt**
```
GNN fallback: C>25, confidence<0.6. Sadece INFO/WARN öneri; veto override yok. Model version hash raporla.
```

**H2) Debug Prompt**
```
GNN PASS önerdi ama rule-engine FAIL. Öneri gösterilmeli ama karar FAIL kalmalı.
```

**H3) Refactor Prompt**
```
GNN inference ayrı servis; timeout 5s; hata durumda skip.
```

**H4) Validation Prompt**
```
GNN vs rule-engine uyumu ≥85%. GNN tek başına PASS vermez.
```

### Phase I: Unified Scoring

**I1) Master Prompt**
```
ChemScore + DataScore iki katman. FinalScore = 0.7*ChemScore + 0.3*DataScore. DataScore<50 → NEEDS_REVIEW. State machine: VETO→FAIL, else SCORE→(PASS|NEEDS_REVIEW).
```

**I2) Debug Prompt**
```
NEEDS_REVIEW tetikleniyor ama DataScore 55. Eşik tutarsızlığı?
```

**I3) Refactor Prompt**
```
Scoring modülü ayrı; weights config'ten.
```

**I4) Validation Prompt**
```
False-pass oranı ≤2%. NEEDS_REVIEW tradeoff: belirsiz vakalarda PASS verme.
```

### Phase J: Golden Test Harness

**J1) Master Prompt**
```
Golden test: GOLDEN_EXPECTATIONS_30 + 10 regression. npm run test:golden. Her molekül için expected status, veto_flags. CI: PR'da golden FAIL ise merge yasak.
```

**J2) Debug Prompt**
```
Golden M003 (THF) beklenen PASS, FAIL alıyor. Diff: veto_flags, score.
```

**J3) Refactor Prompt**
```
Golden testleri Jest/Vitest; snapshot yerine explicit assertion.
```

**J4) Validation Prompt**
```
30 golden + 10 regression deterministik. seed=42, 10 run aynı.
```

---

## 15) Riskler & Önlemler

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| Symmetry yanlış tespit | Orta | Yanlış C_expected | Literatür doğrulama; edge case testleri |
| Exchangeable ppm aralığı solvente göre hatalı | Düşük | Veto false positive | SDBS kalibrasyon; metadata doğruluğu |
| d1 metadata eksik | Yüksek | Quaternary veto yanlış | Varsayılan 2s; WARN "d1_13c_sec assumed" |
| GNN drift | Orta | Öneri yanlış | Model version pin; guardrail |
| FP_RULES SMILES mismatch | Orta | LIBRARY_FINGERPRINT_NOT_FOUND | Canonical SMILES normalize |
| Determinism kırılması | Düşük | CI fail | seed, rng_version, config_hash |
| False-pass artışı | Orta | Güven kaybı | NEEDS_REVIEW; veto override false |
| Regression test yetersiz | Orta | Sessiz bozulma | 40 test; coverage raporu |

---

## 16) Self-Reflection & vNext

### 10+ Belirsizlik
1. MoleculeGraph tam implementasyonu (ring perception, shortestPath) — BLOCKER olabilir.
2. Gerçek FID/peak picking dış kütüphane — parametre injekte edilebilir mi?
3. NOESY gerçek veri formatı — JCAMP?
4. GNN model eğitimi — veri seti, licence.
5. NATURAL_PRODUCTS DB — NMRShiftDB API, rate limit.
6. Solvent metadata UI — BLOCKER.
7. D2O exchange flag — nereden gelir?
8. SNR estimate — otomatik hesaplanabilir mi?
9. Heterosiklik IR priors — kapsam?
10. FP_RULES conflict resolution — aynı SMILES birden fazla kural?

### Knobs (Parametre Tablosu)
| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| integral_tolerance_ratio | 0.25 | 1H integral tolerans |
| aromatic_integral_tolerance_ratio | 0.2 | Aromatik integral |
| hsqc_ratio_warn | 0.6 | HSQC assignment ratio eşik |
| d1_13c_sec | 2 | 13C relaxation delay (s) |
| ir_intensity_min | 0.15 | IR band minimum intensity |
| ms_ppm_veto | 10 | MS ppm veto |
| data_score_needs_review | 50 | DataScore < bu → NEEDS_REVIEW |
| symmetry_reduction_* | (formül) | Simetri grupları |

### Changelog Şablonu
```
## v32.0.0 (YYYY-MM-DD)
### Added
- Symmetry Correction Factor (13C)
- Exchangeable proton mantığı
- d1_13c_sec metadata
- ChemScore + DataScore iki katman
- NEEDS_REVIEW state

### Fixed
- h1AromaticIntegral parse (parseIntegForAromatic)
- calculateTotalIntegral broadContrib
- exchInteg 0.5-1.0 aralığı

### Changed
- IR Ar C=C band threshold 0.15
- HSQC expectedHsycCorr = CH - exchH
- NOESY NOT_PROVIDED vs PARSER_FAIL

### Deprecated
- (yok)
```

---

*Belge sonu — SpectroMind Validation Upgrade OS v1.0*
