# Gözlenen spektrum pipeline’ı

**Simüle/teorik** spektrum ile **gözlenen (FID→FFT)** spektrum kod yolu katmanlarında ayrıdır; UI’da ayrı dataset ve etiketler kullanılır.

---

## 1. Ham gözlem → işlenmiş gözlem

1. **Ham:** `temp/<datasetId>/` altında vendor ham dosyaları (`fid`/`ser`, metadata).
2. **İşlenmiş:** Python çıktısı — eşlenmiş `ppm[]` ve `intensity[]` (kompleks FFT sonrası gerçek kısım veya eşdeğeri), faz/tabanı uygulanmış.
3. **Normalizasyon:** `lib/fid/buildFidProcessResponse.ts` (`finalizeFidSuccess` vb.):
   - Python alan adlarını tekilleştirme
   - `ObservedSpectrumEnvelope` üretimi
   - Varsayılan X/Y görüntüleme meta verileri

---

## 2. Pik listesi

- Python tarafında seçilen tepe noktaları → API gövdesinde `peaks` (veya meta içinde hizalı alanlar).
- **İntegral / multiplet “istasyonu”:** şema alanları veya UI placeholder’ları mevcut olabilir; ürün olgunluğu **parsiyel** — her panelde tam işlev yok (bkz. `docs/FINAL_IMPLEMENTATION_AUDIT.md`).

Teorik tarafta pik’ten Lorentzian üretimi: `docs/PEAK_PICKING_AND_SIMULATION_SPEC.md` (`fidPeakToSimulation`, `spectrumGenerator`).

---

## 3. Grafik adaptörü

- `useFIDUpload` / store: `onObservedNmrOverlayChange` ile `NMRChart`’a `observedOverlay` geçer.
- **Turuncu:** gözlenen; **mavi:** simülasyon (teorik).
- FTIR sekmesine geçişte NMR gözlenen katmanı temizlenir (modal karışmaz).

---

## 4. Köken (provenance) ve kalite kapıları

- `provenance`: işlem adımları, dijital filtre atlandı mı, Python sürüm yolu vb.
- `quality_flags` / `quality`: QC özetleri (`SUCCESS_HIGH_CONFIDENCE`, …).
- `warnings`: 2D ipuçları, düşük SNR, faz heuristiği şüphesi.

QC detay: `docs/PHASE_BASELINE_REFERENCE_QC.md`, `docs/RULE_ENGINE_AND_QC.md` (spektrum doğrulama kuralları Spectrotester tarafında ayrı katman).

---

## 5. Görüntüleme ön ayarları (presets)

- API zarfı: `display_presets`, `default_x_range_ppm`, `default_y_scale_mode`.
- İstemci: `lib/nmr/nmrChartScaling.ts` — H1_FULL (14→0), aromatik/alifatik kısayollar, “sinyale sığdır”.

PPM ters eksen ve simülasyon grid uyumu: `docs/OBSERVED_SIMULATION_PPM_CONTRACT.md`.

---

## İlgili dosyalar

- `app/api/fid/process/route.ts`, `lib/fid/buildFidProcessResponse.ts`
- `lib/types/observed-data.ts`, `lib/hooks/useFIDUpload.ts`
- `components/charts/NMRChart.tsx`, `spectromindStore.ts` (overlay state)

## Uzantı noktaları

- Yeni kalite kapısı: Python çıktısına alan ekleyip `buildFidProcessResponse`’ta `quality_flags` map’i.
- İntegral: önce şema + tek grafik üzerinde doğrulama; sonra çoklu panel.

## Sık hata modları

- Overlay görünmüyor: kullanıcı kapalı veya `observed_spectrum` null.
- Teorik ile ppm hizasız: referans ofseti veya farklı ppm aralığı (bkz. PPM contract belgesi).

## Kaçınılması gerekenler

- Gösterilen `intensity`’yi mutlak konsantrasyon sanmak.
- QC’yi “yayın kalitesi” olarak yorumlamak — heuristik tabanlıdır.
