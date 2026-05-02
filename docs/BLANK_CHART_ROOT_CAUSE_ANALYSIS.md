# Blank/Incorrect NMR Chart Root Cause Analysis

## Date: 2026-03-28

## Problem Statement

Same uploaded FID dataset produces a normal 1H NMR spectrum in MestReNova, but in SpectroMind:
- appeared blank
- appeared nearly blank with only noise
- had absurd ppm axis values (e.g. centered at ~1000 ppm)
- peaks invisible without extreme manual zooming
- silently reported SUCCESS despite broken display

## Root Causes Identified and Fixed

### RC1: PPM Axis Drift (CRITICAL)

**Problem**: `nmrglue.udic` stores the carrier frequency (`car`) in Hz, not ppm. The old code used `car_ppm = float(udic[0].get("car", 0.0))` directly without conversion. For a 400 MHz spectrometer with carrier at 1880000 Hz, this produced `car_ppm = 1880000.0` instead of `4.7 ppm`.

The `ppm_scale()` from `uc_from_udic` was usually correct, but when it failed or produced implausible values, the fallback formula also used the raw Hz value as ppm, sending the axis into absurd ranges.

**Fix**: Added explicit conversion `car_ppm = car_hz / obs_mhz` in `fid_process.py`. Added PPM plausibility guard that checks if the computed axis falls within expected 1H NMR range (-5 to 25 ppm). If primary axis fails, attempts fallback calculation. If both fail, marks `axis_type: "ppm_uncertain"` with explicit warning.

### RC2: X Domain Window Miss (CRITICAL)

**Problem**: `NMRChart.tsx` always initialized with `xDomain = {min: 0, max: 14}`. If the actual ppm data was outside this range (due to RC1 or legitimate non-standard experiments), `computeYBounds` filtered ALL points as `x < xMin || x > xMax`, returning `{min: 0, max: 1}`. The chart rendered with correct axes but zero data points visible.

**Fix**: Added `smartInitialXDomain()` that checks if observed data overlaps the default 0-14 window. If no overlap exists, the X domain is adapted to the actual data range. The `observedPpmRange()` function computes the actual min/max of the ppm array.

### RC3: NaN/Infinity Propagation (HIGH)

**Problem**: Python numpy operations could produce NaN or Infinity values (division by near-zero, log of zero, etc.). These propagated to the JSON output, then to Chart.js which either rendered nothing or crashed silently.

**Fix**: Added `sanitize_for_json()` in Python that replaces NaN/Inf with 0.0. Added double-layer sanitization in `normalizeFidPythonPayload()` (TypeScript route) and `finalizeFidSuccess()` (build response). Both layers sanitize and count affected values.

### RC4: No Blank-Chart Prevention (HIGH)

**Problem**: If processing produced technically valid arrays (non-empty, same length) but with all-zero intensity or all-NaN values, the chart would render as a flat line and report success. No gates existed between "arrays exist" and "chart renders".

**Fix**: Added `chartDataUsable()` in `NMRChart.tsx` that checks: point count >= 4, finite values exist, non-zero intensity exists. If check fails, a descriptive warning is shown instead of a misleading blank chart.

### RC5: Missing Signal Content Validation (MEDIUM)

**Problem**: Python processing could complete successfully (no errors) but produce a flat spectrum (all near-zero after baseline correction). This was silently treated as SUCCESS_HIGH_CONFIDENCE.

**Fix**: Added `has_meaningful_signal` check in Python (`y_dynamic_range > 1e-6` at 99th percentile). If signal is flat, `FLAT_SIGNAL` warning is emitted and QC status is downgraded. This information propagates to the frontend UI as an explicit warning.

### RC7: Full-Spectral-Width Default Window (CRITICAL — 2026-03-28 follow-up)

**Problem:** `computeDefaultXRange()` used `metadata.actual_ppm_range` (full acquisition span, e.g. -5 … 25 ppm) to set the **first chart window** to roughly `[hi+margin, lo+margin]` (~26 … -6). Chart.js then showed **25 → -5** on the axis. Peaks looked tiny compared to MestReNova’s professional **14 → -1** / **14 → 0** first view; dominant solvent dominated vertical scale perception.

**Fix:** For plausible 1H data, **always** use fixed professional first view `[14, 0]` (`H1_PRO_FIRST_VIEW_PPM`). Full width remains available via presets, zoom, and “fit to signal”. Only when `axis_type === 'ppm_uncertain'` or `qc.ppm_axis_plausible === false` do we widen the default window from `actual_ppm_range` so wrong-axis data is still inspectable.

**Client:** `NMRChart` session reset now trusts server `defaultXPpm` when `validatePpmAxis` passes; `smartInitialXDomain` is used only when the client marks the axis implausible.

### RC6: Silent PPM Axis Acceptance (MEDIUM)

**Problem**: The system had no mechanism to flag a scientifically implausible ppm axis. A 1H experiment showing range 500-600 ppm was treated identically to 0-14 ppm.

**Fix**: Added `ppm_axis_plausible()` in Python with per-nucleus plausibility checks (1H: -5 to 25 ppm, max span 60 ppm; 13C: -20 to 300 ppm). Result propagates via QC block and UI warning.

## Files Changed

