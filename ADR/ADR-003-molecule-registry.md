# ADR-003: Molecule Registry

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: Molekül bilgisi şu an dağınık — PubChem CID, SMILES, molfile, formula, predictions hep farklı yerlerde tutuluyor.

## Karar

Merkezi `MoleculeRegistry` servisi kurulacak. Her molekül `MoleculeRecord` olarak kaydedilecek. Bütün modüller (assignment, prediction, verify, MS match, DB) aynı kayıt üzerinden çalışacak.

## Gerekçe

- Mnova'daki Compounds Table tam olarak bu — bütün sistemin omurgası
- Aynı molekülün birden fazla temsili (SMILES, molfile, InChIKey) normalize edilmeli
- Linked datasets, linked predictions, linked assignments molecule-centric olmalı
- Custom fields ve conformer yönetimi merkezi kayıt olmadan kurulamaz

## Sonuçlar

- CompoundsTable UI bu registry'nin görünümü olacak
- SdfBrowser bu registry'ye import edecek
- Prediction ve verify moleculeId referansı kullanacak
