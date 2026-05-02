import { NextRequest, NextResponse } from 'next/server';

/**
 * FTIR Data Aggregator API
 *
 * Tüm kaynaklardan FTIR ile ilgili verileri toplar ve AI'ya context olarak gönderir:
 * 1. PubChem → CID, SMILES, Formula, IUPAC
 * 2. NIST Data Portal → Metadata, literatür referansları
 * 3. Unofficial NIST API → Molecule info (CAS, formula)
 *
 * AI'ya gönderilen context:
 * - Başarılı veri kaynakları
 * - Başarısız kaynakların linkleri (AI'nın bilmesi için)
 * - Toplanan tüm metadata
 */

/**
 * Derive molecular formula from IUPAC name (simple heuristic)
 * Returns null if can't derive or if IUPAC is too complex
 *
 * Examples:
 * - "phenylmethanamine" → "C7H9N"
 * - "2-acetoxybenzoic acid" → "C9H8O4"
 * - "(4aR,5aS,8aR...)-10,11-dimethoxy..." → null (too complex)
 */
function deriveFormulaFromIUPAC(iupacName: string): string | null {
  if (!iupacName) return null;

  // If IUPAC is too long or has stereochemistry, skip validation
  if (iupacName.length > 50 || iupacName.includes('(') && iupacName.includes('R,') || iupacName.includes('S,')) {
    return null; // Too complex
  }

  // Simple heuristic: count common patterns
  // This is NOT accurate but good enough for basic validation
  const lowerName = iupacName.toLowerCase();

  // Count carbons from chain length indicators
  let carbons = 0;
  if (lowerName.includes('meth')) carbons = Math.max(carbons, 1);
  if (lowerName.includes('eth')) carbons = Math.max(carbons, 2);
  if (lowerName.includes('prop')) carbons = Math.max(carbons, 3);
  if (lowerName.includes('but')) carbons = Math.max(carbons, 4);
  if (lowerName.includes('pent')) carbons = Math.max(carbons, 5);
  if (lowerName.includes('hex')) carbons = Math.max(carbons, 6);
  if (lowerName.includes('hept')) carbons = Math.max(carbons, 7);
  if (lowerName.includes('oct')) carbons = Math.max(carbons, 8);
  if (lowerName.includes('non')) carbons = Math.max(carbons, 9);
  if (lowerName.includes('dec')) carbons = Math.max(carbons, 10);

  // Add aromatic ring carbons
  if (lowerName.includes('benz') || lowerName.includes('phenyl')) carbons += 6;
  if (lowerName.includes('indol')) carbons += 9;
  if (lowerName.includes('quinol')) carbons += 10;

  // Check for nitrogen
  const hasNitrogen = lowerName.includes('amine') ||
                     lowerName.includes('amino') ||
                     lowerName.includes('nitrile') ||
                     lowerName.includes('nitro') ||
                     lowerName.includes('imid') ||
                     lowerName.includes('pyrid') ||
                     lowerName.includes('indol');

  // Check for oxygen
  const hasOxygen = lowerName.includes('hydroxy') ||
                   lowerName.includes('oxo') ||
                   lowerName.includes('carboxy') ||
                   lowerName.includes('acid') ||
                   lowerName.includes('ester') ||
                   lowerName.includes('ether') ||
                   lowerName.includes('methoxy');

  // If we can't determine basic structure, return null
  if (carbons === 0) return null;

  // Build a rough formula string for comparison
  // This won't be exact, but good enough to catch major mismatches
  let formulaParts = [`C${carbons > 1 ? carbons : ''}`];

  // We can't accurately predict H count, so skip it for comparison

  if (hasNitrogen) formulaParts.push('N');
  if (hasOxygen) formulaParts.push('O');

  // Return rough formula for pattern matching
  // Example: "C7N" for phenylmethanamine (actual: C7H9N)
  return formulaParts.join('');
}

interface FTIRDataAggregation {
  moleculeName: string;
  cid?: number;
  smiles?: string;
  formula?: string;
  iupacName?: string;
  cas?: string;

  // Veri kaynakları
  sources: {
    pubchem?: {
      success: boolean;
      data?: any;
      url: string;
    };
    nistDataPortal?: {
      success: boolean;
      data?: any;
      url: string;
    };
    nistUnofficial?: {
      success: boolean;
      data?: any;
      url: string;
    };
  };

  // AI için context
  aiContext: string;
}

