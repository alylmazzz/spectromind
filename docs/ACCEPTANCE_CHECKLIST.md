# Acceptance Checklist — SpectroMind + Spectrotester Entegrasyonu

Bu checklist, prompttaki “BİTİRİRKEN” maddelerine göre işaretlenir.

## Nasıl çalıştırırım?

1. **Chem Core (opsiyonel):**
   ```bash
   cd services/chem-core
   pip install -r requirements.txt
   python -m uvicorn main:app --host 0.0.0.0 --port 8001
   ```
2. **Next.js:**
   ```bash
   npm install
   npm run dev
   ```
3. Tarayıcı: http://localhost:3000 (ana sayfa), http://localhost:3000/simulate (simülasyon).
4. **Simülasyon:** SMILES gir (örn. `CCO`), Motor: SpectroMind Engine, “Simülasyonu Çalıştır” → 1H grafiği görünmeli.
5. **HOSE için:** Proje kökünde `venv_rdkit` kurulu ve `pip install rdkit` yapılmış olmalı (Windows: `venv_rdkit\Scripts\python.exe`).

Detay: [docs/LOCAL_DEV.md](LOCAL_DEV.md).

---

## Acceptance maddeleri

| # | Madde | Durum | Not |
|---|--------|--------|-----|
| 1 | SMILES girince engine seçimi çalışıyor | ✅ | SpectroMind / Spectrotester / Hybrid dropdown; Spectrotester henüz 501 |
| 2 | Spectrotester engine ile 1H/13C/IR/MS simülasyon grafiği oluşuyor | ⏳ | Spectrotester compat sonraki aşama; şu an sadece SpectroMind |
| 3 | SpectroMind engine ile aynı (1H grafik) | ✅ | /api/simulate → hose-predict → 1H chart |
| 4 | Hybrid overlay çalışıyor | ⏳ | İki motor çıktısı overlay için UI/API genişletilecek |
| 5 | SMILES boşsa SpectroMind default akış çalışıyor | ✅ | Ana sayfa (/): peak/formül/kütüphane + Analiz; simulate sayfası SMILES zorunlu |
| 6 | QCReport üretip UI’de gösteriyor | ⏳ | Verify servisi + QCReport sonraki aşama |
| 7 | audit_events’e run kaydı düşüyor | ⏳ | Audit/RBAC iskelet sonraki aşama |

**Açıklama:** ✅ Tamamlandı, ⏳ Planlandı / sonraki aşama.

---

## Tamamlanan deliverable’lar

- [x] Repo ağacı + mevcut servisler/UI özeti: `docs/REPO_AND_SPAWN_AUDIT.md`
- [x] Python spawn noktaları listesi ve refactor hedefleri: aynı dosyada
- [x] ADR-0001 (Tek Chem Core): `docs/ADR-0001-chem-core.md`
- [x] ADR-0002 (Rulepacks): `docs/ADR-0002-rulepacks.md`
- [x] Unified schema (TS): `packages/schemas/index.ts`
- [x] Chem Core servisi: `services/chem-core/main.py` (POST /parse-standardize, GET /health)
- [x] Chem Core proxy: `app/api/chem-core/route.ts`
- [x] Simülasyon API: `app/api/simulate/route.ts` (SMILES → chem-core + SpectroMind 1H)
- [x] Simülasyon sayfası: `app/simulate/page.tsx` (SMILES, motor, çözücü, frekans, 1H grafik)
- [x] Ana sayfadan “Simülasyon” linki: Sidebar’da
- [x] hose-predict Windows Python yolu: `getPythonPath()` kullanılıyor
- [x] LOCAL_DEV.md: çalıştırma adımları

## Sonraki aşamalar (kısa)

- Spectrotester compat: generate1H/13C/2D/MS/IR port veya servis; giriş MoleculeGraph+Features.
- Verify servisi + rulepack + QCReport UI.
- Hybrid overlay: iki motor çıktısı aynı grafikte.
- Audit/RBAC iskelet: audit_events, runs, RBAC, e-signature stub.
