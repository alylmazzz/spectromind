# Spectrotester — Mega Prompt + TODO + Debug Checklist

Cursor’a kopyala-yapıştır için: rol seti, P0–P2 TODO, kabul kriterleri ve detaylı debug checklist.

---

## CURSOR MEGA PROMPT (Spectrotester + SpectroMind)

**ROL SETİ (aynı anda hepsi):**

- **Cheminformatics Lead:** SMILES→graph-first analiz (aromatik/sp²/komşuluk/simetri/paths). Regex sayım yok.
- **Spectroscopy Modeling Lead:** ¹H/¹³C/HSQC/HMBC/COSY/NOESY/IR/MS priors + solvent/field/SNR adaptasyonu.
- **Rule Engine Architect:** JSON-schema (AJV) validasyon, prerequisites→N/A, hardness→verdict, confidence_impact scoring.
- **QA / Test Engineer:** Smoke tests + golden fixtures + coverage matrix senaryoları + CI scriptleri.
- **Product-grade Debugger:** trace/timings/artifact hashes, deterministik output, reproducible minimal repro.

**HEDEF**

- Proton, karbon, 2D NMR (HSQC/HMBC/COSY/NOESY), FT-IR ve MS çıktıları bilimsel olarak tutarlı ve eksiksiz olsun.
- “FAIL ama Score yüksek” çelişkisini kaldır: verdict/coverage/confidence ayrışsın.
- Kurallar “sadece daha çok FAIL üretmesin”; neden ve nasıl düzeltileceğini net söylesin.
- Tüm çıktılar deterministik (seed’li) ve test edilebilir olsun.

---

## P0 TODO (kırıcı doğruluk)

1. **Integral parsing tek otorite**  
   HTML ve core’da `parseIntegralValue(raw)` + `detectIntegralMode(...)` kullan; `replace(/\D/g,"")` geçen her yeri kaldır.

2. **Graph-first Molecule Analyzer**  
   RDKit (node/python bridge) veya eşdeğer: aromatic rings, sp²/sp³, carbonyl types, nitrile, halogens, OH/NH, methoxy, exchangeable H.  
   `graph.counts`, `graph.symmetry`, `graph.paths` üret.

3. **C13 sp² üretimi fix**  
   sp² C varsa 100–160 ppm bandını üretmeden çıkış verme (veya FATAL).

4. **HSQC sp² bağlama kuralı**  
   H 4.5–8.8 → C 95–165 zorunlu.

5. **Verdict/Score/Confidence ayrıştır**  
   Hard veto → verdict FAIL. Coverage score ayrı, confidence ayrı; UI/rapor bunu açık yazsın.

6. **Rule schema upgrade**  
   rule_version, applies_to_engines, confidence_impact, references, autofix; NOESY modality (yapıldı).

7. **Teyit raporu schema**  
   engine_used, inputs_echo, timings_ms, artifact_hashes, trace (mevcut şemada var).

**Kabul kriteri (P0):**  
- Aromatik/sp² içeren 10 seed molekülün ¹³C’si 100–160 bandını içeriyor.  
- Stilben/fenolik örnekte HSQC sp² attachment ihlali 0.  
- Integral: "0.634"→0.634, "2H"→2.

---

## P1 TODO (kapsam: rule blocks + priors)

- ruleset.json’e eklenen bloklar: GLOBAL_GRAPH_FIRST_REQUIRED, H1_INTEGRAL_PARSING_SINGLE_AUTHORITY, H1_REQUIRE_VINYLIC_REGION_IF_ALKENE_CH, C13_SYMMETRY_EXPECTATION_UNIQUE_SIGNAL_COUNT, HMBC_CARBONYL_ALPHA_H_GATING_REQUIRED, HMBC_PATH_COVERAGE_MIN_RATIO, COSY_REQUIRE_VINYLIC_CHAIN_EDGES, COSY_GRAPH_EDGE_COVERAGE_RATIO, IR_AROMATIC_RING_CC_REQUIRED_IF_AROMATIC, MS_ISOTOPE_ENVELOPE_M_PLUS1_M_PLUS2_FIT, NOESY_EMPTY_IS_NA_IF_NOT_PROVIDED, NOESY_DISTANCE_PRIOR_CHECK, MS_NEUTRAL_LOSS_* (H2O, MeOH, RULES), H1 benzylic/alpha-carbonyl/solvent, C13 nitrile, HSQC CH3/OCH3, HMBC sp2 sanity, COSY aromatic ortho, IR carbonyl/OH/nitrile, MS adduct, CROSS_CARBONYL/OH/DBE.
- verification_library_seed: priors’a mean/sd/distribution/solvent_offset/noise_model ekle.
- Coverage matrix: lowSNR’da HSQC ratio min=0.60, normalde 0.80.

