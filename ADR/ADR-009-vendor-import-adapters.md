# ADR-009: Vendor Import Adapters

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: Mevcut formatDetector + Python spawn yaklaşımı production/cloud'da kırılgan.

## Karar

Adapter registry pattern:
- Her vendor/format için ayrı adapter (BrukerAdapter, VarianAdapter, JeolAdapter, JcampAdapter)
- Ortak arayüz: `canOpen()`, `inspect()`, `import()`
- Çıktı: NormalizedDataset
- Adapter'lar TypeScript + minimal WASM; Python spawn'dan kaçınma hedefi

## Gerekçe

- Format ekleme/çıkarma ana kodu etkilememeli
- NormalizedDataset üretmeyen import kullanılamaz
- Mevcut formatDetector.ts ve acqus.ts iyi temel — genişletilmeli

## Sonuçlar

- Phase 1'de BrukerAdapter + JcampAdapter
- Phase 2'de VarianAdapter + JeolAdapter
- Her adapter için regression test dosyası
