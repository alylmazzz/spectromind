# Repo Yapısı, Servis Özeti ve Python Spawn Denetimi

## 1) Repo ağacı (özet)

```
spectromind/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (bir kısmı Python spawn kullanıyor)
│   │   ├── ai-nmr-predict/
│   │   ├── elucidation-v15/
│   │   ├── fid/process/
│   │   ├── hose-predict/    # spawn: hose.py
│   │   ├── nmrshiftdb/      # exec: curl fallback
│   │   ├── rdkit/           # draw-2d, generate-sdf, parse-smiles, sdf-to-3d, analyze-structure, elucidation, calculate-energy
│   │   └── v2/              # predict, nmr-engine, ms-predict, gnn, dft, vector-search, self-correction, vb.
│   ├── page.tsx             # Ana sayfa: Sidebar + grafikler + Analiz
│   └── simulate/            # (yeni) Spektrum simülasyon paneli
├── components/
│   ├── analysis/            # AnalysisResultDisplay, Molecule2D/3D, CrystalStructure
│   ├── charts/              # NMRChart, FTIRChart, Carbon13Chart
│   ├── fid/                 # FIDProcessorV2, SpectrumPlot
│   ├── sidebar/             # Sidebar, PeakInput, BulkInput
│   └── spectra/             # MSChart
├── lib/
│   ├── api/                 # gemini, openai
│   ├── chem/                # formula
│   ├── engines/              # predictor/hose.py (Python)
│   ├── fid/, hooks/, nmr/   # NMR pipeline, coupling, shift-engine, spin-system
│   ├── pipeline/            # MoleculePipelineService
│   ├── services/            # TheoreticalSpectrumService, RDKitService, v2/* (MSService, GNNService, DFTService, ConformerService, VectorSearchService)
│   ├── spectromind/         # core, nmr_engine, ir_engine, symmetry
│   └── utils/               # pythonPath, peakParser, enhancedLibraryServer
├── packages/                # (yeni) schemas, rulepacks, spectrotester-compat
│   └── schemas/
├── services/                # Kalıcı Python/FastAPI servisleri
│   ├── chem-core/          # (yeni) parse-standardize, RDKit tek otorite
│   ├── nmr-engine/          # HOSE + GNN, 1H/13C
│   ├── ms-service/, dft-service/, conformer-service/
│   ├── ultrathink-service/, vector-service/, gnn-service/
│   ├── opsin-service/, celery-worker/, self-correction/
│   └── database/
├── Spectrotester/           # v33: Spectromasterv0.2tester.html, ruleset.json, library
├── scripts/                 # elucidation_v15.py, fid_process.py, fid_processor.py, rdkit_*
├── docs/
└── public/
```

## 2) Mevcut servisler ve UI akışı

### Servisler (FastAPI / kalıcı)

| Servis | Port / URL | Açıklama |
|--------|------------|----------|
| nmr-engine | (docker/env) | HOSE + GNN, 1H/13C tahmin |
| ms-service | (docker/env) | MS predictor |
| dft-service | (docker/env) | XTB NMR |
| conformer-service | (docker/env) | Konformer analizi |
| gnn-service | (docker/env) | GNN model |
| ultrathink-service | (docker/env) | UltraThink motor |
| vector-service | (docker/env) | Vector search |
| opsin-service | (docker/env) | IUPAC→SMILES |

### UI akışı (app/page.tsx)

- **Sidebar:** Peak girişi (1H/13C/IR/MS), formül, SMILES, “Analiz” butonu.
- **Analiz:** `useSpectralAnalysis` → AI tahmin + kütüphane/PubChem arama; HOSE tahmini (SMILES varsa) `/api/hose-predict` ile.
- **Grafikler:** NMRChart, Carbon13Chart, FTIRChart, MSChart; AnalysisResultDisplay.
- **Varsayılan:** SMILES yoksa mevcut pipeline (peak/formül/kütüphane) çalışıyor.

### NMR / HOSE yolları

- **1H teorik:** `TheoreticalSpectrumService.generate1HNMR` → `/api/hose-predict` (spawn).
- **HOSE API:** `app/api/hose-predict/route.ts` → `spawn(venvPythonPath, [scriptPath, smiles])` → `lib/engines/predictor/hose.py`.
- **NMR Engine servisi:** `services/nmr-engine/main.py` → `hose_predictor.predict_h1` / `predict_c13`; `lib/services/v2/NMREngineService.ts` HTTP ile bu servisi çağırıyor (spawn yok).

## 3) Python spawn / exec noktaları (liste)

