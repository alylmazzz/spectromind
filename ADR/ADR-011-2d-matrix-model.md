# ADR-011: 2D Matrix Model

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: 2D NMR (HSQC, COSY, HMBC, NOESY) verisi matris olarak temsil edilmeli.

## Karar

`TwoDNmrSpectrum` modeli:
- `matrix: Float64Array` (row-major, f1 × f2)
- `f1: AxisDefinition`, `f2: AxisDefinition`
- `externalTraces: { horizontal1DId?, vertical1DId? }`
- `contourSettings: { positive, negative, scale, paletteId }`
- `peaks2D: TwoDPeak[]`
- `assignments2D: TwoDAssignment[]`

## Gerekçe

- 2D NMR yalnız peak listesi değil; contour, trace, assignment aynı nesne üzerinde yaşamalı
- Mnova'da 2D tam bir workstation — biz de aynı derinlikte çalışmalıyız
- nmr2dSchema.ts zaten var ama processing/rendering ile bağlı değil

## Sonuçlar

- Phase 4'te implementasyon
- Contour engine Canvas 2D API ile
- Trace attach bidirectional sync
