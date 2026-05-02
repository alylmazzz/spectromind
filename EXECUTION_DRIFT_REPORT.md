# Execution Drift Report — 2026-03-31

## Doğrulama Yöntemi

Önceki sprint'te iddia edilen tüm dosyalar tek tek açılıp okundu. Satır sayıları, arayüz tanımları, gerçek implementasyon kalitesi ve bağlantıları doğrulandı.

## Drift Özeti

| İddia Edilen | Gerçek Durum | Değerlendirme |
|---|---|---|
| REPO_AUDIT.md | 111 satır, gerçek içerik | ✅ Doğru |
| GAP_MATRIX.md | 184 satır, 101 yetenek satırı | ✅ Doğru |
| TARGET_ARCHITECTURE.md | 482 satır, gerçek mimari tasarım | ⚠️ Hedef doküman, gerçekleşmemiş kısımları var |
| ROADMAP.md | 115 satır, 8 faz | ✅ Doğru |
| ADR/ dizini | 12 ADR dosyası | ✅ Doğru |
| lib/core/models/ (5 dosya) | Hepsi gerçek interface + factory | ✅ Doğru |
| lib/core/audit/AuditService.ts | 130 satır, çalışır in-memory | ⚠️ Çalışır ama persist yok |
| lib/core/events/EventBus.ts | 49 satır, çalışır pub/sub | ✅ Doğru |
| lib/nmr/processing/ProcessingGraph.ts | 174 satır, çalışır sıralı pipeline | ⚠️ "Graph" adına rağmen DAG değil |
| Processing steps (6 dosya) | Apod/ZF/FFT/Phase/Baseline gerçek, Reference STUB | ⚠️ Reference placeholder |
| lib/core/store/spectromindStore.ts | 240 satır, gerçek Zustand | ⚠️ Var ama page.tsx henüz kullanmıyor |

## Kritik Drift Noktaları

### 1. Zustand Store Var Ama Bağlı Değil

`spectromindStore.ts` tam Zustand implementasyonu içeriyor: document, dataset, molecule, processing, evidence, assignment, UI state ve audit/event entegrasyonu. ANCAK `app/page.tsx` hala 14 adet `useState` ile çalışıyor. Store hiçbir bileşen tarafından import edilmiyor. Bu, store'un "iddia edilmiş ama hiçbir yere bağlı olmayan" durumda olduğu anlamına gelir.

**Etki**: P0 — store varken kullanılmaması, tüm prop drilling zincirini kaldırılamaz hale getiriyor.

### 2. ReferencingStep Placeholder

`ReferencingStep.ts` yalnızca 16 satır ve hiçbir veri dönüşümü yapmıyor. `targetPpm` parametresi alıyor ama input buffer'ı değiştirmeden geri döndürüyor. Bu, NMR iş akışında referencing yapılmadığı anlamına gelir.

**Etki**: P0 — referencing olmadan chemical shift doğruluğu kurulamaz.

### 3. Processing Graph → UI Bağlantısı Yok

ProcessingGraph çekirdeği çalışır durumda ama bunu kullanan bir UI paneli yok. Kullanıcı FID yüklediğinde `ProcessingGraph` kullanılmıyor; hala eski Python spawn akışı.

**Etki**: P1 — işleme motoru kullanılamaz durumda.

### 4. page.tsx Ölü Import ve State Sorunları

- 11 ölü import tespit edildi
- `knownMoleculeName` state'i hiçbir yerde kullanılmıyor
- `libraryMatch` ve `moleculeLibrary` state'leri JSX'te hiç render edilmiyor
- `formula` hiçbir yere geçirilmiyor (sadece hook'a)

**Etki**: P1 — teknik borç, bundle büyüklüğü, karmaşıklık.

### 5. Core Modeller ↔ Mevcut Tipler Köprüsü Yok

`NormalizedDataset`, `MoleculeRecord`, `EvidenceNode` tanımlandı ama mevcut `NMRPeak[]`, `FTIRPeak[]`, `MSPeak[]` ile aralarında bridge/adapter yok. Mevcut uygulama eski tipleri kullanmaya devam ediyor.

**Etki**: P1 — yeni modeller kullanılamaz durumda.

### 6. Phase Correction Sınırlı

Auto phase yalnızca ph0 grid search yapıyor (ph1=0 sabit). Gerçek NMR verisinde ph1 düzeltmesi gereklidir. Bu, auto phase'in çoğu vakada yetersiz kalacağı anlamına gelir.

**Etki**: P1 — bilimsel doğruluk.

### 7. Baseline "bernstein" Dalı Sahte

`BaselineCorrectionStep.ts`'de `bernstein` case'i `polynomial` ile aynı koda düşüyor. Bu yanıltıcı — kullanıcı farklı algoritma bekliyorsa aynı sonuç alır.

**Etki**: P2 — dürüstlük/doğruluk.

## Yanıltıcı "Done" Durumları

| Bileşen | İddia | Gerçek |
|---------|-------|--------|
| Zustand store | "Oluşturuldu" | Var ama hiçbir component kullanmıyor |
| ReferencingStep | "Implementasyon" | Placeholder — veri dönüşümü yok |
| Processing Graph | "Çalışır motor" | Backend çalışır ama UI yok, mevcut FID akışı kullanmıyor |
| Core models | "Çekirdek veri modeli" | Tanımlandı ama runtime'da hiçbir yerde kullanılmıyor |
| Audit trail | "Provenance backbone" | In-memory, persist yok, UI yok |

## Sağlıklı Kısımlar

| Bileşen | Durum |
|---------|-------|
| Dokümantasyon (REPO_AUDIT, GAP_MATRIX, ROADMAP, ADR) | İyi kalite |
| Domain model tipleri (5 interface) | Düşünceli tasarım |
| FFT implementasyonu | Doğru Radix-2 Cooley-Tukey |
| Apodization (4 pencere) | Bilimsel olarak doğru |
| ZeroFill | Doğru |
| EventBus | Temiz implementasyon |
| AuditService API | İyi tasarım (timed, timedAsync) |
