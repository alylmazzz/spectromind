# ADR-010: NMR Processing Graph

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: NMR işleme zinciri tek yönlü fonksiyon çağrıları ile değil, parametreli bir işlem grafı olarak temsil edilmeli.

## Karar

`ProcessingGraph` sınıfı:
- Sıralı adım listesi (şimdilik DAG değil, lineer pipe)
- Her adım `ProcessingStep` union type'ından
- Adımlar eklenebilir, çıkarılabilir, reorder edilebilir
- Template olarak kaydedilebilir/yüklenebilir
- Batch'te yeniden uygulanabilir
- Ara durumlar cache'lenebilir (original FID, processed FID, FT result, final spectrum)

## Gerekçe

- Mnova processing template sistemi tam olarak bu
- Geri dönülebilirlik ve debug için ara durumlar şart
- Batch processing aynı template'i yüzlerce veriye uygulayabilmeli
- Script/CLI aynı graph'ı oluşturup çalıştırabilmeli

## Sonuçlar

- Phase 2'de implementasyon
- İlk implementasyon: apodization, zero fill, FT, phase, baseline, reference
- Template persist: JSON serialize/deserialize
- Ara buffer: SpectrumState { rawFid, processedFid, ft1, finalSpectrum, history }
