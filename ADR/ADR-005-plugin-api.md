# ADR-005: Plugin API

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: qNMR, PCA, reaction monitoring gibi ileri özellikler çekirdek kodun parçası olmamalı.

## Karar

Plugin API şu registration noktalarını sunacak:
- `registerPanel(panelDef)` — UI panel ekleme
- `registerAnalysisService(service)` — Analiz servisi ekleme
- `registerReportSection(section)` — Rapor bölümü ekleme
- `registerScriptApi(api)` — Script API genişletme
- `registerDbFieldType(fieldType)` — Custom DB alan tipi ekleme

Her plugin `id`, `title`, `provides[]` ve `register(app)` taşır.

## Gerekçe

- Platform olgunluğu için genişletilebilirlik şart
- Üçüncü parti veya dahili eklentiler çekirdek kodu bozmadan eklenebilmeli
- Mnova'nın Advanced Plugins (qNMR, PCA, Binding, Structure Elucidation...) bu yaklaşımın olgunlaşmış hali

## Sonuçlar

- Phase 6'da implementasyon
- Çekirdek modüller önce monolitik, sonra plugin'e taşınabilir
