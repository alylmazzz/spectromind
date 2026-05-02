# NMR görselleştirme ve ölçekleme spesifikasyonu

*(NMR visualization and scaling — SpectroMind 1D UI semantics.)*

## Eksenler

### X ekseni (ppm)
- `linear`, `reverse: true`
- ¹H varsayılan pencere: **14 → 0 ppm** (NMR standardı, MestReNova uyumu)
- Açılışta pik kümesine daraltma **yapılmaz**; pik görünürlüğü Y ölçeği ile sağlanır
- Kullanıcı preset düğmeleri ile daraltabilir / genişletebilir

### Y ekseni (yoğunluk)
- `beginAtZero: false`, `grace: '4%'`
- Varsayılan: **ROBUST_P99** — 99. persentil üst sınır, dominant pik kırpılır

## Y ölçek modları

| Mod | Hesap | Kullanım |
|-----|-------|----------|
| `ROBUST_P99` | Görünür pencerenin p99'u | **Varsayılan ¹H** — çözücü piki tüm grafiği ezmez |
| `ROBUST_P995` | p99.5 | Çok güçlü dominant pik |
| `NORMALIZED_MAX` | Pencere içi max | Temiz, tek bileşenli spektrum |
| Çözücü maskeli | DMSO/CDCl₃/HDO bölgeleri hariç p99 | Opsiyonel kullanıcı seçimi |

## Overlay normalizasyonu

Simülasyon serisinin pencere içi (xMin…xMax) max'ı 1.0'a normalize edilir. Legend ve tooltip bunu açıkça belirtir:
- `¹H (simülasyon, normalize)` — overlay aktifken
- `Gözlenen (FID · ROBUST_P99)` — observed serisi

## Sıfır çizgisi

`NMRChart` içinde yerel `nmrBaselineZeroLine` eklentisi (`beforeDatasetsDraw`): y=0 görünür aralıktaysa kesik çizgi. `chartjs-plugin-annotation` kullanılmıyor — React’ta hızlı destroy/yeniden oluşturma sırasında eklentinin `beforeEvent` içinde `state` undefined kalıp `listened` hatasına yol açması engellendi.

## Hızlı presetler

`lib/nmr/nmrChartScaling.ts → H1_DISPLAY_PRESETS`:
- H1_FULL (14→0), H1_EXTENDED (14→−1), AROMATIC (10→5), OLEFINIC (6→2.5), ALIPHATIC (3.5→−0.5)
- "Sinyale sığdır": `fitSignalXDomain` — pik bölgesine dinamik uyum
- "Tam görünüme dön": 14→0 + ROBUST_P99 + zoom reset

## Tooltip

- Başlık: `δ x.xxx ppm`
- Etiket: `[seri adı]: y.yyyy`
- Alt bilgi: `Ölçek: Y: ROBUST_P99 · sim: normalize…`

## Observed vs simulated

- Ayrı toggle'lar
- Ayrı Chart.js dataset'leri
- Legend'da kaynak ve ölçek modu
- State izolasyonu: observed yoksa overlay gösterilmez; simulated yoksa mavi çizgi yok

## FTIR / diğer modallerin karışmaması

- Spektrum tipi NMR'den çıkınca `observedNmrOverlay = null`
- FTIR paneli: "Gözlenen FTIR katmanı yok (NMR FID ile karıştırılmaz)" notu
- FID başarılı işlendiğinde otomatik olarak NMR sekmesine geçiş (`onObservedNmrLoaded`)

## Yeni FID oturumu sıfırlaması

Her `sessionId` (debug_id) değişiminde:
- X → varsayılan pencere (14→0)
- Y → ROBUST_P99
- Çözücü maskesi kapalı
- Önceki zoom sıfırlanır

## Teknik referans

- `lib/nmr/nmrChartScaling.ts`: Presetler, `computeYBounds`, `fitSignalXDomain`, `downsampleXY`, `normalizeSimulatedToUnitMax`, `isInSolventExclusion`
- `components/charts/NMRChart.tsx`: Grafik state modeli, toolbar, Chart.js konfigürasyonu
- `lib/fid/buildFidProcessResponse.ts`: API zarfında `default_x_range_ppm`, `default_y_scale_mode`, `display_presets`

---

## Uzantı noktaları

- Yeni H1 preset: `lib/nmr/nmrChartScaling.ts` içinde `H1_DISPLAY_PRESETS` + toolbar düğmesi `NMRChart.tsx`.
- Yeni Y modu: `computeYBounds` ve tip birliği; solvent maskesi ile birlikte test edin.

## Sık hata modları

- “Simülasyon kayboldu”: overlay normalizasyonu; legend’da “normalize” ibaresine bakın.
- Dar ppm penceresinde düz çizgi: `downsampleXY` veya tüm yoğunluklar benzer; veri sırasını kontrol edin.

## Kaçınılması gerekenler

- Overlay’deki normalize eğriyi spektrometre “tam ölçek” sanmak.
- `reverse: true` ile birlikte manuel domain sırasını ters etiketle karıştırmak.

## Bilinen sınırlamalar

- İlk açılışta otomatik “sinyale sığdır” yok; kullanıcı preset veya fitSignal ile yapar (bilinçli ürün kararı).
