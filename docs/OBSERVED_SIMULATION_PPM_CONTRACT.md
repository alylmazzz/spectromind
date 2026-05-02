# Observed vs Simulation — PPM and Ordering Contract

**Purpose:** Prevent recurring bugs from mixing ppm conventions, array order, and Chart.js linear axis settings.

---

## 1. Canonical Chemical Meaning

- **δ (ppm)** increases with **deshielding** (downfield): TMS ~0, typical ¹H organics spread to ~10–12 ppm, exchangeable beyond.
- **NMR convention (display):** High ppm (left) → low ppm (right) on the x-axis (“reverse” compared to abstract math plots).

---

## 2. Internal Array Contract (Observed)

- From API/Python: `ppm[]` and `intensity[]` are **parallel arrays**, same length after normalization in `normalizeFidPythonPayload`.
- **Ordering of ppm values:** Typically **descending** (high to low) if produced from standard Bruker ppm axis routines — **do not assume** without checking; `validatePpmAxis` in `nmrChartScaling.ts` tests plausibility (range, monotonicity expectations for ¹H/¹³C).

---

## 3. Display Contract (NMRChart + Chart.js)

- X scale: `reverse: true` (see chart setup in `NMRChart.tsx`) so that **chemical “left = high δ”** holds for line rendering.
- **Domain object:** `xDomain.min` / `xDomain.max` are **numeric min/max** of the plotted window (not “left/right” labels). `domainFromDefaultPpm` uses `Math.min/Math.max` on the pair so **order of the pair in API does not break** the domain.

---

## 4. Default Windows (First View)

| Nucleus | Default first-view (professional) | Definition location |
|---------|------------------------------------|---------------------|
| ¹H | **14 → 0 ppm** (not auto full SW) | `H1_PRO_FIRST_VIEW_PPM` in `nmrChartScaling.ts`; `computeDefaultXRange` in `buildFidProcessResponse.ts` |
| ¹³C | Dedicated preset | `C13_PRO_FIRST_VIEW_PPM` in `nmrChartScaling.ts` |

**Important:** Opening **full spectral width automatically** was intentionally **avoided** for ¹H to prevent solvent peak dominating the initial view; server sends `default_display_range_ppm` / envelope `defaultXPpm`.

---

## 5. API Fields for Defaults

- `observed_spectrum.default_display_range_ppm` / top-level `default_x_range_ppm`.
- Sidebar maps: `defaultXPpm: obs.default_display_range_ppm ?? env.default_x_range_ppm ?? [14, 0]` (`Sidebar.tsx`).
- **Session stickiness:** `observedOverlay.sessionId` triggers x-domain reset on new FID session.

---

## 6. Simulation PPM Grid

- `generateNMRSpectrumData`: x from **−2 to +14** ppm step **0.005** (`spectrumGenerator.ts` + `H1_SIMULATION_PPM_DOMAIN` in `fidPeakToSimulation.ts`).
- This grid is **independent** of observed ppm sampling; overlay alignment relies on **both** sharing the same chemical δ axis in the chart window.

---

## 7. Overlay Alignment Rules

When observed + simulated are shown:

1. **X:** Both datasets interpolated/plotted on the **same** `xDomain` window.
2. **Y (simulated):** `normalizeSimulatedToUnitMax` inside visible x window when observed is valid — **relative height match is intentional heuristic**, not absolute intensity calibration to fid data.
3. **Y (observed):** robust percentile scaling; optional solvent mask excludes known solvent regions from percentile calculation.

---

## 8. Known Historical Failure Modes (Documented Guardrails)

- **Blank chart:** `chartDataUsable` rejects empty, too few points, or all-zero y — see `NMRChart.tsx`.
- **Wrong direction sense:** fixed by `reverse: true` + domain helpers; if plausibility fails, `smartInitialXDomain` avoids insane windows.
- **PPM “mirroring” confusion:** min/max domain vs display direction — always read `domainFromDefaultPpm` and Chart.js `reverse` together.

---

## Relevant Files

- `lib/nmr/nmrChartScaling.ts` — `validatePpmAxis observedPpmRange`, `smartInitialXDomain`, `fitSignalXDomain`
- `components/charts/NMRChart.tsx`
- `lib/fid/buildFidProcessResponse.ts` — `computeDefaultXRange`

## Things to Avoid

- Feeding observed ppm ascending without checking monotonicity assumptions in validation.
- Using `data.ppm` length without matching `intensity` length — rejected in overlay builder.

## Extension Points

- If Python changes ppm direction, update `validatePpmAxis` thresholds and metadata `display_direction` handling.
