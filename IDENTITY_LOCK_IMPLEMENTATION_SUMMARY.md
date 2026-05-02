# Identity Lock & Formula Enforcement - Implementation Summary

## ✅ COMPLETED TASKS

### STEP 1: Type System ✅
**File**: `lib/pipeline/types.ts`
- Added `atomCounts: Record<string, number>` to `StructureResult` and `GraphResult`
- Added `molecularFormulaHill: string` (computed from atomCounts)
- Added `dbe: number` (computed from atomCounts)
- Added `totalHydrogenFromFormula: number`
- Added warning codes: `FORMULA_MISMATCH`, `IDENTITY_DRIFT_DETECTED`

### STEP 2: Formula Utility ✅
**File**: `lib/chem/formula.ts` (NEW)
- `computeAtomCountsFromRDKitAtoms()` - Extract atom counts from RDKit atoms
- `formatHillFormula()` - Format in Hill system (C, H, then alphabetical)
- `computeDBE()` - Calculate DBE with halogens and nitrogen correction
- `parseFormulaToAtomCounts()` - Parse formula string to atom counts
- `normalizeFormula()` - Remove Unicode subscripts
- `validateFormula()` - Compare formulas accurately
- `getTotalHydrogen()` / `getTotalCarbon()` - Helper functions

### STEP 3: Pipeline Enforcement ✅
**File**: `lib/pipeline/MoleculePipelineService.ts`

**Changes**:
1. **buildGraph()** - Now computes atomCounts, molecularFormulaHill, dbe from RDKit or JS parser
2. **Formula validation** - Compares identity.formula with graph.molecularFormulaHill
3. **Identity fingerprint** - Stores cid, inchiKey, isomericSmiles, molecularFormulaHill
4. **predictNMR()** - Identity lock:
   - Uses ONLY `graph.molecularFormulaHill` (not user input formula)
   - Detects LLM drift (placeholder - full validation would parse LLM text)
   - Discards LLM peaks if drift detected
   - Forces "model-only" if formula mismatch

**Key Code**:
```typescript
// IDENTITY LOCK: Use ONLY computed formula from graph
const lockedFormula = graph.molecularFormulaHill || graph.formula;
const lockedAtomCounts = graph.atomCounts;
const lockedDBE = graph.dbe;
const lockedTotalH = graph.totalHydrogenFromFormula;

// Pass ONLY computed formula to LLM
llmInterpretation = await runLLMInterpretation({
  formula: lockedFormula, // IDENTITY LOCK: Use computed formula only
  // ...
}, apiKey);
```

## 🚧 REMAINING TASKS

### STEP 4: ai-nmr-predict Route Template Fixes
**File**: `app/api/ai-nmr-predict/route.ts`

**Current Issue**: 
- Line 271-286: Extracts totalHydrogens/totalCarbons from formula string using regex
- Line 312: Uses `formula` variable directly in prompt (may be user input, not computed)

**Required Changes**:
1. Get computed values from pipeline result:
   ```typescript
   const computedFormula = pipelineResult?.graph?.molecularFormulaHill;
   const computedTotalH = pipelineResult?.graph?.totalHydrogenFromFormula;
   const computedDBE = pipelineResult?.graph?.dbe;
   ```
2. Replace all `formula` references in prompt with `computedFormula`
3. Replace all `totalHydrogens` with `computedTotalH`
4. Add DBE to prompt: `DBE = ${computedDBE} (computed from structure)`
5. Add identity lock warning if formula mismatch detected

### STEP 5: Functional Group Library Expansion
**Status**: NOT IMPLEMENTED
**Required**: 
- Create `lib/chem/functionalGroups.ts` with SMARTS-based library
- Integrate RDKit substructure matching (if available)
- Return functional groups from structure analysis

### STEP 6: Smoke Test - Paclitaxel
**File**: `scripts/pipeline_smoke_test.ts`
**Required**:
- Add paclitaxel test case
- Assert: `molecularFormulaHill == "C47H51NO14"`
- Assert: `atomCounts.C == 47, H == 51, N == 1, O == 14`
- Assert: `dbe` is computed and numeric
- Assert: No "C14H12" in any output
- Assert: Warning `FORMULA_MISMATCH` if wrong formula provided

## 🔍 CRITICAL FIXES APPLIED

1. ✅ **Atom counts computed from structure** - Not from free text
2. ✅ **Formula computed from atomCounts** - Hill system format
3. ✅ **DBE computed from atomCounts** - With halogens/nitrogen correction
4. ✅ **Identity fingerprint stored** - For lock enforcement
5. ✅ **LLM receives only computed formula** - Not user input
6. ✅ **Formula mismatch detection** - Warning with high severity
7. ✅ **Identity drift placeholder** - Ready for full LLM text parsing

## ⚠️ KNOWN LIMITATIONS

1. **LLM drift detection** - Currently placeholder. Full implementation would:
   - Parse LLM response text for formula mentions
   - Compare with locked formula
   - Discard peaks if mismatch

2. **Functional group detection** - Not yet expanded. Current:
   - Basic JS parser detection
   - No SMARTS-based library
   - No RDKit substructure matching

3. **ai-nmr-predict route** - Still uses regex parsing. Should use:
   - Pipeline computed values
   - No free-formula in prompts

## 📋 NEXT STEPS

1. **Update ai-nmr-predict route** to use pipeline computed values
2. **Add functional group library** (SMARTS-based)
3. **Add paclitaxel smoke test**
4. **Implement full LLM drift detection** (parse response text)

## 🎯 PACLITAXEL TEST CASE

When fully implemented, paclitaxel query should:
- ✅ Compute `atomCounts = {C:47, H:51, N:1, O:14}`
- ✅ Compute `molecularFormulaHill = "C47H51NO14"`
- ✅ Compute `dbe` from atomCounts
- ✅ Use ONLY computed formula in LLM prompt
- ✅ Detect if LLM mentions "C14H12" and discard
- ✅ Return warning if formula mismatch
- ✅ Lock analysis to selected identity
