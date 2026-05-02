# SpectroMind vs Mnova Gap Matrix — 2026-03-31

Durum Kodları:
- ✅ Olgun — Ürünleşmiş, bilimsel olarak güvenilir
- 🟡 Kısmi — Kod var ama eksik/kırılgan/ürünleşmemiş
- 🔴 Yok — Hiç yok veya stub

Öncelik: P0 = acil, P1 = yakın, P2 = orta vade, P3 = uzun vade

## I. PLATFORM & DATA MODEL

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 1 | Normalize edilmiş çoklu-modalite veri modeli | NMR+MS+IR+UV tek belgede | `observed-data.ts` + `packages/schemas` tipleri var ama runtime kullanımı kısmi | 🟡 | P0 |
| 2 | Vendor-aware import (Bruker/Varian/JEOL/Magritek+) | 15+ NMR + 10+ MS + 5+ IR format | formatDetector + acqus parser, Bruker/Varian/JEOL sezgisi, Python spawn | 🟡 | P1 |
| 3 | Multipage WYSIWYG belge modeli | Çekirdek özellik — sayfa, nesne, hizalama, template | Yok | 🔴 | P1 |
| 4 | Layout templates | Rapor şablonu sistemi | Yok | 🔴 | P2 |
| 5 | Audit trail | İşlem/script/verify kaydı | `AuditTrace` tipi var, runtime/UI yok | 🟡 | P0 |
| 6 | Provenance | Dosya→işleme→analiz→rapor zinciri | `DataProvenance`, `ProcessingProvenance` tipleri var, runtime kısmi | 🟡 | P0 |
| 7 | Global state management | N/A (masaüstü) | useState + prop drilling, store yok | 🔴 | P0 |
| 8 | Undo/redo | Tam | Yok | 🔴 | P2 |

## II. NMR PROCESSING

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 9 | Fourier Transform | Çekirdek | Python spawn (fid_process.py) | 🟡 | P0 |
| 10 | Group delay correction | Enhanced correction | acqus.ts'de parse, işleme Python'da | 🟡 | P1 |
| 11 | Apodization (exp, gauss, sine, etc.) | 10+ pencere | Python'da kısmi | 🟡 | P0 |
| 12 | Zero filling | Tam | Python'da var | 🟡 | P0 |
| 13 | Linear prediction | Forward/backward | Yok | 🔴 | P2 |
| 14 | Phase correction (auto + manual) | Çok modlu | Python auto + ManualPhaseRefPanel | 🟡 | P1 |
| 15 | Baseline correction | Poly/Bernstein/Whittaker | Python'da kısmi | 🟡 | P1 |
| 16 | NUS processing | Tam | Yok | 🔴 | P3 |
| 17 | Covariance NMR | Matris dönüşümleri | Yok | 🔴 | P3 |
| 18 | Symmetrization / Tilt45 / t1 noise | Tam | Yok | 🔴 | P2 |
| 19 | Reference deconvolution | Tam | Yok | 🔴 | P2 |
| 20 | Resolution booster / Denoise | Tam | Yok | 🔴 | P2 |
| 21 | Processing templates | Kaydet/yükle/batch | Yok | 🔴 | P1 |
| 22 | Processing graph (DAG temsili) | Dolaylı (template sistemi) | `ProcessingRecord` tipi var ama gerçek DAG yok | 🟡 | P0 |

## III. NMR ANALYSIS

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 23 | Chemical shift referencing | TMS/TSP/solvent, absolute, 2D | `calibration/profiles.ts` + Python referencing | 🟡 | P1 |
| 24 | Peak picking (auto + manual + GSD) | Çekirdek — GSD varsayılan | `integralDetection.ts`, Python peak picking | 🟡 | P1 |
| 25 | Impurity/solvent autodetection | Çekirdek | `isSolvent` flag + solvent profiles | 🟡 | P1 |
| 26 | Integration + integral table | Tam | `integrationNormalizer.ts` — kısmi | 🟡 | P1 |
| 27 | Multiplet analysis + manager | Olgun — GSD, overlap, report | `multipletAnalysis.ts` — temel, overlap çözümü yok | 🟡 | P1 |
| 28 | Assignment (manual + auto + transfer) | Korelasyon tabanlı dedüksiyon | Şema var (AssignmentEdge benzeri), UI yok | 🟡 | P1 |
| 29 | Assignment table + dataset transfer | Tam | Yok | 🔴 | P2 |
| 30 | Intelligent clipboard | Peak/multiplet/assignment transferi | Yok | 🔴 | P3 |

