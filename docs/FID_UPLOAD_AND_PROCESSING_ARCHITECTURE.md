# FID yükleme ve işleme mimarisi (SpectroMind)

Bu belge, depodaki **gerçek kod yollarına** dayanır. İki ayrı Python FID girişi vardır; ürün yolunda **öncelik klasör/dataset** akışındadır.

---

## 1. Yetkili akış vs miras (legacy)

| Senaryo | Yetkili yol | Python girişi | Not |
|---------|-------------|---------------|-----|
| **Klasör yükleme** (`datasetId`, `temp/...`) | `POST /api/fid/upload` → `POST /api/fid/process` | `scripts/fid_process.py` (`--baseDir`, ağaç tarama) | Ana ürün yolu |
| **Tek dosya / eski istemci** | `POST /api/fid/process` (dosya ile) | `scripts/fid_processor.py` | Legacy; davranış farkı riski |
| **Sunucusuz (Vercel)** | — | — | `fid/process` bilinçli **503**; yerel `venv` + disk gerekir |

`docs/ARCHITECTURE_OVERVIEW.md` ve `docs/ARCHITECTURE_CONFLICTS.md` çift yolu detaylandırır.

---

## 2. Upload akışı

1. İstemci `FormData`: `files[]` + `paths[]` (çoğunlukla `webkitRelativePath`).
2. `app/api/fid/upload/route.ts`: güvenlik (path traversal), `datasetId` (UUID), `temp/<datasetId>/` altına **paralel** `writeFile`.
3. Ham kanal: **Bruker** için `fid` veya `ser` binary; yoksa `ok: false` veya işlemenin beklemesi.
4. `lib/fid/formatDetector.ts` / yol ipuçları: `acqus`, `procpar`, Varian tarzı isimler → **vendor guess** (heuristik).

---

## 3. Temp kalıcılığı ve disk

- Geçici kök: proje altında `temp/` (`.gitignore` tipik olarak dışlar).
- **Yeniden deneme:** `process` route’u diske yazımın tamamlanması için kısa retry yapabilir.
- Üretimde: tek düğüm varsayımı; çoklu replica’da paylaşımlı disk veya iş kuyruğu yoksa **datasetId ile node tutarsızlığı** riski (mimari sınırlama).

---

## 4. İşleme zinciri (`fid_process.py` — özet)

Yüksek seviye (kesin parametreler için `scripts/fid_process.py` ve `app/api/fid/process/route.ts`):

1. Ham FID okuma, vendor’a göre yönlendirme (`nmrglue` vb.).
2. Bruker: dijital filtre / grup gecikmesi denemesi (`remove_digital_filter`).
3. FFT (`fft_positive` ile uyumlu eksen üretimi).
4. Otomatik faz (`ph0`/`ph1`, L-BFGS-B); isteğe bağlı **manuel faz** (`processingSpec` → `--ph0`/`--ph1`).
5. Taban çizgisi (minimum zarf + yumuşatma; polinom AsLS değil).
6. Yoğunluk ölçeği (ör. p99 tabanlı görüntüleme için meta).
7. Pik seçimi (eşik / mesafe / belirginlik kuralları — bilimsel olarak **yaklaşık**).
8. QC bayrakları: SNR, faz artığı, metadata tutarlılığı → `SUCCESS_*` / `PARTIAL_*`.

Çıktı: JSON benzeri yapı; TypeScript tarafında `lib/fid/buildFidProcessResponse.ts` ile **`ObservedSpectrumEnvelope`** ve UI alanları üretilir.

---

## 5. Çıktı şeması ve sözleşme

- **Tercih edilen:** `observed_spectrum` (`kind: 'observed_nmr_1d'`, `ppm`, `intensity`, `peaks`, `metadata`, `provenance`, `quality_flags`, `warnings`).
- **Legacy:** düz `data` alanı — bazı istemciler için; yeni kod **`observed_spectrum`** kullanmalı.
- Görüntüleme ön ayarları: `default_x_range_ppm`, `default_y_scale_mode`, `display_presets` (bkz. `docs/NMR_VISUALIZATION_AND_SCALING_SPEC.md`).

Tam alan listesi: `docs/SCHEMA_REFERENCE.md`, `lib/types/observed-data.ts`.

---

## 6. Hata ve başarısızlık durumları

- Upload: boş dosya listesi, güvensiz yol, yazma hatası → HTTP 4xx/5xx + `fidErrorCodes`.
- Process: `fid`/`ser` yok (race → retry sonrası hâlâ yok), Python nonzero exit, timeout.
- Vendor/2D: `pdata` veya 2D ipuçları → **uyarı**; tam 2D işleme **ürün dışı** seviyede.
- Sunucusuz ortam: `LOCAL_DEV` / `VERCEL` guard → 503 + açıklayıcı mesaj.

Kodlar: `lib/fid/fidErrorCodes.ts`, `docs/FID_ERROR_CODES.md`.

---

## 7. Desteklenen ve kısmi formatlar

| Format / vendor | Durum | Not |
|-----------------|-------|-----|
| Bruker 1D (fid/ser + acqus) | **İyi** | Ana test hattı |
| Varian/Agilent (procpar vb.) | **Kısmi** | Parser ve metadata kalitesi örnekten örneğe |
| JEOL | **Kısmi** | `.jdf` tek dosya yolu vs klasör beklentisi |
| 2D (COSY/HSQC/…) | **Kısmi / plan** | Uyarı; kontur pipeline yok |

Detay: `docs/VENDOR_SUPPORT_MATRIX.md`, `docs/VENDOR_FORMAT_SUPPORT.md`.

---

## İlgili dosyalar

- `app/api/fid/upload/route.ts`, `app/api/fid/process/route.ts`
- `lib/fid/formatDetector.ts`, `lib/fid/buildFidProcessResponse.ts`, `lib/hooks/useFIDUpload.ts`
- `components/fid/FIDUploaderCompact.tsx`, `components/fid/FIDUploader.tsx`
- `scripts/fid_process.py`, `scripts/fid_processor.py`

## Uzantı noktaları

- Yeni vendor: önce Python ağaç tarama + okuyucu; sonra `formatDetector` ve hata mesajları.
- Yeni işlem adımı: `fid_process.py` içinde provenance stringleri ile; API’de `processingSpec` genişletmesi.

## Sık hata modları

- Boş grafik: ppm/intensity uzunluk uyumsuzluğu veya overlay kapalı.
- “Dosya yok”: upload tamamlanmadan process veya yanlış `datasetId`.

## Kaçınılması gerekenler

- Legacy `data`’yı tek kaynak kabul etmek.
- `fid_processor.py` ile `fid_process.py` davranışını özdeş varsaymak.

## Bilinen sınırlamalar

- Grup gecikmesi / DSP her revizyonda mükemmel değil.
- Harici TMS referans kaydırması çoğu senaryoda sınırlı (`reference_offset_ppm_applied` sıklıkla 0).
