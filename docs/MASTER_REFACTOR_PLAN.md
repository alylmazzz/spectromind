# SpectroMind Master Refactor Plan

Version: 1.0.0 | Date: 2026-03-27

## Executive Summary

This plan transforms SpectroMind from a prototype with rich declarative rules but minimal runtime execution into a scientifically auditable, production-grade spectral analysis platform. The core issues are: (1) no single chemistry authority, (2) 59 JSON rules but only 1 runtime evaluator, (3) heterogeneous forward generators, (4) no real inverse elucidation engine.

## Architecture Target

```
Layer A: ChemKernel (single source of truth)
Layer B: ForwardSpectralGenerator (SMILES → theoretical spectra)
Layer C: VerificationEngine (SMILES + observed → evidence report)
Layer D: ElucidationEngine (observed → candidates → ranking)
Layer E: Audit/Benchmark/Reproducibility
```

## Phase Execution Order

### Phase 1: Repository Audit (COMPLETED)
- [x] Full codebase inspection
- [x] Conflict identification
- [x] docs/MASTER_REFACTOR_PLAN.md
- [x] docs/CODEBASE_MAP.md
- [x] docs/ARCHITECTURE_CONFLICTS.md

### Phase 2: Unified Chemistry Kernel (P0)
- [ ] Create `packages/chem-kernel/` with single-authority types
- [ ] Fix H-counting: atom_counts must include implicit H
- [ ] Fix DBE: use float division, include P term
- [ ] Fix `normalizeFormula` Cl/Br uppercase bug
- [ ] Route all chemistry through single kernel
- [ ] Deprecate `lib/utils/molecularStructure.ts` from production

### Phase 3: Shared Schemas
- [ ] Create `packages/schemas/canonical.ts` with all domain types
- [ ] Add Zod validation at API boundaries
- [ ] Unify TS/Python field names

### Phase 5: Real Rule Engine (P0)
- [ ] Implement evaluator registry pattern
- [ ] Write real evaluators for all 59 rules
- [ ] Evidence generation for every rule
- [ ] Coverage matrix auto-generation
- [ ] Fix scoring to use ruleset.json weights

### Phase 7: Forward Generation Fixes (P1)
- [ ] Remove Math.random() from FTIR generator
- [ ] Fix simulate route to use full engine
- [ ] Connect shift-engine pipeline end-to-end

### Phase 13: Testing
- [ ] Add vitest configuration
- [ ] Chemistry kernel unit tests
- [ ] Rule evaluator tests
- [ ] Golden molecule tests
- [ ] Schema validation tests

## Critical Bugs (Immediate Fix)

| Bug | Location | Impact | Fix |
|-----|----------|--------|-----|
| atom_counts missing H | parse_and_standardize | DBE inflated, downstream wrong | Add implicit H to counts |
| DBE `// 2` integer division | parse_and_standardize, chem-core | Half-integer DBE lost | Use float division |
| normalizeFormula toUpperCase | lib/chem/formula.ts | Cl→CL, Br→BR breaks validation | Parse-then-normalize |
| 58 rules return PASS without eval | evaluateRules.ts | Silent false confidence | Implement evaluators |
| Math.random in FTIR | spectrumGenerator.ts | Non-deterministic theory | Remove or seed |
| scoring ignores ruleset weights | scoring.ts | Hardcoded vs declared mismatch | Use meta.scoring_policy |

## Files Changed Tracking

Will be updated as phases complete.
