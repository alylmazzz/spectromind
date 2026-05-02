# ADR-008: Provenance & Audit Design

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: SpectroMind'da AuditTrace ve DataProvenance tipleri tanımlı ama runtime'da kullanılmıyor.

## Karar

Her önemli işlem otomatik olarak audit kaydı üretecek:
- Import provenance (dosya, format, adapter, hash)
- Processing provenance (adım, parametreler, version)
- Analysis provenance (peak pick, multiplet, assignment)
- Prediction provenance (backend, parametreler, sonuç)
- Verification provenance (testler, skorlar, karar)
- Script provenance (script id, parametre snapshot)
- Report provenance (template, nesneler, export zamanı)

Her kayıt: timestamp, user, operation, params, version, duration.

## Gerekçe

- Bilimsel tekrarlanabilirlik ve denetlenebilirlik zorunlu
- GLP/GMP uyumluluğu audit trail gerektirir
- Mnova audit trail'i her işlemi loglayıp raporlanabilir kılıyor

## Sonuçlar

- AuditService Phase 1'de kurulacak
- Mevcut `AuditTrace` ve `DataProvenance` tipleri genişletilecek
- UI'da AuditTrailPanel gösterilecek
