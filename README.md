# 🧬 SpectroMind - NMR Structure Elucidation Platform

**AI-powered molecular structure analysis from NMR spectroscopy data**

Version: 1.5.0 "Singularity Edition"  
Status: ✅ Production Ready

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Setup Python environment
python3 -m venv venv_rdkit
source venv_rdkit/bin/activate
pip install rdkit numpy

# Run development server
npm run dev
```

Navigate to **http://localhost:3000**

---

## 📊 Features

- ✅ **NMR Peak Analysis**: Input 1H NMR data (shift, integration, multiplicity)
- ✅ **PubChem Integration**: Search 966M+ compounds
- ✅ **AI-Powered Analysis**: Gemini/OpenAI structure prediction
- ✅ **RDKit v1.5**: 7-engine elucidation pipeline
  - Mixture Detection
  - Solvent Physics
  - 13C Skeleton Builder
  - 2D Correlations (NOESY/HMBC)
  - Forward Prediction
  - Certified Validator
- ✅ **Enhanced Library**: 794+ analyzed molecules (instant cache)
- ✅ **FTIR Prediction**: AI-generated IR spectra

---

## 🏗️ Architecture

### System Overview

![Architecture Diagram](docs/ARCHITECTURE.drawio)

**Open with:** [draw.io](https://app.diagrams.net) or VS Code Draw.io extension

### Detailed Analysis Flow

SpectroMind uses a 6-step intelligent pipeline for molecular structure elucidation:

#### **Step 0: LocalStorage Check**
```typescript
localStorage.getItem('spectromind_known_molecule')
→ Check if molecule was analyzed in last 10 minutes
→ If found: Use cached data, skip analysis
→ If not: Continue to validation
```

#### **Step 1: Molecule Validation**
```typescript
MoleculeValidator.validateKnownMolecule()
→ detectMixture() - Check for multiple molecules in sample
→ comparePeaks() - Compare with saved peaks (±0.01 ppm tolerance)
→ Validate solvent and frequency match
→ Return: shouldSkipAnalysis boolean
```

#### **Step 2: Enhanced Library Search** (794 molecules)
```typescript
searchEnhancedLibrary()
→ fetch('/api/enhanced-library')
→ Peak matching with ±0.1 ppm tolerance
→ If match ≥95%: FOUND (instant result from AI cache)
→ If not: Continue to PubChem
```

#### **Step 3: PubChem Search** (966M+ molecules)
```typescript
PubChemService.search()
→ Strategy 1: searchByFormula() if formula provided (faster)
   ↳ GET /api/pubchem?type=formula&query=C7H8
→ Strategy 2: searchByPeaks() for complex matching
   ↳ POST /api/pubchem/search-by-peaks
→ Return: { name, formula, cid, score }
```

#### **Step 4: RDKit Structure Elucidation** (Python)
```typescript
RDKitService.elucidate()
→ Only runs if: no library match + no known molecule + formula available
→ fetch('/api/rdkit/elucidation')
   ↳ Spawns Python subprocess: elucidation_v15.py
   ↳ 7-Engine Pipeline:
      1. Mixture Detection
      2. Solvent Physics
      3. 13C Skeleton Builder
      4. 2D Correlations (NOESY/HMBC)
      5. Fragment Detection (RDKit)
      6. Forward Prediction
      7. Certified Validator
→ Return: { best, candidates, fragments }
```

#### **Step 5: AI Analysis** (Gemini/OpenAI)
```typescript
Build Context:
  - libraryResult (Step 2)
  - pubchemResult (Step 3)
  - rdkitResult (Step 4)
  - User peaks + solvent + frequency

AI Provider:
  → fetchGeminiAnalysis() OR fetchChatGPTAnalysis()

AI Tasks:
  1. Identify molecule from all context
  2. Assign each NMR peak to molecular structure
  3. Suggest alternative candidates
  4. Calculate confidence score
  5. Generate FTIR prediction

