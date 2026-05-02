# SpectroMind Target Architecture — 2026-03-31

## Mimari İlkeler

1. **Molecule-centric**: Bütün veriler MoleculeRecord üzerinden birleşir
2. **Evidence-centric**: Gözlem ≠ yorum ≠ hipotez — ayrı katmanlar
3. **Document-centric**: Analiz sırasında rapor canlı olarak oluşur
4. **Vendor-aware**: Ham cihaz verisinden normalize şemaya adapter zinciri
5. **Scriptable**: UI, CLI ve script aynı servis katmanını kullanır
6. **Batch-capable**: Her analiz işlemi tekli ve toplu çalışabilir
7. **Auditable**: Her işlem provenance/audit kaydı tutar
8. **Plugin-extensible**: qNMR, PCA, reaction monitoring vb. plugin olarak eklenir

## I. Core Domain Layer

```
lib/core/
├── models/
│   ├── AnalyticalDocument.ts      — Çekirdek belge
│   ├── NormalizedDataset.ts       — Normalize veri seti
│   ├── MoleculeRecord.ts          — Molekül kayıt defteri
│   ├── EvidenceNode.ts            — Kanıt düğümü
│   ├── AssignmentEdge.ts          — Atama kenarı
│   ├── ProcessingEvent.ts         — İşleme olayı
│   └── index.ts
├── store/
│   ├── spectromindStore.ts        — Zustand global store
│   └── slices/
│       ├── documentSlice.ts
│       ├── moleculeSlice.ts
│       ├── analysisSlice.ts
│       └── uiSlice.ts
├── audit/
│   ├── AuditService.ts            — Provenance kaydı
│   └── types.ts
└── events/
    ├── EventBus.ts                — Modül-arası olay sistemi
    └── types.ts
```

### AnalyticalDocument

```typescript
interface AnalyticalDocument {
  id: string;
  title: string;
  sampleId?: string;
  createdAt: string;
  updatedAt: string;
  datasets: NormalizedDataset[];
  moleculeIds: string[];
  reportPages: ReportPage[];
  evidenceGraph: EvidenceNode[];
  assignmentEdges: AssignmentEdge[];
  auditTrail: AuditEvent[];
  tags: string[];
  customFields: Record<string, unknown>;
}
```

### NormalizedDataset

```typescript
interface NormalizedDataset {
  id: string;
  modality: 'nmr-1d' | 'nmr-2d' | 'ms' | 'ir' | 'uv';
  rawDomain: 'time' | 'frequency' | 'chromatographic';
  vendor?: string;
  nucleus?: string;
  experiment?: string;
  axes: AxisDefinition[];
  acquisition: AcquisitionMetadata;
  processingHistory: ProcessingStep[];
  valuesRef: string;
  provenance: DataProvenance;
  qualityFlags?: QualityFlags;
}
```

### MoleculeRecord

```typescript
interface MoleculeRecord {
  id: string;
  molfile: string;
  smiles: string;
  inchiKey?: string;
  name?: string;
  formula: string;
  exactMass: number;
  molecularWeight: number;
  dbe: number;
  atomLabels: AtomLabel[];
  customFields: Record<string, unknown>;
  conformers: ConformerRecord[];
  linkedDatasetIds: string[];
  linkedPredictionIds: string[];
  linkedAssignmentIds: string[];
}
```

### EvidenceNode

```typescript
interface EvidenceNode {
  id: string;
  modality: '1H' | '13C' | 'HSQC' | 'COSY' | 'HMBC' | 'NOESY' | 'MS' | 'IR' | 'UV';
  observationType: string;
  rawSourceRef: string;
  interpretedMeaning: string;
  supportsHypothesisIds: string[];
  contradictsHypothesisIds: string[];
  confidence: number;
  quality: number;
  provenance: DataProvenance;
}
```

### AssignmentEdge

```typescript
interface AssignmentEdge {
  id: string;
  sourceFeatureId: string;
  sourceFeatureKind: 'peak' | 'multiplet' | 'integral' | 'crossPeak';
  targetAtomId: string;
  targetMoleculeId: string;
  modality: string;
  confidence: number;
  rationale: string;
  source: 'manual' | 'auto' | 'prediction_assisted' | 'transferred';
  provenance: DataProvenance;
}
```

