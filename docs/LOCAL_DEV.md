# SpectroMind + Spectrotester — Yerel Geliştirme

## Hızlı başlangıç (tek komut hedefi)

Hedef: Tüm servisler + web ayağa kalksın.

```bash
# 1) Bağımlılıklar
npm install
cd services/chem-core && pip install -r requirements.txt && cd ../..

# 2) Chem Core (RDKit) — ayrı terminal
cd services/chem-core && python -m uvicorn main:app --host 0.0.0.0 --port 8001

# 3) Next.js
npm run dev
```

Tarayıcı: http://localhost:3000 — Ana sayfa. Simülasyon: http://localhost:3000/simulate

## Ortam değişkenleri

`.env.local` örneği (opsiyonel):

```env
# Chem Core (parse-standardize). Yoksa simulate API Chem Core olmadan çalışır.
CHEM_CORE_URL=http://127.0.0.1:8001

# NMR Engine (HOSE/GNN). Boşsa Next.js mevcut hose-predict route kullanır.)
NMR_ENGINE_URL=http://127.0.0.1:8002
```

## Servisler (portlar)

| Servis        | Port | Açıklama                    |
|---------------|------|-----------------------------|
| Next.js       | 3000 | UI + API routes             |
| Chem Core     | 8001 | RDKit parse-standardize     |
| NMR Engine    | 8002 | (opsiyonel) HOSE/GNN        |

## Vertical slice testi

1. Chem Core’u başlat: `cd services/chem-core && python -m uvicorn main:app --port 8001`
2. `npm run dev` ile Next.js’i başlat.
3. http://localhost:3000/simulate aç.
4. SMILES gir (örn. `CCO`), Motor: SpectroMind Engine, “Simülasyonu Çalıştır” tıkla.
5. 1H NMR grafiği ve (Chem Core açıksa) graph/features dönmeli.

## Python venv (HOSE için)

Mevcut `hose-predict` route, `venv_rdkit` içindeki Python’u kullanır (spawn). Simülasyon bu route’u çağırır.

```bash
# Windows
python -m venv venv_rdkit
venv_rdkit\Scripts\activate
pip install rdkit

# macOS/Linux
python3 -m venv venv_rdkit
source venv_rdkit/bin/activate
pip install rdkit
```

## Docker (tüm servisler — ileride)

`docker-compose.yml` / `docker-compose.v2.yml` ile chem-core, nmr-engine, web ayağa kaldırılabilir. Chem Core için örnek:

```yaml
services:
  chem-core:
    build: ./services/chem-core
    ports:
      - "8001:8001"
```

## Sorun giderme

- **Simülasyon “No 1H spectrum”:** venv_rdkit kurulu mu? `pip install rdkit` ve hose-predict’in Python path’i (getPythonPath) doğru mu?
- **Chem Core 503:** Chem Core çalışıyor mu? `curl http://127.0.0.1:8001/health`
- **Spectrotester engine 501:** Henüz sadece SpectroMind engine destekleniyor; Spectrotester compat sonraki aşamada.
