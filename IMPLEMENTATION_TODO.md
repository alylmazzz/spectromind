# SpectroMind Implementation TODO — 2026-03-31

## ✅ Sprint 1 (Tamamlanan: Core Models + Audit + Processing)

### Core Domain Models
- [x] `lib/core/models/AnalyticalDocument.ts` — Çekirdek belge modeli
- [x] `lib/core/models/NormalizedDataset.ts` — Normalize veri seti + ProcessingStep + QualityFlags
- [x] `lib/core/models/MoleculeRecord.ts` — Molekül kayıt defteri + ConformerRecord
- [x] `lib/core/models/EvidenceNode.ts` — Kanıt düğümü (modality, category, confidence, weight)
- [x] `lib/core/models/AssignmentEdge.ts` — Atama kenarı (feature → atom)
- [x] `lib/core/models/index.ts` — Re-export

### Audit & Events
- [x] `lib/core/audit/types.ts` — AuditAction, AuditEvent tipleri
- [x] `lib/core/audit/AuditService.ts` — Log, subscribe, timed, timedAsync, export
- [x] `lib/core/events/types.ts` — EventType, SpectroMindEvent
- [x] `lib/core/events/EventBus.ts` — Pub/sub olay sistemi

### NMR Processing Graph
- [x] `lib/nmr/processing/ProcessingGraph.ts` — Pipeline motoru + template + state management
- [x] `lib/nmr/processing/steps/ApodizationStep.ts` — Exp, Gauss, Sine, Cosine
- [x] `lib/nmr/processing/steps/ZeroFillStep.ts` — Power-of-two zero filling
- [x] `lib/nmr/processing/steps/FourierTransformStep.ts` — Radix-2 FFT + fftShift
- [x] `lib/nmr/processing/steps/PhaseCorrectionStep.ts` — Auto (entropy) + Manual ph0/ph1
- [x] `lib/nmr/processing/steps/BaselineCorrectionStep.ts` — Polynomial fit

### Belgeleme
- [x] `REPO_AUDIT.md`
- [x] `GAP_MATRIX.md` — 101 yetenek
- [x] `TARGET_ARCHITECTURE.md`
- [x] `ROADMAP.md`
- [x] `ADR/ADR-001` → `ADR-012` — 12 ADR

## ✅ Sprint 2 (Tamamlanan: State Migration + Analysis + Foundation)

### Global State Migration (P0)
- [x] `app/page.tsx` — 14 useState → Zustand store selectors (11 ölü import temizlendi)
- [x] `lib/core/store/spectromindStore.ts` — Legacy session state entegrasyonu (peaks, solvent, frequency, spectrumType, formula, knownMolecule, observedNmrOverlay, fidSimulationPeaks)
- [x] `EXECUTION_DRIFT_REPORT.md` — Önceki sprint drift analizi
- [x] `IMPLEMENTATION_BACKLOG_EXECUTION.md` — Execution-oriented backlog

### NMR Processing — Bug Fixes & Real Implementation (P0)
- [x] `lib/nmr/processing/steps/ReferencingStep.ts` — **REPLACED PLACEHOLDER** with real axis shift: manual point, solvent auto-detect, TMS methods, circular shift, SOLVENT_REFERENCES table

### NMR Processing Panel UI (P1)
- [x] `components/nmr/NMRProcessingPanel.tsx` — Step list, add/remove/toggle/reorder, params editor, template save/load, scientific warnings, styled panel

### 1D NMR Analysis Services (P1)
- [x] `lib/nmr/analysis/PeakPicker.ts` — Threshold + local max + MAD noise estimation + SNR + linewidth + solvent flagging + confidence scoring + audit
- [x] `lib/nmr/analysis/IntegrationService.ts` — Region-based integration, bias correction, reference normalization, running integral, total normalization

### 2D NMR Foundation (P1)
- [x] `lib/core/models/TwoDNmrDataset.ts` — TwoDNmrDataset, TwoDPeak, TwoDAxisDefinition, ContourSettings, TraceLinkage, CorrelationType, experiment type classification, trace extraction (F1/F2), axis conversion utilities

### Core Type Unification & Bridge (P1)
- [x] `lib/core/bridges/solvent.ts` — CanonicalSolvent (14 solvents), SolventInfo with NMR reference values + residual peaks, alias resolution
- [x] `lib/core/bridges/legacyAdapter.ts` — NMRPeak/Carbon13Peak/FTIRPeak/MSPeak ↔ NormalizedDataset + EvidenceNode converters

