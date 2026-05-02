# SpectroMind v2.0 - MS (Kütle Spektrometrisi) Tahmin Modülü

## Genel Bakış

Bu modül, moleküllerin gaz fazındaki parçalanma davranışlarını simüle ederek teorik MS spektrumu üretir. Basit kütle hesaplamasının ötesine geçerek, **BDE (Bond Dissociation Energy)** tabanlı olasılıksal algoritma kullanır.

## Özellikler

### 1. BDE Tabanlı Fragmantasyon
- Her bağın kopma olasılığı, bağ enerjisine ve çarpışma enerjisine bağlıdır
- Arrhenius denklemi ile modellenir: `P = A * exp(-E_bond / (k * T_eff))`
- Halka içi bağlar daha zor kopar (1.5x enerji çarpanı)

### 2. Tanısal İyon Algılama
Modül aşağıdaki karakteristik iyonları otomatik olarak tespit eder:

| m/z | İyon | Yapısal Çıkarım |
|-----|------|----------------|
| 91 | Tropylium (C₇H₇⁺) | Benzil grubu (Ar-CH₂-) |
| 30 | Iminium (CH₂=NH₂⁺) | Primer amin (R-CH₂-NH₂) |
| 44 | Iminium (CH₃-CH=NH₂⁺) | Alfa-metil primer amin |
| 58 | McLafferty (Keton) | Metil Keton (R-CO-CH₃) |
| 74 | McLafferty (Ester) | Metil Ester (R-COOCH₃) |
| 60 | McLafferty (Asit) | Karboksilik Asit (R-COOH) |
| 31 | Oxonium (CH₂=OH⁺) | Primer Alkol (R-CH₂-OH) |
| 43 | Acylium (CH₃-CO⁺) | Asetil grubu |
| 57 | Acylium (C₂H₅-CO⁺) | Propiyonil grubu |
| 105 | Acylium (Ph-CO⁺) | Benzoil grubu |
| 77 | Fenil (C₆H₅⁺) | Aromatik halka |

### 3. McLafferty Düzenlenmesi
- Karbonil gruplarında gama-hidrojen transferi analizi
- 6 üyeli geçiş hali simülasyonu
- Metil keton, ester ve asit tespiti

### 4. İzotopik Doğrulama
- Tropylium için M+1/M oranı kontrolü (%7.7)
- 13C, 18O, 34S katkıları

## Kullanım

### Python Modülü

```python
from ms_predictor import MSPredictor

predictor = MSPredictor()
result = predictor.generate_spectrum(
    smiles="CC(=O)C1=CC=CC=1",  # Asetofenon
    ionization='EI',
    energy=30.0
)

print(f"Formül: {result['formula']}")
print(f"MW: {result['molecular_weight']}")
print(f"Pikler: {len(result['peaks'])}")
print(f"Tanısal İyonlar: {len(result['diagnostic_ions'])}")
```

### API Endpoint

```bash
POST /api/v2/ms-predict
Content-Type: application/json

{
  "smiles": "CC(=O)C1=CC=CC=1",
  "ionization": "EI",
  "energy": 30.0
}
```

**Yanıt:**
```json
{
  "success": true,
  "prediction": {
    "molecularIon": 120.0575,
    "peaks": [
      {"m/z": 120.06, "intensity": 100.0, "type": "M+"},
      {"m/z": 105.03, "intensity": 85.2, "type": "Fragment"},
      ...
    ],
    "diagnosticIons": [
      {
        "mz": 105.03,
        "name": "Acylium (Ph-CO+)",
        "structure": "Benzoil grubu",
        "relative_intensity": 85.2,
        "is_base_peak": false,
        "confirmations": [
          {"mz": 77.04, "intensity": 45.3}
        ]
      }
    ],
    "mclaffertyRearrangements": [...],
    "method": "BDE-based fragmentation (EI)"
  }
}
```

## Parametreler

- **ionization**: `'EI'` | `'ESI'` | `'MALDI'` | `'APCI'`
- **energy**: Çarpışma enerjisi (eV), varsayılan: 30.0
- **depth_limit**: Rekürsiyon derinliği, varsayılan: 2
- **min_mass**: Minimum fragman kütlesi (Da), varsayılan: 15.0

## Matematiksel Model

### Bağ Kopma Olasılığı
```
P_cleave(i) = A * exp(-E_bond(i) / (k * T_eff))
```

### Fragman Şiddeti
```
I_m/z = I_parent * P_cleave * S_ion
```

Burada:
- `E_bond(i)`: i. bağın ayrışma enerjisi (kcal/mol)
- `T_eff`: Efektif sıcaklık (çarpışma enerjisi, eV)
- `S_ion`: İyonizasyon kararlılığı

## Gereksinimler

- Python 3.11+
- RDKit (kurulu)
- NumPy
- Flask (servis için)

## Notlar

- Büyük moleküller için işlem süresi artabilir
- Rekürsif fragmantasyon derinliği performansı etkiler
- BDE tablosu heuristic'tir; gerçek uygulamada ML modeli veya DFT kullanılmalıdır

