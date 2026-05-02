# Architecture Conflicts

## 1. Duplicate Chemistry Authorities

| Authority | Location | H Policy | DBE Method | Aromaticity | SMILES |
|-----------|----------|----------|------------|-------------|--------|
| parse_and_standardize | `app/api/parse_and_standardize/route.ts` | Implicit H missing from atomCounts | `//2` integer division | RDKit | isomeric |
| chem-core | `services/chem-core/main.py` | AddHs explicit graph | `//2` integer division | RDKit | non-isomeric |
| formula.ts | `lib/chem/formula.ts` | implicit H via computeAtomCountsFromRDKitAtoms | Float division (correct) | None | N/A |
| molecularStructure | `lib/utils/molecularStructure.ts` | Explicit only | None | Lowercase letter heuristic | Custom parser |
| Spectrotester features | `Spectrotester/src/core/graph/features.ts` | Depends on upstream graph | Uses graph.dbe | Uses isAromatic field | N/A |

### Conflict: H Counting
- `parse_and_standardize`: `atom_counts` only counts heavy atoms from `mol.GetAtoms()`, H is 0 for most SMILES
- `chem-core`: Uses `CalcMolFormula` regex parse for H count (correct for formula, but DBE uses `//2`)
- `formula.ts`: `computeAtomCountsFromRDKitAtoms` correctly adds implicitHydrogens

### Conflict: DBE Calculation
- `parse_and_standardize`: `(2 + 2*C + N + P - H - X) // 2` — integer division loses half-DBE, H often 0
- `chem-core`: `1 + C - (nH_total // 2) - (nX // 2) + (nN // 2)` — each term individually floor-divided
- `formula.ts`: `C - H/2 - X/2 + N/2 + charge/2 + 1` — correct float division

### Conflict: normalizeFormula
- `formula.ts` line 227: `normalized.toUpperCase()` converts `Cl` → `CL`, `Br` → `BR`
- Downstream `parseFormula` regex `/([A-Z][a-z]?)(\d*)/g` will not match `CL` correctly

### Conflict: SMILES Canonicalization
- `parse_and_standardize`: `MolToSmiles(mol, isomericSmiles=True)` preserves stereochemistry
- `chem-core`: `MolToSmiles(mol, canonical=True)` without isomericSmiles — stereo may be lost

## 2. Duplicate Graph Schemas

- `lib/verification/types.ts`: `MoleculeGraph` with `source: 'rdkit' | 'js_fallback'`
- `Spectrotester/src/core/graph/features.ts`: `MoleculeGraph` with similar but not identical fields
- `packages/schemas/index.ts`: Another `MoleculeGraph` definition

## 3. Rule Engine Gap

- `ruleset.json`: 59 rules with rich metadata
- `evaluateRules.ts`: Only 1 rule (`FORMULA_DBE_NEGATIVE_FATAL`) has real evaluation
- 58 rules silently return PASS with empty evidence
- `scoring.ts` hardcodes ERROR=15; `ruleset.json` declares ERROR=8

## 4. Forward Generation Asymmetry

| Modality | Engine | Deterministic | Production-ready |
|----------|--------|---------------|-----------------|
| 1H NMR | HOSE heuristic + deterministicPredictor | Yes | Partial |
| 13C NMR | AI fallback | No (LLM) | No |
| FTIR | ftirEngine + spectrumGenerator | No (Math.random) | Partial |
| MS | ms-service Python | Yes | Partial |
| HSQC/COSY/HMBC | Declarative only | N/A | No |
| NOESY | None | N/A | No |

## 5. Simulate Route vs Reality

- `app/api/simulate/route.ts`: engine=spectrotester returns 501
- engine=spectromind returns flat peak list (all singlets, integration=1)
- No multiplicity, no coupling, no equivalence grouping

## 6. FID Processing Conflicts

- `useClientFIDProcessing.ts`: Wrong argument order in `processFID` call
- `fid_process.py`: Returns `y` field but API expects `peaks`
- `browser_nmr_processor.py`: Hardcoded `center_ppm = 4.7`
