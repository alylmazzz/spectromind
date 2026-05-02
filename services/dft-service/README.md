# SpectroMind v2.0 - Kuantum Mekaniksel (QM/DFT) Doğrulama Katmanı

## Genel Bakış

Bu modül, sistemin "Son Çare" (Last Resort) ve "Yüksek Hassasiyet" (High Precision) modülüdür. Empirik kurallar ve AI modelleri çalışmadığında, egzotik moleküller, gergin halkalar veya sterik olarak engellenmiş yapılar için fiziksel hesaplamalar yapar.

## Özellikler

### 1. Geometri Optimizasyonu
- **GFN2-xTB**: Semi-empirical quantum mechanical method
- DFT'ye göre 1000 kat daha hızlı
- Geometri konusunda DFT kadar hassas
- RDKit'in kaba 3D yapısını fiziksel minimuma getirir

### 2. GIAO NMR Hesaplaması
- **GIAO (Gauge-Including Atomic Orbitals)**: Manyetik alan altında elektronların çekirdeği ne kadar perdelediğini hesaplar
- Shielding tensor (σ) hesaplama
- Orijin noktasından bağımsız sonuçlar

### 3. Shielding'den Shift'e Dönüşüm
Temel formül:
$$\delta_{hesap} = \sigma_{ref} - \sigma_{numune}$$

Burada:
- $\sigma_{ref}$: TMS (Tetrametilsilan) kalkanlama değeri
- $\sigma_{numune}$: Hesaplanan molekülün kalkanlama değeri

### 4. Lineer Ölçekleme
Hesaplanan değerler ile deneysel değerler arasındaki sistematik hatayı düzeltir:

$$\delta_{final} = \frac{\text{Intercept} - \sigma_{calc}}{\text{Slope}}$$

## Kullanım

### Python Modülü

```python
from xtb_nmr_engine import XTB_NMR_Engine

engine = XTB_NMR_Engine(xtb_path="xtb")
result = engine.predict_shifts(
    smiles="C1(C(=O)O)CC1",  # Siklopropan karboksilik asit
    optimize=True,
    use_linear_scaling=True
)

if "error" not in result:
    print(f"Metod: {result['method']}")
    for h in result['shifts']['1H']:
        print(f"Atom {h['atom_idx']}: {h['shift_ppm']} ppm")
```

### API Endpoint

```bash
POST /api/v2/dft-verify
Content-Type: application/json

{
  "smiles": "C1(C(=O)O)CC1",
  "method": "xtb",
  "optimizeGeometry": true,
  "useLinearScaling": true
}
```

**Yanıt:**
```json
{
  "success": true,
  "verification": {
    "shifts": [
      {
        "atomIndex": 0,
        "shift": 1.2,
        "shielding": 30.3,
        "method": "GFN2-xTB + GIAO",
        "element": "H",
        "confidence": 0.9
      }
    ],
    "method": "GFN2-xTB + GIAO",
    "computationTime": 45.2,
    "optimized": true,
    "linearScaling": true
  }
}
```

## Parametreler

- **method**: `'xtb'` (şu an sadece xTB destekleniyor)
- **optimizeGeometry**: Geometri optimizasyonu yapılsın mı? (varsayılan: true)
- **useLinearScaling**: Lineer ölçekleme kullanılsın mı? (varsayılan: true)

## Referans Değerleri

| Element | TMS Shielding (σ_ref) |
|---------|----------------------|
| H | 31.5 ppm |
| C | 185.4 ppm |
| N | -50.0 ppm |
| O | 300.0 ppm |

## Gereksinimler

- Python 3.11+
- RDKit (kurulu)
- ASE (Atomic Simulation Environment): `pip install ase`
- **xTB**: Sistem PATH'inde olmalı
  - Windows: xTB binary'yi indirip PATH'e ekleyin
  - Linux/Mac: `conda install -c conda-forge xtb`

## Notlar

- **xTB Kurulumu**: Bu modülün çalışması için xTB binary'sinin sistem PATH'inde olması gerekir
- **Hesaplama Süresi**: Küçük moleküller için ~30-60 saniye, büyük moleküller için daha uzun
- **Timeout**: API timeout'u 10 dakika (600 saniye)
- **Fallback**: xTB bulunamazsa veya hesaplama başarısız olursa, empirik tahminler kullanılır

## Hata Yönetimi

- xTB bulunamazsa: `"xTB not found or optimization failed"`
- Hesaplama başarısız olursa: `"NMR calculation failed"`
- Geçersiz SMILES: `"Invalid SMILES"`

## Production Ortamı

Production ortamında bu modül Docker container içinde çalışacak ve xTB binary'si container'a dahil edilecektir.

