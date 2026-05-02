# Rule Engine vNext Migration Notu

## Mimari Degisiklikler
- `OBSERVED_QC` yeni first-class family olarak eklendi.
- Rule schema `status_on_skip` ve `OBSERVED_QC` modality ile genisletildi.
- Evaluator tarafinda `INCONCLUSIVE` ve `NOT_APPLICABLE` semantigi aktif edildi.
- Scoring tarafinda metadata penalty + observed QC confidence cap eklendi.
- Report tarafina `root_cause_analysis`, `skipped_rules_summary`, `modality_confidence_breakdown`, `provenance_summary`, `qc_summary`, `autofix_recommendations` alanlari eklendi.
- Genisletilmis katalogdaki (FORMULA/GLOBAL/1H/13C/HSQC/COSY/HMBC/NOESY/FT-IR/MS) tum rule-id'ler ruleset'e eklendi.
- Eksik kalan 80 rule-id tamamlandi ve evaluator tarafinda sessiz PASS olmadan acik status uretimi saglandi.

## Coverage Matrix (vNext)
| Family | Count |
|---|---:|
| FORMULA | 14 |
| GLOBAL | 22 |
| OBSERVED_QC | 14 |
| 1H | 34 |
| 13C | 26 |
| HSQC | 20 |
| COSY | 19 |
| HMBC | 23 |
| NOESY | 16 |
| FT-IR | 31 |
| MS | 34 |

## Backward Compatibility
- Eski rule nesneleri calismaya devam eder; yeni alanlar opsiyoneldir.
- Loader hard-break yapmaz; minimum zorunlu alanlar korunur.
- Eski input modeli (`smiles`, `formula`) ayni sekilde desteklenir.
- Yeni metadata alani gelmezse evaluator `SKIP/INCONCLUSIVE` uretir, sessiz PASS uretmez.

## Severity Semantics
- `FATAL`: fiziksel/kimyasal imkansizlik.
- `ERROR`: veri/hesaplama zinciri kritik ariza.
- `FAIL`: temel kanitin yoklugu.
- `WARN`: aciklanabilir ama uyumsuz durum.
- `INFO`: bilgilendirici iz.
- `SKIP/NOT_APPLICABLE`: onkosul veya modalite yok.
- `INCONCLUSIVE`: metadata/veri yetersizligi.

## Observed QC Politikasi
- Observed veri verilmeyen senaryoda `SKIP`.
- Observed veri verilip QC zayif ise confidence cap uygulanir.
- QC trace eksikliginde `INCONCLUSIVE` ile audit izi korunur.
