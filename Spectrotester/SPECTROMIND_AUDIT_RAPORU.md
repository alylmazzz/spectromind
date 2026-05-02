# SpectroMind / SpectroMaster Audit Raporu
## Omniscient Prime v31.0 — Bilimsel Doğruluk ve Algoritma Denetimi

**Tarih:** 2025-02-04  
**Kapsam:** Toplu SpectroMind çıktısı (40+ molekül)  
**Hedef:** Kod hataları, kural tutarsızlıkları, 0.x integral proton analizi

---

## 1) Executive Summary

1. **0.x İntegralli Protonlar:** Simülasyonda değişebilir (OH/NH) protonlar `exchInteg = 0.1 + rnd() * 0.5` ile üretiliyor; bu değerler QC’de yanlış parse ediliyor ve VETO_H1_AROMATIC_INTEGRAL tetikleniyor.

2. **Kritik Kod Hatası:** `h1AromaticIntegral` hesaplamasında `parseInt(String(s.integ).replace(/\D/g, ""), 10)` kullanılıyor; "0.547" → "0547" → 547 oluyor. Ondalık integral parse hatası.

3. **Sistem Yanlış FAIL Verdi:** C6H6 (benzen), C4H8O (THF), C2H6OS (DMSO) gibi moleküller geçerli spektral veri ile FAIL/WARN aldı; çoğu simülasyon + QC tutarsızlığından kaynaklanıyor.

4. **VETO_H1_AROMATIC_INTEGRAL Aşırı Sert:** Aromatik 6–9 ppm bölgesinde tek multiplet (örn. 4H) mevcutken, `h1AromaticIntegral` parse hatası nedeniyle yanlış hesaplanıp veto tetikleniyor.

5. **FP_RULES Kapsamı:** Çoğu molekül için fingerprint yok; genel kurallar kullanılıyor ve LIBRARY_FINGERPRINT_NOT_FOUND sık görülüyor.

6. **IR Ar C=C Bandı:** 1450–1600 cm⁻¹ bandı neredeyse hiçbir molekülde "gözlenmedi" olarak raporlanıyor; simülasyon veya threshold problemi.

7. **HSQC Atama Oranı:** Birçok molekülde HSQC assignment ratio <%75; örtüşme ve değişebilir proton mantığı ile uyumlu olabilir ama raporlama tutarsız.

8. **calculateTotalIntegral Mantığı:** Broad peak için `v >= 0.5 ? v : 1` kullanımı; 0.3 integral 1 sayılıyor, 0.55 ise 0.55—tutarsız.

9. **MS ppm Hatası:** [M+H]+ 13C izotop peak’leri yüksek ppm hata veriyor (örn. 9366 ppm); bu beklenen davranış ama rapor kafa karıştırıcı.

10. **Öncelik:** P0 = aromatik integral parse düzeltmesi; P1 = exchangeable integral simülasyon ve QC tutarlılığı; P2 = IR band threshold; P3 = FP_RULES genişletme.

---

## 2) Kanonik Veri Özeti

### Kimlik Nesneleri (örnek)
| Alan | Örnek |
|------|-------|
| context | SMALL_MOLECULE, GENERAL |
| formula | C8H10, C9H8O4, C6H6, ... |
| smiles | CC1=CC=C(C=C1)C, CC(=O)OC1=CC=CC=C1C(=O)O, c1ccccc1, ... |
| exact_mass | 106.0783, 180.0423, 78.0470, ... |
| DBE | 4, 6, 4, ... |

### Spektral Nesneler Özeti
- **1H:** ppm, mult, integ (int veya float), J
- **13C:** ppm, type (CH/CH2/CH3/Q), assignment
- **MS:** mz_calc, mz_obs, rel_int, label
- **FT-IR:** cm⁻¹, intensity, assignment
- **2D:** HSQC, COSY, HMBC, NOESY çiftleri

### Sistem Nesneleri
- coverage/confidence summary
- PASS/FAIL neden listesi (rule codes)
- data_completeness (1H, 13C, HSQC, COSY, HMBC, MS, IR %)
- library coverage: fingerprint eşleşti/eşleşmedi

---

## 3) Detaylı Doğruluk Tablosu

| Modül | Sistem Kararı | Benim Kararım | Çelişki Tipi | Kanıt | Kök Sebep | Öncelik | Patch |
|-------|---------------|---------------|--------------|-------|-----------|---------|-------|
| Formula/DBE | PASS | PASS | NONE | Formül tutarlı | - | - | - |
| 1H | FAIL/WARN | WARN (çoğu) | OVERSTRICT | 0.x integral parse; H_found vs H_expected uyumsuz | CODE_BUG, THRESHOLD | P0 | parseFloat for aromatic integral |
| 13C | WARN/PASS | PASS (simetri) | UNDERSTRICT | Simetri ile az sinyal normal | RULE_DESIGN | P3 | Simetri faktörü |
| HSQC | WARN | WARN | NONE | Düşük assignment; değişebilir H açıklaması | DATA_QUALITY | P2 | Exchangeable downgrade |
| COSY | WARN | WARN | NONE | Singlet varsa COSY opsiyonel | - | - | - |
| HMBC | PASS | PASS | NONE | - | - | - | - |
| MS | PASS/FAIL | PASS | FALSE_NEGATIVE | 13C adduct ppm yüksek; ana [M+H]+ doğru | THRESHOLD | P2 | 13C adduct exclude from ppm veto |
| IR | WARN | WARN | OVERSTRICT | Ar C=C band "gözlenmedi" sık | THRESHOLD, DATA_QUALITY | P2 | IR band detect threshold |
| Library/MCA | Partial | Partial | NONE | FP_RULES eksik | LIBRARY_GAP | P3 | FP_RULES genişlet |

