# FID Klasör Yükleme Implementasyonu

## Özet

Bruker FID klasörlerini sürükle-bırak veya "Klasör Seç" ile yükleyip işleme özelliği eklendi. ENOENT hatası çözüldü.

## Yapılan Değişiklikler

### 1. Yeni API Route: `/api/fid/upload`
- **Dosya:** `app/api/fid/upload/route.ts`
- **Amaç:** Klasör içindeki tüm dosyaları yükleyip temp dizinine kaydetmek
- **Özellikler:**
  - Multiple file upload desteği
  - Relative path korunması (webkitRelativePath)
  - Path traversal koruması
  - FID ve ACQUS dosyalarını otomatik bulma
  - Dataset ID ile izolasyon

### 2. FID Dosya Bulma Utils
- **Dosya:** `lib/fid/fsUtils.ts`
- **Fonksiyonlar:**
  - `safeJoin()`: Path traversal koruması
  - `findFileRecursive()`: Klasör içinde dosya arama (case-insensitive)
  - `listTree()`: Debug için dizin ağacı listeleme

### 3. Bruker Metadata Parser
- **Dosya:** `lib/fid/bruker/acqus.ts`
- **Amaç:** ACQUS dosyasından metadata çıkarma
- **Desteklenen Parametreler:**
  - `SW_h`: Spectral width (Hz)
  - `SW_p`: Spectral width (ppm)
  - `SFO1`: Spectrometer frequency (MHz)
  - `O1`: Offset (Hz)
  - `O1p`: Offset (ppm)
  - `BF1`: Base frequency (MHz)
  - `TD`: Total data points

### 4. Process Route Güncellemesi
- **Dosya:** `app/api/fid/process/route.ts`
- **Yeni Özellikler:**
  - `datasetId` parametresi desteği
  - Hem tek dosya hem klasör yükleme desteği
  - Windows Python path düzeltmesi (`venv_rdkit\Scripts\python.exe`)

### 5. FIDUploader Component Güncellemesi
- **Dosya:** `components/fid/FIDUploader.tsx`
- **Yeni Özellikler:**
  - Klasör yükleme desteği (`webkitdirectory`)
  - Drag & drop klasör desteği
  - Upload status gösterimi
  - Detaylı hata mesajları (FID_NOT_FOUND için özel uyarı)

## Kullanım

### Klasör Yükleme

1. **"Klasör Seç" butonuna tıklayın**
2. Bruker `.fid` klasörünü seçin (örn: `PROTON_02.fid/`)
3. Klasör içindeki tüm dosyalar otomatik yüklenir
4. FID dosyası bulunur ve işlenir

### Sürükle-Bırak

1. `.fid` klasörünü sürükleyip bırakın
2. Tüm dosyalar otomatik yüklenir

### Tek Dosya Yükleme (Eski Yöntem)

1. "Dosya Seç" butonuna tıklayın
2. Tek bir `.fid` veya `.jdf` dosyası seçin
3. Dosya işlenir

## API Endpoints

### POST `/api/fid/upload`

**Request:**
```typescript
FormData {
  datasetId: string;
  files: File[];
  paths: string[]; // webkitRelativePath values
}
```

**Response:**
```typescript
{
  ok: true,
  datasetId: string,
  baseDir: string,
  fidPath: string,
  acqusPath: string | null,
  warnings: string[]
}
```

### POST `/api/fid/process`

**Request (Klasör Yükleme):**
```typescript
FormData {
  datasetId: string;
  format?: string; // 'auto', 'bruker', 'varian', 'jeol'
  theoreticalPeaks?: string; // JSON array
  processingSpec?: string; // JSON
}
```

**Request (Tek Dosya - Eski Yöntem):**
```typescript
FormData {
  fid: File;
  format?: string;
  theoreticalPeaks?: string;
  processingSpec?: string;
}
```

## Hata Mesajları

### FID_NOT_FOUND
- **Sebep:** Yüklenen klasörde `fid` dosyası bulunamadı
- **Çözüm:** Bruker dataset klasörünü seçtiğinizden emin olun

### ACQUS_MISSING
- **Sebep:** `acqus` dosyası bulunamadı (uyarı, işleme devam eder)
- **Çözüm:** Metadata eksik olabilir, varsayılan değerler kullanılır

## Teknik Detaylar

### Path Traversal Koruması

```typescript
function safeJoin(root: string, relPath: string): string {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(root, normalized);
}
```

### Dosya Arama

```typescript
async function findFileRecursive(startDir: string, filename: string): Promise<string | null> {
  // Recursive search, case-insensitive
}
```

### Windows Path Desteği

Python path otomatik olarak platform'a göre ayarlanır:
- Windows: `venv_rdkit\Scripts\python.exe`
- Unix: `venv_rdkit/bin/python3`

## Test Senaryoları

1. ✅ Bruker `.fid` klasörü yükleme
2. ✅ Tek dosya yükleme (backward compatibility)
3. ✅ FID dosyası bulunamadığında hata mesajı
4. ✅ ACQUS eksik olduğunda uyarı
5. ✅ Path traversal koruması
6. ✅ Drag & drop klasör desteği

## Gelecek İyileştirmeler

- [ ] Varian format klasör desteği
- [ ] JEOL format klasör desteği
- [ ] Progress bar (büyük klasörler için)
- [ ] Klasör içeriği önizleme
- [ ] Metadata validation
