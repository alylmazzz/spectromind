# SpectroMind — Developer Onboarding

---

## 1. Run the System

Follow **`docs/LOCAL_DEV.md`**:

- `npm install`
- Optional: `services/chem-core` with uvicorn on `:8001`
- `npm run dev` → http://localhost:3000

**FID processing:** create `venv_rdkit`, install `nmrglue` per project docs; FID **will not work** on Vercel.

---

## 2. Locate Critical Files

| Task | Start here |
|------|------------|
| Main UI | `app/page.tsx`, `components/sidebar/Sidebar.tsx` |
| NMR chart | `components/charts/NMRChart.tsx`, `lib/nmr/nmrChartScaling.ts` |
| FID API | `app/api/fid/process/route.ts`, `app/api/fid/upload/route.ts` |
| FID response shaping | `lib/fid/buildFidProcessResponse.ts` |
| Theoretical curve | `lib/utils/spectrumGenerator.ts` |
| AI analysis hook | `lib/hooks/useSpectralAnalysis.ts` |
| Rules | `Spectrotester/src/core/verify/evaluateRules.ts` |
| Tests | `__tests__/`, `vitest.config.ts` |

Full map: **`docs/CODEBASE_MAP.md`**.

---

## 3. Test FID Processing

1. Start Next locally with venv configured.
2. Use Sidebar FID upload (compact uploader) with a **known-good Bruker 1D** folder.
3. Capture `debug_id`; verify JSON has `observed_spectrum` lengths and QC block.
4. Run automated tests: `npx vitest run __tests__/fid/` (if present) + `__tests__/nmr/`.

---

## 4. Add a New Vendor Parser

1. **`lib/fid/formatDetector.ts`** — recognize paths / magic bytes.
2. **`scripts/fid_process.py`** — implement read branch (prefer extending primary script).
3. **Error taxonomy** — `lib/fid/fidErrorCodes.ts` + user hints.
4. Document in **`docs/VENDOR_SUPPORT_MATRIX.md`** with confidence level.

---

## 5. Add a New Chart Preset

1. **`lib/nmr/nmrChartScaling.ts`** — extend `H1_DISPLAY_PRESETS` (or nucleus-specific table).
2. **`NMRChart.tsx`** — wire button if needed.
3. Update **`docs/NMR_VISUALIZATION_AND_SCALING_SPEC.md`**.

---

## 6. Add a New QC Rule (Verification)

1. **`Spectrotester/lib/spectra/library/ruleset.json`**
2. **`evaluateRules.ts`** implementation + test
3. **`docs/RULE_COVERAGE_MATRIX.md`**

---

## 7. Add a New Export

1. Implement under `lib/export/` (see `jcampDxExport.ts` pattern).
2. Wire UI action in chart or analysis panel.
3. Document MIME type + field mapping in **`docs/API_REFERENCE.md`** or export doc.

---

## 8. Extend Safely Without Breaking Contracts

- Never shorten `ppm`/`intensity` arrays asymmetrically.
- When extending Python JSON, update **`normalizeFidPythonPayload`** first.
- Prefer **`observed_spectrum`** over legacy `data` for new clients.
- Run **`npx tsc --noEmit`** and **`npx vitest`** before merge.

---

## Documentation Set Index

See package **`docs/SYSTEM_OVERVIEW.md`** and **`docs/ARCHITECTURE_OVERVIEW.md`** for the full technical documentation package (this onboarding doc is one entry point).

---

## Relevant Files

- `docs/LOCAL_DEV.md`
- `docs/CODEBASE_MAP.md`
- `docs/DEBUGGING_GUIDE.md`
