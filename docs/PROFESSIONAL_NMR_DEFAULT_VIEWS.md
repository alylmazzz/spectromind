# Profesyonel NMR varsayılan görünümleri (SpectroMind)

## ¹H NMR — ilk açılış davranışı

FID yüklenip işlendiğinde NMRChart şu varsayılan durumla açılır:

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| X aralığı | **14 → 0 ppm** | Solda yüksek δ, sağda düşük δ (NMR standardı) |
| X yönü | **reversed** (`reverse: true`) | Profesyonel yazılım uyumu |
| Y ölçeği | **ROBUST_P99** | 99. persentil üst sınır; dominant çözücü piki tüm grafiği ezmez |
| Sıfır çizgisi | **Görünür** (annotation) | Taban çizgisi referansı |
| Kaynak modu | **Observed** veya **Overlay** | Simülasyon piki varsa ikisi birlikte, yoksa sadece observed |

### Neden 14→0 ppm ve neden otomatik daraltma yapılmıyor?

MestReNova ve diğer profesyonel NMR yazılımlarında **ilk açılış her zaman tam ¹H penceresidir**. Kullanıcı, pik kümesinin nerede olduğunu **bağlamla** anlamalıdır — pencere darlığı bağlamı yok eder. Pik görünürlüğü **Y ölçeği** ile sağlanır, X aralığını daraltarak değil.

### Neden ROBUST_P99 varsayılan?

Birçok NMR denemesinde çözücü kalıntısı (örn. CHCl₃ → δ 7.26, DMSO → δ 2.50) en büyük piktir. `MAX` normalizasyonu bu pik ile tüm diğer sinyalleri düz çizgiye çevirir. `P99` (99. persentil) bu dominant piki kırparak küçük sinyalleri görünür kılar.

### Y ölçek modları

| Mod | Kullanım |
|-----|----------|
| `ROBUST_P99` | **Varsayılan** — çoğu ¹H deneyi |
| `ROBUST_P995` | Çok güçlü dominant pik |
| `NORMALIZED_MAX` | Temiz, tek türlü spektrum |
| Çözücü maskeli | DMSO/CDCl₃ bölgesi hariç Y hesabı |

### Hızlı presetler

| ID | Etiket | ppm aralığı |
|----|--------|-------------|
| H1_FULL | ¹H tam | 14 → 0 |
| H1_EXTENDED | Geniş | 14 → −1 |
| AROMATIC | Aromatik | 10 → 5 |
| OLEFINIC | Olefinik / O–CH | 6 → 2.5 |
| ALIPHATIC | Alifatik | 3.5 → −0.5 |
| Sinyale sığdır | Dinamik | Pik bölgesine uyar |

### Observed vs simulated

- Observed: FID → Python pipeline → turuncu çizgi
- Simulated: Sidebar'daki pik listesinden oluşturulan Lorentz/Gauss — mavi çizgi
- Overlay modunda simülasyon, **görüntü penceresindeki** max'a normalize edilir
- Legend her iki kaynağın ölçek semantiğini açıkça yazar

### 13C preset (planlı)

220 → −10 ppm, ayrı preset ve Y ölçek ayarı.

### 2D (planlı)

1D mantığı zorla uygulanmaz; contour/heatmap/scatter adapter ayrıdır.
