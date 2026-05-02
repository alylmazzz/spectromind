# FID pipeline — hata kodları

API yanıtlarında `error_code` alanı makine okunur; `user_hint` kullanıcıya kısa öneri içerir. `debug_id` günlüklerle eşleştirmek içindir.

| Kod | Anlam |
|-----|--------|
| `FID_DATASET_NOT_FOUND` | `temp/<datasetId>` yok veya yazılmadı |
| `FID_RAW_FILE_NOT_FOUND` | Klasörde `fid` veya `ser` yok |
| `FID_UPLOAD_FAILED` | Upload API genel hata |
| `FID_PYTHON_PROCESS_FAILED` | Python süreç kodu ≠ 0 |
| `FID_DEP_NMRGLUE_MISSING` | nmrglue kurulu değil |
| `FID_DEP_NUMPY_MISSING` | numpy kurulu değil |
| `FID_PARSE_OUTPUT_FAILED` | stdout’tan JSON çıkarılamadı |
| `FID_EMPTY_SPECTRUM` | ppm/intensity boş veya uzunluk uyumsuz |
| `FID_AXIS_LENGTH_MISMATCH` | ppm ve intensity nokta sayısı farklı |
| `FID_LOCAL_ONLY` | Vercel / sunucusuz ortam |
| `FID_MISSING_INPUT` | datasetId ve dosya yok |
| `FID_LOAD_FAILED` | nmrglue veri yükleme hatası |
| `FID_API_INTERNAL` | Yakalanmamış API istisnası |

Tam liste: `lib/fid/fidErrorCodes.ts`.
