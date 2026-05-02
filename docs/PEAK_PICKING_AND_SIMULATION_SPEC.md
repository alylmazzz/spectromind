# Peak Picking and Lorentzian Simulation Specification

---

## 1. Two Different “Peak” Flows

| Flow | Where peaks come from | Consumer |
|------|------------------------|----------|
| **Manual / AI** | User input, `PeakInput`, bulk paste, library | `peaks` state → `generateNMRSpectrumData` |
| **FID automatic** | Python processor on **real spectrum** | API `data.peaks` / `peak_list` → optional `fidPickedPeaksToNmrSimulationPeaks` |

Do not assume algorithmic identity between these two pipelines.

---

## 2. FID Peak Picking (Server / Python)

- Implementation lives in **`scripts/fid_process.py`** (and possibly `fid_processor.py` for legacy) — parameters for prominence, distance, smoothing are **Python-side**.
- Output shape in TS: `FidLegacyChartData.peaks`: `{ ppm, height, abs_height?, area }[]` mapped through `normalizeFidPythonPayload`.
- **Scientific character:** Heuristic peak finder on **processed absorptive 1D**; not GSD-grade deconvolution unless explicitly upgraded in Python.

**Threshold / width logic:** Inspect Python for authoritative numbers; TS only forwards arrays.

---

## 3. FID Peaks → Chart “FID Simulation” Line

**File:** `lib/utils/fidPeakToSimulation.ts` → `fidPickedPeaksToNmrSimulationPeaks`.

**Logic:**

- Filters picks by finite position within extended domain guard.
- **Amplitude:** prefers `intensity`; else `area/20` heuristic; normalizes relative max to derive **`fidPickIntensity`**.
- **Lorentzian width (`lorentzianGammaPpm`):** heuristically **0.012 / 0.018 / 0.025** based on relative height — **display-motivated**, not full width at half maximum from Voigt fit.
- **Labels:** `hideChartLabel: true`, `mult: 'm'` placeholder integration.

**Meaning:** This curve is a **visual aid** aligning picked δ positions with a smooth line — **not** a quantitative reconstruction of acquired lineshape.

---

## 4. Manual Simulation (`generateNMRSpectrumData`)

**File:** `lib/utils/spectrumGenerator.ts`.

- **Grid:** ppm from `H1_SIMULATION_PPM_DOMAIN.min` to `.max` step `DEFAULT_RESOLUTION_PPM` (0.005).
- **Per peak amplitude:** `fidPickIntensity` if set and >0; else **`integ * 100`** (classic manual integral scaling).
- **Gamma (width):** explicit `lorentzianGammaPpm` else `isBroad ? 0.08 : 0.018` ppm.
- **Shape:** normalized Lorentzian `1/(1+(Δ/γ)²)`.

**Display-only vs modeled:** The entire curve is a **deterministic aggregate model** for UI; it does not simulate field inhomogeneity, exchange broadening, or J-coupling fine structure unless encoded elsewhere (advanced NMR engines).

---

## 5. Solvent / Artifact Masking

- **Chart-side:** optional **solvent mask** excludes chemical shift bands from **Y-axis percentile** computation (`nmrChartScaling.ts`) — affects **display scale**, not picked peak list from Python.
- **Rule engine:** separate solvent expectations in verification rules (`H1_SOLVENT_IMPURITY_DETECTION` etc.).

---

## 6. Integrals / Multiplets

- API may include `integral_regions`, `multiplet_regions` as **opaque/placeholder** payloads on legacy chart data — **not** full multiplet analysis workstation in main chart.
- Treat as **partial** until dedicated analyzer UI is wired.

---

## 7. TypeScript `PeakPicker` (Library)

- `lib/nmr/analysis/PeakPicker.ts` exists for **MAD/threshold** picking on `Float64Array` — **parallel** to Python FID pick; **not** automatically the path used by `fid/process` today.

---

## Relevant Files

- `lib/utils/spectrumGenerator.ts`
- `lib/utils/fidPeakToSimulation.ts`
- `scripts/fid_process.py` (authoritative for FID picks)
- `lib/nmr/analysis/PeakPicker.ts` (optional / future consolidation)

## Common Failure Modes

- Empty `peak_list` → no FID simulation line; user still sees observed only.
- Huge area with tiny intensity → amplitude heuristic lands on weak relative peaks.

## Things to Avoid

- Treating `fidPickIntensity` peaks as thermodynamically calibrated integrals.

## Extension Points

- Replace gamma heuristic with FWHM from Python pick table if added to JSON schema.
