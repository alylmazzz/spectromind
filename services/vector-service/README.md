# SpectroMind v2.0 - Vektör Tabanlı Benzerlik Arama (RAG) Modülü

## Genel Bakış

Bu modül, sistemin "Arama Motoru"ndan "Kavramsal Zeka"ya geçiş yaptığı yerdir. Klasik veritabanları kesin eşleşme ararken, bu modül belirsizliği (fuzziness) yöneterek kavramsal arama yapar.

## Özellikler

### 1. Yapısal Embedding (Molecular Fingerprints)
- **Morgan Fingerprints (ECFP4)**: Extended-Connectivity Fingerprints
- Her atomun çevresini (yarıçap 2-3 bağ) tarar
- 2048 uzunluğunda bit vektörü
- **Sonuç**: Aspirin ve Salisilik Asit'in vektörleri uzayda birbirine çok yakındır (Kosinüs benzerliği > 0.8)

### 2. Spektral Embedding (Spectrum Binning)
- **Binning Yöntemi**: 0-12 ppm aralığı 1024 parçaya bölünür
- Her parçadaki pik şiddeti o vektörün değerini oluşturur
- Gaussian yayılımı ile fuzziness (piklerin biraz kaymasını tolere eder)
- **Sonuç**: Pikler biraz kaysa bile (solvent etkisi) vektör benzerliği yüksek çıkar

### 3. Metin Embedding (Semantic Text)
- **Model**: all-MiniLM-L6-v2 (Sentence Transformers)
- Literatür taraması için makale özetleri vektöre çevrilir
- **Sonuç**: "Anti-kanser" sorgusu ile "Sitotoksik ajan" içeren makale eşleşir

### 4. Benzerlik Metriği (Cosine Similarity)
İki vektörün ($\mathbf{A}$ ve $\mathbf{B}$) birbirine ne kadar benzediği:

$$\text{Similarity} = \cos(\theta) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$$

### 5. Hybrid Search (Melez Arama)
Text + Yapı + Spektrum benzerliklerini ağırlıklandırarak arar:

```python
scores = (text_similarity * weight_text) + 
         (struct_similarity * weight_struct) + 
         (spec_similarity * weight_spec)
```

## Kullanım

### Python Modülü

```python
from vector_search_engine import VectorSearchEngine

engine = VectorSearchEngine()

# Veri ekle
engine.add_item(
    doc_id=1,
    name="Aspirin",
    smiles="CC(=O)Oc1ccccc1C(=O)O",
    abstract="Aspirin is a salicylate...",
    nmr_peaks=[(2.35, 3.0), (7.1, 1.0), (7.6, 1.0), (8.1, 1.0)]
)

# Hybrid search
results = engine.search_hybrid({
    "text": "pain treatment",
    "smiles": "CC(=O)Oc1ccccc1",
    "peaks": [(2.3, 3.0), (7.1, 1.0)]
}, weights={"text": 0.3, "struct": 0.4, "spec": 0.3})
```

### API Endpoint

```bash
POST /api/v2/vector-search
Content-Type: application/json

{
  "query": {
    "text": "pain inflammation treatment",
    "smiles": "CC(=O)Oc1ccccc1C(=O)O",
    "peaks": [[2.35, 3.0], [7.1, 1.0], [7.6, 1.0]],
    "weights": {
      "text": 0.3,
      "struct": 0.4,
      "spec": 0.3
    },
    "topK": 10,
    "threshold": 0.0
  }
}
```

**Yanıt:**
```json
{
  "success": true,
  "results": [
    {
      "molecule": {
        "name": "Aspirin",
        "smiles": "CC(=O)Oc1ccccc1C(=O)O",
        "formula": "C9H8O4"
      },
      "similarity": 0.8523,
      "metadata": {
        "reason": "Hybrid Match",
        "abstract": "Aspirin is a salicylate..."
      }
    }
  ],
  "method": "Hybrid Vector Search"
}
```

## Parametreler

- **text**: Semantic text query (örn: "pain treatment")
- **smiles**: SMILES string for structural search
- **peaks**: NMR peaks array `[[ppm, intensity], ...]`
- **weights**: Ağırlıklar `{text: 0.3, struct: 0.4, spec: 0.3}`
- **topK**: Döndürülecek sonuç sayısı (varsayılan: 10)
- **threshold**: Minimum benzerlik eşiği (varsayılan: 0.0)

## Arama Senaryoları

### Senaryo 1: Semantic Text Search
```json
{
  "query": {
    "text": "anti-cancer cytotoxic agent",
    "weights": {"text": 1.0, "struct": 0.0, "spec": 0.0}
  }
}
```

### Senaryo 2: Spectral Search (Shazam-like)
```json
{
  "query": {
    "peaks": [[2.15, 3.0], [6.8, 2.0], [7.3, 2.0]],
    "weights": {"text": 0.0, "struct": 0.0, "spec": 1.0}
  }
}
```

### Senaryo 3: Structural Search
```json
{
  "query": {
    "smiles": "Oc1ccccc1C(=O)O",
    "weights": {"text": 0.0, "struct": 1.0, "spec": 0.0}
  }
}
```

### Senaryo 4: Hybrid Search (Hepsi birlikte)
```json
{
  "query": {
    "text": "pain treatment",
    "smiles": "CC(=O)Oc1ccccc1",
    "peaks": [[2.3, 3.0], [7.1, 1.0]],
    "weights": {"text": 0.3, "struct": 0.4, "spec": 0.3}
  }
}
```

## Gereksinimler

- Python 3.11+
- RDKit (kurulu)
- NumPy
- scikit-learn
- sentence-transformers: `pip install sentence-transformers`
- Flask (servis için)

## Notlar

- **Fuzziness**: Spectrum binning'de Gaussian yayılımı kullanılır, piklerin biraz kaymasını tolere eder
- **Hız**: Vektör işlemleri milisaniyeler içinde yapılır
- **Esneklik**: Ağırlıklar kullanıcı tarafından ayarlanabilir
- **Production**: Üretim ortamında PostgreSQL/pgvector kullanılacak

## Production Ortamı

Production ortamında:
- Mock veritabanı yerine PostgreSQL + pgvector kullanılacak
- HNSW (Hierarchical Navigable Small World) indeksleme
- Milisaniyeler içinde nearest neighbor arama

