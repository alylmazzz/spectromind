# SpectroMind — System Overview

**Audience:** Developers, technical founders, scientific software reviewers, auditors.  
**Grounding:** Repository inspection (2026-04); paths refer to this monorepo.  
**Principle:** Aspirational roadmap items are **not** described here as shipped product features unless the code path is real.

---

## 1. What SpectroMind Is

SpectroMind is a **web-based workstation** (Next.js App Router) for **multimodal spectroscopic analysis** centered on organic structure workflows. It combines:

- **Manual / bulk peak entry** and **AI-assisted structure identification** (LM APIs via server routes).
- **Theoretical 1H NMR curve generation** from peak tables (Lorentzian summation).
- **Observed 1D NMR from FID** via a **Python + nmrglue** pipeline (`scripts/fid_process.py` for folder datasets; **`scripts/fid_processor.py`** for legacy single-file upload in `processFID`).
- **Charts** (Chart.js) for NMR, FTIR, ¹³C, MS; **structure** viewers (RDKit-backed APIs, 3D via 3Dmol/Three.js in parts of the app).
- **Verification-oriented tooling** primarily implemented in the **Spectrotester** subpackage (rule set + evaluators), which SpectroMind can consume or align with for “evidence-based” checks.

It is **not** a drop-in replacement for a full desktop NMR suite (MestreNova-class processing of all vendor 2D workflows, full qNMR, etc.) unless explicitly implemented in code.

---

## 2. Main Capabilities (As Implemented)

| Area | Maturity | Notes |
|------|----------|-------|
| 1H theoretical curve from peaks | **Strong** | `lib/utils/spectrumGenerator.ts` — deterministic Lorentzians. |
| FTIR theoretical curve | **Strong** | Same module; absorption dip model. |
| FID folder → processed 1D spectrum | **Strong (local only)** | Requires `venv_rdkit` + not on Vercel (`VERCEL` guard returns 503). |
| FID single-file path | **Legacy path** | `fid_processor.py` — still in route for direct file upload. |
| NMR chart + observed overlay | **Strong** | `components/charts/NMRChart.tsx` + scaling in `lib/nmr/nmrChartScaling.ts`. |
| 2D NMR processing / heatmaps | **Weak / planned** | Docs and warnings in FID architecture; not first-class product path in main UI. |
| Rule engine (verification) | **Strong (Spectrotester)** | `Spectrotester/src/core/verify/evaluateRules.ts` + `ruleset.json`. |
| Zustand global store (documents, datasets) | **Partial vs UI** | `lib/core/store/spectromindStore.ts`; main page uses legacy session slice; full domain migration ongoing. |
| TypeScript NMR processing graph | **Partial** | `lib/nmr/processing/` — parallel scientific path; not the default FID backend. |

---

## 3. Scientific Scope

- **In scope (today):** 1D ¹H-centric workflows, ¹³C tab/chart with user peaks, FTIR/MS charts from user peaks, FID→1D observed spectrum (Bruker-focused; Varian/JEOL partial), AI analysis routes, RDKit structure operations, Spectrotester rule evaluation when wired into flows.
- **Explicitly limited:** Full 2D acquisition processing, vendor-perfect digital filter/group delay for all platforms, enterprise persistence/DB browser as primary product, uniform “normalized dataset” consumption across every UI panel.

---

## 4. Key System Layers (Logical)

1. **Presentation:** `app/page.tsx`, `components/*`, charts.
2. **Client state:** React + Zustand (`spectromindStore`) for peak lists and overlays; hooks `useSpectralAnalysis`, `useFIDUpload`.
3. **API routes:** `app/api/*` — Next.js serverless/Node; some routes **spawn Python**.
4. **FID pipeline:** upload → temp dir → `fid_process.py` → JSON → `buildFidProcessResponse.ts` → `observed_spectrum` + legacy `data`.
5. **Simulation:** peak tables → `spectrumGenerator` / broader NMR engines under `lib/nmr/*`.
6. **Verification / rules:** Spectrotester core + `ruleset.json`.
7. **Optional microservices:** `services/` (chem-core, etc.) — not required for minimal local run; see `docs/LOCAL_DEV.md`.

---

## 5. Key Use Cases

1. Enter **¹H peaks** → visualize **theoretical** spectrum → run **AI analysis** (`useSpectralAnalysis`).
2. Upload **Bruker-like FID folder** → process → **observed overlay** on main chart; optional **FID-derived peak list** → Lorentzian “FID simulation” line via `fidPeakToSimulation.ts`.
3. **SMILES / structure** via RDKit routes → 2D image / 3D conformer paths.
4. **Verification / elucidation** flows touching `lib/elucidation`, Spectrotester engine, or API wrappers (`/api/elucidation-v15`, etc.) — each route should be validated before claiming UX completeness.

---

## 6. Maturity Snapshot (Honest)

- **Production-ready for demo/lab:** Local Next.js + local Python venv + FID folder processing + chart overlay.
- **Not production-ready without engineering:** Cloud deployment of FID (blocked on Vercel), full 2D, single consistent “normalized observation” model in every panel, elimination of dual Python scripts without compatibility testing.

---

## Relevant Files

- `app/page.tsx` — main shell.
- `app/api/fid/process/route.ts` — authoritative FID API behavior (includes legacy vs dataset split).
- `lib/fid/buildFidProcessResponse.ts` — observed envelope + QC mapping.
- `docs/FID_UPLOAD_AND_PROCESSING_ARCHITECTURE.md` — deep dive.

## Extension Points

- New vendor: extend `lib/fid/formatDetector.ts` + `scripts/fid_process.py`.
- New chart behavior: `lib/nmr/nmrChartScaling.ts`, `NMRChart.tsx`.

## Common Failure Modes

- Missing `venv_rdkit` or wrong Python → FID spawn fails.
- Vercel deployment → FID returns 503 by design.

## Known Limitations

See `docs/LIMITATIONS_AND_TECHNICAL_DEBT.md` and `docs/FINAL_IMPLEMENTATION_AUDIT.md`.