## II. NMR Layer

```
lib/nmr/
├── import/
│   ├── adapters/
│   │   ├── BrukerAdapter.ts
│   │   ├── VarianAdapter.ts
│   │   ├── JeolAdapter.ts
│   │   ├── JcampAdapter.ts
│   │   └── AdapterRegistry.ts
│   └── ImportService.ts
├── processing/
│   ├── ProcessingGraph.ts         — DAG tabanlı işlem motoru
│   ├── steps/
│   │   ├── ApodizationStep.ts
│   │   ├── ZeroFillStep.ts
│   │   ├── FourierTransformStep.ts
│   │   ├── PhaseCorrectionStep.ts
│   │   ├── BaselineCorrectionStep.ts
│   │   ├── ReferencingStep.ts
│   │   ├── LinearPredictionStep.ts
│   │   ├── GroupDelayStep.ts
│   │   └── index.ts
│   ├── ProcessingTemplate.ts
│   └── ProcessingRunner.ts
├── analysis/
│   ├── PeakPicker.ts
│   ├── IntegrationService.ts
│   ├── MultipletAnalyzer.ts
│   ├── MultipletManager.ts
│   ├── GSDEngine.ts
│   ├── ImpurityDetector.ts
│   ├── ReferencingService.ts
│   └── LineFitter.ts
├── twod/
│   ├── TwoDMatrixProcessor.ts
│   ├── ContourEngine.ts
│   ├── TraceManager.ts
│   ├── TwoDPeakPicker.ts
│   └── TwoDAssignment.ts
├── stacked/
│   ├── StackedDataset.ts
│   ├── AlignmentService.ts
│   ├── DescriptorExtractor.ts
│   ├── T1Fitter.ts
│   ├── DOSYTransform.ts
│   └── KineticsTracker.ts
├── spin-system/               — MEVCUT, genişletilecek
├── shift-engine/              — MEVCUT
├── coupling-engine/           — MEVCUT
├── lineshape-engine/          — MEVCUT
├── equivalence-engine/        — MEVCUT
└── spectrum-renderer/         — MEVCUT
```

### ProcessingStep (Union Type)

```typescript
type ProcessingStep =
  | { kind: 'apodization'; window: 'exp' | 'gauss' | 'sine' | 'cosine' | 'traficante'; params: Record<string, number> }
  | { kind: 'zero_fill'; factor: number }
  | { kind: 'linear_prediction'; mode: 'forward' | 'backward'; points: number }
  | { kind: 'group_delay'; mode: 'auto' | 'manual'; points?: number }
  | { kind: 'fid_shift'; points: number }
  | { kind: 'ft'; dimensions: 1 | 2 }
  | { kind: 'phase'; mode: 'auto' | 'manual'; ph0?: number; ph1?: number; algorithm?: string }
  | { kind: 'baseline'; algorithm: 'polynomial' | 'bernstein' | 'whittaker' | 'spline'; degree?: number; auto: boolean }
  | { kind: 'reference'; ppm: number; nucleus?: string; method?: 'manual' | 'solvent' | 'absolute' }
  | { kind: 'noise_reduction'; method: 'smooth' | 'denoise' | 'resolution_booster'; params?: Record<string, number> }
  | { kind: 'signal_suppression'; region: [number, number]; method?: string }
  | { kind: 'symmetrize'; method?: string }
  | { kind: 'tilt45' }
  | { kind: 't1_noise_reduction' }
  | { kind: 'covariance'; operation: 'sqrt' | 'trans' }
  | { kind: 'normalize'; method: 'area' | 'max' | 'reference_peak' }
  | { kind: 'bin'; width: number; unit: 'ppm' | 'hz' }
  | { kind: 'reference_deconvolution'; referenceRegion: [number, number] };
```

## III. Prediction / Verify / Spin Simulation Layer

