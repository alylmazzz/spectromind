# SpectroMind Pipeline Refactor - Implementation Summary

## ✅ Completed Tasks

### 1. Type System Created
**File**: `lib/pipeline/types.ts`
- Complete type definitions for all pipeline stages
- `MoleculeInput`, `IdentityResult`, `StructureResult`, `GraphResult`, `NMRPredictionResult`, `PipelineResult`
- Support for 2D/3D coordinate separation
- Confidence breakdown and warning system

### 2. Pipeline Service Created
**File**: `lib/pipeline/MoleculePipelineService.ts`
- Single Source of Truth orchestrator
- Implements all pipeline stages:
  - `resolveIdentity()` - CID/name resolution
  - `resolveStructure()` - SMILES/InChI with stereo policy
  - `normalizeAndValidate()` - Structure validation
  - `buildGraph()` - 2D/3D graph building (RDKit + JS fallback)
  - `predictNMR()` - Placeholder for deterministic + LLM
  - `optionalFIDCompare()` - Placeholder for FID comparison
- Uses existing services (SMILESResolver, molecularStructure)
- Maintains provenance tracking and confidence calculation

### 3. RDKit Route Enhanced
**File**: `app/api/rdkit/parse-smiles/route.ts`
- **NEW**: `coords2d` field - 2D coordinates for depiction
- **NEW**: `coords3d` field - 3D coordinates for geometry
- **NEW**: `chiral_centers` field - Detected chiral centers
- **BACKWARD COMPATIBLE**: Existing `atoms` array still contains x,y,z

### 4. API Route Integration
**File**: `app/api/ai-nmr-predict/route.ts`
- Integrated with MoleculePipelineService
- **NEW**: `pipeline` field in response (optional, backward compatible)
- Existing response format preserved

### 5. Migration Documentation
**File**: `docs/MIGRATION_PIPELINE_V2.md`
- Complete migration guide
- Backward compatibility notes
- Usage examples
- FAQ section

## 🚧 Placeholder / Not Yet Implemented

### 1. Deterministic NMR Model Integration
**Status**: Placeholder in `predictNMR()`
**Required**: 
- Integration with `services/ultrathink-service/ultrathink_engine.py`
- Or call via API endpoint
- Shoolery/Karplus calculations

### 2. LLM Interpretation Separation
**Status**: Placeholder
**Required**:
- Separate OpenAI/Gemini calls from deterministic model
- Combine results in `finalConsensus`

### 3. FID Processing Integration
**Status**: Placeholder in `optionalFIDCompare()`
**Required**:
- Call `scripts/fid_processor.py`
- Extract experimental peaks
- Match with theoretical peaks

### 4. Formula Validation
**Status**: Placeholder in `normalizeAndValidate()`
**Required**:
- Parse SMILES and calculate formula
- Compare with identity.formula

### 5. InChIKey Calculation
**Status**: Not implemented
**Required**:
- Calculate InChIKey from InChI
- Use for compound matching

### 6. Cache TTL Implementation
**Status**: Not implemented
**Required**:
- Add TTL to SMILESResolver cache
- Negative cache for failures

## 📋 Files Created

1. `lib/pipeline/types.ts` - Type definitions
2. `lib/pipeline/MoleculePipelineService.ts` - Main service
3. `docs/MIGRATION_PIPELINE_V2.md` - Migration guide
4. `REPO_AUDIT_PIPELINE_REFACTOR.md` - Audit results
5. `PIPELINE_REFACTOR_SUMMARY.md` - This file

## 📝 Files Modified

1. `app/api/rdkit/parse-smiles/route.ts` - Added 2D/3D separation
2. `app/api/ai-nmr-predict/route.ts` - Added pipeline integration

## 🔍 How to Verify

### 1. Test Pipeline Service Directly

```typescript
import { MoleculePipelineService } from '@/lib/pipeline/MoleculePipelineService';

const pipeline = MoleculePipelineService.getInstance();

const result = await pipeline.run({
  moleculeName: 'ethanol',
  options: { preferredStereoPolicy: 'auto' }
}, {
  predictNMR: true
});

console.log('Structure:', result.structure.canonicalSmiles);
console.log('Stereo:', result.structure.stereoStatus);
console.log('Graph source:', result.graph.graphSource);
console.log('2D coords:', result.graph.coords2d?.length);
console.log('3D coords:', result.graph.coords3d?.length);
```

### 2. Test API Route

```bash
curl -X POST http://localhost:3000/api/ai-nmr-predict \
  -H "Content-Type: application/json" \
  -d '{
    "moleculeName": "ethanol",
    "literature": []
  }'
```

Check response for `pipeline` field.

### 3. Test RDKit Route

```bash
curl -X POST http://localhost:3000/api/rdkit/parse-smiles \
  -H "Content-Type: application/json" \
  -d '{"smiles": "CCO"}'
```

Verify response contains:
- `coords2d` array
- `coords3d` array
- `atoms` array (backward compatible)

## 🎯 Next Steps

1. **Implement Deterministic NMR Model**
   - Integrate UltraThink engine
   - Or create API endpoint for Python service

2. **Separate LLM Interpretation**
   - Move OpenAI call to pipeline
   - Combine with deterministic results

3. **Complete FID Integration**
   - Process FID in pipeline
   - Match experimental vs theoretical

4. **Add Formula Validation**
   - Use RDKit to calculate formula from SMILES
   - Compare with identity

5. **Implement Cache TTL**
   - Add timestamp to cache entries
   - Enforce TTL on reads

## ⚠️ Important Notes

- **Backward Compatibility**: All existing API responses remain unchanged
- **Pipeline Field**: New `pipeline` field is optional
- **Placeholders**: Marked with `NOT_IMPLEMENTED` comments
- **No Breaking Changes**: Existing code continues to work

## 📚 Related Documentation

- Technical Blueprint: `spectromind_technical_blueprint.txt`
- Migration Guide: `docs/MIGRATION_PIPELINE_V2.md`
- Audit Results: `REPO_AUDIT_PIPELINE_REFACTOR.md`