| File | Change |
|------|--------|
| `scripts/fid_process.py` | car Hz->ppm conversion, PPM plausibility guard, fallback axis, NaN sanitizer, signal content check, AsLS baseline, ACME+L2 phase, solvent auto-ref, top-level exception handler |
| `lib/nmr/nmrChartScaling.ts` | `observedPpmRange`, `smartInitialXDomain`, `validatePpmAxis`, peak-preserving `downsampleXY`, `ROBUST_P98` mode, negative overshoot clamp |
| `components/charts/NMRChart.tsx` | Smart initial X domain, `chartDataUsable` gate, PPM warning banner, observed data quality warning, ROBUST_P98 button, adapted zoom limits |
| `lib/fid/buildFidProcessResponse.ts` | Adaptive `default_x_range_ppm`, NaN sanitization, new QC fields (`has_meaningful_signal`, `ppm_axis_plausible`) |
| `app/api/fid/process/route.ts` | NaN/Inf sanitization in `normalizeFidPythonPayload` |
| `__tests__/nmr/nmrChartScaling.test.ts` | Tests for observedPpmRange, smartInitialXDomain, validatePpmAxis, peak-preserving downsample, P98 scaling, negative clamp |
| `__tests__/fid/fidEnvelope.test.ts` | Tests for NaN sanitization, adaptive X range, empty/mismatch arrays |

### RC8: Naive Downsampling Drops Narrow Peaks (MEDIUM — 2026-03-28)

**Problem:** `downsampleXY` used stride-based sampling (every N-th point). A narrow NMR peak that fell between sampled points was silently dropped, making the chart appear to have fewer or missing peaks.

**Fix:** Replaced with min/max bucket downsampling: each bucket emits both its minimum and maximum intensity points, guaranteeing that no peak amplitude is lost regardless of bucket size.

### RC9: Baseline Undershoot Expands Y-Axis (MEDIUM — 2026-03-28)

**Problem:** After baseline correction, some spectral regions dip slightly negative. `computeYBounds` propagated these negative values into the Y-axis minimum, wasting vertical space and making positive peaks smaller.

**Fix:** Added negative overshoot clamp: Y-axis min is clamped to at most -8% of Y-axis max. This matches MestReNova's behavior where baseline-corrected spectra show near-zero baselines.

### RC10: Missing Aggressive Y-Scale Mode (LOW — 2026-03-28)

**Problem:** `ROBUST_P99` clips at the 99th percentile, which may still let a dominant solvent peak suppress smaller analyte peaks. No more aggressive mode existed.

**Fix:** Added `ROBUST_P98` scaling mode (98th percentile cap) available via UI toggle for spectra with dominant solvent signals.

### RC11: Baseline Correction Quality (HIGH — 2026-03-28)

**Problem:** `min_envelope_uniform` baseline could overestimate baseline near peaks, clipping real signal, and underestimate in rolling-baseline regions.

**Fix:** Implemented **Asymmetric Least Squares (AsLS)** baseline correction as the primary method (Eilers & Boelens 2005, lambda=1e7, p=0.001, 10 iterations). `min_envelope_uniform` remains as automatic fallback if AsLS fails (e.g., scipy.sparse unavailable).

### RC12: No Solvent Reference Calibration (HIGH — 2026-03-28)

**Problem:** PPM axis relied entirely on spectrometer metadata (udic/acqus parameters). Small calibration offsets (0.01-0.5 ppm) could misalign peaks relative to literature values, especially noticeable for known reference compounds.

**Fix:** Added `solvent_auto_ref()` that detects the tallest peak in a ±1.0 ppm window around the expected solvent residual position (CDCl3: 7.26, DMSO-d6: 2.50, D2O: 4.79, CD3OD: 3.31, etc.) and shifts the entire PPM axis to align it exactly. Shift is capped at ±0.8 ppm to avoid false corrections.

### RC13: Suboptimal Phase Correction (HIGH — 2026-03-28)

**Problem:** L2 minimization of negative spectrum with only 8 restart points could get trapped in local minima, leaving significant dispersive character in the displayed spectrum.

**Fix:** Replaced with two-stage optimization: (1) entropy minimization (ACME-like) to find the globally best-absorptive phase, then (2) L2-negative refinement from 14 restart points covering all four quadrants and common first-order offsets. Both stages contribute candidates; the one with lowest neg_energy ratio wins.

## What Remains Heuristic

1. **Phase correction**: Two-stage entropy+L2 with 14 restarts. Much more robust than before but cannot guarantee globally optimal phase for all spectra (especially heavily overlapped or very noisy data).

2. **Baseline correction**: AsLS is production-grade for most 1H spectra. Very broad peaks (e.g., polymer NMR, paramagnetic complexes) may still have minor baseline artifacts.

3. **PPM plausibility thresholds**: Fixed ranges (-5 to 25 ppm for 1H). Edge cases with paramagnetic samples (large chemical shift range) may trigger false warnings.

4. **Signal content threshold**: `y_p99 > 1e-6` after robust scaling. Very dilute samples may be flagged as flat signal.

5. **Solvent referencing**: Requires `SOLVENT` field in Bruker acqus. If solvent is unlisted or peak detection fails, referencing falls back to metadata-only mode.

## Vendor Path Confidence

| Vendor | Format | Confidence | Notes |
|--------|--------|-----------|-------|
| Bruker | 1D fid + acqus | HIGH | Digital filter, group delay, AsLS baseline, solvent ref, metadata extraction all supported |
| Bruker | 1D ser | MEDIUM | Treated as fid, may need additional handling for specific experiments |
| Varian/Agilent | 1D fid + procpar | HIGH | nmrglue read + guess_udic well tested |
| JEOL | .jdf | NOT SUPPORTED | Requires dedicated parser |
| Generic | No metadata | LOW | Falls back to default 400 MHz, 10 kHz SW |

## Future Work

1. **2D experiment support** (COSY, HSQC, HMBC contour rendering)
2. **JEOL JDF parser**
3. **Peak integration with automatic region detection**
4. **Multiplet analysis and J-coupling estimation**
5. **Manual phase correction UI controls**
6. **Export to JCAMP-DX / NMReDATA**
