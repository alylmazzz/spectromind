# Vendor and Format Support Matrix

**Source:** `docs/VENDOR_FORMAT_SUPPORT.md`, `lib/fid/formatDetector.ts`, `scripts/fid_process.py` (inspect script for ground truth), FID architecture docs.

Confidence: **implementation-dependent** — when in doubt, run a fixture through the pipeline and record `metadata.vendor`, `source_format`, and QC flags.

---

## Summary Table

| Vendor / format | Raw input | 1D processed spectrum | 2D | Confidence | Notes |
|-----------------|-----------|------------------------|----|--------------|-------|
| Bruker | `fid` or `ser` + acqus/procs | **Supported** (local Python) | **Partial / not product** | **Medium–high** | Primary target; digital filter removal when nmrglue succeeds |
| Varian / Agilent | `fid` folder patterns | **Partial** | **Partial** | **Medium** | Heuristic detection; metadata depth limited |
| JEOL | `.jdf` | **Partial** | **Unclear** | **Low–medium** | Folder workflow expects fid/ser — single-file path may differ |
| JCAMP 1D NMR | if routed | varies | — | **Verify** | Not primary path in FID_PROCESS docs |
| Other | — | **Unsupported** | — | — | Explicit error codes possible |

---

## Parser Routing

1. **Upload** preserves relative paths → `detectFormatFromRelPaths` / tree listing.
2. **Process** passes `datasetType`/`format` to Python → internal vendor branch in **fid_process.py**.

---

## Known Parser Limitations (Documented)

- **2D (COSY/HSQC/…):** pdata usage **not** end-user complete in main app — warnings may appear.
- **Group delay / DSP:** partial correction — scientific residual distortion possible on some Bruker builds.
- **Referencing:** automatic external reference may be **incomplete** — verify `reference_offset_ppm_applied`.

---

## Roadmap Gaps (Not Shipping Claims)

- Full 2D matrix import + phase + contour viewer integrated with `page.tsx`.
- Uniform vendor adapter layer (`lib/nmr/import/*`) — architecture may exist partially — verify before documentation says “ready”.

---

## Relevant Files

- `lib/fid/formatDetector.ts`
- `lib/fid/fidErrorCodes.ts`
- `app/api/fid/upload/route.ts`, `app/api/fid/process/route.ts`
- `docs/FID_UPLOAD_AND_PROCESSING_ARCHITECTURE.md`
- `docs/FID_ERROR_CODES.md`

## Extension Points

- Add detector heuristics + Python branch + test fixture under `__tests__/fid/`.
