# ADR-006: Script Facade

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: SpectroMind'da scripting/CLI/automation katmanı yok.

## Karar

`ScriptContext` facade'ı, UI ile aynı servis katmanını script'lere açacak:
- `documents` — belge açma/kaydetme
- `nmr` — processing, peak picking, multiplet, assignment
- `ms` — EIC, match, predict
- `ir` — preprocess, peak pick
- `molecules` — registry operasyonları
- `db` — kaydet, ara, getir
- `report` — PDF, export
- `io` — dosya açma/kaydetme

## Gerekçe

- UI, CLI ve script aynı servisleri kullanmalı — aksi halde davranış tutarsızlığı
- Batch otomasyon ancak programlanabilir facade ile mümkün
- Mnova'nın scripting gücü tam olarak bu mimari üzerinde duruyor

## Sonuçlar

- Phase 5'te implementasyon
- Her servis modülü hem UI hem script'ten çağrılabilir tasarlanacak
