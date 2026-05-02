# SpectroMind Pipeline v2.0 Migration Guide

## Overview

SpectroMind v2.0 introduces a **Single Source of Truth** pipeline architecture that ensures deterministic processing, consistent SMILES/stereo handling, and proper separation of 2D/3D coordinates and deterministic vs LLM predictions.

## What Changed

### 1. New Pipeline Service

**File**: `lib/pipeline/MoleculePipelineService.ts`

A centralized service that orchestrates the entire molecule processing pipeline:
- Identity Resolution (CID, name, formula)
- Structure Resolution (SMILES, InChI, stereo)
- Graph Building (2D/3D coordinates)
- NMR Prediction (deterministic + LLM)
- FID Comparison (optional)

### 2. New Type System

**File**: `lib/pipeline/types.ts`

Comprehensive type definitions for all pipeline stages:
- `MoleculeInput` - Input to pipeline
- `IdentityResult` - Resolved identity
- `StructureResult` - SMILES/InChI with stereo status
- `GraphResult` - 2D/3D coordinates separated
- `NMRPredictionResult` - Model + LLM predictions separated
- `PipelineResult` - Complete pipeline output

### 3. RDKit Route Enhancement

**File**: `app/api/rdkit/parse-smiles/route.ts`

**New Fields**:
- `coords2d`: Array of `{x, y}` for 2D depiction
- `coords3d`: Array of `{x, y, z}` for geometry calculations
- `chiral_centers`: Array of detected chiral centers

**Backward Compatibility**:
- Existing `atoms` array still contains `x, y, z` fields (from 3D)
- New fields are additive, no breaking changes

### 4. API Route Updates

All API routes now support a `pipeline` field in responses:

```typescript
{
  // ... existing fields (backward compatible)
  pipeline?: PipelineResult  // New field
}
```

## Migration Steps

### For API Consumers

#### Option 1: Use Pipeline Field (Recommended)

```typescript
const response = await fetch('/api/ai-nmr-predict', {
  method: 'POST',
  body: JSON.stringify({ moleculeName: 'ethanol' })
});

const data = await response.json();

// New: Access pipeline result
if (data.pipeline) {
  const { structure, graph, nmr } = data.pipeline;
  
  // Use 2D coords for visualization
  const coords2d = graph.coords2d;
  
  // Use 3D coords for calculations
  const coords3d = graph.coords3d;
  
  // Access deterministic model prediction
  const modelPeaks = nmr?.modelPrediction.peaks;
  
  // Access LLM interpretation
  const llmNotes = nmr?.llmInterpretation?.notes;
}
```

#### Option 2: Continue Using Existing Fields (Backward Compatible)

```typescript
// Old code still works
const peaks = data.peaks;
const smiles = data.smiles;
```

### For Frontend Components

#### Using 2D vs 3D Coordinates

```typescript
// Before (ambiguous)
const coords = data.atoms.map(a => ({ x: a.x, y: a.y }));

// After (explicit)
const coords2d = data.pipeline?.graph.coords2d;  // For rendering
const coords3d = data.pipeline?.graph.coords3d;  // For Karplus/dihedral
```

#### Checking Stereo Status

```typescript
const stereoStatus = data.pipeline?.structure.stereoStatus;
// 'full' | 'partial' | 'none'

if (stereoStatus !== 'full') {
  console.warn('Stereo information missing; NMR prediction may be ambiguous');
}
```

#### Accessing Confidence

```typescript
const confidence = data.pipeline?.confidence;
// {
//   structureConfidence: 0.0-1.0,
//   stereoConfidence: 0.0-1.0,
//   predictionConfidence: 0.0-1.0,
//   fidQuality?: 0.0-1.0
// }
```

## Breaking Changes

### None (Backward Compatible)

All existing API responses remain unchanged. New `pipeline` field is optional and additive.

## New Features

### 1. Stereo Policy

```typescript
const input: MoleculeInput = {
  moleculeName: 'ethanol',
  options: {
    preferredStereoPolicy: 'require_isomeric' | 'allow_canonical' | 'auto'
  }
};
```

### 2. Provenance Tracking

```typescript
const provenance = data.pipeline?.provenance;
// {
//   sourceChain: ['identity:cid', 'structure:pubchem', 'graph:rdkit'],
//   timestamps: { start: '...', identityResolved: '...', ... }
// }
```

### 3. Warnings System

```typescript
const warnings = data.pipeline?.warnings;
// Array of {
//   code: string,
//   message: string,
//   stage: 'identity' | 'structure' | 'graph' | 'nmr' | 'fid',
//   severity: 'low' | 'medium' | 'high'
// }
```

## Implementation Status

### ✅ Completed

- [x] Pipeline service architecture
- [x] Type definitions
- [x] RDKit 2D/3D separation
- [x] Identity resolution
- [x] Structure resolution with stereo policy
- [x] Graph building (RDKit + JS fallback)

### 🚧 In Progress / Placeholder

- [ ] Deterministic NMR model integration (UltraThink engine)
- [ ] LLM interpretation separation
- [ ] FID processing integration
- [ ] Formula validation
- [ ] InChIKey calculation
- [ ] Cache TTL implementation

## Testing

### Smoke Test

Run the smoke test script:

```bash
npx ts-node scripts/pipeline_smoke_test.ts
```

### Manual Testing

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
console.log('Confidence:', result.confidence);
```

## FAQ

### Q: Do I need to migrate immediately?

**A**: No. All existing endpoints remain backward compatible. The `pipeline` field is optional.

### Q: What if I only need SMILES?

**A**: Continue using existing endpoints. Pipeline is for full processing pipeline.

### Q: How do I know if stereo is available?

**A**: Check `pipeline.structure.stereoStatus`:
- `'full'`: Complete stereo information
- `'partial'`: Some stereo information
- `'none'`: No stereo information

### Q: What's the difference between coords2d and coords3d?

**A**:
- `coords2d`: For visualization/rendering (2D depiction)
- `coords3d`: For geometry calculations (Karplus, dihedral angles, through-space effects)

### Q: Why separate modelPrediction and llmInterpretation?

**A**: 
- `modelPrediction`: Deterministic, reproducible (Shoolery, Karplus)
- `llmInterpretation`: AI-generated, may vary, includes literature insights

## Support

For questions or issues, please refer to:
- Technical Blueprint: `spectromind_technical_blueprint.txt`
- Pipeline Types: `lib/pipeline/types.ts`
- Pipeline Service: `lib/pipeline/MoleculePipelineService.ts`
