## 2026-04-22 - Rule Engine vNext governance extension
- Rulepack `2.0` seviyesine cikarildi; toplam rule sayisi 173 hedef dagilimina genisletildi.
- `OBSERVED_QC` family eklendi ve observed/simulated provenance ayrimi evaluator seviyesine tasindi.
- `evaluateRules.ts` metadata contract ile genisletildi, `INCONCLUSIVE`/`NOT_APPLICABLE` semantigi aktif edildi.
- `scoring.ts` metadata penalty ve observed QC confidence cap mantigi ile guncellendi.
- `report.ts` audit odakli yeni alanlar uretiyor: root cause, skipped summary, modality breakdown, provenance, qc summary, autofix list.
- `scripts/run_vnext_smoke.mjs` ile yeni family/rule varligi smoke testi eklendi.

## 2026-04-22 - Expanded catalog gap closure
- Kullanici katalogundaki eksik kalan 80 rule-id eklendi; katalogdaki 137 rule-id kapsami tamamlandi.
- `evaluateRules.ts` icine FORMULA/GLOBAL/HSQC/COSY/MS icin ilave evaluator mantiklari ve genis info/warn trace kayitlari eklendi.
- `GLOBAL_SOLVENT_FIELD_METADATA_REQUIRED`, `COSY_DIAGONAL_ARTIFACT_EXCLUSION`, `HSQC_TOLERANCE_PPM_WINDOW_CONSISTENCY`, `MS_HRMS_EXACT_MASS_PPM_ERROR` gibi kritik kurallar aktif evaluator ile baglandi.
# SpectroMaster v33.0 — "The Great Correction" Changelog

## Özet
v32.0 "ne yanlış olduğunu biliyordu ama hala yanlış yapıyordu." v33.0 ile sistem "fiziksel kurallara uyan AI"ya dönüşür.

---

## I. Fiziksel Veto Sertleştirmesi (Üretim Aşaması)

### Q-carbon HSQC Maskeleme
- **Sorun:** QC_HSQC_Q_CARBON_VETO rapor ediliyordu ama atama motoru hala Q karbonunu HSQC tablosuna yazıyordu (veri sızıntısı).
- **Çözüm:** `generate2D` içinde HSQC döndürmeden önce Q karbonlarını filtreleyen katman eklendi.
- **Kod:** `isQCarbon(cPpm)` ile her HSQC çifti kontrol edilir; Q/Cq karbonlu eşleşmeler çıkarılır.
- **Etki:** Steroid (C25H44O2) vb. karmaşık yapılarda fiziksel imkansız HSQC eşleşmeleri üretilmez.

---

## II. IR Aromatik İskelet Bantları

### Ar C=C skeletal/overtone (1450-1600 cm⁻¹)
- **Sorun:** Benzen/toluen raporlarında IR Ar C=C bandı "gözlenmedi" hatası; motor aromatik halka nefes alma modlarını simüle etmiyordu.
- **Çözüm:** `generateIR` içinde aromatik halka varsa (aromaticC ≥ 6 veya SMILES deseni) 1500 ve 1580 cm⁻¹ bantları eklenir.
- **Bantlar:** `Ar C=C skeletal (Ring)`, `Ar C=C overtone (Ring)`
- **Etki:** Aromatik moleküllerin IR simülasyonu literatürle uyumlu.

---

## III. GNN Geçiş Hazırlığı

### GNN_GUARDRAILS
- **Yapılandırma:** `enabled: false`, `minC_for_gnn: 25`, `confidence_threshold: 0.6`, `veto_override: false`, `max_inference_ms: 5000`
- **Amaç:** İleride GNN entegrasyonu için guardrail parametreleri tanımlandı. GNN veto override edemez.
- **Not:** Tam GNN geçişi ayrı bir geliştirme fazı olarak planlanmalıdır.

---

## IV. PPM Pencere Filtresi (Anti-Hallüsinasyon)

### Değişebilir proton ppm limiti
- **Sorun:** Glikozidlerde 13.8 ve 12.8 ppm sinyalleri üretiliyordu; asit olmayan yapılarda bu ppm fiziksel olarak anlamsız.
- **Çözüm:**
  - `clampPPM`: EXCHANGEABLE için asit yoksa max 10.5 ppm (asit varsa 13.8).
  - Exchangeable blok: `hasAcid` kontrolü ile OH/NH max 10.5 ppm (asit olmayan moleküller).
- **Etki:** Rastgele yüksek ppm üretimi engellendi; glikozid/şeker bağlamında anti-hallüsinasyon.

---

## V. Out of Memory Azaltma

### Deferred render
- **Sorun:** Chrome'da "Out of Memory" hatası (17k+ satır, React+Babel).
- **Çözüm:** `root.render(<App />)` `requestIdleCallback` (veya `setTimeout(0)`) ile ertelendi; tarayıcıya parse/init sırasında nefes alma fırsatı verir.
- **Öneri:** Çok sekme açıksa bazılarını kapatın; gerekirse Chrome'u `--js-flags="--max-old-space-size=4096"` ile başlatın.

---

## Versiyon Bilgisi
- **OMNISCIENT_VERSION:** v33.0
- **Başlık:** SpectroMaster PLATINUM v33.0 - The Great Correction

---

## VI. Spectromind Uygulaması (Kod Tabanı)

v33 kuralları Spectromind Next.js tarafında da uygulanır:

- **lib/utils/v33SpectrumRules.ts:** `GNN_GUARDRAILS`, `V33_PPM_LIMITS`, `clampPPMV33`, `filterHSQCQCarbonV33`, `hasAromaticRingInStructure`, `V33_IR_AROMATIC_BANDS`
- **lib/utils/theoreticalSpectrum.ts:** Teorik 1H spektrum iyileştirmede v33 PPM clamp (exchangeable 10.5/13.8) uygulanır.
- **lib/spectromind/ir_engine/ftirEngine.ts:** Aromatik yapı varsa 1500 ve 1580 cm⁻¹ Ar C=C skeletal/overtone bantları eklenir.
- **2D HSQC:** HSQC üreten veya işleyen kod `filterHSQCQCarbonV33(hsqc, c13Peaks)` ile Q-karbon çiftlerini filtreleyebilir.

---

*Belge — SpectroMaster v33.0 Changelog*
