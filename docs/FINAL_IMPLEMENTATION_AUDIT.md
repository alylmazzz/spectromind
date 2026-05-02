# Final Implementation Audit — SpectroMind

**Date:** 2026-04-03 | **Method:** Codebase inspection + doc reconciliation.  
**Legend:** IMPLEMENTED | PARTIAL | HEURISTIC | LEGACY | UNSUPPORTED | PLANNED

This file is **concise** by design. Details live in linked docs.

---

## Classification Table

| Area | Status | Notes |
|------|--------|-------|
| Next.js App Router shell | **IMPLEMENTED** | `app/page.tsx`, panels |
| Zustand store (peaks, overlay, session) | **IMPLEMENTED** | `spectromindStore.ts` |
| Zustand full domain (documents/datasets everywhere) | **PARTIAL** | Models exist; not all routes consume |
| NMR Chart.js 1D + zoom | **IMPLEMENTED** | `NMRChart.tsx` |
| Robust Y-scaling + solvent mask | **IMPLEMENTED** | `nmrChartScaling.ts` |
| Theoretical ¹H Lorentzian simulation | **IMPLEMENTED** | `spectrumGenerator.ts` |
| FTIR theoretical curve | **IMPLEMENTED** | deterministic core path |
| FID folder upload → temp | **IMPLEMENTED** | local only |
| FID process via `fid_process.py` | **IMPLEMENTED** | `--baseDir` dataset path |
| FID single-file `fid_processor.py` | **LEGACY** | still callable |
| FID on Vercel | **UNSUPPORTED** | 503 guardrail |
| Observed envelope `observed_spectrum` | **IMPLEMENTED** | `buildFidProcessResponse.ts` |
| Legacy `data` payload | **LEGACY** compat | prefer envelope |
| Python phase/baseline (auto) | **IMPLEMENTED** | approximate science |
| Manual phase via `processingSpec` | **PARTIAL** | API supports; UI coverage varies |
| Referencing (external TMS quality) | **PARTIAL** | often `reference_offset_ppm_applied` limited |
| 2D NMR product pipeline | **UNSUPPORTED** | warnings/docs only |
| TS `ProcessingGraph` NMR steps | **PARTIAL** | not FID default |
| Spectrotester rule engine 57 rules | **IMPLEMENTED** | in `Spectrotester/` |
| `lib/verification` as full engine | **PARTIAL** | thin vs Spectrotester |
| Elucidation API routes | **PARTIAL** | verify UX integration per route |
| Chem-core / RDKit routes | **IMPLEMENTED** | env-dependent |
| MS / FTIR API family | **PARTIAL** | multiple routes; maturity varies |
| Documentation package (this set) | **IMPLEMENTED** | `docs/*.md` 2026-04 refresh |

---

## Top 10 Technical Risks

1. **Dual FID Python scripts** — behavioral drift.
2. **Dual payload (`data` vs `observed_spectrum`)** — client confusion.
3. **Cloud FID expectation mismatch** — Vercel block not always understood by users.
4. **Overlay normalization** — misread as quantitative match.
5. **PPM plausibility heuristics** — false negatives on exotic acquisitions.
6. **Large Sidebar / API surface** — regressions on partial refactors.
7. **Spectrotester coupling** — version skew between ruleset and app consume path.
8. **OrgMetallic peak parsing** — edge cases in `peakParser` / AI paths.
9. **Temp disk / security** — path traversal mitigations must stay in upload route.
10. **Type duplication** — multiple peak/Solvent definitions historically (bridges in `lib/core/bridges`).

---

## Best Entry Points for New Developers

1. `docs/DEVELOPER_ONBOARDING.md`
2. `docs/ARCHITECTURE_OVERVIEW.md`
3. `app/api/fid/process/route.ts`
4. `components/charts/NMRChart.tsx`
5. `lib/fid/buildFidProcessResponse.ts`

---

## Docs Needing Future Refinement

- Per-route **OpenAPI-level** request/response bodies (`API_REFERENCE.md` is summarized).
- Auto-generated **route inventory** from `app/api` glob on each release.
- **Python fid_process** parameter documentation sourced from argparse/help text.

---

## Related Historical Audits

- `docs/NEXT_ITERATION_IMPLEMENTATION_AUDIT.md`, `docs/FINAL_FID_IMPLEMENTATION_AUDIT.md` — earlier phases; may partially overlap; prefer this file + architecture docs for NMR truth.
