# ADR-002: Evidence Graph

**Tarih**: 2026-03-31  
**Durum**: Kabul Edildi  
**Bağlam**: Yapı tayini tek modalite ile değil, NMR+MS+IR+UV kanıtlarının birlikte değerlendirilmesiyle yapılır. Mevcut sistemde gözlem ve yorum ayrımı yok.

## Karar

`EvidenceNode` ve `AssignmentEdge` çift katmanlı bir kanıt grafiği kurulacak:

1. **EvidenceNode**: Gözlem → yorum → hipotez desteği/çelişkisi
2. **AssignmentEdge**: Spektral özellik → atom bağlantısı

Her node/edge `provenance`, `confidence` ve `quality` taşıyacak.

## Gerekçe

- Bilimsel olarak gözlem (peak) ≠ yorum (fonksiyonel grup) ≠ hipotez (yapı)
- Zayıf UV absorpsiyonu tek başına yapı kanıtı değildir — ağırlıklı kanıt sistemi şart
- Verify motoru per-test explainability için evidence breakdown'a ihtiyaç duyar
- Assignment transferi (1H→HSQC→13C) ancak graph yapısında temsil edilebilir

## Sonuçlar

- Verify her test sonucunu EvidenceNode olarak üretecek
- Prediction her tahmin-gözlem karşılaştırmasını EvidenceNode olarak üretecek
- UI EvidenceBreakdown panel gösterecek