### Molecule Registry (P1)
- [x] `lib/molecule/MoleculeRegistry.ts` — Register, search, update, delete, link datasets/predictions/assignments, compounds table export, audit + events

### MS Dual Model (P1)
- [x] `lib/ms/models/MsDocument.ts` — ChromatogramTrace + MassSpectrum + DetectedIon + IsotopeCluster + MolecularMatchResult + MsAssignment + MsDocument, EIC creation utility

### IR/UV Processing Pipeline (P1)
- [x] `lib/ir/processing/IRProcessingPipeline.ts` — Baseline (rubber band), normalization (minmax/area/vector), smoothing, derivative (1st/2nd), absorbance↔transmittance conversion, peak picking with functional group classification

### Scientific Tests (P1)
- [x] `__tests__/nmr/processingGraph.test.ts` — 11 tests: pipeline execution, step management, template serialization, scientific correctness (apodization decay, zero fill doubling, FFT domain conversion, phase energy preservation)
- [x] `__tests__/nmr/peakPicker.test.ts` — 5 tests: threshold detection, SNR filtering, distance merging, solvent flagging, confidence reporting
- [x] `__tests__/nmr/integrationService.test.ts` — 5 tests: region integration, bias correction, reference normalization, running integral, region management

## 🔲 Sprint 3: Phase 1 Devam

### Processing Panel Integration
- [ ] NMRProcessingPanel'i page.tsx layout'una entegre et
- [ ] ProcessingGraph ↔ store bağlantısı (dataset-specific graph yönetimi)
- [ ] FID yüklendiğinde otomatik default processing template uygulama

### Vendor Import
- [ ] `lib/nmr/import/AdapterRegistry.ts`
- [ ] `lib/nmr/import/adapters/BrukerAdapter.ts`
- [ ] `lib/nmr/import/adapters/JcampAdapter.ts`
- [ ] `lib/nmr/import/ImportService.ts`

### Extended Analysis
- [ ] `lib/nmr/analysis/MultipletAnalyzer.ts` — J extraction, classification, overlap scoring
- [ ] `lib/nmr/analysis/ImpurityDetector.ts` — Editable knowledge tables
- [ ] `lib/nmr/analysis/ReferencingService.ts` — TMS/solvent/absolute reference (high-level service)
- [ ] GSD (Global Spectral Deconvolution) foundation

### Sidebar Cleanup
- [ ] `components/sidebar/Sidebar.tsx` — Ölü `inputMethod` state
- [ ] `lib/spectromind/parser/smilesParser.ts` — localhost:3000 → env variable
- [ ] `components/fid/FIDUploader.tsx` — Compact ile birleştir

## 🔲 Phase 2: Prediction & Verify

### Prediction
- [ ] `lib/prediction/PredictionOrchestrator.ts`
- [ ] `lib/prediction/backends/BackendRegistry.ts`
- [ ] `lib/prediction/backends/HOSEBackend.ts`
- [ ] `lib/prediction/CompareService.ts`

### Verification
- [ ] `lib/verification/VerificationOrchestrator.ts`
- [ ] `lib/verification/CandidateRanker.ts`
- [ ] `lib/verification/Explainer.ts`
- [ ] UI: VerificationPanel, CandidateRankingTable, EvidenceBreakdown

## 🔲 Phase 3: Molecule Workstation

- [ ] CompoundsTable UI component
- [ ] SdfBrowser UI component
- [ ] Atom numbering + label UI
- [ ] 3D/conformer viewer wiring

## 🔲 Phase 4: MS & IR Workspaces

### MS
- [ ] MS analysis services (EIC extractor, Elemental composition, Molecular matcher)
- [ ] MS workspace UI (chromatogram + spectrum dual view)

### IR
- [ ] IR workspace UI (processing + evidence integration)
- [ ] Functional group compatibility scoring engine

## 🔲 Phase 5: Report / DB / Script

- [ ] `lib/report/models/WorkspaceDocument.ts`
- [ ] `lib/database/DatabaseService.ts`
- [ ] `lib/scripting/ScriptContext.ts`
- [ ] `lib/scripting/CliRunner.ts`

## 🔲 Phase 6: Plugins

- [ ] `lib/plugins/PluginManager.ts`
- [ ] qNMR plugin
- [ ] PCA / chemometrics plugin
