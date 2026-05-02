# Spectrotester Core

Tek otorite motor: SMILES → graph → features → rule evaluation → teyit raporu.

## Kullanım

- **SpectroMind / HTML**: `run({ smiles, precomputedGraph?, apiBase?, loadJson?, libraryPath? })` ile rapor alın.
- **CLI / Node**: `loadJson` olarak `createNodeLoader(getDefaultLibraryPath())` kullanın; `libraryPath: getDefaultLibraryPath()` verin.

```ts
import { run } from './index';
import { getDefaultLibraryPath, createNodeLoader } from './library/nodeLoader';

const loadJson = createNodeLoader(getDefaultLibraryPath());
const result = await run({
  smiles: 'c1ccccc1',
  loadJson,
  libraryPath: getDefaultLibraryPath(),
  engineId: 'spectrotester',
});
// result.verification_report, result.feature_snapshot
```

## Derleme

Spectrotester dizininde:

```bash
npx tsc -p Spectrotester/tsconfig.json
```

Çıktı: `Spectrotester/dist/`. Node ile: `node --experimental-vm-modules Spectrotester/scripts/run_core_smoke.mjs` (dist’i kullanacak şekilde script yazılabilir).

## Kabul kriterleri (Master Prompt)

- Aynı input + config => aynı rapor hash (deterministik).
- HSQC açıklaması: sadece gerçek exchangeable H için “OH/NH exchange”; CH/CH2 boşluğu için değil.
- Methyl beklentisi: sadece grafta CH3 varken.
- Rapor: `artifact_hashes`, `trace`, `engine_used`, `feature_snapshot` içerir.
