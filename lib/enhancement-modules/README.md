# Enhancement Modules

**10 independent physics/chemistry modules** that enhance AI-predicted NMR/FTIR spectra.

## 📁 File Structure

```
enhancement-modules/
├── README.md                    ← You are here
├── index.ts                     ← Main orchestrator (ON/OFF switches)
├── module1-boltzmann.ts         ← Conformer energy weighting
├── module2-exchange.ts          ← Chemical exchange dynamics
├── module6-symmetry.ts          ← Point group symmetry
├── module9-noe.ts               ← ¹³C Nuclear Overhauser Effect
└── [Add more modules here]
```

## 🚀 Quick Start

```typescript
import { enhanceSpectrum } from '@/lib/enhancement-modules';

const result = await enhanceSpectrum({
  smiles: 'c1ccccc1',
  moleculeName: 'Benzene',
  nmrPeaks: [...],
  solvent: 'CDCl3',
  temperature: 298.15,
  frequency: 400
});

console.log(result.metadata.modulesApplied);
// Output: ['Boltzmann Weighting', 'Symmetry', 'NOE']
```

## 🔧 Customize (Turn ON/OFF)

Open `index.ts` and comment/uncomment modules:

```typescript
// ACTIVE
const boltzmann = await applyBoltzmannWeighting(smiles);

// DISABLED (commented out)
// const boltzmann = await applyBoltzmannWeighting(smiles);
```

## 📦 Available Modules

| Module | File | Purpose | Remove If... |
|--------|------|---------|--------------|
| 1 | `module1-boltzmann.ts` | Conformer energy weighting | You don't need Boltzmann statistics |
| 2 | `module2-exchange.ts` | OH/NH exchange dynamics | You don't analyze exchange |
| 6 | `module6-symmetry.ts` | Point group detection | You don't need symmetry |
| 9 | `module9-noe.ts` | ¹³C NOE enhancement | You don't use ¹³C NMR |

## 🧩 Add New Module

1. Create `moduleX-name.ts`
2. Export simple functions
3. Import in `index.ts`
4. Add to orchestrator with try-catch

```typescript
// moduleX-myfeature.ts
export async function myFeature(input: string) {
  // Your code here
  return { success: true };
}

// index.ts
import { myFeature } from './moduleX-myfeature';

// In enhanceSpectrum():
const result = await myFeature(input.smiles);
```

## 🧪 Testing

Each module is independent - test individually:

```typescript
import { applyBoltzmannWeighting } from './module1-boltzmann';

const result = await applyBoltzmannWeighting('CCCC=O');
console.log(result.conformers);
```

## 📊 Dependencies

- **RDKit Python**: Required for energy & structure modules
- **No external libs**: All calculations use pure TypeScript/Python

## ❓ FAQ

**Q: Can I remove modules I don't need?**
A: Yes! Just delete the file and remove import from `index.ts`

**Q: Are modules interdependent?**
A: No. Each module is fully independent.

**Q: How do I add my own formula?**
A: Create a new `moduleX-myformula.ts` file with your calculation.

**Q: Where is the old `theoreticalSpectrum.ts`?**
A: Still exists for backwards compatibility, but use this modular system instead.
