# FID hata ayıklama kontrol listesi

1. **Yerel Python**: `nmrglue` kurulu mu? `scripts/fid_process.py` elle çalışıyor mu?
2. **Ham dosya**: `temp/<id>/` altında `fid` veya `ser` var mı? (`upload` yanıtı `rawPath` / `serPath`)
3. **API gövdesi**: `debug_id`, `error_code`, `processing_steps` inceleyin.
4. **Endian / boyut**: Python stderr’de bozuk binary veya uzunluk uyarıları.
5. **Klasör yapısı**: Bruker için `acqus` ve `fid`/`ser` beklenen yerde mi?
6. **Windows yolu**: boşluk, Türkçe karakter; `path.join` / normalize kullanımı.
7. **Yarış**: Tek `datasetId` ile eşzamanlı iki yükleme — çakışma için `debugId` önekli tek dosya adları kullanılır.

Kod: `app/api/fid/process/route.ts`, `lib/fid/fidErrorCodes.ts`.
