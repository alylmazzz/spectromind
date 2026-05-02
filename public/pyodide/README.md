# SpectroMind v2.0 - Tarayıcı Tabanlı FID İşleme Modülü

## Genel Bakış

Bu modül, sunucu maliyetlerini sıfıra indiren ve veri gizliliğini %100 sağlayan devrimsel bir adımdır. 100 MB veya 1 GB boyutundaki ham NMR verisi (FID) internete yüklenmez. Bunun yerine, Python'un bilimsel kütüphaneleri (NumPy, SciPy) kullanıcının tarayıcısına indirilir (WASM) ve işlem kullanıcının kendi CPU/RAM gücüyle yapılır.

## Özellikler

### 1. Web Worker Mimarisi
- Ana UI thread'i donmaz
- Arka planda işlem yapılır
- Pyodide (Python in WebAssembly) kullanılır

### 2. Bruker FID Format Desteği
- Binary FID dosyası okuma
- ACQUS parametre dosyası parsing
- Spectral width (SW), frequency (SFO1) otomatik tespit

### 3. DSP Zinciri (Digital Signal Processing)
- **Apodization (Windowing)**: Exponential multiplication
  - Formül: $S'(t) = S(t) \times e^{-LB \cdot t}$
  - Line broadening (LB) parametresi
- **Zero Filling**: Çözünürlük artırma
- **FFT**: Fast Fourier Transform (Cooley-Tukey)
- **Phase Correction**: Zero-order ve first-order faz düzeltme
  - Formül: $S_{new}(\omega) = S_{old}(\omega) \times e^{i(\phi_0 + \phi_1 \cdot \omega)}$

### 4. Real-time Faz Ayarı
- Slider ile anlık faz düzeltme
- UI donmadan işlem yapılır
- MestReNova benzeri deneyim

## Kullanım

### React Component

```tsx
import FIDProcessorV2 from '@/components/fid/FIDProcessorV2';

<FIDProcessorV2 />
```

### Programmatic API

```typescript
import { processFID, FIDProcessingOptions } from '@/lib/utils/v2/clientProcessing';

const options: FIDProcessingOptions = {
  fftSize: 65536,
  phaseCorrection: { ph0: 0, ph1: 0 },
  apodization: 'exponential',
  apodizationParam: 0.3,  // Line broadening (Hz)
  baselineCorrection: true
};

const result = await processFID(fidArrayBuffer, acqusContent, options);
```

## Dosya Yapısı

```
public/pyodide/
├── browser_nmr_processor.py  # Python NMR processor modülü
├── fid_worker.js            # Web Worker (Pyodide + Python)
└── README.md                # Bu dosya
```

## Parametreler

- **lb** (Line Broadening): 0.0 - 5.0 Hz (varsayılan: 0.3)
- **p0** (Phase 0): -180° - 180° (varsayılan: 0.0)
- **p1** (Phase 1): -180° - 180° (varsayılan: 0.0)
- **zf_factor** (Zero Filling): 1 - 4 (varsayılan: 2)

## Performans

- **İlk Yükleme**: ~5-10 saniye (Pyodide indirme)
- **FID İşleme**: ~1-3 saniye (dosya boyutuna bağlı)
- **Real-time Faz**: ~100ms (debounced)

## Gereksinimler

- Modern tarayıcı (Chrome, Firefox, Safari, Edge)
- WebAssembly desteği
- Web Worker desteği

## Notlar

- **Veri Gizliliği**: FID verisi hiçbir zaman sunucuya gönderilmez
- **Sunucu Maliyeti**: Sıfır (tüm işlem client-side)
- **Offline Çalışma**: Pyodide bir kez indirildikten sonra offline çalışabilir
- **Büyük Dosyalar**: 1 GB'a kadar FID dosyaları işlenebilir (RAM'e bağlı)

## Hata Yönetimi

- Pyodide yüklenemezse: Worker error mesajı
- FID parse hatası: "Invalid FID format"
- ACQUS parse hatası: Varsayılan parametreler kullanılır

## Production Ortamı

Production ortamında:
- Pyodide CDN'den yüklenir (jsdelivr)
- Python modülü `/public/pyodide/` klasöründe statik dosya olarak servis edilir
- Web Worker Next.js tarafından otomatik olarak servis edilir

