# SpectroMind v2.0 - 3D Konformer Üretimi ve Boltzmann Ağırlıklandırma Modülü

## Genel Bakış

Bu modül, moleküllerin 2D SMILES gösteriminden 3D uzaysal yapılarına geçiş yaparak, NMR spektroskopisi için kritik olan konformasyonel dinamikleri analiz eder. Özellikle vicinal protonlar arasındaki J-coupling sabitlerini Karplus eşitliği ile tahmin eder.

## Özellikler

### 1. ETKDGv3 Konformer Üretimi
- Cambridge Yapısal Veritabanı (CSD) tabanlı deneysel torsion açıları
- Atomlar arası mesafe kısıtlamaları
- Küçük halkalar için özel optimizasyon
- RMSD tabanlı benzerlik filtreleme

### 2. MMFF94 Enerji Minimizasyonu
- Merck Molecular Force Field ile geometri optimizasyonu
- Sterik çatışmaların giderilmesi
- UFF fallback mekanizması

### 3. Boltzmann Ağırlıklandırma
Her konformerin doğada bulunma ihtimali:

$$P_i = \frac{e^{-\frac{E_i - E_{min}}{RT}}}{Z}$$

Burada:
- $P_i$: i. konformerin popülasyon yüzdesi
- $E_i$: i. konformerin enerjisi (kcal/mol)
- $E_{min}$: Global minimum enerji
- $R$: Gaz sabiti (0.001987 kcal/mol·K)
- $T$: Sıcaklık (298.15 K - Oda sıcaklığı)
- $Z$: Bölüşüm fonksiyonu

### 4. Vicinal Proton Analizi
- H-C-C-H sistemlerinin otomatik tespiti
- Her konformer için dihedral açı hesaplama
- Ağırlıklı ortalama dihedral açı
- Karplus eşitliği ile J-coupling tahmini:

$$J = 7 - 1.0 \cos(\phi) + 5.0 \cos(2\phi)$$

## Kullanım

### Python Modülü

```python
from conformer_engine import ConformerEngine

engine = ConformerEngine(n_confs=50, rmsd_threshold=0.5)
result = engine.generate_ensemble("ClCCCl")  # 1,2-Dikloroetan

print(f"Global Min Enerji: {result['global_min_energy']} kcal/mol")
print(f"Significant Conformers: {result['significant_confs']}")
print(f"Vicinal Couplings: {len(result['vicinal_couplings'])}")
```

### API Endpoint

```bash
POST /api/v2/conformer-analysis
Content-Type: application/json

{
  "smiles": "ClCCCl",
  "numConformers": 50,
  "temperature": 298.15
}
```

**Yanıt:**
```json
{
  "success": true,
  "analysis": {
    "conformers": [...],
    "globalMinEnergy": 12.45,
    "significantConfs": 8,
    "vicinalCouplings": [
      {
        "atoms": "H0-C1-C2-H3",
        "atom_indices": [0, 1, 2, 3],
        "avg_dihedral_angle": 180.0,
        "predicted_J_Hz": 12.0,
        "angles_by_conformer": [...]
      }
    ],
    "ensembleSummary": [
      {
        "id": 0,
        "energy": 12.45,
        "probability": 70.2,
        "weight": 0.702
      }
    ]
  }
}
```

## Parametreler

- **n_confs**: Üretilecek konformer sayısı (varsayılan: 50)
- **rmsd_threshold**: Benzerlik eşiği (Å, varsayılan: 0.5)
- **temperature**: Sıcaklık (K, varsayılan: 298.15)

## Çıktı Örneği (1,2-Dikloroetan)

Bu molekül için sistem şu sonuçları üretir:

- **Trans Konformer**: Cl atomları zıt tarafta
  - Enerji: En düşük
  - Popülasyon: ~%70
  - Dihedral açı: 180°
  - J-coupling: ~12 Hz

- **Gauche Konformer**: Cl atomları 60° açıda
  - Enerji: Biraz daha yüksek
  - Popülasyon: ~%30
  - Dihedral açı: 60°
  - J-coupling: ~4 Hz

- **Ağırlıklı Ortalama**: Sistem bu iki durumun ortalamasını alarak deneysel veriye yakın sonuç üretir.

## Gereksinimler

- Python 3.11+
- RDKit (kurulu)
- NumPy
- Flask (servis için)

## Notlar

- Büyük moleküller için işlem süresi artabilir (50 konformer ~30-60 saniye)
- Düşük olasılıklı (<%1) konformerler otomatik filtrelenir
- MMFF94 başarısız olursa UFF kullanılır
- Vicinal coupling analizi sadece H-C-C-H sistemleri için yapılır

