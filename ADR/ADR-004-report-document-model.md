# ADR-004: Report Document Model

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: SpectroMind'da rapor/belge modeli yok — tek sayfa, tek spektrum akışı var.

## Karar

Multipage `WorkspaceDocument` modeli kurulacak:
- Her belge çoklu sayfa içerir
- Her sayfa çoklu nesne (spektrum, molekül, tablo, metin, anotasyon) içerir
- Nesneler konumlandırılabilir, boyutlandırılabilir
- Layout template sistemi ile standartlaştırılabilir
- Audit trail belgeye gömülebilir

## Gerekçe

- Mnova'nın asıl gücü bu — analiz sırasında rapor canlı olarak oluşuyor
- Profesyonel/kurumsal kullanım multipage belge olmadan mümkün değil
- PDF export bu modele bağlı
- Audit trail, imza ve header/footer bu model üzerinde çalışır

## Sonuçlar

- İlk implementasyon basit page + object listesi olacak
- WYSIWYG canvas Phase 5'te gelecek
- PDF export modele bağımlı
