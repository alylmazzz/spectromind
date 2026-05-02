import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { FUNCTIONAL_GROUP_LIBRARY } from '@/lib/data/functionalGroupLibrary';
import { enhanceTheoreticalSpectrum } from '@/lib/utils/theoreticalSpectrum';
import { MoleculePipelineService } from '@/lib/pipeline/MoleculePipelineService';

/**
 * AI NMR Prediction API
 *
 * Molekül yapısı (SMILES/InChI) ve Crossref literatür referanslarını kullanarak
 * AI ile NMR spektrum tahmini yapar
 *
 * ✅ Silverstein NMR kuralları ile güçlendirilmiş
 * ✅ Fonksiyonel grup kütüphanesi entegre
 * ✅ Literatür abstract'ları çekiliyor
 * ✅ GPT-4O kullanılıyor
 */

interface AIPredictionRequest {
  moleculeName: string;
  userQuery?: string; // Kullanıcının yazdığı orijinal isim
  smiles?: string;
  inchi?: string;
  formula?: string; // Moleküler formül (örn: C47H51NO14)
  cid?: number; // PubChem CID (SMILES çözümlemesi için)
  literature: Array<{
    doi: string;
    title: string;
    url: string;
  }>;
  hosePredictions?: Array<{
    atom: string;
    shift: number;
    confidence?: number;
  }>; // RDKit/HOSE tahminleri
}

/**
 * Crossref API'den DOI'ye göre abstract çeker
 */
