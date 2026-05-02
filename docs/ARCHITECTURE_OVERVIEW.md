# SpectroMind — Architecture Overview

**Grounding:** Code inspection of `app/`, `lib/`, `app/api/fid/`, `Spectrotester/`, `services/`.

---

## 1. Frontend Architecture

- **Framework:** Next.js (App Router), React, Tailwind.
- **Main entry:** `app/page.tsx` — resizable panels (`react-resizable-panels`), sidebar + charts + analysis panel.
- **State:**
  - **Zustand:** `lib/core/store/spectromindStore.ts` holds peaks, solvent, frequency, `observedNmrOverlay`, `fidSimulationPeaks`, and core domain placeholders (documents, datasets).
  - **Local chart state:** `NMRChart.tsx` keeps x-domain, y-scale mode, manual phase UI state (client-only adjustments layered on display; server phase is primarily from Python except where manual spec is sent).
- **Charts:** Chart.js, dynamic import in `NMRChart.tsx`; custom baseline zero-line plugin.

**Authoritative vs legacy (UI):** Peak editing is the **authoritative** source for theoretical curves. Observed data enters only through FID API → `observedNmrOverlay` — must not be merged into theoretical types (`lib/types/observed-data.ts` documents separation intent).

---

## 2. Backend / API Architecture

- **Pattern:** Route handlers in `app/api/**/route.ts`.
- **Long-running FID:** `export const maxDuration = 120` on `fid/process`.
- **Python invocation:** `child_process.spawn` with `venv_rdkit` interpreter — **not** embedded Pyodide for the primary FID path on server.
- **Environment guards:** `process.env.VERCEL` → FID returns 503 with `FidErrorCodes.VERCEL_BLOCKED`.

**Dual FID processors (critical architectural truth):**

| Entry | Python script | When used |
|--------|---------------|-----------|
| `processFIDDataset` | `scripts/fid_process.py` | `datasetId` after folder upload → `--baseDir` |
| `processFID` | `scripts/fid_processor.py` | Legacy **single file** `formData.get('fid')` |

Both normalize through `normalizeFidPythonPayload` in `app/api/fid/process/route.ts`, but **maintainers must treat folder+datasetId as the primary laboratory workflow**; single-file path is legacy compatibility.

---

## 3. Python Processing Services

- **Primary:** `scripts/fid_process.py` (nmrglue, Bruker/Varian paths per script implementation).
- **Legacy:** `scripts/fid_processor.py`.
- **Other:** `services/chem-core` (FastAPI), additional services under `services/` for extended R&D — **optional** for basic UI.

---

## 4. Charting / Rendering Layer

- **NMR:** `components/charts/NMRChart.tsx`, scaling logic `lib/nmr/nmrChartScaling.ts` (domains, robust percentiles, solvent masking, fit-to-signal).
- **FTIR / MS / ¹³C:** dedicated chart components under `components/charts/` and `components/spectra/`.
- **FID compact UI:** `components/fid/FIDUploaderCompact.tsx` integrates with Sidebar flow.

Rendering is **not** the same as scientific truth: Chart.js receives **downsampled** observed points (`downsampleXY` ~8000) for performance; full arrays live in state/API response.

---

## 5. Chemistry / Spectroscopy Engine Layer

- **Theoretical ¹H lineshape:** `lib/utils/spectrumGenerator.ts` — sum of normalized Lorentzians; amplitudes from `integ` or `fidPickIntensity`.
- **FID peaks → simulation peaks:** `lib/utils/fidPeakToSimulation.ts` (`fidPickedPeaksToNmrSimulationPeaks`).
- **Deeper NMR modeling:** `lib/nmr/*` engines (shift, coupling, spin system, lineshape) — used in simulation / predict flows; **not all paths feed the main home chart**.
- **FTIR:** `lib/spectromind/ir_engine/ftirEngine.ts` and API routes under `app/api/ftir-*`.
- **Processing graph (TS):** `lib/nmr/processing/ProcessingGraph.ts` — **parallel** implementation; FID production path remains Python unless explicitly switched in future work.

---

## 6. Storage, Temp, Cache, Export

- **Temp FID storage:** `temp/<datasetId>/` (created by `app/api/fid/upload/route.ts`); single-file path writes under `temp/` with debugId-prefixed filename then deletes after process (see route).
- **Exports:** e.g. `lib/export/jcampDxExport.ts` used from `NMRChart`.
- **Persistence:** No single production database layer in core app for all sessions; analysis persistence APIs exist (`app/api/save-analysis`) — verify deployment usage.

---

## 7. Integration Points

- **PubChem / OPSIN / enhanced library:** various `app/api/pubchem/*`, `enhanced-library`, `opsin`.
- **Spectrotester:** import from `Spectrotester/src/core/*` in tests (`__tests__/rule-engine.test.ts`); product integration may vary by route.
- **Chem core URL:** `CHEM_CORE_URL` env (see `LOCAL_DEV.md`).

---

## 8. Intended vs Current Architecture

**Documented target (strategic):** Normalized datasets, audit service, evidence graph (`lib/core/*`, `REPO_AUDIT.md`, `TARGET_ARCHITECTURE.md`).  
**Current authoritative user path:** Legacy peak arrays + FID envelope + AI hooks — **coexists** with new core models; **do not assume** every screen reads `NormalizedDataset`.

---

## Relevant Files

- `app/api/fid/process/route.ts`, `app/api/fid/upload/route.ts`
- `lib/fid/buildFidProcessResponse.ts`
- `lib/core/store/spectromindStore.ts`

## Extension Points

- New API: add `app/api/.../route.ts`; document in `docs/API_REFERENCE.md`.
- FID: extend Python + `normalizeFidPythonPayload` fields if JSON shape changes.

## Things to Avoid

- Calling Python spawn without updating `normalizeFidPythonPayload` — silent UI breakage.
- Deploying FID to Vercel without alternate worker — guaranteed 503.

## Known Limitations

- Dual Python scripts for FID.
- TypeScript processing graph vs Python FID are **two** processing worlds.
