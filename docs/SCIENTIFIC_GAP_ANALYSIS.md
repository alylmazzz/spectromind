# Scientific Gap Analysis v2.0

Generated: 2026-03-27

## Gaps Closed in This Iteration

### 1. Chemistry Kernel Authority
- **CLOSED**: Python chem-core DBE now uses float division with P and charge terms
- **CLOSED**: Python returns `atomCounts`, `formalCharge`, `kernelVersion`
- **CLOSED**: Python `_symmetry_class_count` uses `CanonicalRankAtoms`
- **REMAINING**: 6 routes still have local `normalizeFormula` copies (pubchem, openai routes)
- **REMAINING**: `molecularStructure.ts` fallback still exists in pipeline service

### 2. Rule Engine
- **CLOSED**: COSY/HMBC `minRatio` parameters now actually used in comparison
- **CLOSED**: `H1_INTEGRAL_PARSING_SINGLE_AUTHORITY` no longer stub (validates integral presence/sign)
- **CLOSED**: MS isotope evaluators now perform real M+1/M+2 ratio analysis
- **CLOSED**: Rule dependency graph with prerequisite checking implemented
- **CLOSED**: Empty array `[]` vs `undefined` distinction handled correctly
- **REMAINING**: No full false-positive/false-negative systematic audit
- **REMAINING**: No rule redundancy resolution
- **REMAINING**: Cross-modal conflict matrix not implemented

### 3. 13C NMR Engine
- **NEW**: Additive substituent model with 15 carbon type categories
- **NEW**: DEPT class prediction (CH3/CH2/CH/C)
- **NEW**: Ring strain corrections (cyclopropyl, cyclobutyl)
- **NEW**: Solvent offset corrections for 6 solvents
- **NEW**: Quaternary carbon weak-signal warnings
- **REMAINING**: No curated HOSE database integration
- **REMAINING**: MAE expected 5-15 ppm without database lookup
- **REMAINING**: No conformer averaging or Boltzmann weighting

### 4. Symmetry Engine
- **NEW**: Morgan extended connectivity partition
- **NEW**: Diastereotopic site detection via stereocenter proximity
- **NEW**: Magnetic equivalence warnings
- **NEW**: Expected unique 13C signal count from equivalence classes
- **REMAINING**: Not full Nauty/bliss (documented limitation)
- **REMAINING**: Cannot distinguish enantiotopic from diastereotopic without CIP

### 5. 2D NMR Coupling Graph
- **NEW**: Unified HSQC/COSY/HMBC on same graph backbone
- **NEW**: Direct one-bond mapping for HSQC
- **NEW**: BFS path enumeration for COSY and HMBC
- **NEW**: Impossible correlation detection
- **NEW**: Coverage ratio metrics
- **NEW**: Verification of observed 2D peaks against coupling graph
- **REMAINING**: No NOESY/ROESY through-space edges (requires 3D coordinates)
- **REMAINING**: Estimated J values are approximations

### 6. MS Engine
- **NEW**: Isotope envelope computation using polynomial convolution
- **NEW**: Natural abundance data for 13 elements
- **NEW**: Isotope match scoring with M+1/M+2/M+3 comparison
- **NEW**: BDE-based fragmentation tree
- **NEW**: Alpha/benzylic/allylic cleavage mechanism annotation
- **NEW**: Neutral loss library (17 entries)
- **NEW**: Diagnostic ion library (11 entries)
- **REMAINING**: No kinetic competition modeling
- **REMAINING**: No charge-remote fragmentation
- **REMAINING**: No rearrangement detection beyond McLafferty

### 7. FTIR Engine
- **NEW**: Conjugation correction (C=O with C=C or aromatic)
- **NEW**: Hydrogen bonding broadening model
- **NEW**: Acid dimerization correction
- **NEW**: Ring strain shifts for 3- and 4-membered rings
- **NEW**: ATR correction with refractive index parameter
- **NEW**: Solvent/water contamination exclusion zones
- **NEW**: Fingerprint region motif matching (10 motifs)
- **REMAINING**: No full normal mode calculation from first principles

### 8. Observed Data Schemas
- **NEW**: `RawObservation` type with instrument metadata
- **NEW**: `ProcessedObservation` type with processing record
- **NEW**: `PeakList` type with quality flags
- **NEW**: `TheoreticalSpectrum` type (distinct from observation)
- **NEW**: `VerificationInput` pairs observed with theoretical
- **NEW**: `DataProvenance` type with hash and processing chain

### 9. Inverse Elucidation
- **UPGRADED**: Motif extraction from 1H, FTIR, MS (9 motif types)
- **UPGRADED**: Spin system assembly (ethyl, isopropyl, aromatic)
- **UPGRADED**: Substructure hypothesis generation from motifs
- **UPGRADED**: Ambiguity class reporting
- **REMAINING**: Still lookup+ranking, not true graph assembly
- **REMAINING**: No formula-constrained SMILES generation

### 10. Benchmark Infrastructure
- **NEW**: Benchmark case type with 15 categories
- **NEW**: Shift metrics (MAE, RMSD, R², max/median error)
- **NEW**: Classification metrics (precision, recall, F1)
- **NEW**: Confidence calibration error computation
- **NEW**: 12 golden benchmark cases as seed
- **REMAINING**: No automated benchmark runner
- **REMAINING**: No CI integration

## Overall Remaining Scientific Gaps (Priority Order)

1. **Curated HOSE database** — largest single accuracy improvement for both 1H and 13C
2. **Full graph automorphism** — Nauty/bliss via WASM or Python bridge
3. **Conformer ensemble averaging** — critical for flexible molecules
4. **True candidate generation** (SMILES enumeration from constraints)
5. **pKa/protonation-aware logic** for exchangeable proton behavior
6. **QM/DFT fallback interface** for difficult predictions
7. **Mixture detection** and sample purity assessment
8. **Tautomer/protomer ensemble** handling
9. **Temperature and concentration effect models**
10. **Automated benchmark CI pipeline** with regression gates
