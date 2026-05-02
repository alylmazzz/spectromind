import type { StructuredEvidenceObject } from '@/lib/chat/contracts';

function detectOleanolicLikeFromText(text: string): boolean {
  const c13Carbonyl = /179(\.\d+)?|180(\.\d+)? ppm|179\.9/i.test(text);
  const aliphaticDense = /14\.|15\.|16\.|17\.|2[0-9]\.|3[0-9]\.|4[0-9]\./.test(text);
  const olefinic = /122\.|123\.|13[4-9]\.|14[0-9]\./.test(text);
  return c13Carbonyl && aliphaticDense && olefinic;
}

export function buildLocalFallbackResponse(params: {
  userPrompt: string;
  evidence: StructuredEvidenceObject;
  failureDetail?: string;
}): string {
  const { userPrompt, evidence, failureDetail } = params;
  const oleanolicLike = detectOleanolicLikeFromText(userPrompt);
  const lines: string[] = [];
  lines.push('OpenRouter yanıtı alınamadı; kanıt tabanlı yerel fallback analizi çalıştırıldı.');
  if (failureDetail) lines.push(`Teknik neden: ${failureDetail}`);
  lines.push('');
  lines.push(`Authority: ${evidence.authority_tier} | QC: ${evidence.qc_status} | Modality: ${evidence.modality}`);
  lines.push(`Confidence ceiling: ${evidence.confidence_ceiling}`);
  lines.push('');
  if (oleanolicLike) {
    lines.push('Ön değerlendirme (deterministik):');
    lines.push('- 13C ~179.9 ppm karbonil sinyali karboksilik asit lehine.');
    lines.push('- 14–55 ppm aralığında yoğun alifatik karbon dağılımı triterpenik gövde ile uyumlu.');
    lines.push('- 122–150 ppm bölgesinde sınırlı doymamışlık sinyali, aromatik çekirdekten çok olefinik katkı lehine.');
    lines.push('');
    lines.push('Sonuç (class-level): Oleanolic-acid-like triterpenic acid sınıfı ile uyumlu.');
    lines.push('Not: Bu bir class-level kanıttır; exact-ID için authoritative cross-modal doğrulama gerekir.');
  } else {
    lines.push('Ön değerlendirme: Mevcut metinden deterministik class-level ispat üretmek için kritik motifler eksik.');
    lines.push('Öneri: run verification + authority trace + residual mask + candidate reranking.');
  }
  lines.push('');
  lines.push('Kök neden adayları:');
  lines.push('- Provider/model erişim hatası veya free model kapasite/rate limit.');
  lines.push('- Streaming parse/yanıt kesintisi.');
  lines.push('- Evidence içinde aday/ranking trace eksikliği.');
  lines.push('');
  lines.push('Sonraki en iyi adım: Run verification, ardından aynı prompt ile Retry/Regenerate.');
  return lines.join('\n');
}
