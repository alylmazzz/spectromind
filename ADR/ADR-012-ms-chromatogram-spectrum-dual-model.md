# ADR-012: MS Chromatogram/Spectrum Dual Model

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: MS verisi iki katmanlıdır — chromatographic traces (TIC/EIC) ve mass spectra. SpectroMind'da sadece MSPeak[] var.

## Karar

İki ayrı model:
1. `ChromatogramTrace` — RT vs intensity; TIC/BPC/EIC/custom
2. `MassSpectrum` — m/z vs intensity; msLevel, precursor, charge

Kapsayıcı `MsDocument` bunları birleştirir.

## Gerekçe

- LC/GC-MS verisi chromatogram + spectrum ikili yapısı olmadan anlaşılamaz
- EIC oluşturma, peak purity, RT alignment trace modeline bağlı
- Elemental composition ve molecular match spectrum modeline bağlı
- Mnova Mass Plugin bu ikili yapıyı doğrudan kullanıyor

## Sonuçlar

- Phase 4'te implementasyon
- Mevcut isotope-engine ve fragmentation-engine bu modele bağlanacak