Return: AIAnalysisResult
```

#### **Step 6: Save & Display**
```typescript
Parallel operations:
  1. fetch('/api/save-analysis') → analysis_history.json
  2. addToEnhancedLibrary() → enhanced_library.json
  3. localStorage.setItem() → Cache for 10 minutes
  4. setState() → Update UI (NMRChart, FTIRChart, ResultsPanel)
```

### Flow Diagram

**For a detailed visual representation of every function call and decision point, see:**
- [**DETAILED_FLOW.drawio**](docs/DETAILED_FLOW.drawio) - Complete step-by-step flow with all functions
- [ARCHITECTURE.drawio](docs/ARCHITECTURE.drawio) - High-level system architecture

---

## 📁 Project Structure

```
spectromind/
├── app/
│   ├── page.tsx              # Main UI
│   └── api/                  # Next.js API Routes
│       ├── pubchem/          # PubChem integration
│       ├── elucidation-v15/  # RDKit v1.5 pipeline
│       ├── enhanced-library/ # AI cache
│       └── ...
│
├── lib/
│   ├── services/             # Service classes (NEW)
│   │   ├── MoleculeValidator.ts  # Molecule validation logic
│   │   ├── PubChemService.ts     # PubChem API wrapper
│   │   └── RDKitService.ts       # RDKit API wrapper
│   ├── engines/              # Python NMR engines
│   ├── utils/                # Utility functions
│   └── types/                # TypeScript types
│
├── scripts/
│   ├── elucidation_v15.py    # v1.5 engine
│   └── rdkit_elucidation.py  # v1.0 legacy
│
├── docs/
│   ├── API.md                # API documentation
│   ├── SETUP.md              # Setup guide
│   ├── FEATURES.md           # Feature details
│   ├── ARCHITECTURE.drawio   # System architecture diagram
│   └── DETAILED_FLOW.drawio  # Step-by-step flow diagram
│
└── venv_rdkit/               # Python virtual environment
```

---

## 🚀 Tech Stack

- **Frontend**: Next.js 16 (React + TypeScript)
- **Backend**: Next.js API Routes
- **NMR Engine**: Python (RDKit)
- **AI**: Google Gemini / OpenAI
- **Database**: JSON files (Enhanced Library, Analysis History)
- **External APIs**: PubChem REST API

---

## 📖 Documentation

- [**DETAILED_FLOW.drawio**](docs/DETAILED_FLOW.drawio) - **Complete step-by-step flow with all functions** ⭐
- [API Endpoints](docs/API.md) - API reference and usage
- [Setup Guide](docs/SETUP.md) - Installation and configuration
- [Features](docs/FEATURES.md) - Detailed feature list
- [Architecture](docs/ARCHITECTURE.drawio) - High-level system design diagram

---

## 🧪 Example Usage

### 1. Enter NMR Peaks

```
Shift: 7.3   Integration: 5   Multiplicity: m
Shift: 2.3   Integration: 3   Multiplicity: s
```

### 2. Click "Analyze"

### 3. Results

- **Molecule**: Toluene (C7H8)
- **Confidence**: 92%
- **FTIR Prediction**: Generated
- **Alternative Candidates**: Benzene derivatives

---

## 🔧 API Endpoints

### Core APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pubchem` | GET | Search by name/formula |
| `/api/pubchem-search` | POST | Peak-based search |
| `/api/elucidation-v15` | POST | RDKit v1.5 pipeline |
| `/api/enhanced-library` | GET/POST | AI cache |

See [API.md](docs/API.md) for full documentation.

---

## 🐛 Known Issues

- **PubChem timeout**: Max 3 CIDs checked (performance optimization)
- **page.tsx size**: 941 lines (refactoring planned)

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

- **PubChem**: NCBI molecular database
- **RDKit**: Open-source cheminformatics
- **Gemini/OpenAI**: AI analysis
- **Next.js**: React framework

---

**Made with ❤️ by SpectroMind Team**
