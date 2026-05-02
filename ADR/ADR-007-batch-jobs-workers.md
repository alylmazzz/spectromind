# ADR-007: Batch Jobs & Workers

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: Büyük veri setleri (metabolomics, seri sentez, QC) toplu işleme gerektirir.

## Karar

Üç seviyeli batch execution:
1. **Interactive batch**: UI'da 20-100 spektrum, WebWorker ile arka plan
2. **Queued batch**: >100 spektrum, job queue + worker pool
3. **Streaming batch**: Çok büyük veri için aç-işle-export-kapat döngüsü

## Gerekçe

- Mnova'nın biofluid/metabolomics akışı tam olarak bu
- Tarayıcı belleği sınırlı — streaming mode şart
- Batch verify, batch qNMR bu altyapıya bağlı
- Celery worker (services/celery-worker) zaten repo'da var — temel mevcut

## Sonuçlar

- WebWorker ile başla (Phase 2)
- Server-side queue Phase 5'te
- Streaming export Phase 6'da
