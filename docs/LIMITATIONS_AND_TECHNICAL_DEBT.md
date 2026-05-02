# SpectroMind — Limitations and Technical Debt

Brutally concise list derived from architecture review (2026-04). For classification matrix see **`docs/FINAL_IMPLEMENTATION_AUDIT.md`**.

---

## 1. Unsupported or Not Product-Complete

- **Serverless FID** on Vercel (by design: 503).
- **Full 2D NMR** acquisition → processing → contour UI on main home workflow.
- **Single unified “NormalizedDataset” consumption** across every panel (models exist; wiring partial).
- **qNMR / regulatory-ready quantitation** end-to-end.

---

## 2. Partial Implementations

- **Varian/JEOL** support vs Bruker baseline.
- **Group delay / DSP** perfection for all Bruker revisions.
- **`lib/core` evidence graph** integration with every analysis click.
- **TypeScript `ProcessingGraph`** vs **Python FID** — two worlds; TS path not default for FID.
- **Integral/multiplet workstation** — payload fields may exist; UX maturity limited.

---

## 3. Heuristic / Approximate Behavior

- **Chart overlay normalization** — simulated max=1 in window when overlaid with observed.
- **`fidPickedPeaksToNmrSimulationPeaks` gamma** — heuristic from relative height.
- **FTIR default widths** from intensity heuristics (see `spectrumGenerator.ts`).
- **FGI / library** AI suggestions — model-dependent, not laws of physics.

---

## 4. Scientific Risks

- **Phase/baseline failure** on difficult samples → misleading “LC” looking spectra.
- **Referencing** may be incomplete — chemical shift comparison vs theory risky without internal standard confirmation.
- **Solvent mask** changes display Y — user may misinterpret absolute comparisons.

---

## 5. Architectural Debt

- **Dual Python scripts** (`fid_process.py` vs `fid_processor.py`).
- **Legacy `data` + `observed_spectrum`** duplicate payload.
- **Large monolithic `Sidebar`** and many API routes — cognitive load for maintainers.
- **`Spectrotester/` vs `lib/verification`** split — evaluators live outside `lib` core.

---

## 6. Duplicated or Conflicting Logic

- Normalization of Python metadata keys duplicated in concept across Python JSON and `normalizeFidPythonPayload`.
- Multiple NMR simulation entry points (`spectrumGenerator` vs deeper `lib/nmr/*` engines) — **not always unified**.

---

## 7. Legacy Areas (Dangerous to Touch Without Tests)

- **Single-file FID path** (`fid_processor.py`) — may drift from folder path.
- **`lib/utils/molecularStructure.ts`** — marked deprecated in codebase map for parsing safety.
- Various **v2** experimental routes — confirm active usage before deleting.

---

## 8. TODO Areas That Matter

- Consolidate FID into **one** Python entry with feature parity.
- Wire **ObservedSpectrumEnvelope** through verification `PeakList` builder consistently.
- Promote **Zustand** domain slices to replace scattered prop drilling for non-home routes.
- 2D roadmap: separate doc + tests when implemented — avoid claiming parity prematurely.

---

## Relevant Files

- `docs/ARCHITECTURE_CONFLICTS.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/FINAL_IMPLEMENTATION_AUDIT.md`