```
lib/prediction/
├── PredictionOrchestrator.ts     — 1H/13C/HSQC predict dispatch
├── backends/
│   ├── HOSEBackend.ts
│   ├── DeterministicBackend.ts   — MEVCUT (deterministicPredictor.ts taşınır)
│   ├── DatabaseBackend.ts
│   ├── QMBackend.ts
│   └── BackendRegistry.ts
├── PredictionDatabase.ts
├── CompareService.ts             — Predict & Compare
├── HighlightService.ts           — Predict & Highlight
└── types.ts

lib/verification/
├── VerificationOrchestrator.ts
├── tests/
│   ├── ShiftAgreementTest.ts
│   ├── MultiplicityTest.ts
│   ├── IntegrationTest.ts
│   ├── HSQCCoverageTest.ts
│   ├── HMBCPlausibilityTest.ts
│   ├── FormulaAgreementTest.ts
│   ├── IRCompatibilityTest.ts
│   └── MSMatchTest.ts
├── CandidateRanker.ts
├── BatchVerifier.ts
├── Explainer.ts                  — Negative result troubleshooting
├── types.ts                      — MEVCUT (genişletilir)
└── constants.ts                  — MEVCUT
```

## IV. MS Workspace

```
lib/ms/
├── models/
│   ├── ChromatogramTrace.ts
│   ├── MassSpectrum.ts
│   └── MsDocument.ts
├── import/
│   └── MsImportAdapters.ts
├── analysis/
│   ├── EicExtractor.ts
│   ├── PeakDetector.ts
│   ├── ChargeDeconvolution.ts
│   ├── ElementalComposition.ts
│   ├── MolecularMatcher.ts
│   └── RtAlignmentService.ts
├── prediction/
│   └── MsPredictor.ts
├── isotope-engine.ts             — MEVCUT
└── fragmentation-engine.ts       — MEVCUT
```

## V. IR / UV Workspace

```
lib/ir/
├── models/
│   └── IrSpectrum.ts
├── processing/
│   ├── BaselineCorrection.ts
│   ├── Normalization.ts
│   ├── MSCCorrection.ts
│   ├── Smoothing.ts
│   ├── DerivativeSpectra.ts
│   ├── PeakPicker.ts
│   └── IrProcessingTemplate.ts
├── analysis/
│   ├── FunctionalGroupScorer.ts
│   └── ChromophoreDetector.ts
└── ir_engine/                    — MEVCUT (taşınır)
```

## VI. Molecule Workstation

```
lib/molecule/
├── MoleculeRegistry.ts           — Merkezi kayıt
├── CompoundsTable.ts
├── SdfBrowser.ts
├── ConformerService.ts
├── PropertyCalculator.ts
└── types.ts
```

## VII. Document / Report

```
lib/report/
├── models/
│   ├── WorkspaceDocument.ts
│   ├── WorkspacePage.ts
│   └── PageObject.ts
├── LayoutEngine.ts
├── LayoutTemplateManager.ts
├── PdfExporter.ts
├── AuditTrailRenderer.ts
└── ReportObjectFactory.ts
```

## VIII. Database

```
lib/database/
├── DatabaseService.ts
├── SchemaManager.ts
├── SearchEngine.ts
├── CustomFieldManager.ts
└── MigrationRunner.ts
```

## IX. Scripting / CLI

```
lib/scripting/
├── ScriptContext.ts              — Ana facade
├── facades/
│   ├── DocumentFacade.ts
│   ├── NmrFacade.ts
│   ├── MsFacade.ts
│   ├── IrFacade.ts
│   ├── MoleculeFacade.ts
│   ├── DbFacade.ts
│   ├── ReportFacade.ts
│   └── IoFacade.ts
├── ScriptRunner.ts
├── CliRunner.ts
└── BatchJobManager.ts
```

## X. Plugin Platform

```
lib/plugins/
├── PluginManager.ts
├── PluginApi.ts
├── types.ts
└── builtin/
    ├── qnmr/
    ├── pca/
    ├── reaction-monitoring/
    ├── iupac/
    └── structure-elucidation/
```

## XI. Frontend Architecture

