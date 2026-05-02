# FID Klasör Yükleme - Tam Implementasyon

## ✅ Tamamlanan Özellikler

### 1. Klasör Yükleme API
- **Route:** `POST /api/fid/upload`
- **Özellikler:**
  - Multiple file upload (webkitRelativePath desteği)
  - Path traversal koruması
  - Bruker/Varian otomatik tespiti (procpar/acqus)
  - FID dosyası zorunlu kontrolü

### 2. Python FID Processor
- **Script:** `scripts/fid_process.py`
- **Özellikler:**
  - nmrglue ile Bruker/Varian dataset okuma
  - MestReNova-benzeri işleme zinciri:
    1. Exponential apodization (LB)
    2. Zero-fill
    3. FFT (complex)
    4. Phase correction (ph0/ph1)
    5. PPM axis construction
  - JSON output (ppm[], intensity[])

### 3. Process Route Güncellemesi
- **Route:** `POST /api/fid/process`
- **Yeni Özellikler:**
  - `datasetId` parametresi desteği
  - Python worker çağrısı (fid_process.py)
  - Windows/Unix path desteği
  - Backward compatibility (tek dosya yükleme)

### 4. Frontend Component'leri
- **FIDUploader:** Klasör yükleme + spektrum görselleştirme
- **SpectrumPlot:** Chart.js ile spektrum grafiği
- **Özellikler:**
  - Drag & drop klasör desteği
  - "Klasör Seç" butonu (webkitdirectory)
  - Upload status gösterimi
  - Detaylı hata mesajları
  - Spektrum grafiği (ppm vs intensity)

## Kullanım Akışı

### 1. Klasör Yükleme
```
Kullanıcı → "Klasör Seç" → PROTON_02.fid/ seçer
         → Tüm dosyalar upload edilir
         → Server temp/<datasetId>/ altına kaydedilir
         → FID ve metadata (procpar/acqus) bulunur
```

### 2. FID İşleme
```
Server → Python script çağrılır (fid_process.py)
      → nmrglue ile dataset okunur
      → Processing chain uygulanır
      → JSON döner: { ppm: [], intensity: [] }
```

### 3. Grafik Gösterimi
```
Frontend → SpectrumPlot component
         → Chart.js ile grafik render
         → PPM ekseni (ters yön: yüksek → düşük)
         → Intensity y ekseni
```

## API Endpoints

### POST `/api/fid/upload`
**Request:**
```typescript
FormData {
  datasetId: string;
  files: File[];
  paths: string[]; // webkitRelativePath
}
```

**Response:**
```typescript
{
  ok: true,
  datasetId: string,
  baseDir: string,
  fidPath: string,
  procparPath: string | null,
  acqusPath: string | null,
  datasetType: "varian" | "bruker" | "unknown",
  warnings: string[]
}
```

### POST `/api/fid/process`
**Request (Klasör):**
```typescript
FormData {
  datasetId: string;
  format?: "auto" | "varian" | "bruker";
  theoreticalPeaks?: string; // JSON
  processingSpec?: string; // JSON
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    metadata: {
      spectrometer_freq: number,
      spectral_width: number,
      data_points: number,
      sw_hz: number,
      sw_ppm: number,
      ref_ppm: number
    },
    ppm: number[],
    intensity: number[],
    peaks: Array<{ ppm, height, area }>
  },
  warnings: string[]
}
```

## Python Dependencies

Kurulu paketler:
- ✅ rdkit 2025.9.3
- ✅ numpy 2.4.1
- ✅ scipy 1.17.0
- ✅ nmrglue 0.11
- ✅ Pillow 12.1.0

## Çözülen Sorunlar

### ❌ Önceki Hata
```
ENOENT: no such file or directory, open 'C:\Users\...\temp\PROTON_02.fid\fid'
```
**Sebep:** Backend, UI'dan gelen Windows absolute path'i kullanmaya çalışıyordu.

### ✅ Çözüm
- Browser dosyaları HTTP ile upload ediyor
- Server temp/<datasetId>/ altına kaydediyor
- Python script server-local path kullanıyor
- Windows absolute path'e hiç güvenilmiyor

## Test Senaryoları

1. ✅ PROTON_02.fid klasörü yükleme
2. ✅ FID dosyası bulunamadığında hata mesajı
3. ✅ Varian format tespiti (procpar)
4. ✅ Bruker format tespiti (acqus)
5. ✅ Spektrum grafiği render
6. ✅ PPM ekseni doğru yön (ters)

## Dosya Yapısı

```
app/api/fid/
  ├── upload/route.ts      # Klasör yükleme
  └── process/route.ts     # FID işleme

lib/fid/
  ├── fsUtils.ts          # Dosya bulma utils
  └── bruker/
      └── acqus.ts        # Metadata parser

components/fid/
  ├── FIDUploader.tsx     # Ana upload component
  └── SpectrumPlot.tsx    # Spektrum grafiği

scripts/
  └── fid_process.py      # Python worker
```

## Sonraki Adımlar

- [ ] Auto-phase (ACME algoritması)
- [ ] Baseline correction (ALS)
- [ ] Peak picking (SNR-based)
- [ ] Solvent mask
- [ ] Progress bar (büyük klasörler için)
