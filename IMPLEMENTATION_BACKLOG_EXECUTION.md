# Implementation Backlog — Execution Priority — 2026-03-31

## P0: Blocking Architecture Issues

| # | Task | Why P0 | Files |
|---|------|--------|-------|
| P0-1 | **Wire Zustand store to page.tsx** — migrate 14 useState to store selectors | Store exists but unused; all prop drilling remains | `app/page.tsx`, `lib/core/store/spectromindStore.ts` |
| P0-2 | **Dead import/state cleanup** — remove 11 dead imports + `knownMoleculeName` state | Technical debt blocking clean migration | `app/page.tsx` |
| P0-3 | **Implement real ReferencingStep** — axis shift, ppm calculation | Referencing is placeholder; chemical shifts are meaningless without it | `lib/nmr/processing/steps/ReferencingStep.ts` |
| P0-4 | **Add legacy type bridge** — NMRPeak[] ↔ NormalizedDataset adapter | Core models unreachable from current UI | NEW: `lib/core/bridges/` |
| P0-5 | **Extend spectromindStore** — add peaks/spectrum type/solvent/frequency slices for page.tsx migration | Current store has dataset/molecule model but not legacy peak arrays | `lib/core/store/spectromindStore.ts` |

## P1: Scientific Core Gaps

| # | Task | Why P1 | Files |
|---|------|--------|-------|
| P1-1 | **NMR Processing Panel UI** — step list, params, toggle, preview | Processing engine has no user surface | NEW: `components/nmr/NMRProcessingPanel.tsx` |
| P1-2 | **Phase correction ph1 support** — auto grid search on ph0+ph1 | Current auto-phase is ph0-only; inadequate for real data | `lib/nmr/processing/steps/PhaseCorrectionStep.ts` |
| P1-3 | **Baseline bernstein honesty** — implement or rename | Currently lies — routes to polynomial | `lib/nmr/processing/steps/BaselineCorrectionStep.ts` |
| P1-4 | **PeakPicker service** — threshold + local max + noise estimate | Peak picking exists in FID Python but not in TS processing chain | NEW: `lib/nmr/analysis/PeakPicker.ts` |
| P1-5 | **IntegrationService** — region-based, absolute/relative, normalize | Integration logic scattered in utils, not service | NEW: `lib/nmr/analysis/IntegrationService.ts` |
| P1-6 | **MultipletAnalyzer enhancement** — J extraction, classification, overlap scoring | Existing `multipletAnalysis.ts` is basic | Extend: `lib/nmr/multipletAnalysis.ts` |
| P1-7 | **ImpurityDetector** — compound/solvent/impurity classification with editable knowledge tables | `isSolvent` flag exists but no systematic detector | NEW: `lib/nmr/analysis/ImpurityDetector.ts` |
| P1-8 | **Core type unification** — Solvent (3 defs → 1), MSPeak (2 → 1), Conformer (2 → 1) | Type divergence causes runtime mismatches | `lib/types/index.ts`, `lib/types/nmr-simulation.ts`, `lib/types/v2/index.ts` |
| P1-9 | **2D NMR foundation model** — TwoDNmrDataset, TwoDPeak, trace attachment types | 2D is the biggest competitive gap; no data model exists | NEW: `lib/core/models/TwoDNmrDataset.ts` |
| P1-10 | **Molecule registry wiring** — CompoundsTable service, link molecules to store | MoleculeRecord type exists but no registry service or UI | NEW: `lib/molecule/MoleculeRegistry.ts` |

## P2: Productization Gaps

| # | Task | Files |
|---|------|-------|
| P2-1 | Stacked/arrayed experiment model | NEW: `lib/nmr/stacked/StackedDataset.ts` |
| P2-2 | MS dual model (chromatogram + spectrum) | NEW: `lib/ms/models/` |
| P2-3 | IR preprocessing pipeline | NEW: `lib/ir/processing/` |
| P2-4 | Multipage document model | NEW: `lib/report/models/` |
| P2-5 | Verify orchestrator with explainability | NEW or extend: `lib/verification/` |
| P2-6 | Prediction orchestrator with backend registry | NEW: `lib/prediction/` |
| P2-7 | Processing template UI (save/load) | `components/nmr/` |
| P2-8 | Assignment panel UI | NEW: `components/nmr/AssignmentPanel.tsx` |
| P2-9 | Database service + browser | NEW: `lib/database/` |
| P2-10 | PDF export pipeline | NEW: `lib/report/PdfExporter.ts` |

## P3: Advanced / Plugin / Future

| # | Task |
|---|------|
| P3-1 | Plugin registration API |
| P3-2 | Script context facade |
| P3-3 | CLI headless runner |
| P3-4 | qNMR plugin |
| P3-5 | PCA/chemometrics plugin |
| P3-6 | Reaction monitoring plugin |
| P3-7 | DOSY transform |
| P3-8 | Covariance NMR |
| P3-9 | Digital signature support |
| P3-10 | NUS processing |

## Execution Order

Immediate next actions (this session):
1. P0-2: Dead import cleanup
2. P0-5: Extend store with legacy-compatible slices
3. P0-1: Wire store to page.tsx
4. P0-3: Real ReferencingStep
5. P0-4: Legacy type bridge
6. P1-1: NMR Processing Panel UI

Then:
7. P1-8: Core type unification
8. P1-4 + P1-5: PeakPicker + IntegrationService
9. P1-9: 2D foundation
10. P1-10: Molecule registry wiring