```
components/
├── workstation/
│   ├── WorkstationLayout.tsx     — Ana çalışma alanı
│   ├── PageNavigator.tsx
│   └── ObjectCanvas.tsx
├── nmr/
│   ├── NMRProcessingPanel.tsx
│   ├── NMR1DViewer.tsx
│   ├── NMR2DViewer.tsx
│   ├── MultipletManager.tsx
│   ├── AssignmentPanel.tsx
│   ├── StackedViewer.tsx
│   └── SpinSimulationPanel.tsx
├── ms/
│   ├── ChromatogramViewer.tsx
│   ├── MassSpectrumViewer.tsx
│   └── MolecularMatchPanel.tsx
├── ir/
│   ├── IrSpectrumViewer.tsx
│   └── IrProcessingPanel.tsx
├── molecule/
│   ├── CompoundsTable.tsx
│   ├── SdfBrowserPanel.tsx
│   ├── MoleculeEditor.tsx
│   └── ConformerViewer.tsx       — MEVCUT (taşınır)
├── verify/
│   ├── VerificationPanel.tsx
│   ├── CandidateRankingTable.tsx
│   └── EvidenceBreakdown.tsx
├── report/
│   ├── ReportEditor.tsx
│   ├── ReportObjectPalette.tsx
│   └── PdfPreview.tsx
├── database/
│   ├── DatabaseBrowser.tsx
│   └── SearchPanel.tsx
└── common/
    ├── AuditTrailPanel.tsx
    └── ProvenanceBadge.tsx
```

## XII. State Management — Zustand Store

```typescript
interface SpectroMindState {
  // Document
  activeDocument: AnalyticalDocument | null;
  openDocuments: AnalyticalDocument[];
  
  // Molecules  
  moleculeRegistry: Map<string, MoleculeRecord>;
  activeMoleculeId: string | null;
  
  // Datasets
  datasets: Map<string, NormalizedDataset>;
  activeDatasetId: string | null;
  
  // Processing
  processingGraphs: Map<string, ProcessingStep[]>;
  
  // Analysis
  peaks: Map<string, Peak[]>;
  multiplets: Map<string, Multiplet[]>;
  assignments: AssignmentEdge[];
  evidenceGraph: EvidenceNode[];
  
  // Verification
  verificationResults: Map<string, VerificationResult>;
  
  // UI
  activePanel: 'nmr' | 'ms' | 'ir' | 'molecule' | 'verify' | 'report' | 'db';
  sidebarOpen: boolean;
  
  // Actions
  loadDocument: (doc: AnalyticalDocument) => void;
  addDataset: (dataset: NormalizedDataset) => void;
  registerMolecule: (mol: MoleculeRecord) => void;
  addProcessingStep: (datasetId: string, step: ProcessingStep) => void;
  addAssignment: (edge: AssignmentEdge) => void;
  addEvidenceNode: (node: EvidenceNode) => void;
}
```

## XIII. Event Flow

```
User drops FID folder
  → VendorAdapter.inspect() → format detection
  → VendorAdapter.import() → NormalizedDataset
  → AuditService.log('import', ...)
  → ProcessingGraph.apply(template) → processed spectrum
  → AuditService.log('processing', ...)
  → PeakPicker.pick() → peaks
  → MultipletAnalyzer.analyze() → multiplets
  → ImpurityDetector.classify() → compound/solvent/impurity
  → MoleculeRegistry.link(datasetId, moleculeId)
  → PredictionOrchestrator.predict(molecule)
  → VerificationOrchestrator.verify(observed, predicted)
  → EvidenceGraph.update(nodes)
  → ReportPage.addObject(spectrumObj, moleculeObj, tableObj)
  → AuditService.log('analysis_complete', ...)
```

## XIV. Teknoloji Kararları

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| Global State | Zustand | Hafif, TypeScript-first, middleware desteği |
| Processing Engine | Pure TypeScript + WASM | Python spawn'dan kurtulma, tarayıcıda çalışabilme |
| 2D Rendering | Canvas 2D API | WebGL gereksiz, Canvas yeterli performans |
| Document Canvas | Custom layout engine | Mevcut kütüphaneler bilimsel nesne semantiğini bilmiyor |
| Database | SQLite (client) + PostgreSQL (server) | Offline + sunucu modları |
| PDF Export | jsPDF + custom renderer | Bilimsel nesne fidelity |
| Plugin API | TypeScript interface + dynamic import | Tip güvenli, lazy loading |
