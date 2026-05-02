# Rule Engine, QC, and Evidence

---

## 1. Authoritative Rule Engine Location

**Package:** `Spectrotester/`

| Asset | Path |
|-------|------|
| Rule evaluators | `Spectrotester/src/core/verify/evaluateRules.ts` |
| Scoring | `Spectrotester/src/core/verify/scoring.ts` |
| Report | `Spectrotester/src/core/verify/report.ts` |
| Ruleset (declarative) | `Spectrotester/lib/spectra/library/ruleset.json` |
| Loader | `Spectrotester/src/core/library/loadRules.ts` |
| Engine orchestration | `Spectrotester/src/core/engine.ts` |

**Tests:** `__tests__/rule-engine.test.ts` imports `evaluateRules` from Spectrotester and loads ruleset from JSON path.

---

## 2. SpectroMind `lib/verification`

Thin types / README — **not** the full evaluator implementation. Do not assume all product routes call Spectrotester engine unless verified in the specific API route.

---

## 3. Rule Categories (Ruleset v1.1 snapshot)

Documented in detail in `docs/RULE_COVERAGE_MATRIX.md`:

- FORMULA, GLOBAL (incl. cross-modality), ¹H, ¹³C, HSQC, COSY, HMBC, IR, MS, META — **57 rules** with evaluators claimed as implemented (see matrix date).

Each rule produces structured **`RuleEvalResult`**: status (`PASS`/`FAIL`/`WARN`/`NOT_EVALUATED`/etc.), evidence fields, human-readable `why`.

---

## 4. QC Semantics (FID Pipeline)

Distinct from verification rules — **processing QC** in `FidQcBlock`:

- `phase_neg_energy_ratio`, `phase_failed_heuristic`
- `snr_estimate`, `has_meaningful_signal`, `ppm_axis_plausible`, `baseline_uncertain`
- Overall status strings (see `PHASE_BASELINE_REFERENCE_QC.md`)

**Warning:** QC flags come from **Python** heuristics; thresholds must be tuned with real data.

---

## 5. Evidence Models

- Rules attach **evidence objects** (counts, booleans, ratios) used in scoring — see `scoring.ts`.
- SpectroMind **core models** (`EvidenceNode` in `lib/core/models/`) exist for **future** unified evidence graph — **not** automatically populated from every rule evaluation today.

---

## 6. Maturity Assessment

| Component | Maturity |
|-----------|----------|
| Ruleset JSON as source of truth | **Strong** |
| Evaluator coverage (per matrix) | **Strong** in Spectrotester |
| Wiring from every UI “Analyze” path | **Verify per route** — may use LLM without full rule pass |
| NOT_EVALUATED handling | Implemented to avoid false confidence |

---

## 7. How to Extend Rules Safely

1. Add rule entry to `ruleset.json` with id, weight, modality.
2. Implement evaluator branch in `evaluateRules.ts` (or modularized file if refactored).
3. Add unit test in `__tests__/rule-engine.test.ts`.
4. Regenerate `docs/RULE_COVERAGE_MATRIX.md` if automation exists, or update manually.

---

## Relevant Files

- `Spectrotester/lib/spectra/library/ruleset.json`
- `Spectrotester/src/core/verify/evaluateRules.ts`
- `docs/RULE_COVERAGE_MATRIX.md`

## Things to Avoid

- Returning `PASS` without evaluator — guarded by `NOT_EVALUATED` path; do not regress.

## Partial / Placeholder Areas

- Full HSQC/COSY **experimental** peak input parity with rules (depends on UI capturing 2D peaks).
