# Vendor / format desteği (SpectroMind FID)

| Kaynak | Ham dosya | Durum | Not |
|--------|-----------|--------|-----|
| Bruker | `fid` (uzantısız), `ser` | **Desteklenir** | `nmrglue` ile okuma; `acqus`/`procs` metadata |
| Varian/Agilent | `fid` klasörü veya `fid` dosyası | **Kısmi** | Heuristik tespit; detaylı pulse program ayrımı sınırlı |
| JEOL | `.jdf` | **Kısmi / planlı** | Format tespiti; tam pipeline Python tarafında genişletilebilir |
| Diğer | — | **Desteklenmez** | Açık `FID_UNSUPPORTED_VENDOR` / mesaj |

Kısmi destek: veri okunabilir ancak deney tipi veya 2D görselleştirme tam değildir.  
Planlı: 2D heatmap, gelişmiş JEOL, gelişmiş Varian metadata.

İlgili: `lib/fid/formatDetector.ts`, `scripts/fid_process.py`, `docs/FID_UPLOAD_AND_PROCESSING_ARCHITECTURE.md`.