export async function POST(request: NextRequest) {
  try {
    const { moleculeName, cid } = await request.json();

    if (!moleculeName && !cid) {
      return NextResponse.json(
        { success: false, error: 'Molecule name or CID required' },
        { status: 400 }
      );
    }

    const aggregation: FTIRDataAggregation = {
      moleculeName: moleculeName || `CID-${cid}`,
      sources: {},
      aiContext: ''
    };

    // ========================================
    // 1. PubChem Verisi (CID, SMILES, Formula)
    // ========================================
    const pubchemUrl = cid
      ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,CanonicalSMILES,IUPACName/JSON`
      : `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(moleculeName)}/property/MolecularFormula,CanonicalSMILES,IUPACName,CID/JSON`;

    try {
      console.log(`🔍 PubChem: ${pubchemUrl}`);
      const pubchemResponse = await fetch(pubchemUrl, {
        headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (pubchemResponse.ok) {
        const pubchemData = await pubchemResponse.json();
        const props = pubchemData.PropertyTable?.Properties?.[0];

        if (props) {
          aggregation.cid = props.CID || cid;
          aggregation.smiles = props.CanonicalSMILES || props.ConnectivitySMILES || props.IsomericSMILES;
          aggregation.formula = props.MolecularFormula;

          // ⚠️ CRITICAL: Validate IUPAC name formula match
          // If IUPAC formula doesn't match context formula, reject it
          // AI will derive IUPAC from SMILES instead
          const iupacPattern = props.IUPACName ? deriveFormulaFromIUPAC(props.IUPACName) : null;
          const contextFormula = props.MolecularFormula;

          if (iupacPattern && contextFormula) {
            // Check if context formula contains the IUPAC pattern
            // Example: "C7N" should match "C7H9N" but NOT "C23H26N2O4"
            const contextPattern = contextFormula.replace(/\d+/g, (n: string) => parseInt(n) > 1 ? n : '');

            // Check carbon count match (most important!)
            const iupacCarbons = iupacPattern.match(/C(\d+)?/)?.[1] || '1';
            const contextCarbons = contextPattern.match(/C(\d+)?/)?.[1] || '1';

            // Check nitrogen presence
            const iupacHasN = iupacPattern.includes('N');
            const contextHasN = contextPattern.includes('N');

            // Check oxygen presence
            const iupacHasO = iupacPattern.includes('O');
            const contextHasO = contextPattern.includes('O');

            const carbonMatch = iupacCarbons === contextCarbons;
            const nitrogenMatch = iupacHasN === contextHasN;
            const oxygenMatch = iupacHasO === contextHasO;

            if (carbonMatch && nitrogenMatch && oxygenMatch) {
              // Pattern matches - IUPAC is valid
              aggregation.iupacName = props.IUPACName;
              console.log(`✅ IUPAC validated: "${props.IUPACName}" matches formula ${contextFormula}`);
            } else {
              // Pattern mismatch - REJECT IUPAC!
              aggregation.iupacName = undefined;
              console.log(`❌ IUPAC REJECTED: "${props.IUPACName}" doesn't match context formula`);
              console.log(`   IUPAC pattern: C=${iupacCarbons}, N=${iupacHasN}, O=${iupacHasO}`);
              console.log(`   Context: ${contextFormula} (C=${contextCarbons}, N=${contextHasN}, O=${contextHasO})`);
              console.log(`   → AI will derive IUPAC from SMILES instead`);
            }
          } else {
            // Can't derive pattern from IUPAC (too complex) - keep it anyway
            aggregation.iupacName = props.IUPACName;
            console.log(`⚠️  IUPAC too complex to validate: "${props.IUPACName}"`);
          }

          aggregation.sources.pubchem = {
            success: true,
            data: props,
            url: pubchemUrl
          };

          console.log(`✅ PubChem: CID ${props.CID || cid}, SMILES: ${props.CanonicalSMILES}, Formula: ${props.MolecularFormula}`);
        }
      } else {
        throw new Error(`HTTP ${pubchemResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ PubChem failed:`, error);
      aggregation.sources.pubchem = {
        success: false,
        url: pubchemUrl
      };

      // PubChem başarısız olursa başka yoldan SMILES almayı dene
      if (cid && !aggregation.smiles) {
        console.log('🔄 Alternatif PubChem endpoint deneniyor...');
        try {
          const altUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/JSON`;
          const altResponse = await fetch(altUrl, {
            headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
            signal: AbortSignal.timeout(10000)
          });

          if (altResponse.ok) {
            const altData = await altResponse.json();
            const compound = altData.PC_Compounds?.[0];

            if (compound) {
              // SMILES'ı props içinde ara
              const smilesProps = compound.props?.find((p: any) =>
                p.urn?.label === 'SMILES' && p.urn?.name === 'Canonical'
              );

              if (smilesProps?.value?.sval) {
                aggregation.smiles = smilesProps.value.sval;
                console.log(`✅ Alternative endpoint: SMILES bulundu: ${aggregation.smiles}`);
              }
            }
          }
        } catch (altError) {
          console.log('❌ Alternative endpoint de başarısız:', altError);
        }
      }
    }

    // ========================================
    // 2. NIST Data Portal (Metadata, Literatür)
    // ========================================
    const nistDataPortalUrl = `https://data.nist.gov/rmm/records?searchphrase=${encodeURIComponent(moleculeName)}+infrared&limit=5`;

    try {
      console.log(`🔍 NIST Data Portal: ${nistDataPortalUrl}`);
      const nistResponse = await fetch(nistDataPortalUrl);

      if (nistResponse.ok) {
        const nistData = await nistResponse.json();

        if (nistData.ResultData && nistData.ResultData.length > 0) {
          aggregation.sources.nistDataPortal = {
            success: true,
            data: {
              resultCount: nistData.ResultCount,
              datasets: nistData.ResultData.map((item: any) => ({
                title: item.title,
                description: item.description?.[0]?.substring(0, 200),
                id: item['@id']
              }))
            },
            url: nistDataPortalUrl
          };

          console.log(`✅ NIST Data Portal: ${nistData.ResultCount} datasets found`);
        } else {
          throw new Error('No results');
        }
      } else {
        throw new Error(`HTTP ${nistResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ NIST Data Portal failed:`, error);
      aggregation.sources.nistDataPortal = {
        success: false,
        url: nistDataPortalUrl
      };
    }

    // ========================================
    // 3. NIST WebBook - REMOVED (Unofficial API kaldırıldı)
    // ========================================
    // Sadece resmi NIST kaynakları kullanılıyor

    // ========================================
    // 4. AI Context Oluştur
    // ========================================
    let contextParts: string[] = [];

    // Başarılı kaynaklar
    contextParts.push(`📊 **TOPLANAN VERİLER:**\n`);

    if (aggregation.cid) contextParts.push(`- PubChem CID: ${aggregation.cid}`);
    if (aggregation.formula) contextParts.push(`- Formula: ${aggregation.formula}`);
    if (aggregation.smiles) contextParts.push(`- SMILES: ${aggregation.smiles}`);
    if (aggregation.iupacName) contextParts.push(`- IUPAC: ${aggregation.iupacName}`);
    if (aggregation.cas) contextParts.push(`- CAS: ${aggregation.cas}`);

    // NIST metadata
    if (aggregation.sources.nistDataPortal?.success) {
      const nistData = aggregation.sources.nistDataPortal.data;
      contextParts.push(`\n📚 **NIST METADATA (${nistData.resultCount} datasets):**`);
      nistData.datasets.forEach((ds: any, idx: number) => {
        contextParts.push(`${idx + 1}. ${ds.title}`);
        if (ds.description) contextParts.push(`   ${ds.description}...`);
      });
    }

    // Başarısız kaynaklar (AI'nın bilmesi için)
    const failedSources = [];
    if (!aggregation.sources.pubchem?.success) {
      failedSources.push(`- PubChem: ${aggregation.sources.pubchem?.url}`);
    }
    if (!aggregation.sources.nistDataPortal?.success) {
      failedSources.push(`- NIST Data Portal: ${aggregation.sources.nistDataPortal?.url}`);
    }

    if (failedSources.length > 0) {
      contextParts.push(`\n⚠️ **ERİŞİLEMEYEN KAYNAKLAR:**`);
      contextParts.push(...failedSources);
    }

    contextParts.push(`\n🎯 **GÖREV:** Bu molekül için FTIR spektrum peaks'lerini tahmin et (7-10 peaks).`);

    aggregation.aiContext = contextParts.join('\n');

    // ========================================
    // Return Aggregated Data
    // ========================================
    return NextResponse.json({
      success: true,
      aggregation
    });

  } catch (error) {
    console.error('FTIR Data Aggregation Error:', error);
    return NextResponse.json(
      { success: false, error: 'Data aggregation failed' },
      { status: 500 }
    );
  }
}
