# FINAL REFACTOR AUDIT - NMR Split + FID Correctness

## TASK 00: REPO AUDIT RESULTS

### A) FILES TO MODIFY

#### NMR Split (Deterministic + LLM)
1. **lib/pipeline/types.ts** (EXISTS - UPDATE)
   - Add strict NMR types: Peak, DeterministicPrediction, LLMInterpretation, FinalConsensus

2. **lib/pipeline/MoleculePipelineService.ts** (EXISTS - UPDATE)
   - Update predictNMR() to call deterministic + LLM separately

3. **lib/nmr/deterministicPredictor.ts** (NEW)
   - Call UltraThink engine or implement TS fallback
   - Group equivalent protons
   - Calculate shifts (Shoolery)
   - Calculate couplings (Karplus if 3D coords available)

4. **lib/nmr/llmPredictor.ts** (NEW)
   - Extract LLM orchestration from route
   - Return LLMInterpretation (not simulation)

5. **lib/nmr/consensusBuilder.ts** (NEW)
   - Merge model + LLM peaks with tolerance
   - Set source tags

6. **app/api/ai-nmr-predict/route.ts** (EXISTS - UPDATE)
   - Call deterministic predictor
   - Call LLM predictor
   - Build consensus
   - Return nmr: NMRPredictionResult

#### FID Processing Correctness
7. **scripts/fid_processor.py** (EXISTS - FIX)
   - Keep spectrum complex until after phase correction
   - Fix phase correction: use exp(iφ) not cosine trick
   - Fix axis: sw_hz, dwell_s, ppm calculation
   - Add metadata: sfo1_mhz, sw_hz, sw_ppm, offset_hz, ref_ppm

8. **lib/fid/processingSpec.ts** (NEW)
   - Define FIDProcessingSpec type
   - Default spec constant

9. **app/api/fid/process/route.ts** (EXISTS - UPDATE)
   - Accept processingSpec parameter
   - Pass spec to Python script

10. **public/pyodide/fid_worker.js** (EXISTS - UPDATE)
    - Accept same processingSpec
    - Implement same processing order
    - Keep complex until after phase

11. **lib/utils/v2/clientProcessing.ts** (EXISTS - UPDATE)
    - Use processingSpec

### B) NEW FILES TO CREATE

1. `lib/nmr/deterministicPredictor.ts` - Deterministic NMR prediction
2. `lib/nmr/llmPredictor.ts` - LLM interpretation (separated)
3. `lib/nmr/consensusBuilder.ts` - Peak fusion logic
4. `lib/fid/processingSpec.ts` - FID processing specification
5. `scripts/pipeline_smoke_test.ts` - Smoke test

### C) FILES TO KEEP (NO CHANGES, BUT REFERENCED)

1. `services/ultrathink-service/ultrathink_engine.py` - Python engine (call from TS)
2. `lib/utils/molecularStructure.ts` - Coupling paths, dihedral (reuse)
3. `lib/utils/theoreticalSpectrum.ts` - Enhancement modules (may use)

## INVENTORY: DETERMINISTIC ASSETS FOUND

### Python (UltraThink)
- ✅ Shoolery constants and calculation
- ✅ Karplus equation (dihedral → J)
- ✅ Proton grouping (simplified - needs improvement)
- ✅ Multiplicity determination (n+1 rule)

### TypeScript
- ✅ findCouplingPaths() - coupling path detection
- ✅ calculateDihedralAngle() - dihedral from 3D coords
- ✅ parseSMILES() - structure parsing (fallback)

## INVENTORY: LLM ASSETS FOUND

- ✅ OpenAI client in `app/api/ai-nmr-predict/route.ts`
- ✅ Prompt building with Silverstein methodology
- ✅ Functional group library integration

## INVENTORY: FID PROCESSING ISSUES FOUND

### Current Problems:
1. **Line 141**: `self.spectrum = np.real(self.spectrum)` - TOO EARLY! Complex lost before phase correction
2. **Line 179**: Phase correction uses cosine trick, not complex rotation
3. **Line 106**: Dwell time calculation unclear (sw_ppm vs sw_hz)
4. **Line 148**: PPM axis may not account for offset_hz correctly
5. **Metadata**: Missing sw_hz, sfo1_mhz, offset_hz, ref_ppm fields

### What Works:
- ✅ Apodization (exponential)
- ✅ Zero filling
- ✅ FFT and fftshift
- ✅ Peak detection (basic)

## IMPLEMENTATION PLAN

### Phase 1: NMR Split
1. Update types.ts with strict NMR types
2. Create deterministicPredictor.ts
3. Create llmPredictor.ts
4. Create consensusBuilder.ts
5. Update ai-nmr-predict route
6. Update MoleculePipelineService.predictNMR()

### Phase 2: FID Correctness
1. Create processingSpec.ts
2. Fix fid_processor.py (complex + axis)
3. Update fid/process route (spec support)
4. Update fid_worker.js (spec support)
5. Update clientProcessing.ts

### Phase 3: Formula + Cache
1. Add formula validation
2. Add cache TTL to SMILESResolver

### Phase 4: Testing
1. Create smoke test
2. Update migration doc
