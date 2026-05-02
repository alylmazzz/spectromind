# SpectroMind — API Reference (Major Routes)

**Scope:** `app/api/**/route.ts` handlers (~46 routes). This document lists **primary** contracts; for exhaustive discovery run a directory listing. **Shapes** are indicative — always read the route file before relying on fields in production.

---

## 1. FID / Observed NMR

| Method | Path | Role |
|--------|------|------|
| POST | `/api/fid/upload` | Multipart folder → `temp/<datasetId>/` |
| POST | `/api/fid/process` | `datasetId` **or** single `fid` file → Python processing |

**`POST /api/fid/process` (conceptual):**

- **Folder mode:** `datasetId` + optional `processingSpec` (JSON string: apodization LB, zero-fill factor, optional manual `ph0_deg`/`ph1_deg`).
- **File mode:** `fid` File + `format` — spawns **`fid_processor.py`** (legacy).
- **Response:** `FidProcessApiEnvelope` — `success`, `debug_id`, `processing_steps[]`, `observed_spectrum` (preferred), deprecated `data` mirror, `warnings`, `qc`, `peak_list`, `stderr` on failure.

**Vercel:** Returns **503** with `FID_ERROR` code `VERCEL_BLOCKED`.

---

## 2. Simulation / Prediction

| Path | Role |
|------|------|
| `/api/simulate` | Unified simulation entry (see route for body). |
| `/api/ai-generate-nmr` | LLM-assisted generation |
| `/api/ai-nmr-predict` | AI NMR predict |
| `/api/hose-predict` | HOSE-style (spawn/Python dependency per route) |
| `/api/nmrshiftdb` | External DB proxy |
| `/api/v2/predict` | v2 prediction |
| `/api/v2/nmr-engine` | NMR engine service proxy |
| `/api/v2/gnn-nmr-predict` | GNN |
| `/api/v2/ultrathink-predict` | Extended predict |

---

## 3. Structure / Cheminformatics

| Path | Role |
|------|------|
| `/api/parse_and_standardize` | SMILES → standardized structure (often Chem Core) |
| `/api/chem-core` | Proxy to chem-core service |
| `/api/rdkit/*` | draw-2d, parse-smiles, sdf-to-3d, generate-sdf, analyze-structure, calculate-energy, elucidation |
| `/api/opsin` | Name → SMILES |
| `/api/pubchem/*` | search, structure, smiles, iupac, sdf, smiles-to-cid, search-by-peaks |

---

## 4. FTIR / MS / Other

| Path | Role |
|------|------|
| `/api/ftir-predict`, `/api/ftir-theoretical`, `/api/ftir-data-aggregator`, `/api/ftir-multi-source` | IR pipelines |
| `/api/v2/ms-predict` | MS prediction |
| `/api/enhanced-library` | Library |
| `/api/molecule-library`, `/api/molecule-library/search` | Built-in library |
| `/api/save-analysis` | Persist analysis (shape in route) |

---

## 5. Elucidation / Verification-Adjacent

| Path | Role |
|------|------|
| `/api/elucidation-v15` | Elucidation pipeline |
| `/api/rdkit/elucidation` | RDKit elucidation helper |
| `/api/v2/dft-verify` | DFT verify |
| `/api/v2/conformer-analysis` | Conformers |
| `/api/v2/self-correction` | Self-correction |

---

## 6. Infrastructure

| Path | Role |
|------|------|
| `/api/v2/health` | Health |
| `/api/crossref` | Crossref |
| `/api/ai-suggest-synonyms` | Synonyms |

---

## 7. Known Inconsistencies / Migration Notes

1. **FID dual scripts:** Dataset → `fid_process.py`; single file → `fid_processor.py` — responses must both pass `normalizeFidPythonPayload`, but **internal Python capabilities may differ**.
2. **`data` vs `observed_spectrum`:** Clients should prefer **`observed_spectrum`**; `data` is legacy chart compatibility.
3. **ProcessingSpec:** Only certain manual phase fields forwarded — see `processFIDDataset` implementation.

---

## Relevant Files

- `app/api/fid/process/route.ts` — canonical FID behavior
- `lib/fid/buildFidProcessResponse.ts` — response finalization

## Extension Points

- Add optional field → update `normalizeFidPythonPayload` + `ObservedSpectrumEnvelope` builder.