---

## P2 TODO (ticari kalite)

- Simetri (unique carbon/proton environments) hesapla; expected count’ları buna göre ayarla.
- NOESY: opsiyonel RDKit konformer + distance prior.
- MS fragmentation neutral loss: H2O/CO2/NH3 ve multi-halogen envelope.

---

## TEST & CI

- `npm run smoke:library` (veya eşdeğer) her commit’te koşsun.
- Yeni testler: aromatic, carbonyl, nitrile, halogen, symmetry_high, overlap_hard, exchangeable, lowSNR.

---

## DEBUG CHECKLIST (neden FAIL oldu? soruşturma)

### A) Input & Standardization

- [ ] SMILES canonicalize edildi mi? (tuz/iyon ayrıştırma, stereokimya korunumu)
- [ ] Formula ve exact mass aynı kaynaktan mı? (SMILES→formula)
- [ ] DBE hesaplaması doğru mu? (hetero/halojen etkisi)
- [ ] “Context” (SMALL_MOLECULE vs GENERAL) eşiklere yansıyor mu?

### B) Graph & Features

- [ ] Aromatik halkalar doğru bulundu mu?
- [ ] sp² karbon sayısı >0 ise “sp² flag” set mi?
- [ ] Exchangeable H sayısı (OH/NH/COOH) doğru mu?
- [ ] Simetri sınıfları (unique C/H) hesaplandı mı?

### C) ¹H parsing & integrals

- [ ] Integral parse ondalığı bozmuyor mu? (`replace(/\D/g,"")` kesinlikle yok)
- [ ] integral_mode doğru mu? (relative_area vs absolute_h)
- [ ] Solvent impurity piki integral toplamından düşüldü mü?
- [ ] Aromatik/vinylic band zorunlulukları geçiyor mu?

### D) ¹³C parsing & generation

- [ ] sp² varsa 100–160 bandında pik var mı?
- [ ] carbonyl varsa 160–220 bandında pik var mı?
- [ ] Overlap bin overflow yanlış “missing C” üretmiyor mu?
- [ ] Simetri nedeniyle “beklenen C sinyal sayısı” unique-C üzerinden mi?

### E) 2D (HSQC/HMBC/COSY/NOESY)

- [ ] HSQC: sp² H → sp² C zorunluluğu sağlanıyor mu?
- [ ] HSQC coverage: lowSNR toleransı doğru mu?
- [ ] HMBC: carbonyl + alpha-H varsa crosspeak var mı?
- [ ] COSY: vinyl zincirde edge var mı?
- [ ] NOESY: veri yoksa N/A mı?

### F) FT-IR

- [ ] sp³ C–H bandı (2850–2960) sadece sp³ C–H varsa mı?
- [ ] Aromatik varsa 3030 ±30 bandı var mı?
- [ ] Carbonyl türüne göre doğru cm⁻¹ aralığı seçildi mi?

### G) MS

- [ ] Adduct hesapları doğru mu?
- [ ] M+1 pikini ppm error diye işaretlemiyor mu? (envelope fit)
- [ ] Neutral loss kuralları fonksiyonel gruba göre doğru mu?
- [ ] Halojen izotop paterni (Cl/Br) doğru mu?

### H) Reporting

- [ ] Verdict (FAIL/WARN/PASS) ile Score/Confidence ayrışık mı?
- [ ] root_cause_analysis, trace, artifact_hashes doluyor mu?

---

## GUARDRAILS

- Backward compatibility: opsiyonel alanlar yoksa validator kırılmayacak.
- Deterministik seed.
- Her kural: prerequisites yoksa FAIL değil N/A (INCONCLUSIVE).

---

**Sonuç:** Bu prompt ile Cursor P0→P1→P2 sırasıyla uygulasın; her adımda smoke testleri çalıştırıp düzeltmeden ilerlemesin.
