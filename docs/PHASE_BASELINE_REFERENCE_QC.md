# Faz, taban çizgisi, referans ve QC (SpectroMind FID)

## Faz (1D)

- **Yöntem**: Gerçek kısımdaki negatif bölgenin L2 normunu minimize eden `ph0`, `ph1` (çok başlangıçlı `L-BFGS-B`).
- **Manuel**: API `processingSpec.phase.manual: true` ve `ph0_deg` / `ph1_deg` ile `app/api/fid/process` yalnızca bu durumda `--ph0/--ph1` gönderir.
- **QC**: `phase_neg_energy_ratio` = negatif enerji / pozitif enerji (düşük = daha absorptif). `phase_failed_heuristic` eşik ~0.65 (Python).

## Dijital filtre / grup gecikmesi (Bruker)

- `nmrglue.bruker.remove_digital_filter(dic, fid)` başarılıysa `processing.group_delay_corrected: true`.
- Başarısızlıkta uyarı ve `digital_filter: skipped:…` provenance.

## Taban çizgisi

- Gerçek spektrum üzerinde **minimum zarf + uniform yumuşatma**; polinom değil, hızlı ve robust bir yaklaşım (gelişmiş AsLS ayrı modül olarak genişletilebilir).

## Referans (ppm)

- Birincil eksen: `ng.fileiobase.uc_from_udic` + `ppm_scale()` (FFT `proc_base.fft_positive` ile uyumlu).
- `reference_offset_ppm_applied: 0` — harici TMS/çözücü kaydırması bir sonraki iterasyonda (manuel / tahminli).

## QC durumları

| Durum | Anlam |
|--------|--------|
| `SUCCESS_HIGH_CONFIDENCE` | Faz + SNR + metadata makul |
| `SUCCESS_MEDIUM_CONFIDENCE` | Orta risk (metadata veya faz) |
| `PARTIAL_LOW_CONFIDENCE` | Düşük SNR, yüksek faz artığı veya metadata zayıf |

API ve `observed_spectrum.quality` bu alanları yansıtır.

---

## Güven ve sınırlamalar

- Otomatik faz **iyileştirme** (optimization) tabanlıdır; her örnekte spektroskopik “doğru” faz garantisi yok.
- Taban çizgisi **hızlı zarf** yaklaşımıdır; karmaşık distorted baseline veya STRONG rolling baseline için yetersiz kalabilir.
- Referans kaydırması çoğu kurulumda **0** — iç standart / çözücü tabanlı otomatik referans ürün seviyesinde tam değil (`docs/LIMITATIONS_AND_TECHNICAL_DEBT.md`).

## İlgili dosyalar

- `scripts/fid_process.py` (faz, baseline, QC sayıları)
- `app/api/fid/process/route.ts` (`processingSpec`, manuel faz)
- `lib/fid/buildFidProcessResponse.ts` (QC alanlarının zarfı)

## Uzantı noktaları

- AsLS veya kullanıcı seçilebilir baseline modu: Python adımı + provenance string.
- Tahminli TMS referansı: offset hesap → `ppm` dizisine sabit kaydırma + metadata.

## Sık hata modları

- `phase_failed_heuristic` veya spektrum “emilen” görünümü: manuel faz deneyin veya ham veri kalitesini kontrol edin.

## Kaçınılması gerekenler

- QC durumunu tek başına “analitik geçerli” saymak.
