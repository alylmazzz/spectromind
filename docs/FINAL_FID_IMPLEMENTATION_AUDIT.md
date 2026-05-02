# FID uygulama denetimi — güncel iterasyon

## Tamamlanan (P0)

| Alan | Durum |
|------|--------|
| Bruker dijital filtre / GRPDLY yolu | `remove_digital_filter` + provenance |
| NMR FFT yönümü | `nmrglue.process.proc_base.fft_positive` |
| DC giderme | Zaman domeninde ortalama çıkarma |
| Otomatik faz | Çok başlangıçlı L-BFGS-B, negatif alan cezası |
| Taban çizgisi | Minimum zarf + yumuşatma (gerçek kısım) |
| ppm ekseni | `uc_from_udic` öncelikli |
| p99 görüntü ölçeği (Python) | Çözücü domini azaltma |
| 2D ham veri | Açık hata `UNSUPPORTED_2D_EXPERIMENT` |
| API zarfı | `qc`, `processing`, `peak_list`, `display_presets`, `default_x_range_ppm`, `default_y_scale_mode` |
| **Varsayılan X penceresi** | **14 → 0 ppm (¹H)** — ilk açılışta sabit, otomatik daraltma yok |
| **Robust Y otomatik ölçek** | **ROBUST_P99** — 99. persentil üst sınır, dominant çözücü piki kırpılır |
| **Y ölçek modları** | `ROBUST_P99`, `ROBUST_P995`, `NORMALIZED_MAX`, çözücü maskeli |
| **Hızlı presetler** | Tam ¹H, genişletilmiş, aromatik, olefinik, alifatik, sinyale sığdır, tam görünüme dön |
| **Overlay normalizasyonu** | Simülasyon pencere içi max=1'e normalize |
| **Observed/simulated ayrımı** | Ayrı toggle'lar, ayrı legend, ayrı state |
| **FTIR stale etiket** | FTIR panelinde "gözlenen FTIR katmanı yok" notu |
| **NMR dışı modda overlay temizleme** | Spektrum tipi NMR değilse `observedNmrOverlay = null` |
| **FID yüklemede NMR görünümüne geçiş** | `onObservedNmrLoaded → setSpectrumType('nmr')` |
| **sessionId ile görünüm sıfırlama** | Yeni FID her yüklemede X ve Y sıfırlanır |
| Otomatik faz varsayılanı | `--ph0/--ph1` yalnızca manuel `processingSpec` ile |

## Tamamlanan (P1)

| Alan | Durum |
|------|--------|
| QC özeti grafik başlığında | `qcSummary` turuncu bandda |
| Sıfır çizgisi | `chartjs-plugin-annotation` y=0 |
| Çözücü maskeli Y ölçeği | `isInSolventExclusion` (DMSO, CDCl₃, HDO, grease bölgeleri) |
| Legend'da ölçek modu | Legend ve tooltip'te Y modu + normalize bilgisi |
| Tooltip'te δ ppm | `mode: 'index'`, `title: δ x.xxx ppm`, `afterBody: ölçek notu` |

## Heuristik / bilinen sınırlar

- Faz optimizasyonu tam ACME/entropy değil; zor spektrumlarda manuel faz gerekir.
- Taban çizgisi AsLS değil; güçlü eğimli baseline'da hatalar olabilir.
- Harici referans (TMS) otomatik kaydırması yok; `reference_offset_ppm_applied: 0`.
- Varian/JEOL tam vendor QC ve 2D görselleştirme roadmap'te.
- `fid_processor.py` (tek dosya yolu) eski pipeline; klasör akışı `fid_process.py` ile hizalanmadı.
- 13C varsayılan penceresi (220→−10) henüz 13C yolu olmadığı için kullanılmıyor.
- `SOLVENT_EXCLUSIONS` sabit liste; dinamik çözücü tespiti yok.

## Testler

| Suite | Sayı | Durum |
|-------|------|-------|
| `npx vitest run` | 92 / 92 | ✓ Geçti |
| `python scripts/fid_process_phase_selftest.py` | 1 | ✓ Geçti |
| `__tests__/nmr/nmrChartScaling.test.ts` | 12 | ✓ Geçti (H1_DEFAULT, Y bounds, fit signal, downsample, solvent mask) |
| `__tests__/fid/formatDetector.test.ts` | 6 | ✓ Geçti |
| `__tests__/fid/fidEnvelope.test.ts` | 1 | ✓ Geçti |

## Belgeler

- `PROFESSIONAL_NMR_DEFAULT_VIEWS.md` — varsayılan pencere, ölçek, preset açıklamaları
- `PHASE_BASELINE_REFERENCE_QC.md` — faz, taban, referans, QC durumları
- `NMR_VISUALIZATION_AND_SCALING_SPEC.md` — grafik ölçekleme ayrıntıları
- `OBSERVED_SPECTRUM_PIPELINE.md`, `VENDOR_FORMAT_SUPPORT.md`, `FID_ERROR_CODES.md`, `FID_DEBUG_CHECKLIST.md`, `SPECTRUM_VISUALIZATION_MAPPING.md`

## Değişen / yeni dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `lib/nmr/nmrChartScaling.ts` | **Yeni** — presetler, Y bounds, fit signal, downsample, solvent mask |
| `components/charts/NMRChart.tsx` | **Yeniden yazıldı** — state, presetler, robust Y, overlay normalizasyon, toggle'lar, araç çubuğu |
| `lib/fid/buildFidProcessResponse.ts` | `display_presets`, `default_x_range_ppm`, `default_y_scale_mode`, `experiment_type`, `current_scale_mode` |
| `lib/utils/spectrumGenerator.ts` | `generateNMRSpectrumData` artık 0–14 ppm |
| `app/page.tsx` | `observedNmrOverlay` genişletilmiş tip; `focusNmrSpectrumView` callback |
| `components/sidebar/Sidebar.tsx` | `onObservedNmrLoaded`, genişletilmiş overlay prop (sessionId, defaultXPpm, yScaleMode, experimentType) |
| `components/charts/FTIRChart.tsx` | "Gözlenen FTIR katmanı yok" notu |
| `__tests__/nmr/nmrChartScaling.test.ts` | **Yeni** — 12 birim testi |
| `docs/PROFESSIONAL_NMR_DEFAULT_VIEWS.md` | **Yeni** |
| `docs/FINAL_FID_IMPLEMENTATION_AUDIT.md` | Güncellenmiş |