---

## 4) Kök Sebep Analizi

### 5.1 CODE_BUG
- **h1AromaticIntegral parse:** Satır ~16490: `parseInt(String(s.integ).replace(/\D/g, ""), 10)` ondalık değerleri bozuyor. "0.547" → 547 veya benzeri yanlış sonuç.
- **Çözüm:** `parseFloat` veya `parseInteg` ile değiştir.

### 5.2 LOGIC_BUG
- **calculateTotalIntegral broadContrib:** `(v >= 0.5) ? v : 1` — 0.4 integral 1 sayılıyor, 0.55 ise 0.55. Tutarsız.
- **Çözüm:** Exchangeable için tutarlı politika: ya hep 1 say ya da ham değeri kullan + expectedExchH cap.

### 5.3 RULE_DESIGN
- **VETO_H1_AROMATIC_INTEGRAL:** Tek aromatik multiplet (4H, 5H) yeterli olabilir; parse hatası olmadan da eşik fazla sert olabilir.
- **Çözüm:** aromatic_integral_tolerance_ratio (0.2) ile soft geçiş; fingerprint PASS ise veto atlama (zaten var).

### 5.4 THRESHOLD_TUNING
- **IR Ar C=C:** 1450–1600 cm⁻¹ bandı neredeyse hiç "gözlenmedi"; simülasyon bu bandı üretmiyor veya intensity threshold yüksek.
- **MS 13C adduct:** [M+H]+ 13C peak ppm hatası veto tetikliyor olabilir.

### 5.5 DATA_QUALITY
- Çözücü piki (CDCl3, DMSO) tespiti; water ~1.56 ppm uyarısı doğru.
- Düşük SNR HSQC missing — exchangeable ile açıklanabilir.

### 5.6 LIBRARY_GAP
- FP_RULES birçok SMILES için yok; genel kurallar kullanılıyor.
- IR_band_priors Ar C=C eksik veya threshold yanlış.

---

## 5) 0.x İntegralli Protonlar — Zorunlu Analiz

### 6.1 Tanım
0.x integralli "br" sinyaller (ör: 0.547, 0.319, 0.259) **değişebilir protonları (OH/NH)** temsil eder. Simülasyon kodu (`Spectromasterv0.2tester.html` satır ~4079):
```javascript
const exchInteg = 0.1 + rnd() * 0.5;
rawSignals.push({ ..., integ: exchInteg, ..., is_ex: true, ... });
```
Bu değerler **gerçek proton sayısı değil**, "broad/variable integral" modellemesidir. D2O ile hızlı değişim, baseline genişlemesi, konsantrasyon/temperatür etkisi nedeniyle integral 1’e normalize olmayabilir.

### 6.2 Muhtemel Kaynaklar

| Kaynak | Kanıt Var? | Açıklama |
|--------|------------|----------|
| A) İntegrasyon ölçekleme/normalizasyon hatası | Evet | Simülasyon kasıtlı 0.1–0.6 veriyor; gerçek deneyde referans piki ile normalize edilmemiş olabilir |
| B) Çözücü/safsızlık/su piki | Kısmen | Su ~1.56 ppm uyarısı var; 0.x değerler genelde 4–12 ppm (OH/NH) |
| C) Exchangeable (OH/NH) + br | Evet | is_ex: true, mult: "br"; COOH, fenol OH, amide NH |
| D) Baseline/phasing hatası | Hayır | Simülasyon; gerçek veri yok |
| E) Overlap/dekonvolüsyon | Hayır | Tek br pik |

### 6.3 Düzeltme Gerektirir mi? — Karar Matrisi

| 0.x Pik | Gerçek Sinyal? | Raporlamada Tutulmalı? | QC Veto Sebebi? | Aksiyon |
|---------|----------------|------------------------|-----------------|---------|
| OH/NH br 4–13 ppm | Evet | Evet | None | Exchangeable say; integral check’ten hariç tut |
| <0.5 integral | Evet | Evet (TRACE) | Soft | Normalize veya "exchangeable" tag |
| ≥0.5 integral | Evet | Evet | None | Ham değeri kullan |

### 6.4 Kod Patch Önerisi

