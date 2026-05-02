# REPO AUDIT - Pipeline Refactor

## PHASE 0: REPO AUDIT RESULTS

### A) FILES TO MODIFY

1. **app/api/rdkit/parse-smiles/route.ts**
   - Add coords2d and coords3d separation
   - Keep existing atoms/bonds structure

2. **app/api/ai-nmr-predict/route.ts**
   - Rewire to use MoleculePipelineService
   - Keep backward compatibility

3. **app/api/pubchem/route.ts**
   - Add pipeline integration (optional wrapper)

4. **app/api/pubchem/iupac/route.ts**
   - Add pipeline integration (optional wrapper)

5. **app/api/opsin/route.ts**
   - Add pipeline integration (optional wrapper)

6. **app/api/fid/process/route.ts**
   - Integrate optionalFIDCompare from pipeline

7. **lib/services/SMILESResolver.ts**
   - Add TTL cache support
   - Keep existing interface, enhance internally

8. **scripts/fid_processor.py**
   - Add metadata fields: sw_hz, sw_ppm, sfo1_mhz, ref_ppm
   - Keep complex spectrum until after phase correction

9. **lib/utils/molecularStructure.ts**
   - Keep as fallback parser
   - Mark limitations clearly

10. **lib/utils/theoreticalSpectrum.ts**
    - May be used by pipeline for enhancement
    - Keep existing functionality

### B) NEW FILES TO ADD

1. **lib/pipeline/types.ts** (NEW)
   - Pipeline type definitions

2. **lib/pipeline/MoleculePipelineService.ts** (NEW)
   - Main pipeline orchestrator

3. **lib/pipeline/providers/PubChemProvider.ts** (NEW - if needed)
   - Extract PubChem logic

4. **lib/pipeline/providers/OPSINProvider.ts** (NEW - if needed)
   - Extract OPSIN logic

5. **docs/MIGRATION_PIPELINE_V2.md** (NEW)
   - Migration guide

6. **scripts/pipeline_smoke_test.ts** (NEW - optional)
   - Smoke test script

### C) FILES TO KEEP BUT RE-WIRE (NO BEHAVIOR CHANGE)

1. **lib/services/SMILESResolver.ts**
   - Keep existing methods
   - Add cache TTL internally

2. **lib/utils/molecularStructure.ts**
   - Keep as fallback
   - No changes to parsing logic

3. **services/ultrathink-service/ultrathink_engine.py**
   - Keep as-is
   - Call from pipeline if available

4. **public/pyodide/fid_worker.js**
   - Keep as-is
   - Document processing spec if needed

## EXISTING TYPE DEFINITIONS FOUND

- `lib/types/index.ts` - NMRPeak, FTIRPeak, Carbon13Peak, Molecule
- `lib/types/spectrum.ts` - ProtonPeak, CarbonPeak, SpectralData
- `lib/spectromind/core/types.ts` - Conformer, NMRPeakTheoretical, JCoupling

## EXISTING SERVICES FOUND

- `lib/services/SMILESResolver.ts` - CID/IUPAC -> SMILES
- `lib/services/StructureCache.ts` - Structure caching
- `lib/services/TheoreticalSpectrumService.ts` - Spectrum enhancement
- `lib/services/v2/` - v2 services

## EXISTING UTILITIES FOUND

- `lib/utils/molecularStructure.ts` - JS SMILES parser (fallback)
- `lib/utils/theoreticalSpectrum.ts` - 10-module enhancement system
- `lib/utils/v2/clientProcessing.ts` - Client-side FID processing

## IMPLEMENTATION STRATEGY

1. Create types first (no dependencies)
2. Create pipeline service (depends on types, uses existing services)
3. Modify RDKit route (add 2D/3D separation)
4. Rewire routes (backward compatible)
5. Add migration doc
