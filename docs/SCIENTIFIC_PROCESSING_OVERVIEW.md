# SpectroMind — Scientific Processing Overview

This document separates **observed (experimental)** processing from **simulated (theoretical)** generation and states implementation maturity explicitly.

---

## 1. Observed vs Simulated — Non-Negotiable Distinction

| Aspect | Observed | Simulated |
|--------|----------|-----------|
| **Source** | Instrument FID → Python (`fid_process.py` / `fid_processor.py`) | User peak table / SMILES-derived predictors |
| **Type anchor** | `ObservedSpectrumEnvelope`, `FidLegacyChartData` (`buildFidProcessResponse.ts`) | `NMRPeak[]` + `generateNMRSpectrumData` |
| **Phase/baseline** | Done in Python (auto L-BFGS-B phase; baseline envelope) | N/A (idealized Lorentzians) |
| **Trust model** | QC block: SNR, phase energy ratio, ppm plausibility | Deterministic math from inputs |

**Schema intent:** `lib/types/observed-data.ts` defines `PeakList` / `TheoreticalSpectrum` separation for verification — **not all UI flows instantiate full `PeakList` objects**; FID path often uses envelope + legacy chart data.

---

## 2. ¹H NMR Processing (Observed)

**Pipeline (production):**

1. Upload → temp tree.
2. Python: digital filter removal (when applicable), apodization, zero-fill, FFT, **automatic ph0/ph1**, baseline correction, ppm axis from nmrglue conventions.
3. Normalization: intensity may carry `intensity_scale_mode` / p99 scaling metadata for display.
4. Peak picking: Python produces `peaks[]` on legacy chart payload; exposed via API.

**Maturity:**

- **Solid for demo 1D:** Typical Bruker 1D proton workflow when venv and data are correct.
- **Approximate / heuristic:** Group delay / digital filter edge cases; referencing auto-TMS may be incomplete — see `PHASE_BASELINE_REFERENCE_QC.md` (`reference_offset_ppm_applied` often 0).

---

## 3. ¹³C NMR State

- **UI:** `Carbon13Chart` with user-entered peaks — **same conceptual model as manual ¹H peaks**, not full FID-driven ¹³C processing in the main home flow.
- **FID metadata:** Python JSON may set `nucleus: 13C`; `buildFidProcessResponse.ts` uses `detectNucleusFromPayload` to choose **default X range** (e.g. `C13_PRO_FIRST_VIEW_PPM` vs `H1_PRO_FIRST_VIEW_PPM`).
- **Gap:** End-to-end “drop ¹³C FID → full purity routine” is **not** documented as complete product path.

---

## 4. 2D NMR State

- **Product:** Largely **unsupported** in the main processing + visualization sense (no first-class 2D heatmap workflow on home page tied to FID).
- **Codebase:** Models may exist under `lib/core/models/TwoDNmrDataset.ts` (platform refactor) — **orthogonal** to Python FID output today.
- **Docs:** `docs/FID_UPLOAD_AND_PROCESSING_ARCHITECTURE.md` warns about 2D / pdata.

---

## 5. Peak Picking (Observed)

- Performed in **Python** on processed 1D real spectrum; results mapped to API `peaks` / `peak_list`.
- See `docs/PEAK_PICKING_AND_SIMULATION_SPEC.md`.

---

## 6. Lorentzian Simulation (Theoretical / FID-assisted display)

- **Core:** `lorentzianNormalized`, `generateNMRSpectrumData` in `lib/utils/spectrumGenerator.ts`.
- **Domain:** `H1_SIMULATION_PPM_DOMAIN` in `fidPeakToSimulation.ts` (**−2 … 14 ppm** stepping `DEFAULT_RESOLUTION_PPM` 0.005).
- **Gamma heuristics:** from `lorentzianGammaPpm` or defaults (`0.018` typical, broader if `isBroad`).
- **FID peak heights:** `fidPickIntensity` preserves relative heights from pick list.

**Deterministic:** yes (no random noise in core path; FTIR historically had random removed per audit).

---

## 7. Baseline / Phase / Reference (Summary)

Detailed in `docs/PHASE_BASELINE_REFERENCE_QC.md`. **TL;DR:**

- Phase: Python L-BFGS-B minimizing negative lobes; manual override via `processingSpec` JSON on API.
- Baseline: minimum envelope + smoothing (not full AsLS in baseline).
- Reference: ppm axis from nmrglue; explicit external reference shift is **limited** — treat metadata accordingly.

---

## 8. Scaling Modes (Display)

- Observed Y: robust percentiles (`ROBUST_P99`, etc.) in `nmrChartScaling.ts`.
- Overlay mode: simulated curve **window-normalized** to max 1 when observed + simulated both shown — **comparability is visual, not absolute quantitation**.

---

## 9. QC Model

- `FidQcBlock` + `observed_spectrum.quality` mirror flags: `phase_failed_heuristic`, `snr_estimate`, `ppm_axis_plausible`, `has_meaningful_signal`, etc.
- Overall status strings documented in `PHASE_BASELINE_REFERENCE_QC.md`.

---

## 10. Scientific Limitations (Explicit)

1. **Single-file vs folder** processors may diverge in edge cases.
2. **2D** not processed as product feature.
3. **Quantitative qNMR** not end-to-end (integrals in JSON may exist; GMP-ready qNMR pipeline is not claimed).
4. **TS ProcessingGraph** ≠ Python FID — two implementations, different completeness.
5. **Chart downsampling** changes only display density, not stored FID result — but can hide fine structure in UI.

---

## Relevant Files

- `scripts/fid_process.py`, `scripts/fid_processor.py`
- `lib/fid/buildFidProcessResponse.ts`
- `lib/utils/spectrumGenerator.ts`, `lib/utils/fidPeakToSimulation.ts`
- `lib/types/observed-data.ts`

## Extension Points

- Add nmrglue post-processing → extend Python JSON → extend `normalizeFidPythonPayload`.

## Common Failure Modes

- ppm axis “plausible” false → chart falls back to `smartInitialXDomain` — user sees warning in `NMRChart`.