```javascript
// Spectromasterv0.2tester.html

// 1) h1AromaticIntegral (satır ~16490) — P0
// ÖNCE:
const h1AromaticIntegral = h1AromaticSignals.reduce((sum, s) => 
  sum + (parseInt(String(s.integ).replace(/\D/g, ""), 10) || 1), 0);
// SONRA:
const parseIntegForSum = (integ) => {
  const m = String(integ || "").trim().match(/^(\d+(\.\d+)?)(\s*H)?$/i);
  return m ? Number(m[1]) : (Number(integ) || 0);
};
const h1AromaticIntegral = h1AromaticSignals.reduce((sum, s) => 
  sum + Math.max(0, parseIntegForSum(s.integ) || 0), 0);

// 2) Exchangeable integral simülasyonu (satır ~4079) — P1
// exchInteg = 0.1 + rnd() * 0.5 yerine:
// Seçenek A: integ: 1 (standart) — QC ile uyumlu
// Seçenek B: integ: 0.5 + rnd() * 0.5 (0.5-1.0) — daha gerçekçi
const exchInteg = 0.5 + rnd() * 0.5;

// 3) calculateTotalIntegral broadContrib (satır ~15541) — P1
// ÖNCE: (v >= 0.5) ? v : 1
// SONRA: Exchangeable için her zaman min(1, v) veya expectedExchH'ya göre cap
broadContrib += (v != null) ? Math.min(1, Math.max(0.5, v)) : 1;

// 4) report_zeroish_integrals — yeni fonksiyon
function classifyZeroishIntegral(integ, ppm, mult) {
  const v = parseFloat(integ);
  if (v < 0.5 && v > 0) return "TRACE_OR_EXCHANGEABLE";
  if (v >= 0.5 && v < 1.5 && /br|broad/i.test(String(mult))) return "EXCHANGEABLE";
  return "NORMAL";
}
```

---

## 6) Patch Planı (P0→P3)

| Öncelik | Modül | Aksiyon | Dosya:Satır |
|---------|-------|---------|-------------|
| P0 | 1H | h1AromaticIntegral parseFloat düzelt | Spectromasterv0.2tester.html:~16490 |
| P1 | 1H | calculateTotalIntegral broadContrib tutarlılığı | ~15541 |
| P1 | Simülasyon | exchInteg 0.5–1.0 aralığı | ~4079 |
| P2 | IR | Ar C=C band detect threshold | verifyIR |
| P2 | MS | 13C adduct ppm veto hariç tut | verifyMS |
| P3 | FP_RULES | Eksik SMILES ekle | FP_RULES array |
| P3 | 13C | Simetri faktörü (QC_C13_COUNT_LOW) | coverageReport |

---

## 7) Regression Test Planı (Minimum 10 Test)

| # | Senaryo | Input Pattern | Beklenen Karar | Beklenen Hata Kodları |
|---|---------|---------------|----------------|------------------------|
| 1 | Fenolik OH | C6H6O, 4H aromatik + 0.5H br OH | PASS/WARN | WARN_FTIR (Ar C=C) |
| 2 | Simetrik aromatik | C6H6, 6H singlet 7.17 | PASS | - |
| 3 | Solvent contamination | CDCl3 7.26 ppm | WARN | Solvent uyarısı |
| 4 | Low SNR HSQC | Eksik HSQC, exchangeable CH | PASS | WARN_HSQC (info) |
| 5 | 13C overlap | 6C → 3 peak (simetri) | PASS | WARN_13C simetri |
| 6 | MS [M+Na]+ baskın | [M+Na]+ 100%, [M+H]+ 9% | PASS | - |
| 7 | IR ring band zayıf | 1500 cm⁻¹ weak | WARN | WARN_FTIR |
| 8 | Fingerprint yok | Genel molekül | WARN | LIBRARY_FINGERPRINT_NOT_FOUND |
| 9 | Fingerprint var | Asetik asit | PASS | - |
| 10 | Integral > expected (safsızlık) | +2H impurity | WARN | H1_INTEGRAL_HIGH |

---

## 8) Self-Audit & Evrim

### Bu analiz hangi girdiler olmadan kesin konuşamaz?
- Ham 1H peak tablosu (integral formatı: string/number)
- Solvent bilgisi
- D2O exchange yapılıp yapılmadığı
- Gerçek vs simülasyon ayrımı

### Hangi ek deneyler kesinlik sağlar?
- D2O shake → OH/NH kaybolur
- DEPT-135 / APT → CH/CH2/CH3 ayrımı
- Uzun delay 13C → kuaterner karbonlar
- Farklı solvent → çözücü pik ayrımı

### Kural motoruna eklenmeli?
- `classifyZeroishIntegral()` — 0.x sınıflandırma
- `aromatic_integral_parse_fix` — ondalık parse
- `exchangeable_integral_policy` — tutarlı sayım

### FP_RULES / GOLDEN_EXPECTATIONS genişletme
- Aspirin, parasetamol, fenol, anilin, p-tolüik asit vb. ekle
- NMRShiftDB’den örnek ppm bölgeleri al

### Sonraki Sürüm Changelog
- [P0] h1AromaticIntegral parseFloat düzeltmesi
- [P1] Exchangeable integral tutarlılığı
- [P2] IR Ar C=C band threshold
- [P2] MS 13C adduct veto istisnası
- [P3] FP_RULES genişletme
- [P3] 0.x integral sınıflandırma raporu

---

*Rapor sonu — SpectroMind Audit v1.0*