async function fetchAbstractFromDOI(doi: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, {
      headers: {
        'User-Agent': 'SpectroMind/1.0 (mailto:support@spectromind.app)'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const abstract = data.message?.abstract;

    // Remove XML/HTML tags from abstract
    if (abstract) {
      return abstract.replace(/<[^>]*>/g, '').trim();
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch abstract for DOI ${doi}:`, error);
    return null;
  }
}

/**
 * Fonksiyonel grup kütüphanesini AI'ya gönderilebilir formata çevirir
 */
function buildFunctionalGroupContext(): string {
  let context = '\n\n📚 **SILVERSTEIN NMR FUNCTIONAL GROUP LIBRARY (80+ Groups):**\n\n';

  // En önemli 30 grubu seç (prompt boyutunu azaltmak için)
  const importantGroups = FUNCTIONAL_GROUP_LIBRARY.slice(0, 30);

  importantGroups.forEach(group => {
    context += `**${group.name} (${group.nameEn})** - ${group.structure}\n`;
    context += `  ¹H NMR: ${group.h1nmr.map(h => `${h.range} (${h.description}${h.multiplicity ? ', ' + h.multiplicity : ''})`).join('; ')}\n`;
    if (group.diagnosticFeatures.length > 0) {
      context += `  🔬 Key: ${group.diagnosticFeatures[0]}\n`;
    }
    context += '\n';
  });

  return context;
}

/**
 * SMILES'tan basit yapısal analiz yapar
 * (RDKit tam entegrasyonu için Python gerekir, bu basit regex bazlı analiz)
 */
function analyzeStructureFromSMILES(smiles: string): string {
  if (!smiles) return '';

  let analysis = '\n\n🧪 **STRUCTURAL ANALYSIS FROM SMILES:**\n\n';

  // Aromatik halkalar
  const aromaticRings = (smiles.match(/c1ccccc1|C1=CC=CC=C1/gi) || []).length;
  if (aromaticRings > 0) {
    analysis += `- Contains ${aromaticRings} aromatic ring(s) → expect peaks at 6.5-8.5 ppm\n`;
  }

  // Fonksiyonel gruplar
  if (smiles.includes('C(=O)O') || smiles.includes('COOH')) {
    analysis += '- Carboxylic acid group (-COOH) → expect COOH peak at 10-13 ppm (br s)\n';
  }
  if (smiles.includes('C(=O)') && !smiles.includes('C(=O)O')) {
    analysis += '- Carbonyl group (C=O) → adjacent CH peaks deshielded (+0.5-1.0 ppm)\n';
  }
  if (smiles.includes('OH') || smiles.includes('O')) {
    analysis += '- Hydroxyl or ether group → expect peaks at 3.0-5.0 ppm region\n';
  }
  if (smiles.includes('N')) {
    analysis += '- Nitrogen-containing → N-H or N-CH3 peaks expected\n';
  }
  if (smiles.includes('Cl') || smiles.includes('Br')) {
    analysis += '- Halogen present → adjacent CH peaks deshielded\n';
  }

  // Çift bağlar
  const doubleBonds = (smiles.match(/C=C/g) || []).length;
  if (doubleBonds > 0) {
    analysis += `- ${doubleBonds} C=C double bond(s) → vinylic H at 4.5-6.5 ppm\n`;
  }

  return analysis;
}

export async function POST(request: NextRequest) {
  try {
    const body: AIPredictionRequest = await request.json();
    const { moleculeName, userQuery, smiles: initialSmiles, inchi, formula, cid, literature, hosePredictions } = body;

    // Kullanıcının yazdığı ismi kullan (varsa), yoksa PubChem'den gelen ismi kullan
    const displayName = userQuery ? userQuery.toUpperCase() : moleculeName;

    // ⚠️ SMILES değişkenini let olarak tanımla (yeniden atama yapılabilmesi için)
    let smiles = initialSmiles;

    console.log('\n🤖 AI NMR Prediction Request (Enhanced):');
    console.log(`  User Query: ${userQuery || 'N/A'}`);
    console.log(`  Molecule: ${moleculeName}`);
    console.log(`  Display Name: ${displayName}`);
    console.log(`  Formula: ${formula || 'N/A'}`);
    console.log(`  SMILES: ${smiles || 'N/A'}`);
    console.log(`  Literature: ${literature.length} publications`);
    console.log(`  HOSE Predictions: ${hosePredictions?.length || 0} peaks`);

    if (!moleculeName) {
      return NextResponse.json({
        success: false,
        error: 'Molecule name is required'
      }, { status: 400 });
    }

    // ⚠️ SMILES ZORUNLULUĞU: SMILES yoksa önce Name-to-Structure modülü çalıştır
    if (!smiles && !inchi) {
      console.warn('⚠️ SMILES ve InChI yok, Name-to-Structure modülü çalıştırılıyor...');
      
      try {
        // Strategy 0: Eğer body'de cid varsa, önce CID'den SMILES çek
        if (body.cid) {
          console.log(`  🔍 Strategy 0: CID'den SMILES çekiliyor (CID: ${body.cid})...`);
          try {
            const cidSmilesResponse = await fetch(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${body.cid}/property/CanonicalSMILES,IsomericSMILES/JSON`,
              {
                headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
                signal: AbortSignal.timeout(5000)
              }
            );

            if (cidSmilesResponse.ok) {
              const cidSmilesData = await cidSmilesResponse.json();
              const cidProps = cidSmilesData.PropertyTable?.Properties?.[0];
              const resolvedSmiles = cidProps?.IsomericSMILES || cidProps?.CanonicalSMILES;
              
              if (resolvedSmiles) {
                smiles = resolvedSmiles;
                console.log(`✅ SMILES CID'den bulundu: ${resolvedSmiles.substring(0, 50)}...`);
              }
            }
          } catch (cidError) {
            console.warn(`  ⚠️ CID'den SMILES çekilemedi:`, cidError);
          }
        }

        // Strategy 1: PubChem'den molekül adı ile SMILES çek
        if (!smiles) {
          const pubchemSearchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(moleculeName)}/property/CanonicalSMILES,IsomericSMILES/JSON`;
          const pubchemResponse = await fetch(pubchemSearchUrl, {
            headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
            signal: AbortSignal.timeout(5000)
          });

          if (pubchemResponse.ok) {
            const pubchemData = await pubchemResponse.json();
            const props = pubchemData.PropertyTable?.Properties?.[0];
            const resolvedSmiles = props?.IsomericSMILES || props?.CanonicalSMILES;
            
            if (resolvedSmiles) {
              smiles = resolvedSmiles; // ✅ let olarak tanımlı, yeniden atama yapılabilir
              console.log(`✅ SMILES PubChem'den bulundu: ${resolvedSmiles.substring(0, 50)}...`);
            }
          }
        }

        // Strategy 2: IUPAC varsa OPSIN ile çevir
        if (!smiles && moleculeName) {
          // IUPAC format kontrolü (basit)
          const isIUPAC = /^[0-9,\-\(\)]*[a-zA-Z]+([0-9,\-\(\)]*[a-zA-Z]+)*$/.test(moleculeName);
          
          if (isIUPAC) {
            const opsinResponse = await fetch(`${request.nextUrl.origin}/api/opsin?name=${encodeURIComponent(moleculeName)}`, {
              signal: AbortSignal.timeout(5000)
            });

            if (opsinResponse.ok) {
              const opsinData = await opsinResponse.json();
              if (opsinData.success && opsinData.smiles) {
                smiles = opsinData.smiles; // ✅ let olarak tanımlı, yeniden atama yapılabilir
                console.log(`✅ SMILES OPSIN ile bulundu: ${opsinData.smiles.substring(0, 50)}...`);
              }
            }
          }
        }

        // Strategy 3: SMILES hala yoksa hata döndür
        if (!smiles) {
          console.error('❌ SMILES çözülemedi, AI tahmini yapılamaz');
          return NextResponse.json({
            success: false,
            error: 'SMILES required for accurate prediction. Could not resolve structure from name. Please provide SMILES or InChI.',
            suggestion: 'Try searching for the molecule in PubChem first to get structure data.'
          }, { status: 400 });
        }

        // SMILES bulundu, devam et
        console.log(`✅ SMILES resolved, AI prediction can proceed`);

      } catch (resolveError) {
        console.error('❌ Name-to-Structure resolution error:', resolveError);
        return NextResponse.json({
          success: false,
          error: 'Failed to resolve SMILES from molecule name',
          details: resolveError instanceof Error ? resolveError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // 1. FETCH ABSTRACTS FROM LITERATURE
    console.log('  📚 Fetching abstracts from Crossref...');
    const literatureWithAbstracts = await Promise.all(
      literature.slice(0, 3).map(async (pub) => { // Limit to 3 for performance
        const abstract = await fetchAbstractFromDOI(pub.doi);
        return {
          ...pub,
          abstract: abstract || 'No abstract available'
        };
      })
    );

    const abstractsFound = literatureWithAbstracts.filter(pub => pub.abstract !== 'No abstract available').length;
    console.log(`  ✅ ${abstractsFound}/${literatureWithAbstracts.length} abstracts retrieved`);

    // 2. BUILD FUNCTIONAL GROUP CONTEXT
    const functionalGroupContext = buildFunctionalGroupContext();

    // 3. ANALYZE STRUCTURE FROM SMILES
    const structuralAnalysis = smiles ? analyzeStructureFromSMILES(smiles) : '';

    // 3.5. EXTRACT HYDROGEN AND CARBON COUNT FROM MOLECULAR FORMULA
    // IDENTITY LOCK: Use computed values from pipeline if available, else parse formula
    // Declare computed values (populated later by pipeline, defaults used at prompt time)
    let computedFormula = formula; // Fallback to user input
    let computedTotalH = 0;
    let computedTotalC = 0;
    let computedDBE: number | undefined;
    let totalHydrogens = computedTotalH;
    let totalCarbons = computedTotalC;
    
    if (totalHydrogens === 0 && computedFormula) {
      // Fallback: Parse computed formula
      const hMatch = computedFormula.match(/H(\d+)/);
      if (hMatch) {
        totalHydrogens = parseInt(hMatch[1]);
      }
    }
    
    if (totalCarbons === 0 && computedFormula) {
      // Fallback: Parse computed formula
      const cMatch = computedFormula.match(/C(\d+)/);
      if (cMatch) {
        totalCarbons = parseInt(cMatch[1]);
      }
    }
    
    // If still zero, try parsing user input formula (last resort)
    if (totalHydrogens === 0 && formula) {
      const hMatch = formula.match(/H(\d+)/);
      if (hMatch) {
        totalHydrogens = parseInt(hMatch[1]);
        console.log(`  🧮 Total hydrogens from user formula: ${totalHydrogens}`);
      }
    }
    
    if (totalCarbons === 0 && formula) {
      const cMatch = formula.match(/C(\d+)/);
      if (cMatch) {
        totalCarbons = parseInt(cMatch[1]);
        console.log(`  🧮 Total carbons from user formula: ${totalCarbons}`);
      }
    }
    
    if (computedTotalH > 0) {
      console.log(`  🔒 Total hydrogens (computed): ${computedTotalH}`);
    }
    if (computedTotalC > 0) {
      console.log(`  🔒 Total carbons (computed): ${computedTotalC}`);
    }
    if (computedDBE !== undefined) {
      console.log(`  🔒 DBE (computed): ${computedDBE}`);
    }

    // 3.6. BUILD HOSE PREDICTIONS CONTEXT
    let hoseContext = '';
    if (hosePredictions && hosePredictions.length > 0) {
      hoseContext = '\n\n🔬 **RDKIT/HOSE CODE PREDICTIONS (Reference Data):**\n\n';
      hoseContext += 'The following chemical shifts were calculated using RDKit HOSE (Hierarchically Ordered Spherical Environment) algorithm:\n\n';

      // Group by carbon atoms (HOSE gives predictions for H atoms attached to carbons)
      hosePredictions.forEach((pred, idx) => {
        hoseContext += `${idx + 1}. Atom ${pred.atom}: δ ${pred.shift.toFixed(2)} ppm\n`;
      });

      hoseContext += `\n📊 **HOSE Statistics:** ${hosePredictions.length} hydrogen predictions generated\n`;
      if (totalHydrogens > 0 && hosePredictions.length !== totalHydrogens) {
        hoseContext += `⚠️ **Note:** HOSE predicted ${hosePredictions.length} hydrogens, but molecular formula shows ${totalHydrogens} total hydrogens. Some hydrogens (e.g., OH, NH) may not have HOSE predictions.\n`;
      }
      hoseContext += '\n⚠️ **Note:** HOSE predictions are quantum-chemistry based and should be used as reference points. You should refine these with functional group analysis and literature data.\n';
    }

    // 4. BUILD ENHANCED PROMPT WITH SILVERSTEIN RULES
    const prompt = `You are an expert NMR spectroscopist trained in Silverstein's systematic approach to spectroscopy.

I need you to predict the ¹H NMR spectrum for: **${displayName}**
${displayName !== moleculeName ? `(Note: User searched for "${displayName}", PubChem name is "${moleculeName}")` : ''}

${computedFormula ? `**MOLECULAR FORMULA (COMPUTED FROM STRUCTURE):** ${computedFormula}\n` : formula ? `**MOLECULAR FORMULA:** ${formula}\n` : ''}${computedDBE !== undefined ? `**DBE (Degree of Unsaturation, COMPUTED):** ${computedDBE}\n` : ''}${totalCarbons > 0 ? `**Total Carbons:** ${totalCarbons}${computedTotalC > 0 ? ' (computed from structure)' : ' (from formula)'}\n` : ''}${totalHydrogens > 0 ? `**Total Hydrogens:** ${totalHydrogens}${computedTotalH > 0 ? ' (computed from structure)' : ' (from formula)'}\n⚠️ **CRITICAL:** This molecule has **${totalHydrogens} total hydrogens**. The sum of all integration values MUST equal ${totalHydrogens}H.\n` : ''}${smiles ? `**SMILES:** ${smiles}\n` : ''}${inchi ? `**InChI:** ${inchi}\n` : ''}${structuralAnalysis}

═══════════════════════════════════════════════════════════════════
📚 LITERATURE REFERENCES WITH ABSTRACTS:
═══════════════════════════════════════════════════════════════════

${literatureWithAbstracts.map((pub, idx) => `
${idx + 1}. **${pub.title}**
   DOI: ${pub.doi}
   URL: ${pub.url}
   Abstract: ${pub.abstract}
`).join('\n')}
${hoseContext}
${functionalGroupContext}

═══════════════════════════════════════════════════════════════════
🔬 SILVERSTEIN NMR ANALYSIS METHODOLOGY:
═══════════════════════════════════════════════════════════════════

**STEP 1: IDENTIFY FUNCTIONAL GROUPS**
- Analyze molecular structure (SMILES/InChI)
- Match functional groups with Silverstein library above
- Determine chemical shift ranges for each group

**STEP 2: CALCULATE CHEMICAL SHIFTS**
- Use standard ppm ranges from functional group library
- Apply shielding/deshielding effects:
  * Electronegative atoms (O, N, Cl, Br) → downfield shift (+ppm)
  * Aromatic rings → 6.5-8.5 ppm
  * Aldehydic H → 9-10 ppm
  * Vinylic H → 4.5-6.5 ppm
  * Aliphatic H → 0.8-3.0 ppm

**STEP 3: DETERMINE MULTIPLICITY (n+1 rule + Complex Patterns)**
- Count neighboring protons (n)
- Basic multiplicity = n+1
- **Simple multiplicities:**
  * s (singlet, n=0, J=0) - No coupling
  * d (doublet, n=1, one J value) - One neighbor
  * t (triplet, n=2, one J value) - Two equivalent neighbors
  * q (quartet, n=3, one J value) - Three equivalent neighbors
- **Complex multiplicities (MANDATORY for complex molecules!):**
  * dd (doublet of doublets, 2 J values) - Two different neighbors
  * dt (doublet of triplets, 2 J values) - One neighbor + two equivalent neighbors
  * td (triplet of doublets, 2 J values) - Two equivalent neighbors + one different neighbor
  * ddd (doublet of doublets of doublets, 3 J values) - Three different neighbors
  * m (multiplet, variable J values) - Complex overlapping patterns
- **CRITICAL:** For complex molecules (like Paclitaxel with 51H), you MUST use complex multiplicities (dd, dt, td, ddd, m) NOT just singlets!

**STEP 3.5: CALCULATE COUPLING CONSTANTS (J VALUES) - MANDATORY!**
⚠️ **CRITICAL:** Every non-singlet peak MUST have J value(s)!

**J Value Rules:**
1. **³J (Vicinal Coupling - Most Common):**
   - Aliphatic ³J: 6-8 Hz (typical)
   - Aromatic ortho (³J): 7-10 Hz
   - Vinyl trans (³J): 11-18 Hz (LARGE!)
   - Vinyl cis (³J): 6-15 Hz
   - Karplus Equation: J = A·cos²θ + B·cosθ + C
     * θ = 0° or 180° → J ≈ 8-12 Hz (maximum)
     * θ = 90° → J ≈ 0-2 Hz (minimum, may appear as singlet!)
     * θ = 60° → J ≈ 4-6 Hz (intermediate)

2. **²J (Geminal Coupling):**
   - CH₂ geminal: 10-15 Hz
   - Aromatic CH₂: 12-18 Hz
   - Vinyl CH₂: 0-3 Hz (often unresolved)

3. **⁴J (Long-range Coupling):**
   - Aromatic meta (⁴J): 2-3 Hz (small but measurable)
   - Allylic (⁴J): 1-3 Hz
   - W-coupling (⁴J): 1-2 Hz

4. **⁵J (Very Long-range):**
   - Aromatic para (⁵J): 0-1 Hz (essentially zero, may appear as singlet)

**J Value Calculation Strategy:**
- For each peak, identify ALL neighboring protons
- Count equivalent vs. non-equivalent neighbors
- Apply Karplus equation for vicinal couplings (if dihedral angle known)
- Use typical ranges based on structural context:
  * Aromatic ring → ortho J = 7-10 Hz, meta J = 2-3 Hz
  * Aliphatic chain → ³J = 6-8 Hz
  * Vinyl → trans J = 12-18 Hz, cis J = 6-12 Hz
  * Rigid ring → may have 90° dihedral → J ≈ 0 Hz (singlet appearance)

**Examples:**
- Aromatic ortho protons: d, J = 7.2-8.5 Hz
- Aliphatic CH-CH: t or d, J = 6-8 Hz
- Vinyl trans: d, J = 12-18 Hz
- Complex aromatic: dd, J = 7.2, 2.4 Hz (ortho + meta)
- Rigid ring CH: s (J ≈ 0 Hz due to 90° dihedral)

**STEP 4: CALCULATE INTEGRATION**
- Count equivalent protons in each group
- Report as whole number ratios

**STEP 5: CONSIDER SOLVENT**
- CDCl3: residual peak at 7.26 ppm (DO NOT include in prediction!)
- D2O: residual peak at 4.79 ppm (DO NOT include in prediction!)
- DMSO-d6: residual peak at 2.50 ppm (DO NOT include in prediction!)

═══════════════════════════════════════════════════════════════════
✅ REAL MOLECULE EXAMPLES (NOT CHCl3!):
═══════════════════════════════════════════════════════════════════

**Example 1: Ethyl Acetate (CH3COOCH2CH3)**
{
  "peaks": [
    {"shift": 1.26, "multiplicity": "t", "integration": "3H", "coupling": 7.0, "assignment": "CH3 (ethyl)"},
    {"shift": 2.05, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3CO"},
    {"shift": 4.12, "multiplicity": "q", "integration": "2H", "coupling": 7.0, "assignment": "OCH2"}
  ]
}

**Example 2: Complex Aromatic (showing dd pattern)**
{
  "peaks": [
    {"shift": 7.74, "multiplicity": "d", "integration": "2H", "coupling": 7.2, "assignment": "Aromatic ortho H"},
    {"shift": 7.60, "multiplicity": "t", "integration": "1H", "coupling": 7.4, "assignment": "Aromatic para H"},
    {"shift": 7.01, "multiplicity": "d", "integration": "1H", "coupling": 8.9, "assignment": "Aromatic meta H"},
    {"shift": 5.79, "multiplicity": "dd", "integration": "1H", "coupling": [8.9, 2.4], "assignment": "Complex aromatic (ortho + meta coupling)"}
  ]
}

**Example 2: Benzyl Alcohol (C6H5CH2OH)**
{
  "peaks": [
    {"shift": 7.34, "multiplicity": "m", "integration": "5H", "coupling": [7.5, 2.0], "assignment": "Aromatic H (complex pattern)"},
    {"shift": 4.63, "multiplicity": "s", "integration": "2H", "coupling": 0, "assignment": "CH2"},
    {"shift": 2.10, "multiplicity": "br s", "integration": "1H", "coupling": 0, "assignment": "OH"}
  ]
}

**Example 3: Acetone (CH3COCH3)**
{
  "peaks": [
    {"shift": 2.17, "multiplicity": "s", "integration": "6H", "coupling": 0, "assignment": "2 × CH3"}
  ]
}

**Example 4: COMPLEX MOLECULE - Paclitaxel (Taxol, C47H51NO14) - 51H**
⚠️ **CRITICAL EXAMPLE:** This shows how to predict complex molecules with MANY peaks and COMPLEX multiplicities!
{
  "peaks": [
    {"shift": 8.13, "multiplicity": "d", "integration": "2H", "coupling": 7.2, "assignment": "Aromatic ortho H"},
    {"shift": 7.74, "multiplicity": "d", "integration": "2H", "coupling": 7.2, "assignment": "Aromatic ortho H"},
    {"shift": 7.60, "multiplicity": "t", "integration": "1H", "coupling": 7.4, "assignment": "Aromatic para H"},
    {"shift": 7.50, "multiplicity": "m", "integration": "5H", "coupling": [7.5, 2.0], "assignment": "Aromatic multiplet"},
    {"shift": 7.40, "multiplicity": "m", "integration": "5H", "coupling": [7.5, 2.0], "assignment": "Aromatic multiplet"},
    {"shift": 7.01, "multiplicity": "d", "integration": "1H", "coupling": 8.9, "assignment": "Aromatic meta H"},
    {"shift": 6.27, "multiplicity": "s", "integration": "1H", "coupling": 0, "assignment": "Isolated proton"},
    {"shift": 6.23, "multiplicity": "t", "integration": "1H", "coupling": 9.0, "assignment": "Vinylic H"},
    {"shift": 5.79, "multiplicity": "dd", "integration": "1H", "coupling": [8.9, 2.4], "assignment": "Complex coupling (ortho + meta)"},
    {"shift": 5.68, "multiplicity": "d", "integration": "1H", "coupling": 7.0, "assignment": "Vinylic H"},
    {"shift": 4.95, "multiplicity": "dd", "integration": "1H", "coupling": [9.5, 2.0], "assignment": "Complex coupling"},
    {"shift": 4.80, "multiplicity": "d", "integration": "1H", "coupling": 2.5, "assignment": "Long-range coupling"},
    {"shift": 4.40, "multiplicity": "m", "integration": "1H", "coupling": [8.0, 4.0], "assignment": "Complex multiplet"},
    {"shift": 4.30, "multiplicity": "d", "integration": "1H", "coupling": 8.4, "assignment": "Vicinal coupling"},
    {"shift": 4.20, "multiplicity": "d", "integration": "1H", "coupling": 8.4, "assignment": "Vicinal coupling"},
    {"shift": 3.80, "multiplicity": "d", "integration": "1H", "coupling": 7.0, "assignment": "Vicinal coupling"},
    {"shift": 2.55, "multiplicity": "m", "integration": "1H", "coupling": [7.0, 4.0], "assignment": "Complex multiplet"},
    {"shift": 2.48, "multiplicity": "d", "integration": "1H", "coupling": 4.0, "assignment": "Long-range coupling"},
    {"shift": 2.39, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3 (isolated)"},
    {"shift": 2.30, "multiplicity": "m", "integration": "2H", "coupling": [7.0, 4.0], "assignment": "Complex multiplet"},
    {"shift": 2.24, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3 (isolated)"},
    {"shift": 1.89, "multiplicity": "m", "integration": "1H", "coupling": [7.0, 4.0], "assignment": "Complex multiplet"},
    {"shift": 1.79, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3 (isolated)"},
    {"shift": 1.68, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3 (isolated)"},
    {"shift": 1.23, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3 (isolated)"},
    {"shift": 1.14, "multiplicity": "s", "integration": "3H", "coupling": 0, "assignment": "CH3 (isolated)"}
  ]
}
**KEY OBSERVATIONS:**
- Total: 26 peaks for 51H (many unique environments!)
- Complex multiplicities: d, t, m, dd (NOT just singlets!)
- J values present: 7.2, 7.4, 8.9, 9.0, 2.4, 7.0, 9.5, 2.0, 8.4, 4.0 Hz
- Aromatic region: 7-8 ppm (multiple peaks with coupling)
- Aliphatic region: 1-5 ppm (many peaks with various multiplicities)
- Singlets ONLY for isolated CH3 groups (not for complex aromatic/aliphatic protons!)

═══════════════════════════════════════════════════════════════════
📋 YOUR TASK:
═══════════════════════════════════════════════════════════════════

Provide ¹H NMR prediction for **${displayName}** in this JSON format:

{
  "confidence": 0.85,
  "method": "Silverstein systematic analysis + literature",
  "solvent": "CDCl3",
  "frequency": "400 MHz",
  "peaks": [
    {
      "shift": 7.34,
      "multiplicity": "m",
      "integration": "5H",
      "assignment": "Aromatic protons on phenyl ring"
    }
  ],
  "structuralAnalysis": "Detailed explanation of how you determined each peak based on functional groups and Silverstein rules",
  "literatureInsights": "Summary of NMR information found in abstracts (if any)",
  "notes": "Prediction based on Silverstein methodology. Actual experimental values may vary by ±0.1-0.3 ppm."
}

⚠️ **CRITICAL INSTRUCTIONS:**
1. DO NOT include solvent peaks (7.26 for CDCl3, 4.79 for D2O, 2.50 for DMSO)
2. Use functional group library above for accurate chemical shift ranges
3. **🚨 MANDATORY SMILES FORMAT - ISOMERIC SMILES REQUIRED:**
   - When generating SMILES codes, you MUST use Isomeric SMILES format that includes stereochemistry
   - Isomeric SMILES includes @ and @@ symbols to indicate chiral centers (R/S configuration)
   - **Geometric isomers require / and \\ symbols:**
     * **Trans (E) configuration:** /C=C/ (both slashes same direction, drawn as zigzag)
     * **Cis (Z) configuration:** /C=C\\ (slashes opposite/inward, drawn as C-shape)
     * Example: Resveratrol (trans - natural form): OC1=CC(=CC(O)=C1)/C=C/C2=CC=C(O)C=C2
     * Example: Resveratrol (cis - isomer): OC1=CC(=CC(O)=C1)/C=C\C2=CC=C(O)C=C2
   - For complex molecules like Paclitaxel with multiple chiral centers, you MUST include ALL stereochemistry markers (@, @@, /, \\)
   - Example: CC1=C2[C@H](C(=O)[C@@]3(...)) - NOT simplified canonical SMILES like c1ccc(cc1)c2ccccc2
   - If a SMILES is provided in the context, USE IT EXACTLY - DO NOT generate a new simplified version!
   - Never simplify or truncate SMILES strings - they must be complete and include all stereochemistry
3. **🚨 MANDATORY MULTIPLICITY RULES - SINGLET YASAĞI:**
   - **FOR COMPLEX MOLECULES (${totalHydrogens >= 30 ? 'LIKE THIS ONE WITH ' + totalHydrogens + 'H' : totalHydrogens > 0 ? totalHydrogens + 'H' : ''}):**
     * ❌ **DO NOT USE ONLY SINGLETS!** This is WRONG for complex molecules!
     * ✅ **MUST use COMPLEX multiplicities:** d, t, m, dd, dt, td, ddd
     * ✅ Aromatic protons → d, t, m, dd (NOT singlet!)
     * ✅ Aliphatic protons with neighbors → d, t, m, dd (NOT singlet!)
     * ✅ Singlets ONLY for isolated CH3 groups or protons with NO neighbors
   - Count ALL neighboring protons (equivalent and non-equivalent)
   - Apply n+1 rule for simple cases, but recognize complex patterns
   - Aromatic rings → complex multiplets (m) or dd patterns (NOT singlet!)
   - Aliphatic chains → t, d, q patterns (NOT singlet unless isolated!)
   - Rigid rings → may show singlet due to 90° dihedral (J ≈ 0), but this is RARE!
4. **MANDATORY J VALUE RULES:**
   - EVERY non-singlet peak MUST have a "coupling" field!
   - Singlets: "coupling": 0 (ONLY for isolated protons!)
   - Simple multiplicities (d, t, q): "coupling": <number> (single J value in Hz)
   - Complex multiplicities (dd, dt, td, ddd): "coupling": [<J1>, <J2>, ...] (array of J values)
   - Typical J ranges:
     * Aromatic ortho: 7-10 Hz
     * Aromatic meta: 2-3 Hz
     * Aliphatic vicinal: 6-8 Hz
     * Vinyl trans: 12-18 Hz
     * Vinyl cis: 6-12 Hz
5. **PEAK COUNT REQUIREMENT - CRITICAL:**
   - For ${totalHydrogens}H, you MUST predict MANY peaks!
   - **Minimum peak count:**
     * ${totalHydrogens >= 50 ? 'For 50+ H: AT LEAST 20-30 peaks' : totalHydrogens >= 30 ? 'For 30+ H: AT LEAST 15-25 peaks' : totalHydrogens >= 20 ? 'For 20+ H: AT LEAST 10-15 peaks' : 'For smaller molecules: 5-10 peaks'}
   - Complex molecules have many unique proton environments
   - Account for symmetry (equivalent protons combine)
   - But don't over-consolidate - each unique environment should have its own peak
   - **Example:** Paclitaxel (51H) has 25+ peaks, NOT 10!
6. **VALIDATION CHECKLIST (Before submitting):**
   - ✅ Total integration = ${totalHydrogens}H?
   - ✅ Peak count >= ${totalHydrogens >= 50 ? '20' : totalHydrogens >= 30 ? '15' : totalHydrogens >= 20 ? '10' : '5'}?
   - ✅ Complex multiplicities used (NOT just singlets)?
   - ✅ J values present for all non-singlets?
   - ✅ Aromatic protons have coupling (d, t, m, dd)?
7. Check abstracts for any mentioned NMR data
8. Be realistic about confidence (0.6-0.9 for predictions)
9. Explain your reasoning in structuralAnalysis field
${totalHydrogens > 0 ? `10. **MANDATORY:** Sum of all integration values MUST equal ${totalHydrogens}H (from molecular formula ${formula}). Double-check your integrations!\n` : ''}${totalCarbons > 0 && hosePredictions && hosePredictions.length > 0 ? `11. **VALIDATION:** HOSE predicted ${hosePredictions.length} hydrogen atoms. Molecular formula shows ${totalCarbons} carbons and ${totalHydrogens} hydrogens. Use HOSE predictions as reference but ensure your final prediction accounts for ALL ${totalHydrogens} hydrogens.\n` : ''}
Now predict the ¹H NMR spectrum for **${displayName}**:`;

    console.log('  📤 Sending to GPT-4O (enhanced model)...');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    let aiResponse: string | null = null;
    let usedProvider = 'OpenAI';

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // ✅ GPT-4O for better chemistry knowledge
        messages: [
          {
            role: 'system',
            content: 'You are a world-class NMR spectroscopist with expertise in Silverstein methodology, functional group analysis, and structure elucidation. You provide highly accurate predictions in strict JSON format with detailed reasoning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Lower temperature for more consistent predictions
        max_tokens: 5000 // ✅ Artırıldı: Uzun SMILES (Paclitaxel gibi) için yeterli token
      });

      aiResponse = completion.choices[0].message.content;
      console.log('  ✅ AI response received (GPT-4O)');
    } catch (openaiError: any) {
      // Check if it's a quota/rate limit error (429)
      // OpenAI APIError has status, code, and message properties
      const isQuotaError = 
        openaiError?.status === 429 || 
        openaiError?.code === 'insufficient_quota' ||
        openaiError?.type === 'insufficient_quota' ||
        (openaiError?.message && (
          openaiError.message.includes('429') || 
          openaiError.message.includes('quota') ||
          openaiError.message.includes('exceeded')
        ));
      
      if (isQuotaError) {
        console.warn('  ⚠️ OpenAI quota exceeded (429), falling back to Gemini...');
        
        // Fallback to Gemini
        try {
          const geminiApiKey = process.env.GEMINI_API_KEY;
          
          if (!geminiApiKey) {
            console.warn('  ⚠️ GEMINI_API_KEY not configured. Skipping fallback.');
            throw new Error('GEMINI_API_KEY not configured. Cannot use fallback. Please add GEMINI_API_KEY to .env.local');
          }

          console.log('  🔄 Attempting Gemini fallback...');
          
          // Convert prompt to Gemini format - use the same system prompt structure
          const systemPrompt = 'You are a world-class NMR spectroscopist with expertise in Silverstein methodology, functional group analysis, and structure elucidation. You provide highly accurate predictions in strict JSON format with detailed reasoning.';
          const geminiPrompt = `${systemPrompt}\n\n${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any markdown formatting or code blocks.`;
          
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: geminiPrompt }]
                }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 5000,
                  responseMimeType: 'application/json'
                }
              }),
              signal: AbortSignal.timeout(60000) // 60 second timeout
            }
          );

          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error(`  ❌ Gemini API error (${geminiResponse.status}):`, errorText.substring(0, 200));
            throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText.substring(0, 100)}`);
          }

          const geminiData = await geminiResponse.json();
          
          // Try multiple response paths
          aiResponse = 
            geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
            geminiData.candidates?.[0]?.output ||
            geminiData.text ||
            null;
            
          if (!aiResponse) {
            console.error('  ❌ Gemini response structure unexpected:', JSON.stringify(geminiData).substring(0, 500));
            throw new Error('Gemini returned empty or unexpected response structure');
          }
          
          usedProvider = 'Gemini (Fallback)';
          console.log('  ✅ AI response received (Gemini fallback)');
        } catch (geminiError) {
          console.error('  ❌ Gemini fallback failed:', geminiError);
          // Re-throw with more context
          const errorMsg = geminiError instanceof Error ? geminiError.message : 'Unknown error';
          throw new Error(`OpenAI quota exceeded (429) and Gemini fallback failed: ${errorMsg}. Please check GEMINI_API_KEY in .env.local or wait for OpenAI quota to reset.`);
        }
      } else {
        // Other OpenAI errors - rethrow
        throw openaiError;
      }
    }

    if (!aiResponse) {
      throw new Error('Empty AI response');
    }

    // Parse AI response with error handling
    let prediction: any;
    try {
      prediction = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('  ❌ JSON parse error:', parseError);
      console.error('  Raw response preview:', aiResponse.substring(0, 500));
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        try {
          prediction = JSON.parse(jsonMatch[1]);
          console.log('  ✅ Extracted JSON from code block');
        } catch {
          throw new Error('Failed to parse AI response even from code block');
        }
      } else {
        throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    console.log(`  📊 Confidence: ${prediction.confidence || 'N/A'}`);
    console.log(`  🔬 Peaks predicted: ${prediction.peaks?.length || 0}`);

    // ✅ VALIDATION: Check peak count vs molecular formula
    const validationWarnings: string[] = [];
    const validationErrors: string[] = [];
    let totalIntegration = 0;
    let needsRetry = false; // Flag for retry with enhanced prompt
    
    if (totalHydrogens > 0 && prediction.peaks) {
      totalIntegration = prediction.peaks.reduce((sum: number, p: any) => {
        const integ = typeof p.integration === 'string' 
          ? parseFloat(p.integration.replace('H', '')) 
          : (p.integration || 1);
        return sum + integ;
      }, 0);

      const atomDifference = Math.abs(totalIntegration - totalHydrogens);
      const integrationRatio = totalIntegration / totalHydrogens;
      
      // 🚨 KRİTİK: 5 atom fazla veya eksik varsa retry yap
      // Ayrıca kompleks moleküller için peak sayısı çok azsa da retry yap
      if (atomDifference >= 5) {
        const errorMsg = `CRITICAL INTEGRATION MISMATCH: Total integration (${totalIntegration.toFixed(1)}H) doesn't match formula (${totalHydrogens}H). Difference: ${atomDifference.toFixed(1)} atoms. This indicates missing or incorrect peaks. Retrying with enhanced validation...`;
        console.warn(`  🚨 ${errorMsg}`);
        validationErrors.push(errorMsg);
        needsRetry = true;
      } else if (totalHydrogens >= 30 && prediction.peaks && prediction.peaks.length < 15) {
        // Kompleks moleküller için peak sayısı kontrolü
        const errorMsg = `INSUFFICIENT PEAK COUNT: Only ${prediction.peaks.length} peaks predicted for ${totalHydrogens}H molecule. Complex molecules should have many unique proton environments. Retrying with enhanced prompt...`;
        console.warn(`  🚨 ${errorMsg}`);
        validationErrors.push(errorMsg);
        needsRetry = true;
      } else if (integrationRatio < 0.5 || integrationRatio > 2.0) {
        const errorMsg = `INTEGRATION MISMATCH: Total integration (${totalIntegration.toFixed(1)}H) doesn't match formula (${totalHydrogens}H). Ratio: ${integrationRatio.toFixed(2)}x (should be ~1.0x). This may indicate missing peaks, overlapping peaks, or incorrect formula.`;
        console.warn(`  ⚠️  ${errorMsg}`);
        validationErrors.push(errorMsg);
      } else if (Math.abs(integrationRatio - 1.0) > 0.1) {
        const warningMsg = `Minor integration mismatch: ${totalIntegration.toFixed(1)}H vs ${totalHydrogens}H expected (${((integrationRatio - 1.0) * 100).toFixed(1)}% difference)`;
        console.warn(`  ⚠️  ${warningMsg}`);
        validationWarnings.push(warningMsg);
      } else {
        console.log(`  ✅ Integration matches formula: ${totalIntegration.toFixed(1)}H = ${totalHydrogens}H`);
      }
    }

    // ✅ VALIDATION: Check peak count and multiplicity patterns
    if (prediction.peaks && prediction.peaks.length > 0) {
      // Check for singlet-only prediction (WRONG for complex molecules!)
      const singletCount = prediction.peaks.filter((p: any) => 
        (p.multiplicity || 's').toLowerCase().trim() === 's'
      ).length;
      const singletRatio = singletCount / prediction.peaks.length;
      
      if (totalHydrogens >= 30 && singletRatio > 0.7) {
        const errorMsg = `SINGLET-ONLY PREDICTION DETECTED: ${singletCount}/${prediction.peaks.length} peaks are singlets (${(singletRatio * 100).toFixed(0)}%). Complex molecules (${totalHydrogens}H) MUST have complex multiplicities (d, t, m, dd, dt, td, ddd)! Retrying with enhanced prompt...`;
        console.warn(`  🚨 ${errorMsg}`);
        validationErrors.push(errorMsg);
        needsRetry = true;
      }
      
      // Check peak count
      if (totalHydrogens > 0 && prediction.peaks.length > totalHydrogens * 2) {
        const warningMsg = `Too many peaks (${prediction.peaks.length}) for ${totalHydrogens} hydrogens. This may indicate overlapping peaks or incorrect structure.`;
        console.warn(`  ⚠️  ${warningMsg}`);
        validationWarnings.push(warningMsg);
      } else if (totalHydrogens > 0) {
        // Minimum peak count requirements
        const minPeaks = totalHydrogens >= 50 ? 20 : totalHydrogens >= 30 ? 15 : totalHydrogens >= 20 ? 10 : 5;
        
        if (prediction.peaks.length < minPeaks) {
          const warningMsg = `Very few peaks (${prediction.peaks.length}) for ${totalHydrogens} hydrogens. Minimum expected: ${minPeaks} peaks. Check for molecular symmetry or missing peaks.`;
          console.warn(`  ⚠️  ${warningMsg}`);
          validationWarnings.push(warningMsg);
          
          // For complex molecules, this is a critical error
          if (totalHydrogens >= 30 && prediction.peaks.length < minPeaks) {
            console.warn(`  🚨 CRITICAL: Complex molecule with ${totalHydrogens}H but only ${prediction.peaks.length} peaks predicted (minimum: ${minPeaks}). This suggests missing peaks or over-consolidation.`);
            if (!needsRetry) {
              validationErrors.push(`Insufficient peak count: ${prediction.peaks.length} peaks for ${totalHydrogens}H molecule (minimum: ${minPeaks}). Complex molecules should have many unique proton environments.`);
              needsRetry = true; // Trigger retry for insufficient peak count
            }
          }
        } else if (prediction.peaks.length < totalHydrogens * 0.3) {
          const warningMsg = `Few peaks (${prediction.peaks.length}) for ${totalHydrogens} hydrogens. Check for molecular symmetry or missing peaks.`;
          console.warn(`  ⚠️  ${warningMsg}`);
          validationWarnings.push(warningMsg);
        }
      }
      
      // Check for missing J values in non-singlets
      const nonSingletsWithoutJ = prediction.peaks.filter((p: any) => {
        const mult = (p.multiplicity || 's').toLowerCase().trim();
        return mult !== 's' && !p.coupling && p.coupling !== 0;
      });
      
      if (nonSingletsWithoutJ.length > 0) {
        const warningMsg = `${nonSingletsWithoutJ.length} non-singlet peak(s) missing J values. All non-singlet peaks MUST have coupling constants!`;
        console.warn(`  ⚠️  ${warningMsg}`);
        validationWarnings.push(warningMsg);
      }
    }

    // ✅ VALIDATION: Check carbon count for 13C NMR (if applicable)
    if (totalCarbons > 0 && prediction.c13Peaks) {
      const carbonPeakCount = prediction.c13Peaks.length;
      if (carbonPeakCount > totalCarbons * 1.5) {
        const warningMsg = `Too many 13C peaks (${carbonPeakCount}) for ${totalCarbons} carbons. Check for overlapping peaks.`;
        validationWarnings.push(warningMsg);
      } else if (carbonPeakCount < totalCarbons * 0.4) {
        const warningMsg = `Very few 13C peaks (${carbonPeakCount}) for ${totalCarbons} carbons. Check for molecular symmetry.`;
        validationWarnings.push(warningMsg);
      }
    }

    // 🔄 RETRY WITH ENHANCED VALIDATION: If 5+ atom difference, retry with stricter prompt
    if (needsRetry && totalHydrogens > 0) {
      const originalDifference = Math.abs(totalIntegration - totalHydrogens);
      console.log(`\n  🔄 RETRYING: ${originalDifference.toFixed(1)} atom difference detected. Retrying with enhanced validation prompt...`);
      
      // Build enhanced retry prompt with all available information
      const retryPrompt = `🚨 **CRITICAL VALIDATION RETRY - PREVIOUS PREDICTION HAD ${originalDifference.toFixed(1)} ATOM MISMATCH**

You are an expert NMR spectroscopist. Your previous prediction for **${displayName}** had a critical error:
- **Expected total hydrogens (from formula):** ${totalHydrogens}H
- **Your previous prediction total:** ${totalIntegration.toFixed(1)}H
- **Difference:** ${Math.abs(totalIntegration - totalHydrogens).toFixed(1)} atoms ${totalIntegration < totalHydrogens ? 'MISSING' : 'EXTRA'}

**MANDATORY REQUIREMENTS FOR THIS RETRY:**
1. **EXACT INTEGRATION MATCH:** Sum of ALL integration values MUST equal EXACTLY ${totalHydrogens}H (no exceptions!)
2. **COMPLETE PEAK COVERAGE:** Account for ALL ${totalHydrogens} hydrogens in the molecule
3. **MISSING PEAKS IDENTIFICATION:** If previous prediction was missing peaks, identify which proton environments were missed:
   - Exchangeable protons (OH, NH, SH) that may be broad or hidden?
   - Equivalent protons that should be combined?
   - Overlapping peaks that need separation?
   - Symmetric environments that reduce peak count?
4. **STRUCTURAL VALIDATION:** Use the 2D structure (SMILES/InChI) to count ALL unique proton environments
5. **🚨 CRITICAL: MULTIPLICITY & COUPLING - SINGLET YASAĞI:**
   - ❌ **DO NOT USE ONLY SINGLETS!** Previous prediction had too many singlets - this is WRONG!
   - ✅ **MUST use COMPLEX multiplicities:** d, t, m, dd, dt, td, ddd
   - ✅ Aromatic protons → d, t, m, dd (NOT singlet!)
   - ✅ Aliphatic protons with neighbors → d, t, m, dd (NOT singlet!)
   - ✅ Singlets ONLY for isolated CH3 groups or protons with NO neighbors
   - EVERY non-singlet peak MUST have "coupling" field
   - Simple multiplicities: "coupling": <number>
   - Complex multiplicities: "coupling": [<J1>, <J2>, ...]
   - Typical J values: Aromatic ortho 7-10 Hz, meta 2-3 Hz, aliphatic 6-8 Hz
6. **PEAK COUNT - CRITICAL:**
   - For ${totalHydrogens}H, predict MANY peaks!
   - **Minimum: ${totalHydrogens >= 50 ? '20-30 peaks' : totalHydrogens >= 30 ? '15-25 peaks' : totalHydrogens >= 20 ? '10-15 peaks' : '5-10 peaks'}**
   - Complex molecules have many unique environments
   - Example: Paclitaxel (51H) has 25+ peaks, NOT 10!
7. **VALIDATION CHECKLIST:**
   - ✅ Total integration = ${totalHydrogens}H?
   - ✅ Peak count >= ${totalHydrogens >= 50 ? '20' : totalHydrogens >= 30 ? '15' : totalHydrogens >= 20 ? '10' : '5'}?
   - ✅ Complex multiplicities used (NOT just singlets)?
   - ✅ J values present for all non-singlets?

**MOLECULE INFORMATION:**
${formula ? `**MOLECULAR FORMULA:** ${formula}\n` : ''}${totalCarbons > 0 ? `**Total Carbons:** ${totalCarbons}\n` : ''}**Total Hydrogens (MANDATORY TARGET):** ${totalHydrogens}H\n${smiles ? `**SMILES (2D Structure):** ${smiles}\n` : ''}${inchi ? `**InChI:** ${inchi}\n` : ''}${structuralAnalysis}

**PREVIOUS PREDICTION (FOR REFERENCE - DO NOT REPEAT ERRORS):**
${prediction.peaks?.map((p: any, idx: number) => 
  `${idx + 1}. δ ${p.shift} ppm, ${p.multiplicity || 's'}, ${typeof p.integration === 'string' ? p.integration : p.integration + 'H'}, ${p.assignment || 'N/A'}`
).join('\n') || 'No peaks predicted'}

**LITERATURE REFERENCES:**
${literatureWithAbstracts.map((pub, idx) => `
${idx + 1}. **${pub.title}**
   DOI: ${pub.doi}
   Abstract: ${pub.abstract}
`).join('\n')}
${hoseContext}
${functionalGroupContext}

**YOUR TASK:**
Provide a CORRECTED ¹H NMR prediction where:
- Total integration = EXACTLY ${totalHydrogens}H
- All proton environments are accounted for
- Missing peaks from previous prediction are identified and added
- Overlapping/equivalent peaks are properly handled

Return JSON in this format:
{
  "confidence": 0.85,
  "method": "Enhanced validation retry - Silverstein systematic analysis",
  "solvent": "CDCl3",
  "frequency": "400 MHz",
  "peaks": [
    {
      "shift": 7.34,
      "multiplicity": "m",
      "integration": "5H",
      "coupling": [7.5, 2.0],
      "assignment": "Aromatic protons on phenyl ring"
    },
    {
      "shift": 5.79,
      "multiplicity": "dd",
      "integration": "1H",
      "coupling": [8.9, 2.4],
      "assignment": "Complex coupling (ortho + meta)"
    }
  ],
  "structuralAnalysis": "Detailed explanation of how you corrected the previous prediction and ensured all ${totalHydrogens} hydrogens are accounted for",
  "corrections": "List of corrections made: which peaks were missing, which were incorrect, etc.",
  "notes": "This is a retry prediction with enhanced validation to ensure exact integration match"
}

⚠️ **CRITICAL REQUIREMENTS:**
1. The sum of ALL integration values in the peaks array MUST equal ${totalHydrogens}H exactly!
2. Use COMPLEX multiplicities (dd, dt, td, ddd, m) - NOT just singlets!
3. EVERY non-singlet peak MUST include "coupling" field with J value(s)!
4. Predict MANY peaks for ${totalHydrogens}H - account for all unique proton environments!`;

      try {
        let retryCompletion: any;
        try {
          retryCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a world-class NMR spectroscopist. You are correcting a previous prediction that had a critical integration mismatch. You MUST ensure the total integration matches the molecular formula exactly. Be thorough and account for ALL protons.'
              },
              {
                role: 'user',
                content: retryPrompt
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1, // Even lower temperature for retry
            max_tokens: 6000 // ✅ Artırıldı: Retry için daha fazla token (uzun SMILES için)
          });
        } catch (retryError: any) {
          // If retry also fails with 429, skip retry
          if (retryError?.status === 429 || retryError?.code === 'insufficient_quota') {
            console.warn('  ⚠️ Retry also hit quota limit, skipping retry...');
            throw retryError;
          }
          throw retryError;
        }

        const retryResponse = retryCompletion.choices[0].message.content;
        if (retryResponse) {
          try {
            const retryPrediction = JSON.parse(retryResponse);
            
            // Validate retry prediction
            let retryTotalIntegration = 0;
            if (retryPrediction.peaks) {
              retryTotalIntegration = retryPrediction.peaks.reduce((sum: number, p: any) => {
                const integ = typeof p.integration === 'string' 
                  ? parseFloat(p.integration.replace('H', '')) 
                  : (p.integration || 1);
                return sum + integ;
              }, 0);
            }

            const retryDifference = Math.abs(retryTotalIntegration - totalHydrogens);
            
            if (retryDifference < 5) {
              console.log(`  ✅ RETRY SUCCESSFUL: Integration now ${retryTotalIntegration.toFixed(1)}H (target: ${totalHydrogens}H, difference: ${retryDifference.toFixed(1)})`);
              prediction = retryPrediction; // Use corrected prediction
              totalIntegration = retryTotalIntegration;
              // Remove the critical error, add success message
              const originalErrorIndex = validationErrors.findIndex(e => e.includes('CRITICAL INTEGRATION MISMATCH'));
              if (originalErrorIndex >= 0) {
                validationErrors[originalErrorIndex] = `Original prediction had ${originalDifference.toFixed(1)} atom mismatch. Retry corrected to ${retryDifference.toFixed(1)} atom difference.`;
              }
            } else {
              console.warn(`  ⚠️  RETRY STILL HAS ISSUES: Integration ${retryTotalIntegration.toFixed(1)}H (target: ${totalHydrogens}H, difference: ${retryDifference.toFixed(1)})`);
              // Keep original error, add retry failure note
              validationErrors.push(`Retry prediction still has ${retryDifference.toFixed(1)} atom mismatch. Manual review recommended.`);
            }
          } catch (retryParseError) {
            console.error('  ❌ Retry response parse error:', retryParseError);
            validationErrors.push('Retry prediction failed to parse. Using original prediction.');
          }
        }
      } catch (retryError) {
        console.error('  ❌ Retry API error:', retryError);
        validationErrors.push('Retry API call failed. Using original prediction.');
      }
    }

    // 🚀 ENHANCEMENT: Apply theoretical spectrum modules
    console.log('  🔧 Applying 10-module enhancement...');

    const mappedPeaks = prediction.peaks?.map((p: any) => {
      // Handle coupling: can be number, array, or undefined
      let coupling: number | number[] | undefined;
      if (p.coupling !== undefined) {
        if (Array.isArray(p.coupling)) {
          coupling = p.coupling.map((j: any) => parseFloat(j));
        } else {
          coupling = parseFloat(p.coupling);
        }
      }
      
      return {
        shift: parseFloat(p.shift),
        integ: typeof p.integration === 'string' 
          ? parseFloat(p.integration.replace('H', '')) 
          : (p.integration || 1),
        mult: p.multiplicity || 's',
        coupling: coupling,
        label: p.assignment
      };
    }) || [];

    const enhancedResult = await enhanceTheoreticalSpectrum({
      smiles,
      inchi,
      moleculeName,
      aiPredictedPeaks: {
        nmr: mappedPeaks
      },
      solvent: prediction.solvent || 'CDCl3',
      temperature: 298.15,
      frequency: parseInt(prediction.frequency?.replace('MHz', '').trim() || '400')
    });

    console.log(`  ✅ Enhancement complete! Applied: ${enhancedResult.metadata.enhancementsApplied.join(', ')}`);
    if (enhancedResult.metadata.warnings && enhancedResult.metadata.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${enhancedResult.metadata.warnings.join('; ')}`);
    }

    // Convert to old format for compatibility (if needed)
    // Use enhanced peaks if available, otherwise use original prediction peaks with coupling
    const finalPeaks = enhancedResult.nmr && enhancedResult.nmr.length > 0 
      ? enhancedResult.nmr 
      : mappedPeaks;
    
    const formattedPrediction = {
      confidence: prediction.confidence,
      method: prediction.method || 'Silverstein systematic analysis + 10-Module Enhancement',
      spectra: [{
        nucleus: '1H',
        solvent: prediction.solvent || 'CDCl3',
        frequency: prediction.frequency || '400 MHz',
        peaks: finalPeaks
      }],
      notes: prediction.notes || 'Prediction based on Silverstein methodology',
      literatureInsights: prediction.literatureInsights || 'No specific NMR data found in abstracts',
      structuralAnalysis: prediction.structuralAnalysis || '',
      enhancements: enhancedResult.metadata.enhancementsApplied,
      warnings: [...(enhancedResult.metadata.warnings || []), ...validationWarnings],
      validation: {
        totalHydrogens: totalHydrogens || null,
        totalIntegration: totalIntegration || null,
        integrationRatio: totalHydrogens > 0 ? (totalIntegration / totalHydrogens) : null,
        peakCount: prediction.peaks?.length || 0,
        errors: validationErrors,
        warnings: validationWarnings,
        isValid: validationErrors.length === 0
      }
    };

    // Run pipeline for structured output (NMR split: deterministic + LLM)
    let pipelineResult = null;
    let nmrResult = null;
    
    // IDENTITY LOCK: Update computed values from pipeline (declared above)
    // computedFormula, computedTotalH, computedTotalC, computedDBE are block-scoped above
    
    try {
      const pipeline = MoleculePipelineService.getInstance();
      
      // Run pipeline to get structure and graph
      const pipelineRun = await pipeline.run({
        cid,
        moleculeName,
        iupacName: moleculeName,
        formula,
        smiles: smiles || undefined,
        inchi: inchi || undefined,
        userQuery,
        options: {
          preferredStereoPolicy: 'auto'
        }
      }, {
        predictNMR: true // This will call deterministic + LLM separately
      });
      
      pipelineResult = pipelineRun;
      nmrResult = pipelineRun.nmr;
      
      // IDENTITY LOCK: Use computed values from pipeline
      if (pipelineRun.graph?.molecularFormulaHill) {
        computedFormula = pipelineRun.graph.molecularFormulaHill;
        computedTotalH = pipelineRun.graph.totalHydrogenFromFormula || 0;
        computedTotalC = pipelineRun.graph.atomCounts?.['C'] || 0;
        computedDBE = pipelineRun.graph.dbe;
        
        console.log('  🔒 Identity lock active:', {
          computedFormula,
          computedTotalH,
          computedTotalC,
          computedDBE
        });
        
        // Check for formula mismatch
        if (formula && formula !== computedFormula) {
          console.warn(`  ⚠️ FORMULA MISMATCH: User provided "${formula}" but computed "${computedFormula}". Using computed formula.`);
        }
      }
      
      console.log('  ✅ Pipeline NMR result:', {
        modelPeaks: nmrResult?.modelPrediction.peaks.length || 0,
        llmPeaks: nmrResult?.llmInterpretation?.peaks?.length || 0,
        consensusPeaks: nmrResult?.finalConsensus.peaks.length || 0,
        method: nmrResult?.finalConsensus.method
      });
    } catch (pipelineError) {
      console.warn('⚠️ Pipeline execution failed (non-critical):', pipelineError);
      // Continue with existing response
    }

    return NextResponse.json({
      success: true,
      prediction: formattedPrediction,
      metadata: {
        model: usedProvider === 'Gemini (Fallback)' ? 'gemini-2.0-flash-exp' : 'gpt-4o',
        provider: usedProvider,
        timestamp: new Date().toISOString(),
        inputSources: {
          hasStructure: !!(smiles || inchi),
          literatureCount: literature.length,
          abstractsRetrieved: abstractsFound,
          functionalGroupsUsed: 30
        },
        enhancement: 'Silverstein methodology + Functional Group Library + Literature Abstracts + 10-Module Theoretical Enhancement',
        theoreticalEnhancements: enhancedResult.metadata.enhancementsApplied,
        theoreticalWarnings: enhancedResult.metadata.warnings || []
      },
      // New: Pipeline result (backward compatible - optional field)
      pipeline: pipelineResult || undefined,
      
      // New: NMR split result (if available)
      nmr: nmrResult || undefined
    });

  } catch (error) {
    console.error('❌ AI NMR Prediction Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      prediction: null
    }, { status: 500 });
  }
}
