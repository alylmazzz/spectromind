# ADR-0002: Versiyonlu Rulepack (Predict / Verify)

## Durum

Kabul edildi (iskelet).

## Bağlam

Kuralların çoğunun koda gömülü olması ürünleşme, versiyon ve test için risk oluşturuyor. Spectrotester’daki QC kodları ve tahmin kuralları yaşam döngüsüne alınmalı.

## Karar

- **Predict rulepack** ve **Verify rulepack** ayrılacak.
- Kurallar mümkün olduğunca DSL/JSON rulepack’e taşınacak; versiyonlanacak ve test edilecek.
- Hedef dizin: `packages/rulepacks/predict/v1`, `packages/rulepacks/verify/v1`.
- Eşikler (T/TH ppm, coverage, HSQC assignment ratio) kod sabiti olmayacak; config’ten gelecek; her run’da config snapshot kaydedilecek.

## Sonuçlar

- Kural değişikliği kod deploy’u gerektirmez.
- Part 11 / audit için rulepack version + config snapshot izlenebilir.
