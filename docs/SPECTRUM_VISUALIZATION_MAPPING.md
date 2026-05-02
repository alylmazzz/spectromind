# Spektrum → grafik eşlemesi

| Modality / deney | Bileşen | Not |
|------------------|---------|-----|
| 1H NMR (1D) | `NMRChart` + `observedOverlay` | Ana proton grafiği |
| 13C / DEPT (1D) | Uygun NMR paneli (uygulama yapılandırmasına bağlı) | DEPT ayrımı UI’de işaretleme planlı |
| 2D (COSY, HSQC, HMBC, NOESY) | Planlı: heatmap / scatter | Şu an 1D çıktı veya uyarı; 2D tam render roadmap’te |
| FTIR | FTIR grafik bileşenleri | FID pipeline’ından bağımsız |

Observed overlay yalnızca `success === true` ve `observed_spectrum` içinde geçerli `ppm`/`intensity` varken çizilir; boş “başarılı” çizim yok.
