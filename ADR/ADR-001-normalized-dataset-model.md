# ADR-001: Normalized Dataset Model

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: SpectroMind'da NMR, MS, IR ve UV verileri farklı tiplerde (NMRPeak[], FTIRPeak[], MSPeak[]) ayrık diziler olarak tutuluyor. 2D NMR, stacked/arrayed veriler ve processing history için ortak bir model yok.

## Karar

Bütün modaliteler tek bir `NormalizedDataset` arayüzü üzerinden normalize edilecek. Bu model:

1. Modalite bağımsız ortak alanlar tutar (id, modality, vendor, axes, provenance)
2. Zaman domeni (FID) ve frekans domeni ayrımını `rawDomain` ile ifade eder
3. Acquisition metadata'yı yapısal olarak saklar
4. Processing history'yi sıralı adım dizisi olarak tutar
5. QualityFlags ile veri kalitesini parametreleştirir

## Gerekçe

- Mevcut `observed-data.ts` iyi bir başlangıç ama runtime'da kullanılmıyor
- Her modalite kendi peak tipini kullanıyor (NMRPeak, FTIRPeak, MSPeak) — normalize katman eksik
- 2D NMR, stacked veriler ve processing template sistemi ortak veri modeli olmadan kurulamaz
- Vendor-aware import adaptörleri ortak çıktı şemasına ihtiyaç duyar

## Sonuçlar

- Mevcut peak tipleri (NMRPeak, FTIRPeak, MSPeak) kaldırılmayacak; NormalizedDataset'ten türetilen view'lar olarak korunacak
- İmport adaptörleri NormalizedDataset üretecek
- Processing graph NormalizedDataset üzerinde çalışacak
- UI bileşenleri NormalizedDataset'ten peak dizilerine bridge katmanıyla bağlanacak
