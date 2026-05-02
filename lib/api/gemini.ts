import { NMRPeak, AIAnalysisResult } from '@/lib/types';
import { normalizeIntegrations, detectIntegrationProblems } from '@/lib/utils/integrationNormalizer';

// ✅ Lazy load: Functional Group Library (2973 satır, 68KB)
const loadFunctionalGroupLibrary = async () => {
  const module = await import('@/lib/data/functionalGroupLibrary');
  return {
    findByH1Shift: module.findByH1Shift,
    findByC13Shift: module.findByC13Shift,
    DIAGNOSTIC_PEAKS: module.DIAGNOSTIC_PEAKS,
    DIAGNOSTIC_IR: module.DIAGNOSTIC_IR
  };
};

export async function fetchGeminiAnalysis(
  apiKey: string,
  model: string,
  userPeaks: NMRPeak[],
  spectrumType: 'nmr' | 'ftir' | 'c13' = 'nmr',
  algorithmicContext: string = '',
  libraryMatchesContext: string = '',
  solvent: string = 'DMSO',
  frequency: number = 300,
  jointModalityContext: string = ''
): Promise<AIAnalysisResult> {
  console.log('Gemini API Call:', {
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'EMPTY',
    model,
    peakCount: userPeaks.length
  });

  const totalProtons = userPeaks.reduce((sum, p) => sum + (p.integ || 0), 0);

  // Integration Analysis (for NMR only)
  let normalizedPeaksInfo = '';
  if (spectrumType === 'nmr' && userPeaks.length > 0) {
    const problems = detectIntegrationProblems(userPeaks);
    const normResult = normalizeIntegrations(userPeaks);

    const integrationWarnings = [
      ...normResult.warnings,
      ...(problems.hasProblems ? ['⚠️ Integration Problems Detected:', ...problems.problems, 'Suggestions:', ...problems.suggestions] : [])
    ];

    normalizedPeaksInfo = `
📊 **INTEGRATION ANALİZİ (Silverstein Systematic Method):**
- Normalization method: ${normResult.method}
- Multiplier used: ${normResult.multiplier}
- Scale factor: ${normResult.scaleFactor.toFixed(3)}
- Total H: ${normResult.totalH}
- Confidence score: ${normResult.confidenceScore}%

${integrationWarnings.length > 0 ? '⚠️ WARNINGS:\n' + integrationWarnings.join('\n') : ''}

**Normalized Peak Integrations:**
${normResult.normalizedPeaks.map(p =>
  `δ ${p.shift.toFixed(2)}: ${p.integ}H (original: ${p.integOriginal?.toFixed(2)})`
).join('\n')}
`;
  }

  // Functional Group Analysis from 80-group library
  let functionalGroupAnalysis = '';
  if (spectrumType === 'nmr' && userPeaks.length > 0) {
    // ✅ Lazy load library sadece NMR analizi için
    const { findByH1Shift, DIAGNOSTIC_PEAKS } = await loadFunctionalGroupLibrary();

    const peakAnalysis: Array<{
      peak: NMRPeak;
      possibleGroups: any[];
      diagnosticLevel: 'definitive' | 'highly_probable' | 'possible';
    }> = [];

    userPeaks.forEach(peak => {
      const matches = findByH1Shift(peak.shift, 0.3);

      // Determine diagnostic level
      let diagnosticLevel: 'definitive' | 'highly_probable' | 'possible' = 'possible';

      // Check if this is a diagnostic peak
      const diagnosticMatch = Object.values(DIAGNOSTIC_PEAKS).find((dp: any) =>
        peak.shift >= dp.range[0] && peak.shift <= dp.range[1]
      );

      if (diagnosticMatch) {
        diagnosticLevel = 'definitive';
      } else if (matches.length > 0 && matches.length <= 2) {
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
  const { peak, possibleGroups, diagnosticLevel } = analysis;

  let levelEmoji = diagnosticLevel === 'definitive' ? '✅' :
                   diagnosticLevel === 'highly_probable' ? '⚡' : '💡';

  return `${levelEmoji} **Peak ${idx + 1}: δ ${peak.shift.toFixed(2)} ppm (${peak.mult || 's'}, ${peak.integ || 0}H)**
  Diagnostic Level: ${diagnosticLevel.toUpperCase()}

  Possible Functional Groups:
${possibleGroups.length > 0
  ? possibleGroups.map((fg, i) => {
      const matchingRange = fg.h1nmr.find((h: any) =>
        peak.shift >= h.ppm[0] && peak.shift <= h.ppm[1]
      );
      return `  ${i + 1}. ${fg.name} (${fg.nameEn})
     - Expected: ${matchingRange?.description || fg.h1nmr[0].description}
     - Diagnostic features: ${fg.diagnosticFeatures.join(', ')}
     ${fg.warnings ? '⚠️ ' + fg.warnings.join('; ') : ''}`;
    }).join('\n')
  : '  No direct matches - may be unusual chemical environment'}
`;
}).join('\n')}
`;
  }

  const peakStr = userPeaks
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
`;

  const systemPrompt = `Sen deneyimli bir NMR spektroskopisti ve organik kimyagersin. ¹H-NMR spektrumlarını profesyonel olarak analiz edip molekül yapısını belirleyebiliyorsun.${theoreticalMethodology}
${spectroMindInterpretationContract}

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
   - ⚠️ **DO NOT compute DBE** - The application will compute it automatically from the locked formula

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

   ⚠️ **ÖNCE FORMÜL DOĞRULAMASI YAP!**

   Step 1: Context IUPAC → formül türet
   Step 2: Context formula ile KARŞILAŞTIR
   Step 3: MISMATCH → Context IUPAC YANLIŞ! REDDET!
   Step 4: MATCH → Context IUPAC'ı kullan

   **WRONG Example:**
   - Context IUPAC: "2-(1H-indol-3-yl)ethanamine" → C10H12N2
   - Context formula: C23H26N2O4
   - Match: ❌ → REJECT! SMILES'tan türet!

   ✅ MATCH → AYNEN kullan
   ❌ MISMATCH → REDDET, SMILES'tan türet!

2️⃣ **Context'te IUPAC Yoksa:**

   ⚠️ **MUTLAKA:** SMILES + PEAKS kullanarak türet!

   **SMILES Parsing (En Önemli!):**
   - "CC(=O)C" → ketone at C2 → "propan-2-one"
   - "CC(=O)Oc1ccccc1C(=O)O" → ester + aromatic + acid → "2-acetoxybenzoic acid"

   **Peaks ile Validate Et:**
   - FTIR: 1715 cm⁻¹ → C=O ketone
   - NMR: δ 7-8 ppm → aromatic
   - NMR: δ 9-10 ppm → aldehyde

   ⚠️ **DO NOT compute DBE** - The application will compute it automatically

3️⃣ **Türetme Örnekleri (SMILES + Peaks):**
   - SMILES "CC(=O)C" + FTIR 1715 → "propan-2-one"
   - SMILES "CC(=O)Oc1ccccc1C(=O)O" + FTIR 1754,1685 → "2-acetoxybenzoic acid"
   - SMILES "Cc1ccccc1" + NMR δ 7.2 → "methylbenzene"
   - SMILES "CC(C)=CCCC(C)(O)C=C" + FTIR 3400,1640 → "3,7-dimethylocta-1,6-dien-3-ol"

4️⃣ **Functional Group Priority:**
   Carboxylic acid > Ester > Amide > Aldehyde > Ketone > Alcohol > Amine

5️⃣ **Common Mistakes - AVOID:**
   ❌ Common name as IUPAC (e.g., "Aspirin", "Linalool")
   ❌ Missing position numbers (e.g., "propanone" → should be "propan-2-one")
   ❌ Wrong stereochemistry notation

✅ **ALWAYS:** iupacName field MUST contain systematic IUPAC name, not common name!

🚨 **FORMULA VALIDATION - MANDATORY:**

⚠️ Your suggested IUPAC's formula MUST MATCH context formula EXACTLY!

**Validation:**
1. Context formula: C23H26N2O4
2. Your suggestion → derive formula
3. IF MISMATCH → Confidence = 0% ❌

**WRONG Example:**
- Context: C23H26N2O4 (23C, 2N)
- Suggestion: "phenol" (6C, 0N) ❌ INVALID!

**CORRECT Example:**
- Context: C7H9N
- Suggestion: "phenylmethanamine" (C7H9N) ✅

❌ Formula mismatch = Confidence 0%!
❌ Context has N → Suggestion MUST have N!
- Peak'leri dikkatlice karşılaştır, benzer yapıları ayırt et
- Linalool ≠ Geraniol (farklı vinilik protonları!)
- Her zaman peak pattern'ini ve yapısal özellikleri kontrol et

📖 **SİLVERSTEIN NMR SPECTROSCOPY - ADVANCED RULES (80 FUNCTIONAL GROUP LIBRARY):**

**A. DIAGNOSTIC PEAKS - DEFİNİTİVE FUNCTIONAL GROUP INDICATORS:**
- δ 9.0-10.5 ppm → ALDEHYDE (CHO) - Very distinctive!
- δ 11.0-12.0 ppm → CARBOXYLIC ACID (COOH) - Very broad!
- δ 10.0-11.0 ppm → PHENOLIC OH (Ar-OH)
- δ 5.0-6.0 ppm (d, t, dt) → ALKENE (C=C-H) - Veto rule!
- δ 7.0-8.0 ppm (complex pattern) → AROMATIC RING

**B. INTEGRATION NORMALIZATION (Silverstein Method):**
1. Find smallest integration value
2. Divide all by smallest → Get ratios
3. Multiply by 2, 3, 4... until whole numbers (max multiplier: 12)
4. Verify total H matches molecular formula

Example: Raw 1.76 : 2.64 : 1.77 : 2.59
→ ÷1.76 → 1.0 : 1.5 : 1.01 : 1.47
→ ×2 → 2 : 3 : 2 : 3 (Total: 10H) ✅

**C. SPECIAL CHEMICAL ENVIRONMENTS:**
- **Enol Protons (C=C-OH):** δ 15-17 ppm (very downfield!)
- **Imidazole NH:** δ 12-14 ppm (very broad)
- **Nitroalkane α-H:** δ 4.3-4.5 ppm (deshielded)
- **Epoxide Ring:** δ 2.5-3.5 ppm (characteristic)

**D. COUPLING CONSTANTS (J values):**
- **³J (vicinal):** 6-8 Hz (typical)
- **²J (geminal):** 10-16 Hz (CH₂)
- **⁴J (allylic/benzylic):** 1-3 Hz (weak, long-range)
- **Aromatic ortho:** 7-9 Hz
- **Aromatic meta:** 2-3 Hz
- **Aromatic para:** 0-1 Hz

**E. BROAD PEAKS - SPECIAL CASES:**
- **NH₂ (Primary Amine):** Usually broad singlet, can be two separate peaks
- **OH (Alcohol):** Broad singlet, exchanges with D₂O
- **COOH:** EXTREMELY broad (10-13 ppm), can disappear!
- **NH (Secondary Amine):** Broad singlet

**F. MULTIPLICITY SPECIAL PATTERNS:**
- **Roof Effect (Skewing):** AB system → Multiplets lean toward each other
- **Second-order Splitting:** When Δδ/J < 10 → Complex patterns
- **Long-range Coupling:** Allylic (⁴J), benzylic (⁴J)

**G. FUNCTIONAL GROUP PRIORITIES (80-Group Library):**
When multiple groups match, prioritize:
1. Diagnostic peaks (definitive identification)
2. Integration matches (H count fits)
3. Multiplicity patterns (coupling makes sense)
4. Chemical shift + multiplicity + integration ALL match

**H. AROMATIC SUBSTITUTION PATTERNS:**
- **Monosubstituted:** δ 7.2-7.4 (5H, complex)
- **Ortho (1,2):** δ 7.0-7.8 (4H, two doublets)
- **Meta (1,3):** δ 6.8-7.5 (4H, complex)
- **Para (1,4):** δ 6.8-7.5 (4H, two doublets, symmetric)

**I. ELECTRONEGATIVE ATOM EFFECTS (α-Effect):**
- α-O: +2.5-3.5 ppm shift
- α-N: +2.0-2.5 ppm shift
- α-Cl: +2.5-3.0 ppm shift
- α-Br: +2.5-3.5 ppm shift
- α-C=O: +1.0-2.0 ppm shift

**J. ANISOTROPIC EFFECTS:**
- **Benzene Ring:** Deshielding above/below plane
- **Carbonyl Group:** Deshielding in-plane, shielding perpendicular
- **C≡C Triple Bond:** Shielding effect (acetylene δ ~2-3 ppm)

**K. EXCHANGEABLE PROTONS:**
- Add D₂O → OH, NH, SH disappear
- Broad peaks often indicate exchange
- Temperature affects exchange rate

**L. ALKENE STEREOCHEMISTRY:**
- **Trans (E):** ³J = 12-18 Hz (large)
- **Cis (Z):** ³J = 6-12 Hz (medium)
- **Geminal (=CH₂):** ²J = 0-3 Hz (small)

**M. CARBOXYLIC ACIDS (δ 11.0-12.0 ppm) - CRITICAL:**
⚠️ CRITICAL: Peak can be SO BROAD it disappears into baseline!
- Very concentration dependent
- H-bonding causes extreme broadening
- In D₂O: COOH → COOD (peak becomes invisible!)
- Integration may be unreliable

**N. AMIDES - RESTRICTED ROTATION:**
- NH₂ protons → TWO SEPARATE PEAKS (restricted rotation!)
- Rotation barrier ~15-20 kcal/mol
- At room temperature: slow exchange → distinct signals
- Heating → coalescence → single broad peak

**O. NITROALKANES:**
- α-CH₂: δ 4.3-4.5 ppm (strongly deshielded)
- α-CH: δ 4.4-4.6 ppm
- Diagnostic: High chemical shift for aliphatic CH

**P. SYSTEMATIC PROBLEM SOLVING (Silverstein Method):**
1. **Identify obvious functional groups** (diagnostic peaks)
2. **Calculate molecular formula** from integration
3. **Determine DBE** (degree of unsaturation)
4. **Assign each peak** to structural fragment
5. **Assemble structure** logically
6. **Validate** with all spectroscopic data

**Q. MULTIPLET SKEWING (Roof Effect):**
- When two multiplets "lean" toward each other → Coupled!
- Indicates which protons are neighbors
- Very useful for structure determination
- Example: CH₂-CH₂ → Two triplets lean toward each other

📚 **IUPAC NOMENKLATÜR GEREKSİNİMLERİ (KRİTİK - HATALI IUPAC KABUL EDİLMEZ!):**

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

**KURAL:**
1. "moleculeName" = Yaygın kullanılan isim (common/trivial name)
2. "iupacName" = O MOLEKÜLün IUPAC sistematik adı (BAŞKA MOLEKÜLÜN ADI DEĞİL!)
3. Her molekül için FARKLI IUPAC adı olmalıdır!

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

JSON format:
{
  "moleculeName": "Molekül adı (common name)",
  "iupacName": "⚠️ KRİTİK: Bu molekülün KENDİ IUPAC adı! BAŞKA molekülün adını YAZMA! Örn: 'para-Nitrotoluene' ise '1-Methyl-4-nitrobenzene', 'Phenol' ise 'Benzenol', 'Aspirin' ise '2-(Acetyloxy)benzoic acid'",
  "formula": "⚠️ KRİTİK: Eğer context'te 'CRITICAL IDENTITY LOCK' uyarısı varsa, belirtilen formülü AYNEN kullan! Spektrumdan formül türetme! Örnek: 'C10H12N2O'",
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

**ÖNEMLİ: FTIR TAHMİNİ ZORUNLU!**
predicted_ftir array'ine MUTLAKA 7-10 adet FTIR piki ekle.
Her fonksiyonel grup için gerçekçi pikler ekle:

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

  const userPrompt = `${spectrumType.toUpperCase()} Spektrumu:

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  console.log('API URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));

  const requestBody = {
    contents: [{
      parts: [
        { text: `${systemPrompt}\n\n${userPrompt}` }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  console.log('Request Body:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;
    throw new Error(`Gemini API error: ${errorMessage}`);
  }

  const data = await response.json();

  console.log('Full API Response:', data);
  console.log('Candidates:', data.candidates);
  console.log('First candidate:', data.candidates?.[0]);

  // Try different response structures
  let text = '';

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = data.candidates[0].content.parts[0].text;
  } else if (data.candidates?.[0]?.output) {
    text = data.candidates[0].output;
  } else if (data.candidates?.[0]?.text) {
    text = data.candidates[0].text;
  } else if (data.text) {
    text = data.text;
  } else if (typeof data.candidates?.[0] === 'string') {
    text = data.candidates[0];
  }

  if (!text) {
    console.error('No text in response. Full data:', JSON.stringify(data, null, 2));
    throw new Error('AI yanıtı boş geldi. candidates yapısı beklenenden farklı. Console loglarını kontrol edin.');
  }

  console.log('Extracted text:', text);

  // Parse JSON from markdown code blocks if present
  let jsonText = text;

  // Try to extract JSON from markdown code blocks
  const jsonCodeBlock = text.match(/```json\n([\s\S]*?)\n```/);
  if (jsonCodeBlock) {
    jsonText = jsonCodeBlock[1];
  } else {
    // Try to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  console.log('Extracted JSON:', jsonText);

  // Clean up LaTeX and special characters that break JSON
  let cleanedJson = jsonText
    .replace(/\$\\delta\$/g, 'δ')          // Replace LaTeX delta with symbol
    .replace(/\$\\alpha\$/g, 'α')          // Replace LaTeX alpha
    .replace(/\$\\beta\$/g, 'β')           // Replace LaTeX beta
    .replace(/\$([^$]+)\$/g, '$1')         // Remove other LaTeX $ wrappers
    .replace(/\\"/g, '"')                   // Fix escaped quotes
    .replace(/\n/g, ' ')                    // Remove newlines in strings
    .replace(/\r/g, '');                    // Remove carriage returns

  console.log('Cleaned JSON:', cleanedJson);

  try {
    const parsed = JSON.parse(cleanedJson);
    console.log('Successfully parsed:', parsed);

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
    console.error('Failed to parse:', cleanedJson);
    console.error('Original text:', text);

    // Try one more time with more aggressive cleaning
    try {
      // Extract just the key fields manually as fallback
      const match = cleanedJson.match(/"moleculeName"\s*:\s*"([^"]+)"/);
      const formulaMatch = cleanedJson.match(/"formula"\s*:\s*"([^"]+)"/);
      const confidenceMatch = cleanedJson.match(/"confidence"\s*:\s*(\d+)/);

      if (match) {
        return {
          moleculeName: match[1],
          formula: formulaMatch ? formulaMatch[1] : 'Unknown',
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
          reasoning: 'Partial parse - check console for full response',
          functionalGroups: []
        };
      }
    } catch (fallbackError) {
      console.error('Fallback parse also failed:', fallbackError);
    }

    // Final fallback
    return {
      moleculeName: 'Parse Error',
      formula: 'Unknown',
      confidence: 0,
      reasoning: `Failed to parse AI response. Raw response: ${text.substring(0, 200)}...`,
      functionalGroups: []
    };
  }
}
