import type { StructuredEvidenceObject } from '@/lib/chat/contracts';

const WHY_WRONG = /neden\s+(yanlış|yanlis|hatalı|hatali)|neden.*iupac|neden.*formül|neden.*formul|kök\s+neden|kok\s+neden|root\s*cause/i;

function rootCauseFromEvidence(ev: StructuredEvidenceObject): string {
  if (ev.identity_surface?.parity_status === 'DRIFT_DETECTED') {
    return 'STRUCTURE_CARD_SOURCE_PARITY_FAILURE';
  }
  if (ev.title_source !== ev.summary_source) {
    return 'TITLE_BODY_SUMMARY_VERDICT_DRIFT';
  }
  if (ev.authority_tier === 'DISPLAY_ONLY_FALLBACK') {
    return 'FALLBACK_IDENTITY_LEAK';
  }
  if (ev.identity_surface?.exact_id_active && /inconclusive/i.test(String(ev.identity_surface.verdict_mode || ''))) {
    return 'FINAL_VERDICT_RESOLVER_MISMATCH';
  }
  if (ev.contradiction_analysis.length > 0) {
    return 'SOURCE_OF_TRUTH_DRIFT';
  }
  return 'AUTHORITY_CONTRACT_BREACH';
}

/**
 * Deterministik Türkçe şablon: LLM yokken veya ön-yanıt olarak kullanılabilir.
 */
export function buildStructuredTurkishWhyWrong(
  userPrompt: string,
  evidence: StructuredEvidenceObject
): string | null {
  if (!WHY_WRONG.test(userPrompt)) return null;
  const is = evidence.identity_surface;
  const rc = rootCauseFromEvidence(evidence);
  const lines: string[] = [];
  lines.push('### 1) Kısa cevap');
  lines.push(
    is?.exact_id_active
      ? 'Kanıt paketinde exact-ID kapısı açık; kimlik çözümlenmiş sayılır. Ekranda görünen IUPAC/formül çelişkisi çoğunlukla kaynak yüzeyi (yapı kartı vs başlık) parity ihlilidir, yeni bir bileşen keşfi değildir.'
      : 'Kimlik veya metadata yüzeyleri arasında kanıt-tabanlı olmayan bir sızıntı veya parity ihlali olasılığı yüksektir; aşağıdaki kaynak durumuna bakın.'
  );
  lines.push('');
  lines.push('### 2) Kaynak durumu');
  lines.push(
    `- authority_tier: ${evidence.authority_tier}\n- qc_status: ${evidence.qc_status}\n- confidence_ceiling: ${evidence.confidence_ceiling}\n- formula_source: ${evidence.formula_source}\n- iupac_source: ${evidence.iupac_source}\n- smiles_source: ${evidence.smiles_source}\n- structure_card_source: ${evidence.structure_card_source}`
  );
  if (is) {
    lines.push(
      `- identity_surface.final_identity_source: ${is.final_identity_source}\n- identity_surface.parity_status: ${is.parity_status}\n- identity_surface.verdict_mode: ${is.verdict_mode ?? 'n/a'}`
    );
  }
  lines.push('');
  lines.push('### 3) IUPAC neden yanlış görünüyor');
  lines.push(
    rc === 'STRUCTURE_CARD_SOURCE_PARITY_FAILURE'
      ? 'Başlık / özet ile yapı kartı farklı kimlik kanallarından beslenmiş olabilir. Uydurma IUPAC varyantı üretmeyin; final_identity_source ile hizalayın.'
      : 'IUPAC satırı evidence.iupac_source ile aynı omurgadan gelmiyorsa, önce çelişkiyi düzeltin — yeni sistematik ad uydurmayın.'
  );
  lines.push('');
  lines.push('### 4) Molekül formülü neden yanlış görünüyor');
  lines.push(
    'Formül, evidence.formula_source ve graph/valence omurgası ile çelişiyorsa, parser veya fallback sızıntısı olabilir; formülü serbest metinden türetmeyin.'
  );
  lines.push('');
  lines.push('### 5) Bu vakada doğru kimlik ne');
  const smilesLine =
    !is?.display_smiles || String(is.display_smiles).trim() === ''
      ? '—'
      : String(is.display_smiles).length > 48
        ? `${String(is.display_smiles).slice(0, 48)}…`
        : String(is.display_smiles);
  lines.push(
    is?.display_molecule
      ? `Kilitli yüzey adayı: **${is.display_molecule}**. IUPAC: **${is.display_iupac || '—'}**; formül: **${is.display_formula || '—'}**; SMILES: **${smilesLine}**.`
      : 'Exact-ID kapalıysa yalnızca sınıf-seviyesi (class-level) ifade kullanın; kesin küçük molekül adı uydurmayın.'
  );
  lines.push('');
  lines.push('### 6) Sonraki en iyi adım');
  lines.push(evidence.next_actions.slice(0, 4).map((a) => `- ${a}`).join('\n'));
  lines.push('');
  lines.push(`**Kök neden kodu (iç denetim):** \`${rc}\``);
  return lines.join('\n');
}
