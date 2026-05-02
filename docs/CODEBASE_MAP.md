# Codebase Map

## Layer A: Chemistry Kernel

| Module | Path | Role |
|--------|------|------|
| Formula/DBE/AtomCounts | `lib/chem/formula.ts` | Single source of truth |
| Chem Kernel Package | `packages/chem-kernel/` | Unified exports + utilities |
| Parse & Standardize API | `app/api/parse_and_standardize/route.ts` | RDKit SMILES→Graph |
| Chem Core Service | `services/chem-core/main.py` | Python FastAPI alternative |
| Molecular Structure (DEPRECATED) | `lib/utils/molecularStructure.ts` | Legacy JS parser — not production-safe |

## Layer B: Forward Spectral Generation

| Module | Path | Modality |
|--------|------|----------|
| Deterministic Predictor | `lib/nmr/deterministicPredictor.ts` | 1H NMR |
| Shift Engine | `lib/nmr/shift-engine/` | 1H chemical shift layers |
| Coupling Engine | `lib/nmr/coupling-engine/` | J-coupling calculation |
| Spin System Solver | `lib/nmr/spin-system/` | Multiplet generation |
| Equivalence Engine | `lib/nmr/equivalence-engine/` | Proton grouping |
| Lineshape Engine | `lib/nmr/lineshape-engine/` | Peak shape generation |
| Spectrum Renderer | `lib/nmr/spectrum-renderer/` | Rasterization + export |
| FTIR Engine | `lib/spectromind/ir_engine/ftirEngine.ts` | IR band prediction |
| Spectrum Generator | `lib/utils/spectrumGenerator.ts` | Visual curve generation |
| HOSE Predictor | scripts + `app/api/hose-predict/` | Fast 1H estimation |
| MS Service | `services/ms-service/` | Mass spec prediction |
| Simulate API | `app/api/simulate/route.ts` | Unified simulation endpoint |

## Layer C: Verification Engine

| Module | Path | Role |
|--------|------|------|
| Rule Evaluator | `Spectrotester/src/core/verify/evaluateRules.ts` | 57 rule evaluators |
| Scoring | `Spectrotester/src/core/verify/scoring.ts` | Aggregate scoring |
| Report Builder | `Spectrotester/src/core/verify/report.ts` | Report generation |
| Ruleset | `Spectrotester/lib/spectra/library/ruleset.json` | 57 declarative rules |
| Engine Core | `Spectrotester/src/core/engine.ts` | Orchestration |
| Graph Features | `Spectrotester/src/core/graph/features.ts` | Feature extraction |

## Layer D: Inverse Elucidation

| Module | Path | Role |
|--------|------|------|
| Elucidation Engine | `lib/elucidation/engine.ts` | Pipeline: observe→constrain→generate→rank |
| Spectral Analysis Hook | `lib/hooks/useSpectralAnalysis.ts` | Client-side analysis flow |
| Pipeline Service | `lib/pipeline/MoleculePipelineService.ts` | End-to-end pipeline |

## Layer E: Infrastructure

| Module | Path | Role |
|--------|------|------|
| Schemas | `packages/schemas/index.ts` | Shared type definitions |
| Calibration Profiles | `lib/calibration/profiles.ts` | Solvent/tolerance/impurity data |
| Verification Types | `lib/verification/types.ts` | Graph and report types |
| Peak Parser | `lib/utils/peakParser.ts` | Text→structured peaks |
| Peak Validation | `lib/utils/peakValidation.ts` | Shift range validation |

## Documentation package (2026-04)

| Document | Role |
|----------|------|
| `docs/SYSTEM_OVERVIEW.md` | Ürün + olgunluk özeti |
| `docs/ARCHITECTURE_OVERVIEW.md` | FE/BE, Python, yetkili vs legacy yollar |
| `docs/CODEBASE_MAP.md` | Bu dosya — navigasyon |
| `docs/SCIENTIFIC_PROCESSING_OVERVIEW.md` | Gözlenen vs simüle, 1D/13C/2D durumu |
| `docs/FID_UPLOAD_AND_PROCESSING_ARCHITECTURE.md` | FID upload/temp/zincir |
| `docs/OBSERVED_SPECTRUM_PIPELINE.md` | Gözlenen artifact akışı |
| `docs/OBSERVED_SIMULATION_PPM_CONTRACT.md` | PPM/domain sözleşmesi |
| `docs/NMR_VISUALIZATION_AND_SCALING_SPEC.md` | Chart ölçek, overlay |
| `docs/PHASE_BASELINE_REFERENCE_QC.md` | Faz/tabanı/referans/QC |
| `docs/PEAK_PICKING_AND_SIMULATION_SPEC.md` | Pik + Lorentzian |
| `docs/API_REFERENCE.md` | Route özetleri |
| `docs/SCHEMA_REFERENCE.md` | TS/Python zarf tipleri |
| `docs/RULE_ENGINE_AND_QC.md` | Spectrotester kuralları |
| `docs/VENDOR_SUPPORT_MATRIX.md` | Vendor matrisi |
| `docs/DEBUGGING_GUIDE.md` | Teşhis |
| `docs/DEVELOPER_ONBOARDING.md` | Kurulum + uzantı |
| `docs/LIMITATIONS_AND_TECHNICAL_DEBT.md` | Borç ve risk |
| `docs/FINAL_IMPLEMENTATION_AUDIT.md` | IMPLEMENTED/PARTIAL/… tablosu |

DOCX paket üretimi: `npm run doc:spectromind-system` → `docs/SPECTROMIND_SISTEM_DOKUMANTASYONU.docx`

## API Routes (46 `app/api/**/route.ts`)

See `app/api/` — categorized in ARCHITECTURE_CONFLICTS.md
