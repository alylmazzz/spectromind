# ADR-0001: Tek Kimyasal Çekirdek (Chem Core)

## Durum

Kabul edildi.

## Bağlam

- SpectroMind ve Spectrotester entegrasyonunda SMILES parsing, aromatiklik, formül ve “expected” değişkenler (nC_total, nH_total, DBE, nC_aromatic, vb.) birden fazla yerde (string/regex, Spectrotester’daki custom aromatiklik) hesaplanıyordu.
- Aromatiklik sınıflaması tutarsız olunca NMR bölgeleri ve QC zinciri bozuluyor; raporlarda hata kaynağı olarak gösterildi.

## Karar

- **Tek otorite:** Tüm temel kimyasal gerçekler (SMILES parsing, standardizasyon, aromatiklik, formül, exact mass, atom/bond listesi, expected set) **tek bir Chem Core** üzerinden üretilecek.
- **Graf tabanlı aromatiklik:** “lowercase c gördüm mü aromatik” gibi string/regex yaklaşımı kullanılmayacak; aromatiklik RDKit (veya tek Chem Core) graf çıktısına göre belirlenecek.
- **Spectrotester:** Custom/pattern tabanlı aromatiklik devre dışı bırakılacak; Spectrotester compat katmanı girişi olarak Chem Core’dan gelen **MoleculeGraph + MoleculeFeatures** kabul edecek.

## Sözleşme (kısa)

- **MoleculeGraph:** canonical_smiles, inchi, inchikey, formula, exact_mass, atoms[], bonds[], aromatic_flags, stereo, charge.
- **MoleculeFeatures (expected set):** nC_total, nH_total, DBE, nC_aromatic, nH_aromatic, nC_carbonyl, nC_protonated, nH_exchangeable, symmetry_classes, vb.
- **StandardizationPolicy:** tautomer/protomer seçimi vb. (opsiyonel parametre).
- Uygulama: **services/chem-core** (FastAPI + RDKit); endpoint’ler: `POST /parse-standardize`, opsiyonel `POST /features`.

## Sonuçlar

- Tahmin ve teyit motorları aynı graf/expected set ile beslenir; aromatiklik ve bölge tutarlılığı sağlanır.
- Spectrotester compat, SMILES string ile kendi parsing’ini yapmaz; Chem Core çıktısı kullanılır.
