# SpectroMind NMR Engine - FastAPI Microservice

## Genel Bakış

Bu servis, SpectroMind'ın Python tabanlı NMR analiz motorunu sürekli ayakta duran bir mikroservis olarak çalıştırır. RDKit kütüphaneleri RAM'de hazır bekler, her istekte yeniden yüklenmez.

## Özellikler

- **Persistent Service**: RDKit bir kez yüklenir, RAM'de kalır
- **HOSE Code Prediction**: 1H ve 13C NMR tahmini
- **GNN Support**: Graph Neural Network model desteği (placeholder)
- **Conformer Analysis**: ETKDGv3 + Boltzmann weighting
- **FTIR Prediction**: Anharmonik düzeltme ile
- **MS Prediction**: Kütle spektrometrisi tahmini
- **QM Calculation**: xTB ve DFT desteği

## Kurulum

```bash
cd services/nmr-engine
pip install -r requirements.txt
```

## Çalıştırma

```bash
python main.py
```

Servis `http://localhost:8000` adresinde çalışır.

## API Endpoints

### Health Check
```
GET /health
```

### NMR Prediction
```
POST /predict/nmr
{
  "smiles": "CCO",
  "spectrum_type": "both",
  "method": "hybrid",
  "solvent": "CDCl3"
}
```

### Conformer Analysis
```
POST /analyze/conformers
{
  "smiles": "CCO",
  "num_conformers": 50,
  "boltzmann_weighting": true
}
```

### FTIR Prediction
```
POST /predict/ftir
{
  "smiles": "CCO",
  "anharmonic_correction": true
}
```

### MS Prediction
```
POST /predict/ms
{
  "smiles": "CCO",
  "ionization_mode": "ESI"
}
```

### QM Calculation
```
POST /calculate/qm
{
  "smiles": "CCO",
  "method": "xtb"
}
```

## Next.js Entegrasyonu

Next.js tarafında bu servisi çağırmak için:

```typescript
const response = await fetch('http://localhost:8000/predict/nmr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    smiles: 'CCO',
    spectrum_type: 'both',
    method: 'hybrid'
  })
});
```

## Performans

- **İlk Yükleme**: ~2-3 saniye (RDKit yükleme)
- **NMR Tahmini**: ~100-500ms (kütüphaneler hazır)
- **Conformer Analizi**: ~1-5 saniye (50 konformer)
- **FTIR**: ~50-200ms

## Geliştirme Notları

- GNN modeli şu an placeholder - gerçek PyTorch modeli entegre edilmeli
- QM hesaplamaları için xTB/ORCA kurulumu gerekli
- Production'da Redis cache eklenmeli
- Celery worker'ları için ayrı bir servis gerekli

