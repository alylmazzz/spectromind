# SpectroMind Repo Audit — 2026-03-31

## 1. Genel Profil

| Alan | Değer |
|------|-------|
| Framework | Next.js 16 (App Router) + React 19 |
| Dil | TypeScript 5 + Python (venv_rdkit) |
| UI | Tailwind 4, Chart.js, react-resizable-panels, 3Dmol, Three.js |
| Test | Vitest 4 — 20+ test dosyası, coverage: lib/packages/Spectrotester |
| NMR Engine | lib/nmr/* (shift, coupling, spin-system, lineshape, validation) |
| MS Engine | lib/ms/* (isotope-engine, fragmentation-engine) |
| IR Engine | lib/spectromind/ir_engine/* (ftirEngine, normalModeSolver, forceConstantModel) |
| Elucidation | lib/elucidation/engine.ts + scripts/elucidation_v15.py |
| Verification | packages/schemas (VerificationReport, QCReport) + Spectrotester verify/* |
| Prediction | deterministicPredictor + HOSE + LLM (Gemini/OpenAI) + UltraThink |
| FID Processing | Python (nmrglue/scipy) via spawn; format detector: Bruker/Varian/JEOL |
| Backend Services | 11 Python microservices (Docker): nmr-engine, ms-service, dft-service, gnn-service, conformer-service, chem-core, celery-worker, vector-service, opsin-service, self-correction, ultrathink |
| API Routes | 40+ Next.js API routes |
| Spectrotester | Ayrı paket: rule-based verify, golden expectations, library schemas |
| DB | services/database/schema.sql + redis_service.py — minimal |
| Sayfalar | / (ana uygulama), /simulate |

## 2. Güçlü Yönler

### 2.1 Bilimsel Derinlik
- **Katmanlı shift modeli**: base → topology → electronic → π-anisotropy → H-bond → solvent. Bu, basit tablo lookup'tan çok daha ileri.
- **Spin-system çekirdeği**: firstOrderSolver + hamiltonianSolver + spinSystemClassifier. Hamiltonien tabanlı ikinci mertebe solver VAR.
- **Coupling engine**: Karplus engine, bond classifier, J library. Visin-al, geminal, long-range ayrımı yapıyor.
- **Equivalence engine**: Kimyasal eşdeğerlik tespiti mevcut.
- **MS**: Isotope engine (IUPAC 2016 kütle tablosu, konvolüsyon) + fragmentation engine (α-cleavage, McLafferty, RDA).
- **IR**: Force constant model + normal mode solver + aromatik band tamamlayıcı kurallar.
- **Observed data model**: RawObservation → ProcessedObservation → PeakList → VerificationInput zinciri tanımlı. Provenance ve QualityFlags yapısı VAR.
- **Unified spectrum schema**: packages/schemas/index.ts — NMR1D, NMR2D, IR, MS, QC, Verification, Elucidation tipleri tek yerde.

### 2.2 Mimari Yetkinlik
- **Deterministik + LLM hibrit**: Kural tabanlı tahmin + LLM zenginleştirme ayrımı düşünülmüş.
- **Multi-engine simulate route**: spectromind/spectrotester/hybrid seçimi var.
- **FID format detection**: Bruker acqus parser, Varian/JEOL sezgisi.
- **Processing provenance tipi**: ProcessingProvenance, AuditTrace packages/schemas'da tanımlı.
- **Calibration profiles**: Solvent, field, temperature, tolerans yapısı var.

### 2.3 Ürün Tarafı
- **NMRChart**: Profesyonel seviyeye yakın — zoom, pan, solvent mask, JCAMP export, manual phase/ref panel, observed overlay.
- **FID upload**: Klasör sürükle-bırak, format tespiti, Python backend işleme, overlay akışı.
- **BulkInput**: Metin parse, PubChem arama, AI tahmin, literature DOI.
- **2D/3D Molecule**: PubChem + RDKit SVG + 3Dmol.js.
- **Conformer viewer**: Three.js tabanlı, enerji/ağırlık gösterimi.

## 3. Zayıf Yönler ve Riskler

### 3.1 Mimari Sorunlar

| Sorun | Etki | Önem |
|-------|------|------|
| **Global state yok** — tüm state `page.tsx` içinde useState + prop drilling | Ölçeklenme engeli, yeni modüller eklemek zor | KRİTİK |
| **Tip çoğullaması** — `Solvent` 3 farklı yerde 3 farklı tanım, `MSPeak` 2 farklı tanım, `Conformer` 2 farklı tanım | Tip güvenliği kırık, refactoring riski | YÜKSEK |
| **localhost:3000 sabit kodlu** — smilesParser.ts doğrudan localhost'a fetch yapıyor | Production/Docker'da kırılır | YÜKSEK |
| **Python spawn bağımlılığı** — FID process ve bazı API'ler venv_rdkit/bin/python3 çağırıyor; Windows'ta path farklı | Platform bağımlılığı, Vercel'de çalışmaz | YÜKSEK |
| **Çift FID implementasyonu** — FIDUploader.tsx vs FIDUploaderCompact.tsx, biri useFIDUpload kullanıyor diğeri kendi fetch'ini yapıyor | Bakım borcu, davranış tutarsızlığı | ORTA |
| **Kullanılmayan import'lar** — page.tsx'de çok sayıda ölü import | Kod kalitesi, bundle boyutu | DÜŞÜK |
| **BulkInput monolit** — Binlerce satır tek dosyada | Bakım maliyeti çok yüksek | ORTA |

### 3.2 Bilimsel Eksiklikler

| Eksik | Mnova Karşılığı | Etki |
|-------|-----------------|------|
| **Gerçek NMR processing zinciri yok** — FT, apodization, zero fill, LP, NUS, phase, baseline, reference deconvolution... yalnız Python spawn ile kısmi | Mnova: 25+ processing adımı, template, batch | KRİTİK |
| **2D NMR processing yok** — nmr2dSchema var ama gerçek 2D matrix processing, contour engine, trace attach yok | Mnova: Tam 2D workstation | KRİTİK |
| **Multiplet/assignment workstation yok** — multipletAnalysis.ts var ama Multiplet Manager, overlap çözümü, report, copy yok | Mnova: Olgun multiplet ekosistemi | YÜKSEK |
| **Stacked/arrayed NMR yok** — Hiçbir veri modeli veya UI yok | Mnova: T1, DOSY, reaction monitoring, batch | YÜKSEK |
| **Verify olgunlaşmamış** — VerificationReport şeması güçlü ama gerçek UI panel, batch verify, negative troubleshooting yok | Mnova: Tam Verify + batch | YÜKSEK |
| **MS tam workspace yok** — isotope + fragmentation engine var ama chromatogram, EIC, RT alignment, deconvolution, molecular match yok | Mnova: Tam LC/GC-MS modülü | YÜKSEK |
| **IR/UV preprocessing pipeline yok** — ftirEngine var ama baseline, MSC, smoothing, derivative, template zinciri yok | Mnova ElViS: Tam preprocessing | ORTA |
| **Line fitting / deconvolution yok** | Mnova: Ayrı modül | ORTA |
| **qNMR yok** | Mnova: Concentration + purity + batch | ORTA |
| **Digital JC yok** | Mnova: Coupling ayrıştırma aracı | DÜŞÜK |

### 3.3 Ürün Eksiklikleri

| Eksik | Etki |
|-------|------|
| **Multipage belge modeli yok** — Tek sayfa, tek spektrum çalışma alanı | Rapor, multi-experiment, kurumsal kullanım imkansız |
| **Layout template yok** | Standartlaştırılmış çıktı üretilemez |
| **Database browser yok** — schema.sql var ama UI/search/custom fields yok | Veri yönetimi imkansız |
| **Script/CLI/automation yok** — Scripting katmanı hiç yok | Batch otomasyon imkansız |
| **Plugin sistemi yok** | Genişletilemez platform |
| **Audit trail UI yok** — AuditTrace tipi var ama UI'da gösterilmiyor | İzlenebilirlik yok |
| **SDF browser yok** | Yapı kütüphanesi tarama yok |
| **Compounds Table yok** | Molekül-merkezli çalışma yüzeyi yok |

## 4. Hızlı Kazanımlar (Quick Wins)

1. **Tip birleştirme** — Solvent, MSPeak, Conformer tanımlarını tek kaynak haline getir
2. **Ölü import temizliği** — page.tsx ve sidebar'daki kullanılmayan import'ları sil
3. **localhost:3000 → env variable** — smilesParser.ts'deki sabit URL'yi ortam değişkenine çevir
4. **BulkInput ayrıştırma** — Mevcut refactored versiyonu ana akışa taşı
5. **FIDUploader birleştirme** — Compact versiyonu ana versiyon yap, diğerini kaldır
6. **Global state store** — Zustand ile temel state'i merkezileştir
7. **ConformerViewer ve VectorSearch'ü ana akışa bağla** — Şu an orphan bileşenler

## 5. Risk Matrisi

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| Python spawn'lar production'da kırılır | Yüksek | Kritik | WASM/browser-native alternatifler veya containerized deployment |
| Tip çoğullaması runtime hataya yol açar | Orta | Yüksek | Tek kaynak refactoring |
| Büyük bileşenler (BulkInput, useSpectralAnalysis) bakımsız kalır | Yüksek | Orta | Modüler ayrıştırma |
| 2D/stacked özellikler mevcut tip sistemiyle uyumsuz | Kesin | Kritik | Unified data model öncelikli |
| LLM hallucination bilimsel yanlış sonuç üretir | Orta | Kritik | Deterministik doğrulama katmanı zorunlu |
