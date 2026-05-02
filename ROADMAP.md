# SpectroMind Master Roadmap — 2026-03-31

## Phase 0: Immediate Stabilization (Hafta 1-2)

### Hedef: Mevcut kodu kırılmadan çalışır hale getir, teknik borcu azalt

- [ ] **0.1** Zustand global store kurulumu — `page.tsx` useState'lerini taşı
- [ ] **0.2** Tip birleştirme — Solvent, MSPeak, Conformer tek kaynak
- [ ] **0.3** Ölü import temizliği (page.tsx, Sidebar.tsx)
- [ ] **0.4** `localhost:3000` → env variable (smilesParser.ts + diğerleri)
- [ ] **0.5** FIDUploader birleştirme — Compact'ı ana versiyon yap
- [ ] **0.6** BulkInput modüler ayrıştırma
- [ ] **0.7** ConformerViewer ve VectorSearch ana akışa bağlama

## Phase 1: Core Data Model (Hafta 3-6)

### Hedef: Bütün modüllerin üstüne inşa edeceği normalize veri omurgası

- [ ] **1.1** `lib/core/models/` — AnalyticalDocument, NormalizedDataset, MoleculeRecord, EvidenceNode, AssignmentEdge, ProcessingEvent
- [ ] **1.2** `lib/core/audit/AuditService.ts` — Provenance/audit backbone
- [ ] **1.3** `lib/core/store/spectromindStore.ts` — Zustand store ile core model entegrasyonu
- [ ] **1.4** `lib/core/events/EventBus.ts` — Modül-arası olay sistemi
- [ ] **1.5** Mevcut tiplerin (observed-data.ts, schemas/index.ts) yeni modele migration'ı
- [ ] **1.6** Vendor import adapter registry — AdapterRegistry + BrukerAdapter temel
- [ ] **1.7** NormalizedDataset ↔ mevcut `NMRPeak[]` / `FTIRPeak[]` / `MSPeak[]` bridge katmanı

## Phase 2: NMR Processing & Analysis (Hafta 7-14)

### Hedef: Ham FID → işlenmiş spektrum → peak/multiplet/assignment zinciri

- [ ] **2.1** `ProcessingGraph.ts` — DAG tabanlı işlem motoru
- [ ] **2.2** İşlem adımları: Apodization, ZeroFill, FT, Phase, Baseline, Reference
- [ ] **2.3** ProcessingTemplate — kaydet/yükle/uygula
- [ ] **2.4** Python spawn → TypeScript/WASM migration planı (nmrglue FFT)
- [ ] **2.5** PeakPicker — threshold + GSD temel
- [ ] **2.6** IntegrationService — absolute + relative + normalize
- [ ] **2.7** MultipletAnalyzer — coupling extraction, classification
- [ ] **2.8** MultipletManager — UI panel + overlap çözümü
- [ ] **2.9** ImpurityDetector — solvent/impurity/compound sınıflandırma
- [ ] **2.10** ReferencingService — TMS/solvent/absolute
- [ ] **2.11** NMR processing panel UI
- [ ] **2.12** Regression testleri — golden dataset yaklaşımı

## Phase 3: Prediction / Verify (Hafta 15-20)

### Hedef: Yapıdan spektrum tahmini → deneysel karşılaştırma → doğrulama

- [ ] **3.1** PredictionOrchestrator — backend dispatch (HOSE, deterministic, DB, QM)
- [ ] **3.2** CompareService — Predict & Compare overlay
- [ ] **3.3** VerificationOrchestrator — çoklu test, weighted scoring
- [ ] **3.4** ShiftAgreementTest, MultiplicityTest, IntegrationTest
- [ ] **3.5** MSMatchTest, IRCompatibilityTest
- [ ] **3.6** CandidateRanker — aday sıralama + açıklama
- [ ] **3.7** Explainer — negative result troubleshooting
- [ ] **3.8** SpinSimulationPanel — UI + backend entegrasyonu
- [ ] **3.9** PredictionDatabase — kaydet/güncelle/sorgula
- [ ] **3.10** VerificationPanel + CandidateRankingTable UI

## Phase 4: Molecule / MS / IR Workspaces (Hafta 21-30)

### Hedef: Molekül-merkezli çalışma + MS ve IR tam modülleri

- [ ] **4.1** MoleculeRegistry — merkezi kayıt servisi
- [ ] **4.2** CompoundsTable UI — formula, MW, DBE, custom fields, assignment visibility
- [ ] **4.3** SdfBrowser — yükle, filtrele, ara, import
- [ ] **4.4** 3D molecule/conformer viewer iyileştirme
- [ ] **4.5** MS document model — ChromatogramTrace, MassSpectrum, MsDocument
- [ ] **4.6** EIC extraction, chromatographic peak detection
- [ ] **4.7** Elemental composition + molecular match
- [ ] **4.8** MS prediction + assignment table
- [ ] **4.9** IR processing pipeline — baseline, normalize, smooth, derivative
- [ ] **4.10** IR processing template
- [ ] **4.11** Functional group compatibility scoring + UV chromophore heuristics
- [ ] **4.12** 2D NMR — contour engine, trace attach, 2D peak picking

## Phase 5: Report / DB / Script (Hafta 31-40)

### Hedef: Belge, veritabanı ve otomasyon katmanları

- [ ] **5.1** WorkspaceDocument model — multipage, page objects
- [ ] **5.2** Report editor UI — spectrum + molecule + table + text nesneleri
- [ ] **5.3** Layout template sistemi
- [ ] **5.4** PDF export
- [ ] **5.5** Database service — schema, custom fields, search
- [ ] **5.6** Database browser UI
- [ ] **5.7** Script context facade — NMR, MS, IR, molecule, DB, report, IO
- [ ] **5.8** CLI headless runner
- [ ] **5.9** Batch job manager
- [ ] **5.10** Script audit logging

## Phase 6: Plugins / Chemometrics (Hafta 41-50)

### Hedef: Platform genişletilebilirliği

- [ ] **6.1** Plugin API — register panels, services, DB fields, report sections
- [ ] **6.2** qNMR plugin — concentration, purity, batch
- [ ] **6.3** PCA plugin — score plot, loading, CV, ellipse
- [ ] **6.4** Reaction monitoring plugin
- [ ] **6.5** Structure elucidation plugin — mevcut engine'i sarmalama
- [ ] **6.6** Stacked/arrayed NMR — full workflow
- [ ] **6.7** T1/DOSY/kinetics specialized analysis

## Phase 7: Validation / Release Preparation (Hafta 51-60)

### Hedef: Bilimsel doğrulama, performans, güvenlik

- [ ] **7.1** Golden dataset corpus — 50+ bilinen molekül
- [ ] **7.2** Scientific regression test suite
- [ ] **7.3** Performance optimization — 2D contour, stacked render, large dataset
- [ ] **7.4** Accessibility audit
- [ ] **7.5** Security audit — API keys, spawn injection, file access
- [ ] **7.6** Dokümantasyon — kullanıcı kılavuzu, geliştirici kılavuzu
- [ ] **7.7** CI/CD pipeline — test, lint, build, deploy
- [ ] **7.8** Beta release preparation
