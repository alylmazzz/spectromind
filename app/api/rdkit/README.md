# RDKit API Endpoints

**Python-powered chemistry calculations** via Next.js API routes.

## 📁 Endpoints

```
api/rdkit/
├── README.md                       ← You are here
├── calculate-energy/route.ts       ← MMFF94 energy + Boltzmann weights
├── analyze-structure/route.ts      ← 2D/3D coords + point group symmetry
└── elucidation/route.ts            ← De novo structure elucidation
```

## 🚀 Quick Start

### 1. Energy Calculation

```bash
POST /api/rdkit/calculate-energy
Content-Type: application/json

{
  "smiles": "CCCC=O",
  "temperature": 298.15
}
```

**Response:**
```json
{
  "success": true,
  "conformers": [
    { "id": 0, "energy": -1.70, "boltzmann_weight": 0.18 },
    { "id": 1, "energy": -1.59, "boltzmann_weight": 0.15 }
  ],
  "lowest_energy": -1.70,
  "method": "MMFF94"
}
```

### 2. Structure Analysis

```bash
POST /api/rdkit/analyze-structure
Content-Type: application/json

{
  "smiles": "c1ccccc1"
}
```

**Response:**
```json
{
  "success": true,
  "coords_2d": [...],
  "coords_3d": [...],
  "point_group": "D6h",
  "symmetry_elements": ["E", "C6", "σh"],
  "molecular_formula": "C6H6",
  "molecular_weight": 78.11
}
```

## 🐍 Python Scripts

Located in `/scripts/`:

| Script | Purpose | Remove If... |
|--------|---------|--------------|
| `rdkit_energy_calculator.py` | MMFF94 conformer energies | You don't need Boltzmann |
| `rdkit_structure_analyzer.py` | 2D/3D coords + symmetry | You don't need structure |
| `rdkit_elucidation.py` | De novo structure finding | You don't use elucidation |

## 🔧 Setup

**1. Install Python dependencies:**
```bash
cd venv_rdkit
source bin/activate
pip install rdkit-pypi
```

**2. Test Python script:**
```bash
python3 scripts/rdkit_energy_calculator.py "CCCC=O"
```

## 🧪 Testing

### Energy API
```bash
curl -X POST http://localhost:3000/api/rdkit/calculate-energy \
  -H "Content-Type: application/json" \
  -d '{"smiles":"c1ccccc1"}'
```

### Structure API
```bash
curl -X POST http://localhost:3000/api/rdkit/analyze-structure \
  -H "Content-Type: application/json" \
  -d '{"smiles":"c1ccccc1"}'
```

## 🎨 Unified Service

Use the unified service for cleaner code:

```typescript
import { rdkit } from '@/lib/services/RDKitUnified';

// Energy
const energy = await rdkit.calculateEnergy('c1ccccc1');

// Structure
const structure = await rdkit.analyzeStructure('c1ccccc1');

// Both at once
const { energy, structure } = await rdkit.getFullAnalysis('c1ccccc1');
```

## 🐛 Troubleshooting

**"Python script failed"**
- Check `venv_rdkit` is activated
- Run `pip install rdkit-pypi`

**"Invalid SMILES"**
- Verify SMILES syntax
- Use canonical SMILES (e.g., from PubChem)

**"MMFF94 failed"**
- Some molecules don't have MMFF parameters
- Fallback to UFF is automatic

## 📊 Performance

| Operation | Time | Cacheable |
|-----------|------|-----------|
| Energy (10 conformers) | ~2-5s | ✅ Yes |
| Structure analysis | ~1-3s | ✅ Yes |
| Elucidation | ~5-15s | ❌ No |

## ❓ FAQ

**Q: Can I use JavaScript RDKit?**
A: Yes, but Python RDKit has more features (MMFF94, ETKDG)

**Q: Why subprocess instead of library?**
A: RDKit Python → cleaner separation, easier debugging

**Q: Can I remove these APIs?**
A: Yes - just delete the `/api/rdkit/` folder
