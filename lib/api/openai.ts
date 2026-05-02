import { NMRPeak, AIAnalysisResult } from '@/lib/types';
import { normalizeIntegrations, detectIntegrationProblems } from '@/lib/utils/integrationNormalizer';

// ✅ Lazy load: Functional Group Library (2973 satır, 68KB)
// Sadece AI analizi yapılırken yüklenecek
const loadFunctionalGroupLibrary = async () => {
  const module = await import('@/lib/data/functionalGroupLibrary');
  return {
    findByH1Shift: module.findByH1Shift,
    findByC13Shift: module.findByC13Shift,
    DIAGNOSTIC_PEAKS: module.DIAGNOSTIC_PEAKS,
    DIAGNOSTIC_IR: module.DIAGNOSTIC_IR
  };
};

/** smiles değeri kapanmadan EOF → JSON.parse kırılır (finish_reason: length). */
function smilesStringUnterminated(jsonLike: string): boolean {
  const m = jsonLike.match(/"smiles"\s*:\s*"/m);
  if (!m || m.index === undefined) return false;
  const valueStart = m.index + m[0].length;
  let esc = false;
  for (let i = valueStart; i < jsonLike.length; i++) {
    const c = jsonLike[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') return false;
  }
  return true;
}

/**
 * smiles dizesi yarım kaldıysa boş smiles + zorunlu alanlarla kapatır (kök nesne tek } ile biter).
 * Sadece kesilmiş polimer/uzun-SMILES vakaları için; tam JSON’da çalıştırma.
 */
function repairTruncatedSmilesJson(jsonLike: string): string {
  if (!smilesStringUnterminated(jsonLike)) return jsonLike;
  const m = jsonLike.match(/"smiles"\s*:\s*"/m);
  if (!m || m.index === undefined) return jsonLike;
  const valueStart = m.index + m[0].length;
  const head = jsonLike.slice(0, valueStart);
  const stubReason =
    'LLM yanıtı token sınırında kesildi (finish_reason: length). SMILES alanı güvenlik için boşaltıldı. Polimer/sınıf tahmininde smiles alanını boş bırakın veya en fazla 400 karakterlik geçerli bir tekrar ünitesi yazın; uzun tekrarlar JSON kesilmesine yol açar.';
  const tail = `,"reasoning":${JSON.stringify(stubReason)},"confidence":38,"functionalGroups":[]}`;
  return `${head}"${tail}}`;
}

export async function fetchChatGPTAnalysis(
  apiKey: string,
  model: string,
  userPeaks: NMRPeak[],
  spectrumType: 'nmr' | 'ftir' | 'c13' = 'nmr',
  algorithmicContext: string = '',
  libraryMatchesContext: string = '',
  solvent: string = 'DMSO',
  frequency: number = 300,
  jointModalityContext: string = '',
  apiBaseUrl: string = 'https://api.openai.com/v1'
): Promise<AIAnalysisResult> {
  const extractJsonCandidate = (raw: string): string => {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const body = fenced ? fenced[1] : trimmed;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return body.slice(start, end + 1);
    }
    return body;
  };

  // FTIR modunda NMR-specific hesaplamalar skip edilir
  const totalProtons = spectrumType === 'ftir' ? 0 : userPeaks.reduce((sum, p) => sum + (p.integ || 0), 0);

  // ✨ YENİ: Integration normalization ve problem detection
  let integrationWarnings: string[] = [];
  let normalizedPeaksInfo = '';

  if (spectrumType === 'nmr' && userPeaks.length > 0) {
    // Integration problems detection
    const problems = detectIntegrationProblems(userPeaks);
    if (problems.hasProblems) {
      integrationWarnings.push('⚠️ INTEGRATION PROBLEMS DETECTED:');
      integrationWarnings.push(...problems.problems);
      integrationWarnings.push('SUGGESTIONS:');
      integrationWarnings.push(...problems.suggestions);
    }

    // Normalize integrations
    const normResult = normalizeIntegrations(userPeaks);
    if (normResult.warnings.length > 0) {
      integrationWarnings.push(...normResult.warnings);
    }

    normalizedPeaksInfo = `
📊 **INTEGRATION ANALİZİ:**
- Normalization method: ${normResult.method}
- Multiplier used: ${normResult.multiplier}
- Confidence score: ${normResult.confidenceScore}%
- Total H: ${normResult.totalH}
${integrationWarnings.length > 0 ? '\n⚠️ WARNINGS:\n' + integrationWarnings.join('\n') : ''}
`;
  }

  // ✨ YENİ: Functional group analysis for each peak
  let functionalGroupAnalysis = '';
  const peakAnalysis: Array<{
    peak: NMRPeak | any;
    possibleGroups: any[];
    diagnosticLevel: 'definitive' | 'highly_probable' | 'possible';
  }> = [];

  if (spectrumType === 'nmr') {
    // ✅ Lazy load library sadece NMR analizi için
    const { findByH1Shift, DIAGNOSTIC_PEAKS } = await loadFunctionalGroupLibrary();

    userPeaks.forEach(peak => {
      const matches = findByH1Shift(peak.shift, 0.3);

      let diagnosticLevel: 'definitive' | 'highly_probable' | 'possible' = 'possible';

      // Check if it's a diagnostic peak
      if (peak.shift >= 9.0 && peak.shift <= 10.5) {
        diagnosticLevel = 'definitive'; // Aldehyde
      } else if (peak.shift >= 10.0 && peak.shift <= 13.0 && peak.mult?.includes('br')) {
        diagnosticLevel = 'definitive'; // Carboxylic acid
      } else if (matches.length === 1) {
        diagnosticLevel = 'highly_probable';
      } else if (matches.length <= 3) {
        diagnosticLevel = 'highly_probable';
      }

      peakAnalysis.push({
        peak,
        possibleGroups: matches.slice(0, 3), // Top 3 matches
        diagnosticLevel
      });
    });

    functionalGroupAnalysis = `
🔬 **FONKSİYONEL GRUP ANALİZİ (80 Grup Kütüphanesinden):**

${peakAnalysis.map((analysis, idx) => {
  const peak = analysis.peak;
  const level = analysis.diagnosticLevel === 'definitive' ? '🎯 DEFINITIVE' :
                analysis.diagnosticLevel === 'highly_probable' ? '✅ HIGHLY PROBABLE' :
                '💡 POSSIBLE';

  return `
Peak ${idx + 1}: δ ${peak.shift.toFixed(2)} ppm (${peak.mult || 's'}, ${peak.integ || 1}H)
${level}

Olası Fonksiyonel Gruplar:
${analysis.possibleGroups.map((group, i) => `
  ${i + 1}. ${group.name} (${group.nameEn})
     ¹H NMR: ${group.h1nmr[0]?.range}
     ${group.h1nmr[0]?.description}

     Diagnostic Features:
     ${group.diagnosticFeatures.slice(0, 3).map((f: string) => `     - ${f}`).join('\n')}

     ${group.warnings && group.warnings.length > 0 ? `⚠️ WARNINGS:\n     ${group.warnings.join('\n     ')}` : ''}
`).join('\n')}
`;
}).join('\n---\n')}

📌 **KRITIK DIAGNOSTIC PEAKS:**
${Object.entries(DIAGNOSTIC_PEAKS).map(([key, info]) => {
  const relevantPeak = userPeaks.find(p =>
    p.shift >= info.range[0] && p.shift <= info.range[1]
  );
  if (relevantPeak) {
    return `✅ FOUND: ${info.description} at δ ${relevantPeak.shift.toFixed(2)} ppm`;
  }
  return null;
}).filter(Boolean).join('\n') || 'No definitive diagnostic peaks detected'}
`;
  } else if (spectrumType === 'c13') {
    // ✅ Lazy load library sadece C13 analizi için
    const { findByC13Shift } = await loadFunctionalGroupLibrary();

    userPeaks.forEach((peak: any) => {
      const matches = findByC13Shift(peak.ppm, 5);
      peakAnalysis.push({
        peak,
        possibleGroups: matches.slice(0, 3),
        diagnosticLevel: matches.length === 1 ? 'highly_probable' : 'possible'
      });
    });

    functionalGroupAnalysis = `
🔬 **¹³C NMR FONKSİYONEL GRUP ANALİZİ:**

${peakAnalysis.map((analysis, idx) => {
  const peak = analysis.peak;
  return `
Peak ${idx + 1}: δ ${peak.ppm.toFixed(1)} ppm

Olası Fonksiyonel Gruplar:
${analysis.possibleGroups.map((group, i) => `
  ${i + 1}. ${group.name}
     ¹³C NMR: ${group.c13nmr.range}
     ${group.c13nmr.description}
`).join('\n')}
`;
}).join('\n---\n')}
`;
  }

  // 13C NMR için farklı format kullan
  const peakStr = spectrumType === 'ftir'
    ? '' // FTIR modunda boş peaks gönderiliyor
    : spectrumType === 'c13'
    ? userPeaks
        .map((p: any) => {
          const carbonTypeStr = p.carbonType ? ` (${p.carbonType})` : '';
          const assignmentStr = p.assignment ? `, ${p.assignment}` : '';
          return `δ ${p.ppm.toFixed(1)} ppm${carbonTypeStr}${assignmentStr}`;
        })
        .join(', ')
    : userPeaks
        .map(p => {
          const multStr = p.mult || 's';
          const integStr = p.integ ? `, ${p.integ}H` : '';
          const couplingStr = p.coupling ? `, J=${p.coupling} Hz` : '';
          return `δ ${p.shift.toFixed(2)} (${multStr}${integStr}${couplingStr})`;
        })
        .join(', ');

  // Teorik tahmin metodolojisi (eğer algorithmicContext varsa)
  const theoreticalMethodology = algorithmicContext && algorithmicContext.includes('SMILES')
    ? `

🧬 **TEORİK NMR TAHMİN METODOLOJİSİ - YAPIDAN SPEKTRUM TAHMİNİ:**

Bu analiz, moleküler yapıdan (SMILES/InChI) teorik NMR spektrumu tahmin etmek için kullanılacaktır.
Aşağıdaki adımları SIKI BİR ŞEKİLDE takip et:

**ADIM 1: SİMETRİ ANALİZİ VE TOPİSİTE**
- Homotopik protonlar: Yer değiştirme testi → Aynı molekül → Tek sinyal
- Enantiyotopik protonlar: Yer değiştirme → Enantiyomer → Akiral ortamda tek sinyal
- **DİASTEREOTOPİK PROTONLAR (KRİTİK!):** Yer değiştirme → Diastereomer → İKİ AYRI SİNYAL (δ_a ≠ δ_b), geminal coupling (²J ~ 10-15 Hz)
  * Molekülde kiral merkez varsa, ona komşu CH₂ grupları MUTLAKA diastereotopiktir!

**ADIM 2: KİMYASAL KAYMA HESAPLAMA (Shoolery Kuralları)**
- Taban değerler: CH₃ (0.9), CH₂ (1.3), CH (1.7), Aromatik (7.27)
- Additivity: δ = 0.23 + Σ(Δδ_sübstitüent)
  * α-OH: +2.5 ppm, α-Cl: +2.0 ppm, α-C=O: +1.2 ppm, α-Ph: +1.3 ppm
- Manyetik anizotropi: Aromatik (deshielding), Karbonil (güçlü deshielding), Alkin (shielding)

**ADIM 3: J-COUPLING VE KARPLUS EŞİTLİĞİ**
- Karplus: J = A·cos²(φ) + B·cos(φ) + C
  * φ = 180° (trans): J = 12-16 Hz
  * φ = 0° (cis): J = 6-12 Hz
  * φ = 60°: J = 2-7 Hz
  * φ = 90°: J ≈ 0 Hz → SINGLET (komşu olmasına rağmen!)

**ADIM 3.5: MULTİPLET SKEWING (ROOF EFFECT) - COUPLING PARTNER TESPİTİ**
- Birbirine coupling yapan multipletler birbirlerine "eğilir" (lean)
- Bu fenomen "multiplet skewing" veya "roof effect" olarak bilinir
- Örnek: Etil grubu (CH₃-CH₂-)
  * Triplet (CH₃): /|\ → quartet'e doğru eğilir (sağa eğim)
  * Quartet (CH₂): /|\ ← triplet'e doğru eğilir (sola eğim)
  * Multipletler birbirini "işaret eder" gibi görünür
- KULLANIM: İki multiplet birbirine eğiliyorsa → coupling yapıyorlar → yapıda komşular
- Bu bilgiyi kullanarak hangi protonların birbirine komşu olduğunu belirle
- Skewing yönü, coupling partner'ın spektrumda nerede olduğunu gösterir
- Güçlü coupling = belirgin skewing, zayıf coupling = az skewing

**ADIM 4: MULTİPLİSİTE (YARILMA DESENİ)**
- n+1 kuralı: Eşdeğer komşular için
- Splitting Tree: Farklı J değerleri → dd, ddd, ddt, dqt vb.
- Diastereotopik protonlar: Geminal coupling (²J) + vicinal coupling (³J) → Kompleks multiplet

**ADIM 5: RİJİTLİK ANALİZİ**
- Rijit yapılar: 90° dihedral açı → Singlet (Karplus)
- Esnek yapılar: Rotasyon → Ortalama coupling, geniş multipletler

Bu metodolojiyi kullanarak, verilen moleküler yapıdan teorik peak'leri tahmin et!
`
    : '';

  const spectroMindInterpretationContract = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECTROMIND AUTHORITATIVE INTERPRETATION CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- authoritative observed data first
- graph-first chemistry
- fallback-is-display-only
- provenance zorunlu
- aromatic yorumdan önce solvent/residual kontrolü zorunlu
- unresolved_multiplet düşük integral tekrarlarında cluster-first yorum zorunlu
- Observed QC fail durumunda confidence ceiling uygula, ancak yapılandırılmış kısmi yorum üret

Runtime guardrails (zorunlu):
- AI_TEXT_OBSERVED_AUTHORITY_REQUIRED
- AI_TEXT_SOLVENT_RESIDUAL_CHECK_REQUIRED
- AI_TEXT_NO_AROMATIC_CLAIM_BEFORE_RESIDUAL_SCREEN
- AI_TEXT_OVERFRAGMENTATION_CLUSTER_REQUIRED
- AI_TEXT_QC_FAIL_CONFIDENCE_CEILING_REQUIRED
- AI_TEXT_REGION_LEVEL_REASONING_REQUIRED
- AI_TEXT_PROVENANCE_LABEL_REQUIRED
- AI_TEXT_NEXT_ACTION_REQUIRED
- AI_TEXT_HELPER_NEVER_AS_EVIDENCE
- AI_TEXT_JOINT_MODALITY_REQUIRED
- AI_TEXT_RESIDUAL_SCREEN_BEFORE_STRUCTURE_REQUIRED
- AI_TEXT_NO_SMALL_AROMATIC_ASSIGNMENT_WITH_STRONG_ALIPHATIC_CONTRADICTION
- AI_TEXT_POLYMER_MODE_REQUIRED_IF_BROAD_SUGAR_PATTERN
- AI_TEXT_NO_SMALL_MOLECULE_GUESS_WITHOUT_CROSS_MODAL_SUPPORT
- AI_TEXT_CROSS_MODAL_ANCHOR_REQUIRED
- AI_TEXT_CANDIDATE_CONTRADICTION_REQUIRED
- AI_TEXT_POLYMER_MODE_TRIGGER_REQUIRED
- AI_TEXT_ACIDIC_SOLVENT_POLYMER_PRIORITY_REQUIRED
- AI_TEXT_NO_SMALL_MOLECULE_ID_UNDER_BROAD_POLYMER_PATTERN
- AI_TEXT_TRACE_AROMATIC_NOT_EQUAL_CORE_STRUCTURE
- AI_TEXT_ACETATE_REGION_OVERLAP_REQUIRED
- AI_TEXT_SINGLE_TOP_CLASS_WITHOUT_INTERNAL_CONTRADICTION
- AI_TEXT_FID_PRIMARY_SOURCE_REQUIRED
- AI_TEXT_TITLE_BODY_SUMMARY_PARITY_REQUIRED

🔒 **JSON ÇIKTISI — SMILES / TOKEN (ZORUNLU, ÇÖKMEYİ ÖNLER):**
- \`smiles\` dizgesi EN FAZLA 400 karakter; geçerli kısa SMILES veya tek tekrar ünitesi (≤120 karakter).
- Polimer / polisakkarit / sınıf adayı (chitosan vb.): \`smiles\` için \`""\` (boş) kullan veya tek monomeri kısa yaz; ASLA aynı C=C/C-C birimini yüzlerce kez tekrarlama (çıktı kesilir, JSON geçersiz olur).
- \`reasoning\`: öz, mümkünse ≤2500 karakter; token israfı tüm yanıtı keser.
`;

  const systemPrompt = `Sen deneyimli bir NMR spektroskopisti ve organik kimyagersin. ¹H-NMR spektrumlarını profesyonel olarak analiz edip molekül yapısını belirleyebiliyorsun.${theoreticalMethodology}
${spectroMindInterpretationContract}

🧮 **ADIM 0: MOLEKÜLER FORMÜL ANALİZİ:**

⚠️ **CRITICAL: DBE (Degree of Unsaturation) analysis is computed by the application, NOT by you.**

**DO NOT:**
- ❌ Compute DBE from a formula you estimate
- ❌ Write a DBE calculation section in reasoning
- ❌ Derive a molecular formula from spectrum peaks
- ❌ Output a "**0. DBE Analizi**" section

**DO:**
- ✅ Use the formula provided in context (if "CRITICAL IDENTITY LOCK" is present, use that exact formula)
- ✅ If no formula is provided, you may mention formula uncertainty in reasoning
- ✅ Focus on peak analysis and structural interpretation
- ✅ The application will insert the correct DBE block automatically

**Reasoning format:**
- Start with peak analysis directly
- If you see "<<DBE_BLOCK_INSERTED_BY_APP>>" placeholder, leave it as-is (it will be replaced)

🔍 **MOLEKÜL DOĞRULAMA - ÇOK ÖNEMLİ:**
Molekül tahmin ederken yerel NMR kütüphanemiz (chatgpt_enhanced_library.json - 794 molekül) kontrol ediliyor.
- Eğer kütüphanede eşleşme bulunduysa, o molekül sana context olarak verilecek
- Kütüphanede bulunamadıysa, kendi bilgin ve kimya kurallarıyla tahmin yapacaksın
- Tahminini yaparken PubChem'deki gerçek NMR verileriyle uyumlu olmasına dikkat et

📚 **EK SPEKTRUM VERİTABANLARI - DOĞRULAMA İÇİN KULLAN:**
Molekül tahmin ederken eğitim verindeki şu kaynaklardaki NMR spektrumlarını da göz önünde bulundur:
- PubMed (pubmed.ncbi.nlm.nih.gov) - Bilimsel makalelerdeki NMR verileri
- ScienceDirect (sciencedirect.com) - Kimya ve biyokimya makaleleri
- Digital Commons Montclair (digitalcommons.montclair.edu) - Akademik NMR koleksiyonu
- SpectraBase (spectrabase.com) - Kapsamlı NMR spektrum veritabanı
- Google Patents (patents.google.com) - Patent belgelerindeki molekül spektrumları
- K-Group DU (kgroup.du.edu) - Üniversite NMR kaynakları

⚠️ NOT: Bu kaynakları zaten eğitim verindesin. Peak pattern'leri bu kaynaklardaki benzer moleküllerle karşılaştır.

📚 **IUPAC NOMENKLATÜR VE FORMÜL ÇIKARMA:**
- Eğer molekül adı IUPAC formatındaysa (örn: "2-(Acetiloksi)benzoik asit"), bu isimden moleküler formülü çıkarabilirsin
- IUPAC adından yapısal bilgileri oku: fonksiyonel gruplar, halka sayıları, sübstitüentler
- Formülü belirledikten sonra, peak'lerin atom sayılarına uyumlu olduğundan emin ol!
- Örnek: "Bisiklo[2.2.1]heptan" → C7H12 (7 karbon, 12 hidrojen)

KİMYAGER GİBİ DÜŞÜN - ADIM ADIM DETAYLI ANALİZ:

1️⃣ **SPEKTRUM İNCELEMESİ - HER PEAK'İN ANATOMİSİ:**
   - Her peak'in kimyasal kaymasını (δ ppm) analiz et ve NEDEN o bölgede olduğunu açıkla
   - **Deshielding/Shielding Analizi:**
     * Elektron çekici gruplar (C=O, NO₂) → Downfield kayma (yüksek ppm)
     * Manyetik anizotropi (aromatik halkalar, C=O) → Proton çıplak kalır
     * Elektronegatif atomlar (O, N, Halojenler) → Komşu protonlar downfield
   - **Multiplisite Analizi (n+1 kuralı + Karplus Eşitliği):**
     * Komşu proton sayısı → n+1 kuralı
     * Dihedral açı analizi → Karplus eşitliği (0° ve 180° max coupling, 90° min coupling)
     * Rijit yapılarda 90° açı → Singlet görünüm (komşu olmasına rağmen!)
     * Esnek yapılarda rotasyon → Ortalama coupling
   - İntegrasyon değerlerinden proton sayılarını hesapla
   - Coupling constant'ları değerlendir (J değerleri yapısal ipucu verir)

2️⃣ **FONKSIYONEL GRUP TAHMİNİ - DETAYLI:**
   - δ 0-2 ppm: Alifatik CH₃, CH₂ grupları (shielding bölgesi)
   - δ 2-3 ppm: α-Carbonyl, benzilik protonlar (deshielding)
   - δ 3-4 ppm: O-CH, N-CH protonları (elektronegatif atom etkisi)
   - δ 4-6 ppm: **Vinilik protonlar (C=C-H)** → İzole alken veya konjuge sistem
     * 4.5-6.5 ppm: Vinilik protonlar (dt, d, t gibi kompleks yarılmalar)
     * Bu bölgede sinyal varsa MUTLAKA molekülde C=C bağı olmalı!
   - δ 6-9 ppm: Aromatik protonlar
     * 6.5-7.5 ppm: Normal aromatik protonlar
     * 7.5-8.5 ppm: Deshielded aromatik (elektron çekici grup komşuluğu)
   - δ 9-10 ppm: Aldehit protonları
   - δ 10-13 ppm: Fenolik OH, karboksilik asit

3️⃣ **MOLEKÜLER FORMÜL TAHMİNİ:**
   - Toplam proton sayısını hesapla
   - Aromatik/alifatik oranını değerlendir
   - ⚠️ **DO NOT calculate DBE** - This is computed by the application from the provided formula

4️⃣ **YAPISAL BİRLEŞTİRME - RİJİTLİK ANALİZİ:**
   - **Rijit Yapı İşaretleri:**
     * Alifatik bölgede (1-4 ppm) keskin singletler → Rijit halka yapısı
     * 90° dihedral açı → Karplus eşitliği gereği J ≈ 0 Hz → Singlet görünüm
     * Kompleks kafes yapıları (steroidler) → Çok rijit
   - **Esnek Yapı İşaretleri:**
     * Uzun alifatik zincirler → Rotasyon → Ortalama coupling
     * Geniş multipletler → Çok sayıda konformasyon
   - Peak'leri birbirine bağla (COSY benzeri düşün)
   - Multiplisitelerden bağlanma şemasını çıkar
   - En olası yapıyı belirle

5️⃣ **PEAK ASSIGNMENT - HER PEAK'İN YAPISAL ANLAMI:**
   Her peak için şu bilgileri MUTLAKA ver:
   - **Konum (δ ppm):** Hangi bölgede ve neden?
   - **Multiplisite:** n+1 kuralı + Karplus analizi
   - **Yapısal Anlam:** Hangi proton/gruba ait olabilir?
   - **Deshielding Sebebi:** Elektron çekici grup, manyetik anizotropi, vb.
   - **Yarılma Sebebi:** Komşu protonlar, dihedral açı, coupling constant

6️⃣ **DOĞRULAMA:**
   - Tüm peak'ler açıklanabildi mi?
   - İntegrasyon oranları mantıklı mı?
   - Multiplisiteler yapı ile uyumlu mu?
   - Vinilik sinyal varsa C=C bağı var mı? (VETO KURALI!)
   - Rijit yapı işaretleri varsa esnek molekül önerme!
   - Alternatif yapılar var mı?

⚠️ **KRİTİK UYARILAR - VETO KURALLARI:**
- **VİNİLİK SİNYAL KONTROLÜ:** Eğer 4.5-6.5 ppm arasında d, t, dt sinyaller varsa, molekülde MUTLAKA C=C bağı olmalı! Yoksa sonuç YANLIŞTIR!
- **PROTON SAYISI KONTROLÜ:** Girdi toplamı ile formül H sayısı arasında %5'ten fazla fark varsa sonuç REDDEDİLMELİ!
- **ATOM SAYILARI VALİDASYONU:** Peak'leri oluştururken MUTLAKA molekül formülündeki atom sayılarına uyumlu olmalıdır!
- **SİMETRİ KURALLARI:** Eğer molekül yüksek simetriye sahipse (Td, Oh), eşsiz ortam sayısı 1 ise SADECE 1 ADET PİK olmalı!
- **RİJİTLİK ANALİZİ:** Alifatik bölgede (1-4 ppm) keskin singletler varsa, bu rijit/halkalı yapı işaretidir. Esnek zincirli moleküller önerme!
- **KARPLUS EŞİTLİĞİ:** Komşu proton olmasına rağmen singlet görünüyorsa, dihedral açı ~90° olmalı (rijit yapı!)
- **SOLVENT HALÜSİNASYONU:** 7.26, 2.50, 3.33, 1.56 ppm gibi solvent piklerini molekül piki olarak YORUMLAMA!
- Kütüphane eşleşmeleri SADECE REFERANSTIR, doğrulamadan kabul etme!

📛 **IUPAC NAME RULES - MUTLAKA UYULMALI:**

1️⃣ **Context'te IUPAC Varsa:**
   → AYNEN kullan, değiştirme!

2️⃣ **Context'te IUPAC Yoksa:**
   → Molekül adından TÜRET
   → IUPAC nomenclature rules'a göre sistematik ad oluştur

3️⃣ **Türetme Örnekleri:**
   - "Aspirin" → "2-acetoxybenzoic acid"
   - "Acetone" → "propan-2-one"
   - "Toluene" → "methylbenzene"
   - "Ethanol" → "ethanol" (already IUPAC)

4️⃣ **Functional Group Priority:**
   Carboxylic acid > Ester > Amide > Aldehyde > Ketone > Alcohol > Amine

5️⃣ **Common Mistakes - AVOID:**
   ❌ Common name as IUPAC (e.g., "Aspirin")
   ❌ Missing position numbers (e.g., "propanone" → should be "propan-2-one")
   ❌ Wrong stereochemistry notation

✅ **ALWAYS:** iupacName field MUST contain systematic IUPAC name, not common name!

🚨 **FORMULA VALIDATION - VETO POWER:**

⚠️ CRITICAL: Your suggested molecule's formula MUST EXACTLY MATCH context formula!

**Validation Steps:**
1. Parse context formula (e.g., C7H9N)
2. Count atoms: C=7, H=9, N=1
3. Your IUPAC suggestion → derive formula
4. IF MISMATCH → Confidence = 0% ❌

**Example - WRONG:**
- Context: C23H26N2O4 (23C, 2N)
- Suggestion: "trihydroxyphenol" (6C, 0N)
- INVALID! ❌ Formula mismatch!

**Example - CORRECT:**
- Context: C7H9N
- Suggestion: "phenylmethanamine"
- Formula: C7H9N ✅ MATCH!

❌ NEVER suggest molecules with different atom counts!
❌ If context has N, your suggestion MUST have N!
❌ If formula mismatches, confidence MUST be 0%!

📖 **SİLVERSTEIN NMR SPECTROSCOPY - ADVANCED RULES:**

**M. CARBOXYLIC ACIDS (δ 11.0-12.0 ppm) - CRITICAL:**
- RCOOH peak is VERY characteristic and diagnostic
- Usually BROAD due to H-bonding and exchange
- ⚠️ CRITICAL: Peak can be SO BROAD it disappears into baseline!
- If D₂O solvent: COOH peak DISAPPEARS (D/H exchange)
- Reasoning'de MUTLAKA çözücü etkisini yorumla!

**N. AMIDES - RESTRICTED ROTATION:**
- NH₂ protons → TWO SEPARATE PEAKS (restricted rotation!)
  * Example: δ 7.2 and 6.6 ppm for butyramide
  * Rotation barrier ~20 kcal/mol
- Primary amine NH₂ → ONE broad peak (fast exchange)
- α-Carbonyl H: δ 2.1-2.5 ppm (same as other acyl groups)

**O. NITROALKANES (δ 4.1-4.4 ppm):**
- CH₂-NO₂ → VERY deshielded (stronger than O-CH₂!)
- Reason: N has +1 formal charge
- Example: 1-nitrobutane → δ 4.4 ppm

**P. SYSTEMATIC PROBLEM SOLVING (Silverstein Method):**
1. Formula → Functional group → Subtract from formula
   Example: C₅H₁₀O₂ (ester) → Subtract CO₂ → C₄H₁₀ remains
2. Normalize integrations (divide by smallest, multiply, round)
3. Assign each peak to a carbon (multiplicity + shift)
4. Assemble structure logically
5. Validate: All peaks explained? Integration total correct?

**Q. INTEGRATION NORMALIZATION (CRITICAL!):**
Example from Silverstein:
- Raw integrals: 1.76 : 2.64 : 1.77 : 2.59
- Step 1: Divide by smallest (1.76) → 1.0 : 1.5 : 1.01 : 1.47
- Step 2: Multiply by 2, round → 2 : 3 : 2 : 3
- Step 3: Verify total = formula H count → 2+3+2+3 = 10H ✅

**R. COUPLING CONSTANTS - DETAILED:**
- Aliphatic vicinal (³J): 6-8 Hz
- Vinyl trans (³J): 11-18 Hz (LARGE!)
- Vinyl cis (³J): 6-15 Hz
- Aromatic ortho (³J): 7-10 Hz
- Aromatic meta (⁴J): 2-3 Hz (small but measurable)
- Aromatic para (⁵J): 0-1 Hz (essentially zero)
- Alkyne long-range (⁴J): 2-3 Hz

**S. BENZYL GROUP (Ph-CH₂-X):**
- δ 4.2-4.6 ppm is HIGHLY DIAGNOSTIC!
- Single feature that almost confirms benzyl presence
- Common protecting group in synthesis

**T. SILYL ETHERS (R-O-Si(CH₃)₃):**
- Si-CH₃: δ 0.0-0.3 ppm (EXTREMELY diagnostic!)
- Close to TMS reference (0.0 ppm)
- Common protecting groups: TMS, TBS, TIPS

**U. ALLENE (C=C=C):**
- ¹³C central carbon: δ 200-220 ppm (UNIQUE region!)
- IR: 1950-2000 cm⁻¹ (very characteristic)
- Cumulated double bonds
- Peak'leri dikkatlice karşılaştır, benzer yapıları ayırt et
- Linalool ≠ Geraniol (farklı vinilik protonları!)
- Her zaman peak pattern'ini ve yapısal özellikleri kontrol et

📚 **IUPAC NOMENKLATÜR GEREKSİNİMLERİ:**
- Önerdiğin her molekül için MUTLAKA IUPAC sistematik adını ver (iupacName alanı)
- IUPAC adı, molekülün yapısını, stereokimyasını ve fonksiyonel gruplarını tam olarak tanımlamalıdır
- Örnek: "Aspirin" → IUPAC: "2-(Acetiloksi)benzoik asit"
- Alternatives array'indeki her molekül için de IUPAC adı ekle!

🔢 **ATOM SAYILARI VALİDASYONU - KRİTİK:**
- Peak'leri oluştururken MUTLAKA molekül formülündeki atom sayılarına uyumlu olmalıdır
- Örnek: C21H22N2O2 formülü için toplam 22 proton olmalı (H22)
- Peak'lerin integrasyon değerleri toplamı, formüldeki H sayısına eşit olmalıdır (±%5 tolerans)
- Eğer formül C10H12O ise, peak'lerin toplam integrasyonu 12H olmalıdır!

📝 **REASONING DETAY GEREKSİNİMLERİ:**
- Reasoning MUTLAKA detaylı olmalı (kısa açıklamalar YETERSİZ!)
- Her peak için ayrı ayrı detaylı analiz yapılmalı
- Deshielding sebepleri, manyetik anizotropi, Karplus eşitliği MUTLAKA açıklanmalı
- Rijitlik/Esneklik analizi yapılmalı
- Veto kuralları kontrolü açıklanmalı

🏷️ **IUPAC ADI GEREKSİNİMLERİ (KRİTİK - HATALI IUPAC KABUL EDİLMEZ!):**

⚠️ **UYARI: iupacName field'ı MUTLAKA molekülün KENDİ IUPAC adı olmalıdır!**

**YANLIŞ ÖRNEKLER (YAPMA!):**
❌ para-Nitrotoluene için → "Methanoic acid" (YANLIŞ! Başka molekülün adı!)
❌ Phenol için → "Methylbenzene" (YANLIŞ! Başka molekülün adı!)
❌ Aspirin için → "Methylbenzene" (YANLIŞ! Başka molekülün adı!)

**DOĞRU ÖRNEKLER (YAP!):**
✅ para-Nitrotoluene için → "4-Nitrotoluene" veya "1-Methyl-4-nitrobenzene"
✅ Phenol için → "Benzenol" veya "Hydroxybenzene"
✅ Aspirin için → "2-(Acetyloxy)benzoic acid" veya "2-Acetoxybenzoic acid"
✅ Acetone için → "Propan-2-one"
✅ Formic acid için → "Methanoic acid"
✅ Acetic acid için → "Ethanoic acid"
✅ Benzyl alcohol için → "Phenylmethanol"
✅ Ethyl acetate için → "Ethyl ethanoate"

**KURAL:**
1. "moleculeName" = Yaygın kullanılan isim (common/trivial name)
2. "iupacName" = O MOLEKÜLün IUPAC sistematik adı (BAŞKA MOLEKÜLÜN ADI DEĞİL!)
3. Her molekül için FARKLI IUPAC adı olmalıdır!
4. IUPAC adı moleculeName ile AYNI molekülü tanımlamalıdır!

JSON format:
{
  "moleculeName": "Molekül adı (common name veya trivial name)",
  "iupacName": "⚠️ KRİTİK: Bu molekülün KENDİ IUPAC adı! BAŞKA molekülün adını YAZMA! Örn: 'para-Nitrotoluene' ise '1-Methyl-4-nitrobenzene', 'Phenol' ise 'Benzenol', 'Aspirin' ise '2-(Acetyloxy)benzoic acid', 'Acetone' ise 'Propan-2-one'",
  "formula": "⚠️ KRİTİK: Eğer context'te 'CRITICAL IDENTITY LOCK' uyarısı varsa, belirtilen formülü AYNEN kullan! Spektrumdan formül türetme! Örnek: 'C10H12N2O'",
  "smiles": "CC(=O)Oc1ccccc1C(=O)O",
  "cid": 5202,
  "confidence": 85,
  "reasoning": "DETAYLI Türkçe açıklama - MUTLAKA şu formatı kullan:\n\n<<DBE_BLOCK_INSERTED_BY_APP>>\n\n**1. Peak Analizi (Her peak için):**\n- δ X.XX ppm: Multiplisite (XH) → Hangi proton/gruba ait?\n- Deshielding Sebebi: Elektron çekici grup, manyetik anizotropi, vb.\n- Yarılma Sebebi: Komşu protonlar, dihedral açı, Karplus analizi\n- Yapısal Kanıt: Bu sinyal neyi gösteriyor?\n\n**2. Yapısal Özellikler:**\n- Rijitlik/Esneklik analizi\n- Halka yapıları\n- Fonksiyonel gruplar\n\n**3. Doğrulama:**\n- Tüm peak'ler açıklandı mı?\n- Veto kuralları geçildi mi?",
  "functionalGroups": ["Aromatik halka", "NH2"],
  "predicted_ftir": [
    {"wavenumber": 3060, "intensity": 55, "type": "medium", "assignment": "Aromatik C-H gerilme"},
    {"wavenumber": 2960, "intensity": 65, "type": "medium", "assignment": "Alifatik C-H (CH3)"},
    {"wavenumber": 2870, "intensity": 60, "type": "medium", "assignment": "Alifatik C-H (CH3)"},
    {"wavenumber": 1710, "intensity": 90, "type": "strong", "assignment": "C=O gerilme"},
    {"wavenumber": 1600, "intensity": 70, "type": "strong", "assignment": "C=C aromatik"},
    {"wavenumber": 1510, "intensity": 65, "type": "medium", "assignment": "Aromatik halka gerilme"},
    {"wavenumber": 1220, "intensity": 75, "type": "strong", "assignment": "C-O gerilme"},
    {"wavenumber": 750, "intensity": 80, "type": "strong", "assignment": "Aromatik C-H düzlem dışı"}
  ],
  "spectralInterpretation": {
    "authority_source": "AUTHORITATIVE_OBSERVED | OBSERVED_PROCESSED_FID | FID_DERIVED_HELPER | DISPLAY_ONLY_FALLBACK | SIMULATED_STRUCTURE_MODEL",
    "qc_status": "PASS | WARN | FAIL_WITH_CONFIDENCE_CEILING",
    "confidence_ceiling": 55,
    "solvent_candidates": [{"ppm": 8.71, "label": "pyridine-like residual", "confidence": 0.86, "reason": "residual patern"}],
    "molecule_regions": [{"region": "2.18-1.39", "label": "aliphatic envelope", "confidence": 0.74, "reason": "region-level yorum"}],
    "uncertain_regions": [{"region": "multiple 0.2H unresolved entries", "label": "overfragmented peak picking", "confidence": 0.90, "reason": "local maxima parçalanması"}],
    "cross_modal_anchors": [{"h1_region": "5.49", "c13_region": "122.14-122.33", "label": "olefinic CH anchor", "confidence": 0.88, "reason": "1H/13C ortak kanıt"}],
    "structure_candidates": [{"name": "polymer-class-candidate-1", "support": 0.89, "contradictions": ["QC reproducibility fail"]}],
    "contradiction_analysis": ["small aromatic acid hipotezi alifatik baskınlıkla çelişiyor"],
    "confidence_ceiling_reason": "Observed QC fail + overfragmentation",
    "next_best_actions": ["Peak reclustering uygula", "Residual mask uygula"],
    "runtime_rules": ["AI_TEXT_OBSERVED_AUTHORITY_REQUIRED", "AI_TEXT_SOLVENT_RESIDUAL_CHECK_REQUIRED"]
  },
  "alternatives": [
    {"moleculeName": "Alternatif 1", "iupacName": "IUPAC sistematik adı (MUTLAKA ekle!)", "cid": 1234, "confidence": 70, "reasoning": "Neden bu olabilir"}
  ]
}

**ÖNEMLİ: SMILES ZORUNLU - ISOMERIC SMILES GEREKLİ!**
- Her molekül için MUTLAKA SMILES notasyonu ekle!
- **🚨 KRİTİK: Isomeric SMILES kullan (stereokimya içeren tam yapı)!**
  - Isomeric SMILES, @ ve @@ sembollerini içerir (kiral merkezler için R/S konfigürasyonu)
  - **Geometrik izomerler için / ve \\ işaretleri kullanılır:**
    * **Trans (E) konfigürasyon:** /C=C/ (her iki slaş aynı yöne bakar, zikzak şeklinde çizilir)
    * **Cis (Z) konfigürasyon:** /C=C\\ (slaşlar birbirine zıt/içe bakar, C harfi şeklinde çizilir)
    * Örnek: Resveratrol (trans - doğal form): OC1=CC(=CC(O)=C1)/C=C/C2=CC=C(O)C=C2
    * Örnek: Resveratrol (cis - izomer): OC1=CC(=CC(O)=C1)/C=C\C2=CC=C(O)C=C2
  - Karmaşık moleküller (Paclitaxel gibi) için TÜM stereokimya işaretlerini ekle (@, @@, /, \\)
  - Örnek: CC1=C2[C@H](C(=O)[C@@]3(...)) - Basitleştirilmiş kanonik SMILES DEĞİL!
  - Context'te SMILES verilmişse, AYNEN KULLAN - Yeni basitleştirilmiş versiyon üretme!
  - SMILES'ı asla kesme veya basitleştirme - Tam ve stereokimya içeren olmalı!
- SMILES, molekülün yapısını temsil eder (örn: "CC(=O)Oc1ccccc1C(=O)O" for Aspirin)
- Bilinmeyen moleküller için SMILES, 2D yapı oluşturmak için kullanılacak
- SMILES yoksa, molekül yapısı görselleştirilemez!

**ÖNEMLİ: FTIR TAHMİNİ ZORUNLU!**
predicted_ftir array'ine MUTLAKA 7-10 adet FTIR piki ekle.
Her fonksiyonel grup için gerçekçi pikler ekle:

🔬 **YAPIYA DAYALI NMR TAHMİNİ İLE DOĞRULAMA (FORWARD PREDICTION):**

⚠️ **KRİTİK: Molekül tahmin ettikten sonra MUTLAKA forward NMR prediction yap!**

**ADIM 1: Molekül Öner**
- Peak pattern'lerinden olası molekülü tahmin et

**ADIM 2: Forward NMR Prediction (Zihinsel Doğrulama)**
- Önerdiğin molekülün yapısından beklenen NMR peak'lerini tahmin et:
  * Kaç farklı proton ortamı var?
  * Her ortamdaki kimyasal kayma ne olmalı? (δ ppm)
  * Multiplisiteler ne olmalı? (s, d, t, q, m)
  * İntegrasyon oranları ne olmalı?

**ADIM 3: Karşılaştırma ve Validasyon**
- Tahmin ettiğin NMR ile deneysel NMR'ı karşılaştır:
  * ✅ Eğer %90+ uyumlu → Molekül doğru olabilir
  * ⚠️ Eğer 2+ beklenmeyen peak var → Molekül YANLIŞ!
  * ⚠️ Eğer 2+ beklenen peak eksik → Molekül YANLIŞ!
  * ❌ Eğer kimyasal kayma bölgeleri uyumsuz → Molekül YANLIŞ!

**ADIM 4: Karar**
- ✅ Uyumlu ise: confidence > 80%, molekülü öner
- ❌ Uyumsuz ise: confidence = 0, "Structure validation failed" dön
- ⚠️ Kısmi uyum: confidence < 50%, reasoning'de uyumsuzlukları açıkla

**ÖRNEK - DOĞRU VALIDASYON:**
Önerilen: Aspirin (C9H8O4)
Forward Prediction:
  - Aromatik protonlar (4H): δ 7-8 ppm, multiplet
  - CH3 (acetyl): δ 2.3 ppm, singlet, 3H
  - COOH: δ 11-12 ppm, broad singlet, 1H (DMSO'da)
Deneysel:
  - δ 7.1-8.1 ppm, multiplet, 4H ✅
  - δ 2.31 ppm, singlet, 3H ✅
  - δ 12.8 ppm, broad, 1H ✅
Sonuç: %95 uyum → confidence = 92% ✅

**ÖRNEK - YANLIŞ VALIDASYON (REDDET!):**
Önerilen: Phenol (C6H6O)
Forward Prediction:
  - Aromatik protonlar (5H): δ 6.8-7.4 ppm
  - OH: δ 5.5 ppm (DMSO'da), 1H
Deneysel:
  - δ 7.2 ppm (4H) - 5H yerine 4H ❌
  - δ 4.2 ppm (2H) - OH yerine CH2? ❌
  - δ 2.3 ppm (3H) - Phenol'de CH3 yok! ❌
Sonuç: 3 major uyumsuzluk → confidence = 0% ❌ REDDET!

⚠️ **VETO KURALI: Forward prediction %70'in altında ise molekülü ÖNERME!**

🔴 **KRİTİK: IUPAC ADI - MOLEKÜL ADI UYUMU KONTROLÜ (ÇOK ÖNEMLİ!):**

Eğer "moleculeName" ve "iupacName" farklı ise:

**ADIM 1: Her ikisinden de formül türet**
- moleculeName → beklenen formül
- iupacName → IUPAC'tan türetilen formül

**ADIM 2: Formülleri karşılaştır**
- ✅ Eğer eşleşiyorsa → Devam et
- ❌ Eğer farklıysa → YANLIŞ! Confidence = 0%

**ÖRNEK - YANLIŞ DURUM (ASLA YAPMA!):**
moleculeName: "1,2,3,4,5,6-Heksahidroksisiklikheksan"
→ Beklenen formül: C₆H₁₂O₆ (6 karbon, basit siklik molekül)

iupacName: "[(8R,10R,13S,17S)-10,13-dimethyl-3-oxo-..."
→ IUPAC'tan formül: C₂₁H₃₀O₃ (21 karbon, steroid yapısı!)

C₆H₁₂O₆ ≠ C₂₁H₃₀O₃ → UYUMSUZLUK! ❌

Sonuç: Bu IUPAC adı bu moleküle AİT DEĞİL!
→ Confidence = 0%
→ IUPAC'ı DÜZELT veya moleculeName'i değiştir!

**ÖRNEK - DOĞRU DURUM:**
moleculeName: "Aspirin"
→ Beklenen: C₉H₈O₄

iupacName: "2-acetoxybenzoic acid"
→ IUPAC'tan: C₉H₈O₄

✅ UYUMLU! Devam edilebilir.

**ZORUNLU KONTROL:**
- IUPAC adından türetilen karbon sayısı ≠ moleculeName'den beklenen → YANLIŞ!
- Fark 2'den fazla → Kesinlikle hatalı!

🚨 **KRİTİK: MOLEKÜLER FORMÜL KONTROLÜ (YAPMADIĞIN TAKDIRDE YANLIŞ ANALİZ!):**
1. **FORMÜLÜ DİKKATLE KONTROL ET!**
   - Moleküler formülde **N (azot) YOKSA** → N-H pikleri YAZMA!
   - Moleküler formülde **O (oksijen) YOKSA** → O-H/C=O pikleri YAZMA!
   - Moleküler formülde **halojen (Cl, Br, F) YOKSA** → C-X pikleri YAZMA!
   - Sadece C ve H varsa (hidrokarbon) → Sadece C-H pikleri yaz!

2. **YANLIŞ ÖRNEK (YAPMA!):**
   ❌ D-Glucose (C₆H₁₂O₆) için → N-H gerilme 3300 cm⁻¹ (YANLIŞ! Formülde N YOK!)
   ❌ Benzene (C₆H₆) için → C=O gerilme 1720 cm⁻¹ (YANLIŞ! Formülde O YOK!)
   ❌ Ethan (C₂H₆) için → O-H gerilme 3400 cm⁻¹ (YANLIŞ! Formülde O YOK!)

3. **DOĞRU ÖRNEK (YAP!):**
   ✅ D-Glucose (C₆H₁₂O₆) için → O-H gerilme 3300-3500 cm⁻¹ (DOĞRU! O var)
   ✅ D-Glucose (C₆H₁₂O₆) için → C-O gerilme 1000-1200 cm⁻¹ (DOĞRU! O var)
   ✅ Benzene (C₆H₆) için → Aromatik C-H 3050 cm⁻¹ (DOĞRU! Sadece C ve H)

**FTIR PEAK LİSTESİ (Formüldeki atomlara göre seç!):**

1. Aromatik C-H: 3000-3100 cm⁻¹ (weak-medium, intensity: 40-60)
2. Alifatik C-H: 2850-3000 cm⁻¹ (medium-strong, intensity: 50-80)
   - CH3 için: ~2960 ve ~2870 cm⁻¹
   - CH2 için: ~2930 ve ~2850 cm⁻¹
3. **N-H (Amin/Amid): 3300-3500 cm⁻¹ (medium-strong, intensity: 50-80)** ← SADECE FORMÜLDE N VARSA!
4. **O-H (Hydroxyl/Alcohol): 3200-3600 cm⁻¹ (broad, intensity: 60-90)** ← SADECE FORMÜLDE O VARSA!
5. **C=O (Carbonyl): 1650-1750 cm⁻¹ (strong, intensity: 80-100)** ← SADECE FORMÜLDE O VARSA!
   - Ester: 1730-1750, Keton: 1700-1720, Aldehit: 1720-1740
6. C=C (Aromatic): 1450-1600 cm⁻¹ (medium-strong, intensity: 50-80)
7. **C-O (Ester/Ether): 1050-1300 cm⁻¹ (strong, intensity: 70-90)** ← SADECE FORMÜLDE O VARSA!
8. Aromatic C-H (out-of-plane bending): 650-900 cm⁻¹ (strong, intensity: 70-90)

⚠️ **ADIM ADIM KONTROL:**
ADIM 1: Moleküler formülü yaz (örn: C₆H₁₂O₆)
ADIM 2: Hangi atomlar var? C var, H var, O var, N YOK
ADIM 3: O var → O-H ve C-O pikleri ekle
ADIM 4: N YOK → N-H pikleri EKLEME!
ADIM 5: Aromatik halka var mı? Evet/Hayır → Aromatik pikler ekle/ekleme

MUTLAKA 7-10 adet pik ekle! Az pik eklemek HATALI analiz demektir.`;

  // Çözücü bilgisi context - DETAYLI
  const solventInfo = solvent === 'D2O' || solvent === 'MeOD'
    ? `⚠️ **${solvent} - PROTIC ÇÖZÜCÜ:**
- OH/NH/SH protonları D/H değişimi nedeniyle KAYBOLUR veya çok zayıf görünür
- Eğer spektrumda OH/NH peak'i yoksa, bu NORMALDIR
- Reasoning'de MUTLAKA bunu belirt: "D2O/MeOD kullanıldığı için OH protonları görünmüyor"`
    : solvent === 'DMSO'
    ? `📌 **${solvent} - POLAR APROTIK:**
- OH/NH protonları broad ve downfield kayar (δ 4-6 ppm arası)
- Hidrojen bağı etkisi nedeniyle OH peak'leri genişler
- Reasoning'de MUTLAKA şunu yaz: "DMSO'da OH/NH protonları δ X.XX ppm'de broad singlet olarak görünüyor"`
    : solvent === 'CDCl3'
    ? `✓ **${solvent} - APOLAR ÇÖZÜCÜ:**
- OH/NH protonları keskin singlet olarak görünür (δ 1-4 ppm)
- En net OH/NH sinyallerini verir
- Reasoning'de MUTLAKA şunu yaz: "CDCl3'te OH protonları δ X.XX ppm'de keskin singlet"`
    : `${solvent} çözücüsü kullanılmış.`;

  // Frekans bilgisi context
  const frequencyInfo = frequency >= 500
    ? `📡 **${frequency} MHz - YÜKSEK ALAN:**
- Peak'ler daha iyi ayrılır, multiplisiteler net görünür
- Coupling constant'lar (J değerleri) daha hassas ölçülür
- Reasoning'de şunu belirt: "${frequency} MHz yüksek çözünürlük sayesinde..."`
    : `📡 **${frequency} MHz - STANDART ALAN:**
- Temel peak'ler görünür ama bazı multiplisiteler overlap olabilir
- Reasoning'de şunu belirt: "${frequency} MHz'de ölçüldü"`;

  // FTIR için özel user prompt
  const userPrompt = spectrumType === 'ftir'
    ? `🔬 **FTIR SPEKTRUM ANALİZİ - THEORETİCAL ENGINE GUIDANCE:**

${algorithmicContext}

📚 **FTIR SPECTROSCOPY METHODOLOGY - HOOKE'S LAW & FORCE CONSTANTS:**

Sen deneyimli bir FTIR spektroskopisti ve organik kimyagersin. Moleküllerin infrared spektrumlarını teorik fizik kurallarına göre tahmin edip analiz edebiliyorsun.

**ADIM 1: HOOKE'S LAW - FUNDAMENTAL EQUATION**
Vibrational frequency: ν = (1/2πc) × √(k/μ)
- k = force constant (N/m) - bond strength
- μ = reduced mass (amu)
- c = speed of light (2.998 × 10¹⁰ cm/s)

**Base Force Constants (Literature Values):**
Single Bonds:
- C-H sp³: 500 N/m → ~2900 cm⁻¹
- C-H sp²: 550 N/m → ~3050 cm⁻¹ (aromatic)
- C-H sp: 600 N/m → ~3300 cm⁻¹ (alkyne)
- O-H: 750 N/m → ~3300-3600 cm⁻¹ (sharp=free, broad=H-bonded)
- N-H: 650 N/m → ~3300-3500 cm⁻¹
- C-C: 400 N/m → ~1000-1250 cm⁻¹
- C-O: 450 N/m → ~1050-1300 cm⁻¹
- C-N: 420 N/m → ~1020-1220 cm⁻¹

Double Bonds:
- C=C: 950 N/m → ~1620-1680 cm⁻¹
- C=O: 1200 N/m → ~1700-1750 cm⁻¹
- C=N: 1100 N/m → ~1640-1690 cm⁻¹

Triple Bonds:
- C≡C: 1600 N/m → ~2100-2260 cm⁻¹
- C≡N: 1650 N/m → ~2210-2260 cm⁻¹

**ADIM 2: FORCE CONSTANT CORRECTIONS - CRITICAL!**

The base frequency is MODIFIED by these effects:

1️⃣ **CONJUGATION EFFECT** (-20 to -60 N/m):
   - Simple conjugation (Ph-CO-, Ph-CH=CH-): -30 cm⁻¹
   - Extended conjugation (Ph-CH=CH-CO-, α,β-unsaturated): -45 cm⁻¹
   - Polyene/highly conjugated systems: -60 cm⁻¹
   - **Example:** Acetone C=O: 1715 cm⁻¹ → Acetophenone C=O: 1685 cm⁻¹ (conjugated)

2️⃣ **RING STRAIN EFFECT** (+20 to +50 N/m):
   - Cyclopropane (3-membered): +50 cm⁻¹ (VERY strained)
   - Cyclobutane (4-membered): +30 cm⁻¹ (strained)
   - Cyclopentane (5-membered): +10 cm⁻¹ (slightly strained)
   - Cyclohexane (6+ membered): 0 cm⁻¹ (strain-free)

3️⃣ **HYDROGEN BONDING** (-50 to -100 N/m):
   - O-H free: 3600 cm⁻¹ (sharp)
   - O-H H-bonded (intermolecular): 3200-3500 cm⁻¹ (broad)
   - O-H H-bonded (intramolecular): 2500-3200 cm⁻¹ (very broad)
   - **COOH especially broad:** 2500-3300 cm⁻¹ (dimer formation)

4️⃣ **ELECTRON-WITHDRAWING GROUPS** (+20 N/m):
   - Halogens (F, Cl, Br) adjacent to C=O: +20 cm⁻¹
   - CF₃CO-R → 1780 cm⁻¹ (blue shifted)

5️⃣ **ANHARMONICITY** (Morse Potential):
   - Real bonds are NOT perfect springs!
   - Correction: ν_real = ν_harmonic × (1 - χₑ × ν/10000)
   - O-H: χₑ = 0.025
   - C-H: χₑ = 0.020
   - C=O: χₑ = 0.015

**ADIM 3: FINGERPRINT REGION (400-1500 cm⁻¹) - MOLECULAR ID**

Normal Modes (Coupled Vibrations):
- CH₂ scissoring: 1465 cm⁻¹ (medium)
- CH₃ symmetric bend: 1375 cm⁻¹ (medium, umbrella mode)
- CH₃ asymmetric bend: 1450 cm⁻¹ (medium)
- C-O ester asymmetric stretch: 1300 cm⁻¹ (strong)
- C-O ester symmetric stretch: 1220 cm⁻¹ (strong)
- C-O ether/alcohol: 1050 cm⁻¹ (strong)

Aromatic Fingerprint:
- C=C aromatic stretch: 1600, 1580, 1500, 1450 cm⁻¹
- Ring breathing: 1020 cm⁻¹
- C-C skeletal: 1175 cm⁻¹

Out-of-Plane C-H Bending (Aromatic Substitution Pattern):
- Mono-substituted: 756, 690 cm⁻¹ (2 strong peaks)
- Ortho-disubstituted: 750 cm⁻¹ (1 peak)
- Meta-disubstituted: 810, 750 cm⁻¹ (2 peaks)
- Para-disubstituted: 825 cm⁻¹ (1 strong peak)

**ADIM 4: INTENSITY RULES**

Intensity ∝ (dμ/dq)² - dipole moment derivative

Strong (85-100):
- C=O stretch (highly polar)
- C-O stretch (ester, ether)
- O-H, N-H stretch (polar X-H)

Medium (50-80):
- C=C stretch
- Aromatic C=C
- CH₂ bending modes

Weak (20-45):
- C-C stretch (non-polar)
- C≡C stretch (symmetric, low dipole change)
- C-H stretch (low polarity)

**ADIM 5: FUNCTIONAL GROUP PRIORITY - DIAGNOSTIC PEAKS**

🔴 ALWAYS CHECK FIRST:
1. **C=O** (1650-1850 cm⁻¹): Most diagnostic!
   - Ketone: 1715 cm⁻¹
   - Aldehyde: 1730 cm⁻¹
   - Ester: 1735 cm⁻¹
   - Acid: 1710 cm⁻¹
   - Amide: 1650 cm⁻¹
   - Acid chloride: 1800 cm⁻¹
   - Anhydride: 1760, 1820 cm⁻¹ (2 peaks!)

2. **O-H / N-H** (3200-3600 cm⁻¹):
   - Check if broad (H-bonded) or sharp (free)

3. **C-H** (2800-3100 cm⁻¹):
   - sp³: 2850-2970 cm⁻¹
   - sp²: 3000-3100 cm⁻¹ (=C-H aromatic/alkene)
   - sp: 3300 cm⁻¹ (≡C-H alkyne)

4. **Triple Bonds** (2000-2300 cm⁻¹):
   - C≡C: 2100-2260 cm⁻¹ (weak if symmetric)
   - C≡N: 2210-2260 cm⁻¹ (medium)

🎯 **GÖREV - THEORETICAL ENGINE + AI REFINEMENT:**

Context'te size THEORETICAL ENGINE'in tahminleri verildi. Bu tahminler:
- ✅ Hooke's Law'a göre fiziksel olarak doğru
- ⚠️ ±20-50 cm⁻¹ hata payı olabilir
- ⚠️ Bazı coupling peaks eksik olabilir

**YAPMANIZ GEREKENLER:**

1. **CONTEXT'TEKİ MOLEKÜLÜ KULLAN:**
   - moleculeName, formula, SMILES, CID'yi AYNEN al
   - BAŞKA molekül uydurma!
   
2. **🚨 IDENTITY LOCK - FORMÜL ZORUNLULUĞU:**
   - Eğer context'te "CRITICAL IDENTITY LOCK" uyarısı varsa, belirtilen formülü MUTLAKA kullan!
   - O formülü spektrumdan türetme!
   - Farklı formül önerme!
   - Formül uyuşmazlığı varsa confidence = 0% yap ve açıkla!

2. **FUNCTIONAL GROUP DETECTION:**
   - SMILES'tan functional groups'ları tespit et
   - Her functional group için literatür peak ranges'ini kontrol et

3. **THEORETICAL PEAKS'İ FİLTRELE VE İYİLEŞTİR:**
   - Context'te verilen theoretical peaks'i incele
   - Şüpheli peaks'i eleme kriterleri:
     * Formülde olmayan atomlar (örn: N yoksa N-H peak yazma)
     * Fiziksel olarak imkansız (örn: C-H > 3100 cm⁻¹)
     * Duplicate peaks (aynı assignment'tan 2 peak olmasın)
   - Eksik peaks'leri ekle:
     * Aromatic substitution pattern peaks
     * C-O ester stretches (if ester present)
     * CH₂/CH₃ bending modes
     * Fingerprint region peaks

4. **FREQUENCY REFINEMENT:**
   - Theoretical peak'leri literatür ranges ile karşılaştır
   - Eğer ±50 cm⁻¹'den fazla fark varsa düzelt
   - Reasoning'de neden düzelttiğini açıkla:
     "Theoretical engine 1754 cm⁻¹ önerdi, ancak ester C=O literatür range'i 1735-1750 cm⁻¹ olduğu için 1742 cm⁻¹'e düzelttim"

5. **PEAK ASSIGNMENT:**
   - Her peak için NET assignment yaz:
     * ✅ "ν(C=O) ester stretch"
     * ✅ "δₛ(CH₃) symmetric bending"
     * ❌ "C-O stretch" (belirsiz!)
   - Conjugation/ring strain effects'i belirt:
     * "ν(C=O) ketone stretch (conjugated, shifted to 1685 cm⁻¹)"

6. **REASONING - DETAYLI AÇIKLAMA:**
   - Theoretical engine'in hangi yöntemleri kullandığını açıkla
   - Hangi peaks'leri kabul ettin, hangilerini düzelttin
   - Eksik eklediğin peaks'leri ve nedenlerini yaz
   - Conjugation/ring strain/H-bonding effects'lerini yorumla

7. **FINAL VALIDATION:**
   - 7-10 adet peak var mı?
   - Tüm major functional groups covered mı?
   - Aromatic substitution pattern peaks var mı?
   - Fingerprint region peaks var mı?
   - predicted_ftir array'i BOŞ DEĞİL mi?

📛 **IUPAC NAME - ÇOK ÖNEMLİ!**

IUPAC adı MUTLAKA doğru olmalı. İşte kurallar:

1️⃣ **Context'te IUPAC Adı Varsa:**

   ⚠️ **ÖNCE FORMÜL DOĞRULAMASI YAP! (MANDATORY!):**

   Step 1: Context'teki IUPAC adından formülü türet
   Step 2: Context'teki molecular formula ile KARŞILAŞTIR
   Step 3: IF MISMATCH → Context IUPAC YANLIŞ! REDDET!
   Step 4: IF MATCH → Context IUPAC'ı kullan

   **Example - CORRECT:**
   - Context IUPAC: "2-acetoxybenzoic acid"
   - Derived formula: C9H8O4
   - Context formula: C9H8O4
   - Match: ✅ → Context IUPAC'ı kullan

   **Example - WRONG (REJECT!):**
   - Context IUPAC: "2-(1H-indol-3-yl)ethanamine"
   - Derived formula: C10H12N2 (10 carbons, NO oxygen!)
   - Context formula: C23H26N2O4 (23 carbons, 4 oxygens!)
   - Match: ❌ → Context IUPAC YANLIŞ! SMILES'tan türet!

   ✅ IF FORMULAS MATCH → Context'teki IUPAC adını AYNEN kullan
   ❌ IF FORMULAS DON'T MATCH → Context IUPAC'ı REDDET, SMILES'tan türet!

2️⃣ **Context'te IUPAC Adı Yoksa (null veya undefined):**

   ⚠️ **ÖNEMLİ:** Sadece molekül adına BAKMA! Şu verileri MUTLAKA kullan:

   **A) SMILES STRING (En Önemli! 🔥):**
   - Context'te SMILES varsa, önce SMILES'ı parse et
   - SMILES'tan yapıyı çıkar (functional groups, chain length, branches)
   - Example SMILES parsing:
     * "CC(=O)C" → 3 carbon, ketone at C2 → "propan-2-one"
     * "CC(=O)Oc1ccccc1C(=O)O" → ester + aromatic + acid → "2-acetoxybenzoic acid"
     * "CC(C)=CCCC(C)(O)C=C" → 8 carbon, alcohol, 2 double bonds → "3,7-dimethylocta-1,6-dien-3-ol"

   **B) FTIR/NMR PEAKS (Functional Group Validation):**
   - FTIR peaks'ten functional groups'ları doğrula:
     * 1700-1750 cm⁻¹ → C=O (ketone/aldehyde/ester/acid)
     * 3200-3600 cm⁻¹ → O-H or N-H
     * 2200-2260 cm⁻¹ → C≡N or C≡C
     * 1600, 1500 cm⁻¹ → Aromatic ring
   - NMR peaks'ten yapı doğrula:
     * δ 9-10 ppm → Aldehyde
     * δ 7-8 ppm → Aromatic
     * δ 11-12 ppm → Carboxylic acid

   **C) MOLECULAR FORMULA:**
   - ⚠️ **DO NOT calculate DBE from formula** - DBE is computed by the application
   - You may interpret DBE value if provided in context (e.g., "DBE=6 suggests aromatic ring + carbonyl")

   **D) IUPAC TÜRETİM WORKFLOW:**

   Step 1: SMILES'tan ana zinciri bul
   Step 2: Functional groups'ları priority'ye göre sırala
   Step 3: Substituent'leri tespit et
   Step 4: Pozisyon numaralarını minimize et
   Step 5: IUPAC adını oluştur
   Step 6: FTIR/NMR peaks ile VALIDATE et

   **E) ÖRNEK TÜRETME (SMILES + Peaks):**

   Example 1:
   - SMILES: "CC(=O)C"
   - FTIR: 1715 cm⁻¹ (C=O ketone)
   - Formula: C₃H₆O
   - Analysis: 3 carbon chain, ketone at C2
   - IUPAC: "propan-2-one" ✅

   Example 2:
   - SMILES: "CC(=O)Oc1ccccc1C(=O)O"
   - FTIR: 1754 cm⁻¹ (C=O ester), 1685 cm⁻¹ (C=O acid), 1600 cm⁻¹ (aromatic)
   - NMR: δ 7-8 ppm (aromatic)
   - Formula: C₉H₈O₄
   - Analysis: Benzene ring + acetoxy group (position 2) + carboxylic acid
   - IUPAC: "2-acetoxybenzoic acid" ✅

   Example 3:
   - SMILES: "CC(C)=CCCC(C)(O)C=C"
   - FTIR: 3400 cm⁻¹ (O-H alcohol), 1640 cm⁻¹ (C=C)
   - NMR: δ 4.5-6 ppm (vinylic protons)
   - Formula: C₁₀H₁₈O
   - Analysis: 8 carbon main chain, alcohol at C3, methyl at C3,C7, double bonds at C1,C6
   - IUPAC: "3,7-dimethylocta-1,6-dien-3-ol" ✅

   ⚠️ **VALIDATION CHECKLIST:**
   - ✅ SMILES ile IUPAC uyumlu mu?
   - ✅ FTIR peaks functional groups'ları destekliyor mu?
   - ✅ NMR chemical shifts doğru mu?
   - ✅ Molecular formula atom sayıları match ediyor mu?
   - ✅ Stereochemistry varsa belirtilmiş mi?

3️⃣ **IUPAC Türetme Kuralları:**
   - En uzun carbon chain'i bul → parent name
   - Functional groups'ları önceliğe göre sırala:
     * Carboxylic acid (-oic acid) > Ester (-oate) > Amide (-amide) > Aldehyde (-al) > Ketone (-one) > Alcohol (-ol) > Amine (-amine)
   - Substituent pozisyonlarını numaralandır (en düşük numara)
   - Alphabetical order for substituents (ignoring prefixes: di-, tri-)
   - Examples:
     * CH₃-CO-CH₃ → "propan-2-one" (ketone at position 2)
     * CH₃-CH₂-OH → "ethanol"
     * CH₃-CH(OH)-CH₃ → "propan-2-ol"

4️⃣ **Doğrulama Checklist:**
   ✅ IUPAC adı sistematik mi? (common name değil!)
   ✅ Functional group doğru isimlendirilmiş mi?
   ✅ Pozisyon numaraları minimum mi?
   ✅ Stereochemistry belirtilmiş mi? (eğer varsa: (R)-, (S)-, (E)-, (Z)-)

5️⃣ **Yaygın Hatalar - BUNLARI YAPMA:**
   ❌ "Aspirin" → IUPAC DEĞİL! (Common name)
   ❌ "Acetone" → IUPAC DEĞİL! (Common name)
   ❌ "Benzyl alcohol" → IUPAC DEĞİL!
   ✅ Doğrusu: "2-acetoxybenzoic acid", "propan-2-one", "phenylmethanol"

🚨 **CRITICAL VALIDATION RULES - NEVER SKIP! (VETO POWER):**

These rules have VETO POWER - if violated, suggestion is INVALID regardless of other factors!

1️⃣ **FORMULA VALIDATION (MANDATORY!):**

   ⚠️ YOUR SUGGESTED IUPAC NAME'S FORMULA **MUST EXACTLY MATCH** CONTEXT FORMULA!

   **Validation Process:**

   Step 1: Parse context formula (e.g., C23H26N2O4)
   Step 2: Count each atom type: C=23, H=26, N=2, O=4
   Step 3: Your suggested IUPAC → derive its formula
   Step 4: Compare atom-by-atom
   Step 5: IF MISMATCH → REJECT suggestion! Confidence = 0%

   **Example - CORRECT:**
   - Context formula: C9H8O4
   - Your suggestion: "2-acetoxybenzoic acid"
   - Derived formula: C9H8O4
   - Match: ✅ VALID

   **Example - WRONG (DO NOT DO THIS!):**
   - Context formula: C23H26N2O4 (23 carbons, 2 nitrogens!)
   - Your suggestion: "2,4,6-trihydroxyphenol"
   - Derived formula: C6H6O4 (6 carbons, NO nitrogen!)
   - Match: ❌ INVALID! → Confidence must be 0%, NOT 100%!

   **CRITICAL CHECKS:**
   - ✅ Carbon count matches?
   - ✅ Hydrogen count matches?
   - ✅ Nitrogen present in context → MUST be in your suggestion!
   - ✅ Oxygen count matches?
   - ✅ Any other atoms (S, Cl, Br, etc.) match?

   ❌ IF ANY ATOM COUNT MISMATCHES → DO NOT SUGGEST THAT MOLECULE!
   ❌ NEVER return confidence > 0% for formula mismatches!

2️⃣ **NITROGEN PRESENCE CHECK:**

   IF context formula contains 'N':
       YOUR suggested IUPAC MUST have nitrogen-containing groups!
       Examples: -NH2, -NO2, -CN, -CONH2, heterocyclic N

   IF context has NO 'N' but your suggestion has N:
       ❌ INVALID!

   Example:
   - Context: C23H26N2O4 ← HAS 2 NITROGENS!
   - Your suggestion MUST contain nitrogen atoms
   - "Phenol" ❌ INVALID (no N)
   - "Dimethoxystrychnine" ✅ VALID (alkaloid with N)

3️⃣ **COMPLEXITY CHECK:**

   IF context formula has >15 carbons OR multiple nitrogens:
       → Complex molecule!
       → DO NOT suggest simple molecules (phenol, benzene, etc.)
       → Use semi-systematic names or indicate complexity

   Example:
   - C23H26N2O4 → Complex alkaloid
   - DO NOT suggest: "trihydroxyphenol" (too simple!)
   - SUGGEST: "dimethoxystrychnine" or indicate natural product

4️⃣ **SMILES CROSS-VALIDATION:**

   IF context provides SMILES:
       Parse SMILES to identify:
       - Ring systems (aromatic, aliphatic)
       - Functional groups
       - Nitrogen positions
       - Complexity level

       Your IUPAC MUST match SMILES structure!

5️⃣ **CONFIDENCE CALCULATION:**

   confidence = MIN(
       formula_match_score,      // ← 0% if ANY atom mismatch!
       smiles_match_score,
       complexity_match_score,
       spectral_data_score
   );

   **NEVER exceed minimum score!**

   Example:
   - Formula match: 0% (mismatch)
   - SMILES match: 90%
   - Complexity: 80%
   - Final confidence: MIN(0, 90, 80) = 0% ❌

⚠️ **ADDITIONAL CRITICAL RULES:**
- predicted_ftir array'i BOŞ OLMAMALI! (minimum 7 peaks)
- Formülde olmayan atomlara ait pikler YAZMA
- moleculeName context'ten AYNEN al (common name OK)
- **iupacName:** Context IUPAC'ın formülünü KONTROL ET! Formula mismatch varsa REDDET ve SMILES'tan türet!
- **formula:** Context'ten AYNEN al - ASLA değiştirme!
- CID'yi context'ten AYNEN al (ama CID yanlışsa confidence düşür!)
- Theoretical engine'in önerilerini referans al ama KÖR KÖRÜNE KOPYALAMA
- Her peak için wavenumber, intensity (number), type (strong/medium/weak), assignment belirt

🔴 **FINAL CHECK BEFORE RETURNING JSON:**

   ⚠️ EXAMPLE VALIDATION - ALWAYS DO THIS!

   **Step 1: Parse Context IUPAC Formula**
   Context IUPAC: "Phenylmethanamine"
   → Derived formula: C7H9N (7C, 1N, 0O)

   **Step 2: Compare with Context Formula**
   Context formula: C23H26N2O4 (23C, 2N, 4O)

   **Step 3: Check Match**
   7C ≠ 23C ❌
   1N ≠ 2N ❌
   0O ≠ 4O ❌
   → MISMATCH! Context IUPAC is WRONG!

   **Step 4: Derive from SMILES Instead**
   Use context SMILES to derive correct IUPAC

   ✅ **MANDATORY CHECKS:**
   □ Context IUPAC formula matches context formula? (atom-by-atom!)
   □ If NO MATCH → Used SMILES to derive IUPAC?
   □ If context has N, my IUPAC has N-containing groups?
   □ If context has O, my IUPAC has O-containing groups?
   □ If context has 20+ carbons, my IUPAC isn't simple (phenol, benzene)?
   □ Confidence = 0% if formula mismatch?

   ❌ IF ANY ☐ UNCHECKED → STOP! REVISE YOUR ANSWER!

📋 **ÖRNEK REASONING FORMAT:**
"Bu molekül (Aspirin, C₉H₈O₄) ester ve carboxylic acid functional groups'larına sahip. Theoretical engine Hooke's Law kullanarak 12 adet peak önerdi. Bu peaks'leri inceledikten sonra:

1. ✅ 1685 cm⁻¹ (C=O acid): Kabul edildi, aromatic ring ile conjugation nedeniyle 1710'dan düşük
2. ✅ 1754 cm⁻¹ (C=O ester): 1742 cm⁻¹'e düzeltildi (literatür range: 1735-1750)
3. ➕ 1300 cm⁻¹ (C-O ester asymmetric): Theoretical engine'de eksikti, eklendi
4. ➕ 1220 cm⁻¹ (C-O ester symmetric): Eklendi
5. ✅ Aromatic substitution pattern: ortho-disubstituted → 750 cm⁻¹ peak eklendi

Final: 9 adet peak, tüm major functional groups covered, fingerprint region complete."`
    : `${spectrumType.toUpperCase()} Spektrumu:

🧪 **DENEY KOŞULLARI - REASONING'DE MUTLAKA KULLAN:**
${solventInfo}
${frequencyInfo}

📊 **PEAK VERİLERİ:**
${peakStr}
${spectrumType !== 'c13' ? `Toplam: ${totalProtons.toFixed(1)}H` : ''}

${normalizedPeaksInfo}

${functionalGroupAnalysis}

🎯 **GÖREV:**
1. Molekülü tanımla
2. **reasoning kısmında MUTLAKA çözücü ve frekans etkisini yorumla**
3. Integration normalization sonuçlarını değerlendir
4. Functional group library'den gelen eşleşmeleri kullan
5. Alternatif 2-3 molekül öner (alternatives array'inde)

⚠️ ÖNEMLİ:
- reasoning'de çözücü/frekans bilgisini KULLANMAYI UNUTMA!
- Integration analysis'deki warnings'leri dikkate al
- Diagnostic level'ı yüksek olan functional group'ları öncelikllendir

${jointModalityContext}

LIBRARY_MATCH_CONTEXT (MUTLAKA KULLAN):
${libraryMatchesContext || 'NO_LIBRARY_CONTEXT'}

JOINT MODALITY ZORUNLU ÇIKTI KILAVUZU:
- 1H + 13C + residual + QC + provenance birlikte yorumlanmalı
- Önce residual elemesi, sonra yapı adayı
- "Benzoik asit" gibi küçük aromatik adaylar için alifatik baskınlıkla çelişki analizi zorunlu
- Chitosan/polysaccharide/polymer/broad-spectrum + acidic solvent vakalarında polymer-mode zorunlu
- 4.7-5.4 (anomeric), 3.0-4.2 (sugar ring), 1.9-2.1 (acetate/N-acetyl overlap) region-first yorum zorunlu
- 11-12 ppm acidic residual/exchange bölgesi solvent olarak raporlanmalı
- 0.14 ve 7.50 gibi tekil impurity sinyalleri yapı adayına kanıt yazılmamalı
- Çıktıda spectralInterpretation altında şu alanları üret:
  * cross_modal_anchors
  * structure_candidates
  * contradiction_analysis
  * confidence_ceiling_reason
  * next_best_actions
- JSON şema örneğindeki candidate isimleri sadece örnektir; gerçek tahmin olarak kopyalama.
- Polymer-mode aktifken small-molecule spesifik isim yerine class-level polymer sonucu üret.
- Tek üst sınıf seçimi içsel çelişki barındırıyorsa INCONCLUSIVE + contradiction_analysis döndür.`;

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      // gpt-4o / 4o-mini: completion üst sınırı 16384; uzun JSON + reasoning için yüksek tutulur
      max_tokens: 16384,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`LLM API error: ${errorMessage}`);
  }

  const data = await response.json();
  const finishReason = data.choices?.[0]?.finish_reason;
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('AI yanıtı boş geldi');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('LLM raw length:', text.length, 'finish_reason:', finishReason);
  }

  try {
    // Clean JSON string before parsing
    let cleanedJson = extractJsonCandidate(text);
    
    // Remove markdown code blocks if present
    const jsonMatch = cleanedJson.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      cleanedJson = jsonMatch[1];
    }
    
    // Remove leading/trailing whitespace
    cleanedJson = cleanedJson.trim();

    // Uzun SMILES + finish_reason:length → yarım JSON; önce onar
    if (finishReason === 'length' || smilesStringUnterminated(cleanedJson)) {
      cleanedJson = repairTruncatedSmilesJson(cleanedJson);
    }
    
    // Fix common JSON issues
    // 1. Remove BOM if present
    if (cleanedJson.charCodeAt(0) === 0xFEFF) {
      cleanedJson = cleanedJson.slice(1);
    }
    
    // 2. Fix unescaped newlines in strings
    cleanedJson = cleanedJson.replace(/("(?:[^"\\]|\\.)*")\s*\n\s*("(?:[^"\\]|\\.)*")/g, '$1 $2');
    
    // 3. Fix unescaped quotes in strings (basic fix)
    // This is tricky - we need to be careful not to break valid JSON
    // Only fix if we detect unterminated strings
    let quoteCount = 0;
    let inString = false;
    let escapeNext = false;
    let fixedJson = '';
    
    for (let i = 0; i < cleanedJson.length; i++) {
      const char = cleanedJson[i];
      
      if (escapeNext) {
        fixedJson += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        fixedJson += char;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        quoteCount++;
        fixedJson += char;
      } else {
        fixedJson += char;
      }
    }
    
    // If we have an unterminated string, try to fix it
    if (inString && fixedJson.length > 0) {
      // Try to find where the string should end
      const lastQuoteIndex = fixedJson.lastIndexOf('"');
      if (lastQuoteIndex > 0 && lastQuoteIndex < fixedJson.length - 1) {
        // Check if we need to add a closing quote
        const afterLastQuote = fixedJson.substring(lastQuoteIndex + 1);
        if (!afterLastQuote.match(/^\s*[,}\]]/)) {
          // String seems unterminated, try to fix
          const beforeLastQuote = fixedJson.substring(0, lastQuoteIndex);
          const needsClosing = beforeLastQuote.match(/"\s*:\s*"([^"]*)$/);
          if (needsClosing) {
            // Try to find a reasonable place to close the string
            const nextComma = afterLastQuote.indexOf(',');
            const nextBrace = afterLastQuote.indexOf('}');
            const nextBracket = afterLastQuote.indexOf(']');
            
            let endIndex = fixedJson.length;
            if (nextComma !== -1) endIndex = Math.min(endIndex, lastQuoteIndex + 1 + nextComma);
            if (nextBrace !== -1) endIndex = Math.min(endIndex, lastQuoteIndex + 1 + nextBrace);
            if (nextBracket !== -1) endIndex = Math.min(endIndex, lastQuoteIndex + 1 + nextBracket);
            
            if (endIndex < fixedJson.length) {
              fixedJson = fixedJson.substring(0, endIndex) + '"' + fixedJson.substring(endIndex);
            }
          }
        }
      }
    }
    
    cleanedJson = fixedJson;
    
    // Try to parse
    let parsed;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (firstParseError) {
      // If first parse fails, try more aggressive cleaning
      console.warn('First parse attempt failed, trying aggressive cleaning...');
      
      // Try to extract JSON object manually
      const jsonStart = cleanedJson.indexOf('{');
      const jsonEnd = cleanedJson.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedJson = cleanedJson.substring(jsonStart, jsonEnd + 1);
        
        // Escape any unescaped newlines and special characters in string values
        cleanedJson = cleanedJson.replace(/("(?:[^"\\]|\\.)*")\s*\n\s*/g, (match, str) => {
          // If this looks like a string value, escape the newline
          return str + ' ';
        });
        
        try {
          parsed = JSON.parse(cleanedJson);
        } catch (secondParseError) {
          // Last resort: try to extract key fields manually
          console.warn('Second parse attempt failed, trying manual extraction...');
          
          const moleculeNameMatch = cleanedJson.match(/"moleculeName"\s*:\s*"([^"]*)"/);
          const formulaMatch = cleanedJson.match(/"formula"\s*:\s*"([^"]*)"/);
          const confidenceMatch = cleanedJson.match(/"confidence"\s*:\s*(\d+)/);
          const smilesMatch = cleanedJson.match(/"smiles"\s*:\s*"([^"]*)"/);
          
          parsed = {
            moleculeName: moleculeNameMatch ? moleculeNameMatch[1] : 'Parse Error',
            formula: formulaMatch ? formulaMatch[1] : 'Unknown',
            confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
            smiles: smilesMatch ? smilesMatch[1] : undefined,
            reasoning: 'Partial parse - JSON had syntax errors',
            functionalGroups: []
          };
        }
      } else {
        throw firstParseError;
      }
    }
    
    console.log('Successfully parsed:', parsed);

    // SMILES Validation and Sanitization
    if (parsed.smiles) {
      // Clean SMILES string (remove URL encoding, extra whitespace, etc.)
      let cleanedSmiles = parsed.smiles.trim();
      
      // Remove URL encoding if present
      try {
        cleanedSmiles = decodeURIComponent(cleanedSmiles);
      } catch (e) {
        // If decode fails, use original
      }
      
      // Remove any non-SMILES characters that might have leaked in
      cleanedSmiles = cleanedSmiles.replace(/[^\w@\[\]\(\)=#\-\+\.\\/\\:]/g, '');
      
      // Basic SMILES syntax validation
      const validChars = /^[A-Za-z0-9@\[\]\(\)=#\-\+\.\\/\\:]+$/;
      const minLength = 2;
      const maxLength = 2000; // ✅ Artırıldı: Çok uzun SMILES (Ftalosiyanin gibi) için yeterli

      if (!validChars.test(cleanedSmiles)) {
        console.warn('⚠️ Invalid SMILES characters detected, original length:', parsed.smiles.length);
        // Try to extract valid SMILES portion
        const validPortion = cleanedSmiles.match(/^[A-Za-z0-9@\[\]\(\)=#\-\+\.\\/\\:]+/);
        if (validPortion && validPortion[0].length >= minLength) {
          parsed.smiles = validPortion[0];
          console.warn('⚠️ Extracted valid SMILES portion:', parsed.smiles.substring(0, 50) + '...');
        } else {
          parsed.smiles = undefined;
        }
      } else if (cleanedSmiles.length < minLength || cleanedSmiles.length > maxLength) {
        console.warn('⚠️ Invalid SMILES length:', cleanedSmiles.length);
        if (cleanedSmiles.length > maxLength) {
          // Truncate if too long (but this is unusual)
          parsed.smiles = cleanedSmiles.substring(0, maxLength);
          console.warn('⚠️ SMILES truncated to', maxLength, 'characters');
        } else {
          parsed.smiles = undefined;
        }
      } else {
        parsed.smiles = cleanedSmiles;
        // Check balanced brackets
        const openBrackets = (parsed.smiles.match(/\[/g) || []).length;
        const closeBrackets = (parsed.smiles.match(/\]/g) || []).length;
        const openParen = (parsed.smiles.match(/\(/g) || []).length;
        const closeParen = (parsed.smiles.match(/\)/g) || []).length;

        if (openBrackets !== closeBrackets || openParen !== closeParen) {
          console.warn('⚠️ Unbalanced brackets in SMILES:', parsed.smiles);
          parsed.smiles = undefined;
        } else {
          console.log('✅ Valid SMILES:', parsed.smiles);
        }
      }
    } else {
      console.warn('⚠️ No SMILES provided by AI');
    }

    // ============================================================================
    // IUPAC NAME - FORMULA CROSS-VALIDATION (CRITICAL!)
    // ============================================================================
    if (parsed.moleculeName && parsed.iupacName && parsed.formula) {
      const moleculeName = parsed.moleculeName.toLowerCase();
      const iupacName = parsed.iupacName.toLowerCase();

      // Extract carbon count from formula
      // ✅ Unicode subscript'leri normalize et (C₄₇H₅₁NO₁₄ → C47H51NO14)
      const normalizeFormula = (formula: string): string => {
        if (!formula) return '';
        const subscriptMap: Record<string, string> = {
          '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
          '₆': '6', '₇': '7', '₈': '8', '₉': '9'
        };
        return formula.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => subscriptMap[char] || char);
      };
      
      const normalizedFormula = normalizeFormula(parsed.formula);
      const formulaCarbonMatch = normalizedFormula.match(/C(\d+)?/);
      const formulaCarbon = formulaCarbonMatch
        ? (formulaCarbonMatch[1] ? parseInt(formulaCarbonMatch[1]) : 1)
        : 0;

      console.log('🔍 IUPAC Validation:');
      console.log(`   moleculeName: ${parsed.moleculeName}`);
      console.log(`   iupacName: ${parsed.iupacName}`);
      console.log(`   formula: ${parsed.formula} (${formulaCarbon} carbons)`);

      // ========================================================================
      // STEP 1: KIMYAGERLER GİBİ IUPAC'TAN FORMÜL TÜRET (İYİLEŞTİRİLMİŞ)
      // ========================================================================

      // 1A. Ana zincir karbon sayısı (prefix'lerden)
      const carbonPrefixes: Record<string, number> = {
        'meth': 1, 'eth': 2, 'prop': 3, 'but': 4, 'pent': 5, 'hex': 6,
        'hept': 7, 'oct': 8, 'non': 9, 'dec': 10, 'undec': 11, 'dodec': 12,
        'tridec': 13, 'tetradec': 14, 'pentadec': 15, 'hexadec': 16,
        'heptadec': 17, 'octadec': 18, 'nonadec': 19, 'eicos': 20,
        'icos': 20, 'henicos': 21, 'docos': 22, 'tricos': 23
      };

      let iupacCarbonCount = 0;
      let backboneCarbons = 0;

      // Ana zincir (en uzun prefix)
      for (const [prefix, count] of Object.entries(carbonPrefixes)) {
        if (iupacName.includes(prefix)) {
          backboneCarbons = Math.max(backboneCarbons, count);
        }
      }

      iupacCarbonCount = backboneCarbons;

      // 1B. Aromatik halkalar ve özel gruplar (ÖNEMLİ: Önce aromatik kontrolü!)
      const aromaticGroups: Record<string, number> = {
        'phenyl': 6, 'fenil': 6, 'benzyl': 7, 'benzil': 7,
        'benzen': 6, 'benzoyl': 7, 'benzoil': 7,
        'toluyl': 7, 'xylyl': 8, 'naphthyl': 10, 'naftil': 10,
        'aniline': 6, 'anilin': 6, // ✅ EKLENDİ: aniline = 6 karbon (phenyl + NH2)
        'phenol': 6, 'fenol': 6, // ✅ EKLENDİ: phenol = 6 karbon
        'toluene': 7, 'toluen': 7, // ✅ EKLENDİ: toluene = 7 karbon
        'xylene': 8, 'ksilen': 8 // ✅ EKLENDİ: xylene = 8 karbon
      };

      // ✅ İYİLEŞTİRME: "N-phenylaniline" gibi kombinasyonları tespit et
      // N-phenylaniline = phenyl (6) + aniline (6) = 12 karbon
      // Ama aniline zaten phenyl içerir, bu yüzden dikkatli saymalıyız
      
      let aromaticCarbonCount = 0;
      const foundAromaticGroups: string[] = [];
      
      // Önce özel kombinasyonları kontrol et
      if (iupacName.includes('phenylaniline') || iupacName.includes('fenilanilin')) {
        // N-phenylaniline = 2 phenyl halkası = 12 karbon
        aromaticCarbonCount = 12;
        foundAromaticGroups.push('N-phenylaniline (12C)');
      } else if (iupacName.includes('diphenyl') || iupacName.includes('difenil')) {
        // diphenyl = 2 phenyl = 12 karbon
        aromaticCarbonCount = 12;
        foundAromaticGroups.push('diphenyl (12C)');
      } else {
        // Normal aromatik grup tespiti
        for (const [group, carbons] of Object.entries(aromaticGroups)) {
          if (iupacName.includes(group)) {
            // Eğer "aniline" varsa ve "phenyl" de varsa, sadece birini say (aniline zaten phenyl içerir)
            if (group === 'aniline' || group === 'anilin') {
              if (!iupacName.includes('phenyl') && !iupacName.includes('fenil')) {
                aromaticCarbonCount += carbons;
                foundAromaticGroups.push(`${group} (${carbons}C)`);
              }
            } else if (group === 'phenyl' || group === 'fenil') {
              // Eğer "aniline" yoksa phenyl'i say
              if (!iupacName.includes('aniline') && !iupacName.includes('anilin')) {
                aromaticCarbonCount += carbons;
                foundAromaticGroups.push(`${group} (${carbons}C)`);
              }
            } else {
              aromaticCarbonCount += carbons;
              foundAromaticGroups.push(`${group} (${carbons}C)`);
            }
          }
        }
      }
      
      iupacCarbonCount += aromaticCarbonCount;
      if (foundAromaticGroups.length > 0) {
        console.log(`   Aromatik gruplar: ${foundAromaticGroups.join(', ')}`);
      }

      // 1C. Substituent gruplar
      const substituents: Record<string, number> = {
        'dimethyl': 2, 'trimethyl': 3, 'tetramethyl': 4,
        'diethyl': 4, 'triethyl': 6,
        'dipropyl': 6, 'tripropyl': 9,
        'acetyl': 2, 'asetil': 2,
        'formyl': 1,
        'hydroxy': 0, 'hidroksi': 0, // O ekler, C eklemez
        'amino': 0, 'chloro': 0, 'bromo': 0, 'fluoro': 0, 'iodo': 0
      };

      for (const [sub, carbons] of Object.entries(substituents)) {
        if (iupacName.includes(sub) && carbons > 0) {
          console.log(`   Substituent bulundu: ${sub} (+${carbons} karbon)`);
          iupacCarbonCount += carbons;
        }
      }

      // 1D. Tek "methyl" veya "ethyl" (substituent olarak)
      const singleSubMatches = iupacName.match(/(?<!di|tri|tetra)(methyl|ethyl|propyl)/g);
      if (singleSubMatches) {
        for (const match of singleSubMatches) {
          if (match === 'methyl' && !iupacName.includes('dimethyl') && backboneCarbons > 1) {
            console.log(`   Tek methyl substituent (+1 karbon)`);
            iupacCarbonCount += 1;
          } else if (match === 'ethyl' && !iupacName.includes('diethyl')) {
            console.log(`   Tek ethyl substituent (+2 karbon)`);
            iupacCarbonCount += 2;
          }
        }
      }

      console.log(`   IUPAC'tan çıkarılan toplam karbon: ${iupacCarbonCount}`);

      // ========================================================================
      // STEP 2: BİLİNEN YANLIŞ CID EŞLEŞMELERİ (PubChem hataları)
      // ========================================================================
      const knownMismatches = [
        { mol: 'cyclooctatetraene', iupac: 'pyrazine', issue: 'C8H8 vs C4H4N2' },
        { mol: 'heksahidroksi', iupac: 'dimethyl-3-oxo', issue: 'C6H12O6 vs C21H30O3' },
        { mol: 'hexahydroxy', iupac: 'steroid', issue: 'Simple sugar vs complex steroid' },
        { mol: 'trioksan', iupac: 'methylpentan', issue: 'C3H6O3 vs C6H12O' },
        { mol: 'trioxane', iupac: 'methylpentan', issue: 'C3H6O3 vs C6H12O' },
        { mol: 'benzil', iupac: 'dihydroxyprop', issue: 'C7H8O (benzyl alcohol) vs C3H6O3 (glyceraldehyde)' },
        { mol: 'benzyl', iupac: 'dihydroxyprop', issue: 'C7H8O vs C3H6O3' }
      ];

      let mismatchDetected = false;
      for (const mismatch of knownMismatches) {
        if (moleculeName.includes(mismatch.mol) && iupacName.includes(mismatch.iupac)) {
          console.warn('⚠️ Known IUPAC-Molecule Mismatch detected');
          console.warn(`   Issue: ${mismatch.issue}`);
          parsed.confidence = Math.min(parsed.confidence || 100, 25);
          mismatchDetected = true;
          break;
        }
      }

      // ========================================================================
      // STEP 3: KARBON SAYISI DOĞRULAMA (KİMYAGER KURALI)
      // ========================================================================
      if (!mismatchDetected && formulaCarbon > 0 && iupacCarbonCount > 0) {
        const carbonDiff = Math.abs(formulaCarbon - iupacCarbonCount);

        // Kimyagerler için tolerans: ±1 kabul edilebilir (isomer, tautomer)
        // ±2 veya daha fazla → YANLIŞ CID!
        const TOLERANCE = 1;

        if (carbonDiff > TOLERANCE) {
          // ✅ İYİLEŞTİRME: Eğer IUPAC'tan çıkarılan karbon sayısı 0 ise, algoritma başarısız olmuş demektir
          // Bu durumda validation'ı atla (algoritma yetersiz, ama molekül yanlış olmayabilir)
          if (iupacCarbonCount === 0) {
            console.warn('⚠️ IUPAC karbon sayısı çıkarılamadı (algoritma yetersiz), validation atlanıyor');
            console.warn(`   IUPAC: ${parsed.iupacName}`);
            console.warn(`   Formül: ${parsed.formula} → ${formulaCarbon} karbon`);
            // Validation'ı atla, confidence'ı düşürme
          } else {
            console.warn('⚠️ Carbon count mismatch detected (validation warning)');
            console.warn(`   Formül: ${parsed.formula} → ${formulaCarbon} karbon`);
            console.warn(`   IUPAC: ${parsed.iupacName} → ${iupacCarbonCount} karbon`);
            console.warn(`   FARK: ${carbonDiff} (Tolerans: ±${TOLERANCE})`);
            
            // Kimyager kuralı: ±2 veya fazla fark → kesinlikle yanlış
            if (carbonDiff >= 4) {
              parsed.confidence = Math.min(parsed.confidence || 100, 15); // Çok ciddi hata
              console.warn(`   ⚠️ KRİTİK: Confidence → ${parsed.confidence}% (CID yanlış olabilir)`);
            } else if (carbonDiff >= 2) {
              parsed.confidence = Math.min(parsed.confidence || 100, 25);
              console.warn(`   ⚠️ CİDDİ: Confidence → ${parsed.confidence}% (CID kontrol edilmeli)`);
            } else {
              parsed.confidence = Math.min(parsed.confidence || 100, 45);
              console.warn(`   ⚠️ UYARI: Confidence → ${parsed.confidence}% (küçük fark, kontrol edin)`);
            }

            mismatchDetected = true;
          }
        } else {
          console.log(`   ✅ Karbon sayısı uyumlu (fark: ${carbonDiff}, tolerans dahilinde)`);
        }
      }

      // ========================================================================
      // STEP 4: ELEMENT COMPOSITION VALIDATION (KİMYAGER KURALI)
      // ========================================================================
      if (!mismatchDetected) {
        // Extract elements from formula
        const hasN = parsed.formula.includes('N');
        const hasO = parsed.formula.includes('O');
        const hasHalogen = /[FClBrI]/.test(parsed.formula);

        // Check nitrogen compounds
        const nitrogenIndicators = ['amin', 'amine', 'nitr', 'pyridin', 'pyrazine', 'imid', 'azole', 'cyan'];
        const hasNitrogenInIUPAC = nitrogenIndicators.some(ind => iupacName.includes(ind));

        if (hasNitrogenInIUPAC && !hasN) {
          console.warn('⚠️ IUPAC suggests nitrogen but formula has none');
          console.warn(`   IUPAC: ${parsed.iupacName} (nitrogen compound)`);
          console.warn(`   Formula: ${parsed.formula} (no N)`);
          parsed.confidence = Math.min(parsed.confidence || 100, 20);
          mismatchDetected = true;
        } else if (!hasNitrogenInIUPAC && hasN) {
          console.warn('⚠️ Formula has nitrogen but IUPAC does not suggest it');
          console.warn(`   IUPAC: ${parsed.iupacName} (no nitrogen indicators)`);
          console.warn(`   Formula: ${parsed.formula} (contains N)`);
          parsed.confidence = Math.min(parsed.confidence || 100, 20);
          mismatchDetected = true;
        }

        // Check oxygen compounds
        if (!mismatchDetected) {
          const oxygenIndicators = ['ol', 'one', 'oic', 'oxy', 'hydroxy', 'hidroksi', 'keto', 'aldehyd', 'ester', 'ether'];
          const hasOxygenInIUPAC = oxygenIndicators.some(ind => iupacName.includes(ind));

          if (hasOxygenInIUPAC && !hasO) {
            console.warn('⚠️ IUPAC suggests oxygen but formula has none');
            console.warn(`   IUPAC: ${parsed.iupacName} (oxygen compound)`);
            console.warn(`   Formula: ${parsed.formula} (no O)`);
            parsed.confidence = Math.min(parsed.confidence || 100, 20);
            mismatchDetected = true;
          }
        }

        // Check halogens
        if (!mismatchDetected) {
          const halogenIndicators = ['fluoro', 'chloro', 'bromo', 'iodo', 'kloro', 'flor', 'brom', 'iyot'];
          const hasHalogenInIUPAC = halogenIndicators.some(ind => iupacName.includes(ind));

          if (hasHalogenInIUPAC && !hasHalogen) {
            console.warn('⚠️ IUPAC suggests halogen but formula has none');
            console.warn(`   IUPAC: ${parsed.iupacName} (halogen compound)`);
            console.warn(`   Formula: ${parsed.formula} (no F/Cl/Br/I)`);
            parsed.confidence = Math.min(parsed.confidence || 100, 30);
            mismatchDetected = true;
          }
        }
      }

      // ========================================================================
      // STEP 5: Final validation result
      // ========================================================================
      if (mismatchDetected) {
        console.warn('⚠️ IUPAC validation warning (confidence adjusted)');
        // ✅ İYİLEŞTİRME: console.error yerine console.warn kullan, analizi tamamen reddetme
        // Confidence zaten düşürüldü, kullanıcı karar versin
      } else {
        console.log('✅ IUPAC validation PASSED');
      }
    }

    // CID Validation
    let validCid = null;
    if (parsed.cid !== undefined && parsed.cid !== null) {
      const parsedCid = typeof parsed.cid === 'string' ? parseInt(parsed.cid) : parsed.cid;
      if (!isNaN(parsedCid) && parsedCid > 0 && Number.isInteger(parsedCid)) {
        validCid = parsedCid;
      }
    }

    // Return with validated CID
    return {
      ...parsed,
      cid: validCid
    };
  } catch (parseError) {
    console.error('JSON Parse Error:', parseError);
    console.error('Finish reason:', finishReason);
    console.error('Failed to parse. Text length:', text.length);
    console.error('First 500 chars:', text.substring(0, 500));
    console.error('Last 500 chars:', text.substring(Math.max(0, text.length - 500)));

    // Retry once with a compact JSON-only instruction if response was likely truncated.
    if (
      finishReason === 'length' ||
      (parseError instanceof Error &&
        /unterminated|string|unexpected end|json/i.test(parseError.message))
    ) {
      try {
        const retryResponse = await fetch(`${apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `${systemPrompt}

CRITICAL OUTPUT MODE (RETRY — önceki yanıt kesildi veya JSON kırıldı):
- Return ONLY strict JSON object.
- smiles: max 400 chars OR empty string for polymer/class; NEVER megabyte-long repeating SMILES.
- Keep reasoning concise (max 1200 chars).
- alternatives max 3.
- Never include markdown fences.`
              },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 16384,
            response_format: { type: 'json_object' }
          })
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryText = retryData.choices?.[0]?.message?.content;
          const retryFinish = retryData.choices?.[0]?.finish_reason;
          if (retryText) {
            let retryJson = extractJsonCandidate(retryText).trim();
            if (retryFinish === 'length' || smilesStringUnterminated(retryJson)) {
              retryJson = repairTruncatedSmilesJson(retryJson);
            }
            const retryParsed = JSON.parse(retryJson);
            return {
              ...retryParsed,
              cid: retryParsed.cid
                ? (typeof retryParsed.cid === 'string' ? parseInt(retryParsed.cid) : retryParsed.cid)
                : null
            };
          }
        }
      } catch (retryError) {
        console.error('Retry parse failed:', retryError);
      }
    }

    // Try one more aggressive fix: extract JSON object boundaries
    try {
      const extracted = extractJsonCandidate(text);
      const jsonStart = extracted.indexOf('{');
      const jsonEnd = extracted.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const extractedJson = extracted.substring(jsonStart, jsonEnd + 1);
        
        // Try to fix common issues
        // 1. Fix unterminated strings by finding the end of the JSON object
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let fixedJson = '';
        
        for (let i = 0; i < extractedJson.length; i++) {
          const char = extractedJson[i];
          
          if (escapeNext) {
            fixedJson += char;
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            fixedJson += char;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            fixedJson += char;
          } else if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            fixedJson += char;
          } else {
            fixedJson += char;
          }
        }
        
        // If we're still in a string at the end, try to close it
        if (inString && fixedJson.length > 0) {
          // Find the last complete property and close the string there
          const lastCompleteProp = fixedJson.lastIndexOf('",');
          if (lastCompleteProp !== -1) {
            // We might have an unterminated string, try to fix it
            const beforeProp = fixedJson.substring(0, lastCompleteProp + 2);
            const afterProp = extractedJson.substring(lastCompleteProp + 2);
            // Try to find where the next property or closing brace should be
            const nextPropMatch = afterProp.match(/^\s*"([^"]+)":\s*"([^"]*)$/);
            if (nextPropMatch) {
              // This property seems incomplete, try to close it
              const propName = nextPropMatch[1];
              const propValue = nextPropMatch[2];
              // Try to find a reasonable end point
              const nextComma = afterProp.indexOf(',', nextPropMatch[0].length);
              const nextBrace = afterProp.indexOf('}', nextPropMatch[0].length);
              
              if (nextComma !== -1 || nextBrace !== -1) {
                const endPoint = Math.min(
                  nextComma !== -1 ? nextComma : Infinity,
                  nextBrace !== -1 ? nextBrace : Infinity
                );
                fixedJson = beforeProp + `"${propName}": "${propValue}",` + afterProp.substring(endPoint);
              }
            }
          }
        }
        
        const finalParsed = JSON.parse(fixedJson);
        console.log('✅ Successfully parsed after aggressive fix');
        return {
          ...finalParsed,
          cid: finalParsed.cid ? (typeof finalParsed.cid === 'string' ? parseInt(finalParsed.cid) : finalParsed.cid) : null
        };
      }
    } catch (aggressiveFixError) {
      console.error('Aggressive fix also failed:', aggressiveFixError);
    }

    // Final fallback - try to extract key fields with regex
    try {
      const moleculeNameMatch = text.match(/"moleculeName"\s*:\s*"([^"]*)"/);
      const formulaMatch = text.match(/"formula"\s*:\s*"([^"]*)"/);
      const confidenceMatch = text.match(/"confidence"\s*:\s*(\d+)/);
      const iupacMatch = text.match(/"iupacName"\s*:\s*"([^"]*)"/);
      
      return {
        moleculeName: moleculeNameMatch ? moleculeNameMatch[1] : 'Parse Error',
        iupacName: iupacMatch ? iupacMatch[1] : undefined,
        formula: formulaMatch ? formulaMatch[1] : 'Unknown',
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
        reasoning: `Failed to parse AI response completely. Partial data extracted. Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        functionalGroups: [],
        cid: null
      };
    } catch (extractionError) {
      console.error('Field extraction also failed:', extractionError);
    }

    // Ultimate fallback
    return {
      moleculeName: 'Parse Error',
      formula: 'Unknown',
      confidence: 0,
      reasoning: `Failed to parse AI response. Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response length: ${text.length} chars.`,
      functionalGroups: [],
      cid: null
    };
  }
}