| # | Dosya | Kullanım | Script / Komut | Refactor hedefi |
|---|--------|----------|-----------------|------------------|
| 1 | `app/api/hose-predict/route.ts` | `spawn` | `venv_rdkit/bin/python3`, `lib/engines/predictor/hose.py` | `nmr-engine` HTTP (POST /predict/1h) kullan; route sadece proxy. |
| 2 | `app/api/fid/process/route.ts` | `spawn` | `scripts/fid_process.py` veya `fid_processor.py` | FID işleme için kalıcı `services/fid-processor` FastAPI servisi. |
| 3 | `app/api/rdkit/parse-smiles/route.ts` | `exec` | Geçici .py, RDKit parse | `services/chem-core` POST /parse-standardize. |
| 4 | `app/api/rdkit/draw-2d/route.ts` | `exec` | Geçici .py, RDKit MolToImage | chem-core’a GET /draw-2d ekle veya ayrı görselleştirme servisi. |
| 5 | `app/api/rdkit/generate-sdf/route.ts` | `exec` | Geçici .py, RDKit SDF | chem-core’a POST /generate-sdf. |
| 6 | `app/api/rdkit/sdf-to-3d/route.ts` | `exec` | Inline Python, 3D | conformer-service veya chem-core ile birleştir. |
| 7 | `app/api/rdkit/analyze-structure/route.ts` | `spawn` | `scripts/rdkit_structure_analyzer.py` | chem-core POST /features veya /analyze. |
| 8 | `app/api/rdkit/elucidation/route.ts` | `spawn` | `scripts/rdkit_elucidation.py` | Ayrı elucidation servisi veya nmr-engine’e ekle. |
| 9 | `app/api/rdkit/calculate-energy/route.ts` | `spawn` | `scripts/rdkit_energy_calculator.py` | dft-service veya conformer-service. |
| 10 | `app/api/elucidation-v15/route.ts` | `spawn` | `scripts/elucidation_v15.py` | Kalıcı elucidation servisi. |
| 11 | `app/api/v2/self-correction/route.ts` | `exec` | Geçici .py, self_correction_loop | services/self-correction’ı HTTP API yap; route proxy. |
| 12 | `app/api/nmrshiftdb/route.ts` | `exec` (fallback) | `curl` | Ağ çağrısı; Python yok, bırakılabilir. |
| 13 | `lib/services/v2/MSService.ts` | `exec` | Geçici .py → ms_predictor | ms-service’e HTTP ile bağlan; fallback kaldırılabilir. |
| 14 | `lib/services/v2/GNNService.ts` | `exec` | Geçici .py fallback | gnn-service HTTP; fallback sadece servis yoksa. |
| 15 | `lib/services/v2/ConformerService.ts` | `exec` | Geçici .py, conformer_engine | conformer-service HTTP. |
| 16 | `lib/services/v2/VectorSearchService.ts` | `exec` | Geçici .py, vector_search_engine | vector-service HTTP. |
| 17 | `lib/services/v2/DFTService.ts` | `exec` | Geçici .py, xtb_nmr_engine | dft-service HTTP. |

**Not:** `app/api/hose-predict/route.ts` Windows’ta `venv_rdkit/bin/python3` kullanıyor (satır 31); Windows’ta `venv_rdkit\Scripts\python.exe` olmalı. `getPythonPath()` kullanılmalı.

## 4) Spectrotester (v33) konumu ve fonksiyonlar

- **Konum:** `spectromind/Spectrotester/`
- **Ana dosya:** `Spectromasterv0.2tester.html` (tek dev HTML/JS)
- **Üretim:** `generate1H`, `generate13C`, `generate2D`, `generateMS`, `generateIR` (satır ~3754, 5459, 7875, 7683, 7820).
- **Teyit:** `verify1H`, `verify13C`, `verifyMS`, `verifyIR` (satır ~15628, 14829, vb.).
- **Kural:** `lib/spectra/library/ruleset.json`, `rule_schema.json`, `teyit_raporu_schema.json`, `verification_library_seed.json`.

## 5) Refactor öncelik sırası (spawn → servis)

1. **chem-core:** parse-standardize + features (RDKit). Tüm parse-smiles / draw-2d / generate-sdf / analyze-structure buraya taşınır.
2. **hose-predict:** Sadece `nmr-engine` HTTP client; spawn kaldırılır.
3. **FID process:** Ayrı `fid-processor` servisi veya mevcut Pyodide/worker ile client-side.
4. **v2 servisleri:** MSService, GNNService, ConformerService, VectorSearchService, DFTService → yalnızca HTTP, exec fallback kaldırılır veya opsiyonel.
5. **elucidation / self-correction:** Kalıcı servis + API route proxy.

Bu belge, ADR-0001 ve vertical slice ile uyumludur.
