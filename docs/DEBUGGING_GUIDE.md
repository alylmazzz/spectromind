# SpectroMind — Debugging Guide

---

## 1. Blank or Empty NMR Chart

**Check order:**

1. **Observed toggle** — `NMRChart` requires `showObserved` + valid `obsPoints`; `chartDataUsable` needs ≥4 finite points and non-zero y (`NMRChart.tsx`).
2. **Simulated toggle** — needs `peaksForSim.length > 0`.
3. **Console:** `obsFailReason` from `chartDataUsable` (`no_points`, `all_zero_intensity`, etc.).
4. **API:** Inspect `POST /api/fid/process` JSON — `observed_spectrum.x/y` lengths, `success`, `error_code`.

---

## 2. Wrong PPM Axis / Inverted Sense

1. Read **`validatePpmAxis`** output — if implausible, chart uses `smartInitialXDomain`.
2. Check **warning** string in UI (`ppmWarning` state).
3. Verify Python **`metadata.axis_type`**, `actual_ppm_range`, **`ppm_axis_plausible`** in QC.
4. Review **`reverse: true`** on Chart.js x-scale — domain is min/max numeric, not “left/right”.

See `docs/OBSERVED_SIMULATION_PPM_CONTRACT.md`.

---

## 3. Wrong Peak Positions (Simulated)

1. Confirm **manual peaks** `shift` in ppm vs Hz confusion — UI expects ppm.
2. **Frequency** prop affects some labels / coupling displays — Lorentzian x is still ppm for default generator.
3. **FID picks → simulation:** inspect `fidPickedPeaksToNmrSimulationPeaks` — wrong `area`/`intensity` skews `fidPickIntensity`.

---

## 4. Upload / Temp Issues

1. **`/api/fid/upload`** — permissions, path traversal blocks, missing fid/ser.
2. **`temp/<datasetId>`** — disk full, antivirus locking, Windows path length.
3. **`datasetId` mismatch** — process called before upload flush completes; route has retry logic — check logs for timing.

---

## 5. Observed vs Simulated Mismatch (Overlay)

**Expected:** simulated curve **window-normalized** when both visible — not absolute intensity match.

1. Compare **δ** manually on same peak — if chemical shift differs, referencing/metadata wrong from FID.
2. If shape differs: simulation is **Lorentzian sum**; observed is **processed real spectrum** — model mismatch is normal.

---

## 6. Stale State (UI)

1. **Zustand:** `observedNmrOverlay` updates must change **`sessionId`** to reset domains (`useEffect` in `NMRChart`).
2. Switching spectrum type **clears** overlay (`spectromindStore.setSpectrumType` when not `nmr`).
3. Hot reload — client state resets; server temp may remain orphaned.

---

## 7. Inspecting Intermediate Arrays

1. **Browser:** React DevTools → props/state on `NMRChart`.
2. **Network tab:** full JSON from `fid/process`.
3. **Server logs:** Python stderr mirrors processing; `debug_id` correlates entries.

---

## 8. Logs to Inspect

- Next.js server console: FID route prints debugId, script path (**note which:** `fid_process.py` vs `fid_processor.py`).
- Python stderr: phase/baseline/QC notes.

---

## Relevant Files

- `components/charts/NMRChart.tsx`
- `app/api/fid/process/route.ts`
- `lib/fid/buildFidProcessResponse.ts`
- `docs/FID_DEBUG_CHECKLIST.md`, `docs/BLANK_CHART_ROOT_CAUSE_ANALYSIS.md`

## Things to Avoid

- Editing only `data` consumer while Python writes new fields only on `observed_spectrum`.
