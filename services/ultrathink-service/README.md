# UltraThink Comprehensive Theoretical Spectrum Prediction Engine

## Genel Bakış

UltraThink, ULTRATHINK dokümanındaki tüm 150 temel prensip, 225 1H NMR parametresi, 25 13C NMR birimi, 25 FTIR birimi ve 250 additivity kuralını içeren kapsamlı bir teorik spektrum tahmin motorudur.

## Özellikler

### Bölüm 1: Temel Prensipler ve Moleküler Hazırlık (150 Parametre)
- Atom numarası, kütle numarası, çekirdek spini
- Jiromanyetik oran, Larmor frekansı
- Doymamışlık derecesi (DoB) hesabı
- Hibritleşme ve s-karakteri analizi
- Simetri ve eşdeğerlik tespiti
- Moleküler graf ve topolojik analiz

### Bölüm 2: 1H NMR Master Algoritma (225 Parametre)
- **Shoolery Kuralı**: Metilen ve metin grupları için additivity
- **Tobey-Simon Kuralı**: Olefinik protonlar için geometrik etkiler
- **Curphy-Morrison Kuralı**: Aromatik protonlar için sübstitüent etkileri
- **Karplus Eşitliği**: 3J coupling sabitleri için dihedral açı bağımlılığı
- Multiplet ağacı (splitting tree) oluşturma
- İkinci derece spin sistemleri (AB, AMX, AA'BB')

### Bölüm 3: 13C NMR Tahmin (25 Birim)
- **Grant-Paul Denklemi**: Alkanlar için additivity
- Sterik düzeltme faktörleri
- Gamma-gauche etkisi
- Aromatik 13C shift tahmini
- Karbonil grupları (keton, aldehit, asit, ester, amid)
- DEPT faz analizi

### Bölüm 4: FTIR Tahmin (25 Birim)
- **Hooke Yasası**: Temel titreşim frekansı hesabı
- Bağ kuvvet sabiti (k) hiyerarşisi
- İndirgenmiş kütle (μ) hesabı
- Fonksiyonel grup bölgeleri
- Konjugasyon etkisi
- Halka gerginliği etkisi
- Hidrojen bağı etkileri

### Bölüm 5: Additivity Kuralları (250 Lookup Table)
- Shoolery sabitleri (50+ grup)
- Curphy-Morrison sabitleri (16+ grup)
- Tobey-Simon sabitleri (15+ grup)
- Grant-Paul parametreleri
- Sterik düzeltme faktörleri
- Aromatik 13C sabitleri
- Karbonil IR shift'leri

### Bölüm 6: Bütünleşik Değerlendirme
- Çapraz doğrulama (IR ↔ NMR ↔ 13C)
- Tutarlılık kontrolleri
- Entegrasyon doğrulama
- Simetri/İntegral uyumu

### Bölüm 8: Heteroatomlar
- 19F (Flor) eşleşme sabitleri
- 31P (Fosfor) eşleşme sabitleri
- 2H (Döteryum) solvent pikleri
- 29Si uyduları

## Kurulum

```bash
cd services/ultrathink-service
pip install -r requirements.txt
```

## Kullanım

### Python API

```python
from ultrathink_engine import predict_ultrathink_spectrum

result = predict_ultrathink_spectrum('CCO')  # Ethanol

print(f"1H NMR peaks: {result['h1NMR']}")
print(f"13C NMR peaks: {result['c13NMR']}")
print(f"FTIR peaks: {result['ftir']}")
print(f"Properties: {result['properties']}")
```

### Flask Service

```bash
python main.py
```

Service `http://localhost:8005` adresinde çalışır.

### Next.js API Endpoint

```typescript
const response = await fetch('/api/v2/ultrathink-predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    smiles: 'CCO',
    solvent: 'CDCl3',
    temperature: 298.15,
    frequency: 400
  })
});

const data = await response.json();
```

## API Response Format

```json
{
  "success": true,
  "prediction": {
    "h1NMR": [
      {
        "shift": 3.6,
        "integration": 2,
        "multiplicity": "q",
        "assignment": "H1"
      }
    ],
    "c13NMR": [
      {
        "shift": 58.0,
        "intensity": 1.0,
        "assignment": "CH2 (C1)",
        "carbon_type": "CH2"
      }
    ],
    "ftir": [
      {
        "wavenumber": 3300,
        "intensity": 80,
        "assignment": "O-H stretch",
        "type": "broad"
      }
    ],
    "properties": {
      "formula": "C2H6O",
      "molecularWeight": 46.07,
      "doB": 0.0,
      "symmetry": "C1",
      "chiralCenters": 0,
      "rotatableBonds": 0,
      "heteroatomRatio": 0.5
    },
    "confidence": 0.85,
    "warnings": [],
    "method": "UltraThink Comprehensive Prediction Engine v1.0"
  },
  "metadata": {
    "version": "2.0.0",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "statistics": {
      "h1Peaks": 3,
      "c13Peaks": 2,
      "ftirPeaks": 4,
      "totalIntegration": 6
    }
  }
}
```

## Algoritma Detayları

### 1H NMR Tahmin Akışı

1. Molekül parse edilir (RDKit)
2. Hidrojenler eklenir (explicit H)
3. Eşdeğer hidrojenler gruplanır (simetri analizi)
4. Her grup için:
   - Shoolery kuralı uygulanır (alifatik)
   - Tobey-Simon kuralı uygulanır (olefinik)
   - Curphy-Morrison kuralı uygulanır (aromatik)
5. J-coupling hesaplanır (Karplus eşitliği)
6. Multiplet pattern oluşturulur

### 13C NMR Tahmin Akışı

1. Tüm karbonlar tespit edilir
2. Her karbon için:
   - Grant-Paul denklemi uygulanır
   - Fonksiyonel grup düzeltmeleri eklenir
   - Sterik düzeltmeler uygulanır
3. Karbon tipi belirlenir (Cq, CH, CH2, CH3)

### FTIR Tahmin Akışı

1. Fonksiyonel gruplar tespit edilir
2. Her grup için:
   - Hooke yasası ile frekans hesaplanır
   - Konjugasyon etkisi uygulanır
   - Halka gerginliği düzeltmesi yapılır
3. Titreşim modları belirlenir

## Referanslar

- ULTRATHINK Technical Documentation (SpectroMind Master Inventory)
- Pavia, D. L. - Introduction to Spectroscopy
- Silverstein, R. M. - Spectrometric Identification of Organic Compounds
- Grant, D. M. & Paul, E. G. - Carbon-13 Magnetic Resonance
- Shoolery, J. N. - Proton Magnetic Resonance Spectroscopy

## Lisans

SpectroMind v2.0 "Singularity Edition"