## IV. 2D NMR

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 31 | 2D matrix processing | FT, phase, baseline, tilt | nmr2dSchema.ts şema — işleme yok | 🟡 | P1 |
| 32 | Contour engine | Tam, palette editörü | Yok | 🔴 | P1 |
| 33 | External trace attach (1D↔2D) | Otomatik + drag-drop | Yok | 🔴 | P1 |
| 34 | 2D peak picking | Tam | Yok | 🔴 | P2 |
| 35 | 2D assignment | HSQC/COSY/HMBC/NOESY | Şemada var, UI yok | 🟡 | P2 |
| 36 | Absolute reference (2D + x-nuclei) | Tam | Yok | 🔴 | P2 |

## V. STACKED / ARRAYED / BATCH NMR

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 37 | Arrayed experiment model | Tam | Yok | 🔴 | P2 |
| 38 | Stacked display modes | 5 mod | Yok | 🔴 | P2 |
| 39 | Active vs selected spectra | İki katman | Yok | 🔴 | P2 |
| 40 | Reference alignment | Auto + manual | Yok | 🔴 | P2 |
| 41 | T1/T2 analysis | Mono/biexp fit | Yok | 🔴 | P2 |
| 42 | DOSY/ROSY transform | Tam | Yok | 🔴 | P3 |
| 43 | Reaction monitoring | Dataset import + region + kinetics | Yok | 🔴 | P3 |
| 44 | Batch processing (scripted) | Template + CLI batch | Yok | 🔴 | P2 |

## VI. PREDICTION / VERIFY / SPIN SIMULATION

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 45 | 1H prediction (HOSE/DB/rule) | Mestrelab + Modgraph | deterministicPredictor + HOSE Python | 🟡 | P1 |
| 46 | 13C prediction | Tam | carbon13/engine.ts — kısmi (~5-20 ppm hata) | 🟡 | P1 |
| 47 | Predict & Highlight / Compare / Verify | 3 farklı workflow | Kısmi (simulate route) | 🟡 | P1 |
| 48 | Spin simulation (panel + overlay) | XML save, subsystem, second-order | hamiltonianSolver.ts + firstOrderSolver.ts — backend var, panel yok | 🟡 | P1 |
| 49 | Prediction database | Kaydet/güncelle | Yok | 🔴 | P2 |
| 50 | Verify — single mode | Olgun | Spectrotester verify + schemas — kısmi | 🟡 | P1 |
| 51 | Verify — batch mode | Tam | Yok | 🔴 | P2 |
| 52 | Verify — negative troubleshooting | Ayrıntılı | Yok | 🔴 | P2 |
| 53 | Candidate ranking | Skor tabanlı | ElucidationReport.alternatives — kısmi | 🟡 | P2 |

## VII. MOLECULE WORKSTATION

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 54 | Compounds Table | Tam (formula, MW, DBE, custom) | Yok | 🔴 | P1 |
| 55 | SDF Browser | Filtre, arama, import | Yok | 🔴 | P2 |
| 56 | 2D molecule editor | Template, dative bond, radical | RDKit SVG (salt okunur) | 🟡 | P2 |
| 57 | 3D molecule viewer | Konformer, stereo | 3Dmol + ConformerViewer — iyi temel | 🟡 | P1 |
| 58 | Atom numbering + labels | Düzenlenebilir | Kısmi (RDKit atomNumbers) | 🟡 | P2 |
| 59 | Molecule registry (merkezi) | Compounds Table = registry | Yok — her modül kendi yapısını taşıyor | 🔴 | P0 |

