# Data Flow Map

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User / API Request                       │
├─────────────────────────────────────────────────────────────┤
│ Layer D: Inverse Elucidation Engine                        │
│   observed → constraints → candidates → resim → ranking   │
│   lib/elucidation/engine.ts                                │
├─────────────────────────────────────────────────────────────┤
│ Layer C: Verification Engine                               │
│   SMILES + observed → evidence report                      │
│   Spectrotester/src/core/verify/evaluateRules.ts           │
│   Spectrotester/src/core/verify/scoring.ts                 │
├─────────────────────────────────────────────────────────────┤
│ Layer B: Forward Spectral Generation                       │
│   SMILES → theoretical spectra                             │
│   lib/nmr/carbon13/engine.ts (13C)                         │
│   lib/nmr/shift-engine/ (1H)                               │
│   lib/nmr/coupling-graph/ (HSQC/COSY/HMBC)                │
│   lib/ms/isotope-engine.ts (MS isotope)                    │
│   lib/ms/fragmentation-engine.ts (MS fragments)            │
│   lib/ftir/correction-layers.ts (FTIR)                     │
│   lib/spectromind/ir_engine/ (FTIR base)                   │
├─────────────────────────────────────────────────────────────┤
│ Layer A: Chemistry Kernel (single authority)               │
│   packages/chem-kernel/ → lib/chem/formula.ts              │
│   packages/chem-kernel/symmetry.ts                         │
│   packages/chem-kernel/chemUtils.ts                        │
│   services/chem-core/main.py (Python bridge)               │
│   app/api/parse_and_standardize/route.ts (RDKit bridge)    │
├─────────────────────────────────────────────────────────────┤
│ Layer E: Audit / Benchmark / Calibration                   │
│   lib/benchmark/scaffold.ts                                │
│   lib/calibration/profiles.ts                              │
│   __tests__/*                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: SMILES → Theoretical Spectrum

```
SMILES input
  │
  ├── parse_and_standardize (RDKit Python)
  │     → canonicalSmiles, atomCounts, dbe, exactMass, graph
  │
  ├── chem-kernel (TS)
  │     → formula validation, DBE cross-check, functional groups
  │
  ├── symmetry engine
  │     → equivalence classes, unique carbon count
  │
  ├── 1H predictor (shift-engine)
  │     → predicted 1H peaks with shifts, coupling, multiplicity
  │
  ├── 13C predictor (carbon13/engine.ts)
  │     → predicted 13C peaks with DEPT classes
  │
  ├── coupling graph (coupling-graph/)
  │     → HSQC/COSY/HMBC expected correlations
  │
  ├── FTIR predictor (ir_engine + correction-layers)
  │     → predicted IR bands with corrections
  │
  └── MS predictor (isotope + fragmentation engines)
        → isotope envelope, fragmentation tree
```

## Data Flow: Verification

```
SMILES + Observed Spectra
  │
  ├── chem-kernel → graph features
  │
  ├── evaluateRules (57 rules)
  │     ├── prerequisites checked (dependency graph)
  │     ├── FORMULA rules (DBE, parity)
  │     ├── GLOBAL rules (SMILES, graph)
  │     ├── CROSS-modal rules (aromaticity, carbonyl, OH consensus)
  │     ├── 1H rules (region, integral, motif)
  │     ├── 13C rules (class count, symmetry, region)
  │     ├── HSQC rules (count, sp2 match, CH3 sync)
  │     ├── COSY rules (vicinal pairs, coverage)
  │     ├── HMBC rules (carbonyl, coverage)
  │     ├── NOESY rules (empty handling)
  │     ├── IR rules (functional group bands)
  │     └── MS rules (isotope envelope, neutral loss)
  │
  └── scoring → confidence + coverage + verdict

```

## Observed Data Schema Separation

```
Instrument File → RawObservation
                      │
              FID Processing
                      │
                ProcessedObservation
                      │
                  Peak Picking
                      │
                   PeakList  ←→  TheoreticalSpectrum
                      │                    │
                      └────────────────────┘
                              │
                      VerificationInput
```
