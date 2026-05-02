# SpectroMind — Schema Reference

Cross-module contracts for observed FID output, legacy chart data, verification-oriented types, and Python↔TypeScript handoff.

---

## 1. FID API Envelope (`FidProcessApiEnvelope`)

**Defined in:** `lib/fid/buildFidProcessResponse.ts`

Key fields:

- `success: boolean`
- `status: 'ok' | 'error' | 'validation_failed' | 'unsupported'`
- `debug_id: string`
- `error_code`, `error_message`, `user_hint` (failure UX)
- `processing_steps: { step, ok, detail? }[]`
- `observed_spectrum?: ObservedSpectrumEnvelope` — **preferred**
- `data?: FidLegacyChartData` — **deprecated** duplicate for charts
- `peak_list?`, `integral_regions?`, `multiplet_regions?`, `qc?`, `processing?`, `comparison?`, `stderr?`
- `default_x_range_ppm`, `default_y_scale_mode`, `display_presets`

---

## 2. Observed Spectrum Envelope (`ObservedSpectrumEnvelope`)

**Kind:** `'observed_nmr_1d'`

| Field | Meaning |
|-------|---------|
| `x`, `y` | ppm[], intensity[] (parallel) |
| `peaks` | Pick list `{ position, intensity?, area? }[]` |
| `experiment_type` | `'1H' \| '13C'` etc. |
| `default_display_range_ppm` | First-view x window |
| `current_scale_mode` | Intensity scaling hint |
| `display_presets` | Preset buttons metadata |
| `metadata` | Bag for vendor/frequency/sw/acquisition |
| `provenance` | `debugId`, `datasetId?`, `processingSteps[]`, `detectedVendor?` |
| `quality` | Axis match, empty, lowConfidence, SNR, phase flags |
| `qc` | `FidQcBlock` mirror |

---

## 3. Legacy Chart Data (`FidLegacyChartData`)

Flat structure used to **construct** envelope and for older consumers:

- `metadata`: spectrometer frequency, sw, offset, axis_type, `actual_ppm_range`, nucleus, vendor, solvent hints, reference fields…
- `ppm`, `intensity`
- `baseline?`, `peaks`, `warnings`, `processing`, `qc`
- `intensity_scale_mode`, `intensity_raw_max_scale`

**Python → TS mapping:** `normalizeFidPythonPayload` in `app/api/fid/process/route.ts` coalesces alternate metadata keys (`spectrometer_freq_mhz`, `sw_ppm`, etc.).

---

## 4. Observed Data Types (Design / Verification)

**File:** `lib/types/observed-data.ts`

- `RawObservation`, `ProcessedObservation` — **ideal lifecycle**; not every route populates full objects.
- `PeakList` — observed peaks with `QualityFlags`.
- `TheoreticalSpectrum` — predictions with `isHeuristic` per peak.
- `VerificationInput` — multimodal pairing for verify flows.

**Gap:** FID pipeline primarily uses **`FidLegacyChartData` / `ObservedSpectrumEnvelope`**, not always `PeakList` wrapper.

---

## 5. NMR Peak (Manual / Simulation)

**File:** `lib/types/index.ts` — `NMRPeak`

Used by charts and `generateNMRSpectrumData`. May carry `fidPickIntensity`, `lorentzianGammaPpm`, `isBroad`, etc.

---

## 6. TypeScript / Python Handoff

- **Transport:** Single JSON object in Python stdout (regex extract `{...}` in route).
- **Versioning:** No unified JSON schema file enforced at runtime; **backward compatibility** responsibility in `normalizeFidPythonPayload`.
- **Risk:** Python adds field → TS ignores unless mapped; TS expects field → undefined until Python updated.

---

## 7. Overlay Schema (Client)

**`NmrObservedOverlay`** (`NMRChart.tsx` / store): `ppm`, `intensity`, `sessionId`, `defaultXPpm`, `yScaleMode`, `experimentType`, QC summary, optional auto phase/ref metadata from Sidebar mapping.

---

## 8. Export Schema

- JCAMP-DX export: `lib/export/jcampDxExport.ts` — peak list + domain dependent on caller.

---

## Relevant Files

- `lib/fid/buildFidProcessResponse.ts`
- `lib/types/observed-data.ts`
- `app/api/fid/process/route.ts`
- `packages/schemas/index.ts` (cross-package reports / audit types)

## Extension Points

- Add envelope field → bump contract doc + `finalizeFidSuccess`.

## Things to Avoid

- Breaking `ppm.length === intensity.length` invariant.