## VIII. MASS SPECTROMETRY WORKSPACE

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 60 | ChromatogramTrace model | TIC/BPC/EIC/custom | Yok | 🔴 | P2 |
| 61 | MassSpectrum model | Tam | MSPeak[] — basit dizi | 🟡 | P1 |
| 62 | MS browser (spectrum selection) | Tam | MSChart — temel | 🟡 | P2 |
| 63 | Chromatographic peak detection | Tam | Yok | 🔴 | P2 |
| 64 | Charge state deconvolution | Tam | Yok | 🔴 | P3 |
| 65 | Elemental composition | Tam | isotope-engine — temel | 🟡 | P2 |
| 66 | Molecular match | Adduct/fragment/dimer | fragmentation-engine — kısmi | 🟡 | P2 |
| 67 | MS assignment table | Tam | Yok | 🔴 | P2 |
| 68 | MS spectrum prediction | Tam | v2/ms-predict route — temel | 🟡 | P2 |
| 69 | RT alignment / autoalignment | Tam | Yok | 🔴 | P3 |

## IX. IR / UV WORKSPACE

| # | Yetenek | Mnova ElViS | SpectroMind | Durum | Öncelik |
|---|---------|-------------|-------------|-------|---------|
| 70 | Baseline correction | Tam | ftirEngine — basit | 🟡 | P2 |
| 71 | Normalization | Area/vector/max | Yok | 🔴 | P2 |
| 72 | MSC (Multiplicative Scatter) | Tam | Yok | 🔴 | P3 |
| 73 | Smoothing | SG, moving average | Yok | 🔴 | P2 |
| 74 | Derivative spectra | 1st/2nd | Yok | 🔴 | P2 |
| 75 | IR peak picking | Tam | ftirEngine peak list | 🟡 | P2 |
| 76 | IR processing templates | Tam | Yok | 🔴 | P2 |
| 77 | Functional group compatibility | İç motor | ftirEngine + v33SpectrumRules — kısmi | 🟡 | P1 |
| 78 | UV chromophore heuristics | Kısmi | Yok | 🔴 | P3 |

## X. DOCUMENT / REPORT / EXPORT

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 79 | Multipage document model | Çekirdek | Yok | 🔴 | P1 |
| 80 | Spectrum/molecule/table page objects | Tam | Yok | 🔴 | P2 |
| 81 | Annotation objects | Tam | Yok | 🔴 | P2 |
| 82 | Header/footer | Tam | Yok | 🔴 | P2 |
| 83 | PDF export | Tam | Yok | 🔴 | P2 |
| 84 | JCAMP-DX export | Tam | jcampDxExport.ts — var | ✅ | — |
| 85 | NMReDATA export | Tam | nmredataExport.ts — var | ✅ | — |
| 86 | Digital signature | Tam | Yok | 🔴 | P3 |

## XI. DATABASE

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 87 | Database create/connect | Sunucu tabanlı | schema.sql + db_service.py — stub | 🟡 | P2 |
| 88 | Custom fields | Tam | Yok | 🔴 | P2 |
| 89 | DB browser + search | Tam | Yok | 🔴 | P2 |
| 90 | DB scripts | Tam | Yok | 🔴 | P3 |

## XII. SCRIPTING / CLI / AUTOMATION

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 91 | Script engine (ECMAScript) | Tam | Yok | 🔴 | P2 |
| 92 | CLI headless runner | Tam | Yok | 🔴 | P2 |
| 93 | Processing template scripting | Tam | Yok | 🔴 | P2 |
| 94 | Batch job orchestration | Tam | Yok | 🔴 | P2 |
| 95 | Script audit logging | Tam | Yok | 🔴 | P2 |

## XIII. ADVANCED PLUGINS

| # | Yetenek | Mnova | SpectroMind | Durum | Öncelik |
|---|---------|-------|-------------|-------|---------|
| 96 | Plugin API | Register panels/services/db/report | Yok | 🔴 | P2 |
| 97 | qNMR | Concentration + purity + batch | Yok | 🔴 | P2 |
| 98 | PCA / chemometrics | Score/loading/CV/ellipse | Yok | 🔴 | P3 |
| 99 | Reaction monitoring plugin | Dataset + region + kinetics | Yok | 🔴 | P3 |
| 100 | Structure elucidation plugin | Aday üretimi + sıralama | elucidation/engine.ts — temel | 🟡 | P1 |
| 101 | IUPAC naming | Tam | opsin route — harici | 🟡 | P2 |

## Özet Sayaçlar

| Durum | Sayı |
|-------|------|
| ✅ Olgun | 2 |
| 🟡 Kısmi | 35 |
| 🔴 Yok | 64 |
| **Toplam** | **101** |
