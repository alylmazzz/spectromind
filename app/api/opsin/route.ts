import { NextRequest, NextResponse } from 'next/server';

/**
 * OPSIN API - IUPAC Name to SMILES Conversion
 *
 * Converts IUPAC nomenclature to SMILES notation using OPSIN
 * (Open Parser for Systematic IUPAC Nomenclature)
 *
 * Example:
 *   Input: "pentan-1-ol"
 *   Output: "CCCCCO"
 */
/**
 * IUPAC format kontrolü (basit regex)
 * Geçerli IUPAC formatı: sayılar, tireler, küçük harfler içerir
 * Örnek: "pentan-1-ol", "2-methylpropan-2-ol"
 */
function isValidIUPACFormat(name: string): boolean {
  // Basit IUPAC format kontrolü
  // Geçerli format: sayılar, tireler, küçük/büyük harfler, parantezler
  const iupacPattern = /^[0-9,\-\(\)]*[a-zA-Z]+([0-9,\-\(\)]*[a-zA-Z]+)*$/;
  return iupacPattern.test(name) && name.length > 2;
}

/**
 * PubChem'den IUPAC adını çek (ticari isimler için)
 */
async function fetchIUPACFromPubChem(tradeName: string): Promise<string | null> {
  try {
    // Önce CID'yi bul
    const cidResponse = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(tradeName)}/cids/JSON`,
      { headers: { 'User-Agent': 'NMR-MIND-App/1.0' }, signal: AbortSignal.timeout(5000) }
    );

    if (!cidResponse.ok) {
      return null;
    }

    const cidData = await cidResponse.json();
    const cids = cidData.IdentifierList?.CID || [];

    if (cids.length === 0) {
      return null;
    }

    // İlk CID'den IUPAC adını çek
    const cid = cids[0];
    const propResponse = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName/JSON`,
      { headers: { 'User-Agent': 'NMR-MIND-App/1.0' }, signal: AbortSignal.timeout(5000) }
    );

    if (!propResponse.ok) {
      return null;
    }

    const propData = await propResponse.json();
    const iupacName = propData.PropertyTable?.Properties?.[0]?.IUPACName;

    return iupacName || null;
  } catch (error) {
    console.error('PubChem IUPAC fetch error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let iupacName = searchParams.get('name');

    if (!iupacName) {
      return NextResponse.json(
        { success: false, error: 'IUPAC name required' },
        { status: 400 }
      );
    }

    console.log(`🔬 OPSIN: Converting IUPAC to SMILES: "${iupacName}"`);

    // ⚠️ İSİM NORMALİZASYONU: OPSIN öncesi kontrol
    // Eğer isim geçerli IUPAC formatında değilse, ticari isim olabilir
    if (!isValidIUPACFormat(iupacName)) {
      console.log(`  ⚠️ "${iupacName}" geçerli IUPAC formatında görünmüyor, PubChem'den IUPAC çekiliyor...`);
      
      const pubchemIUPAC = await fetchIUPACFromPubChem(iupacName);
      
      if (pubchemIUPAC) {
        console.log(`  ✅ PubChem'den IUPAC bulundu: "${pubchemIUPAC}"`);
        iupacName = pubchemIUPAC;
      } else {
        console.warn(`  ⚠️ PubChem'de IUPAC bulunamadı, OPSIN deneniyor (başarısız olabilir)...`);
        // Devam et, belki OPSIN yine de çalışır
      }
    }

    // OPSIN endpoint (University of Cambridge)
    const opsinUrl = `https://opsin.ch.cam.ac.uk/opsin/${encodeURIComponent(iupacName)}.smi`;

    const response = await fetch(opsinUrl, {
      headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`⚠️ OPSIN failed for "${iupacName}": HTTP ${response.status}`);
      return NextResponse.json(
        { success: false, error: 'OPSIN conversion failed. The name may not be in valid IUPAC format.' },
        { status: 404 }
      );
    }

    const smiles = await response.text();
    const trimmedSmiles = smiles.trim();

    if (!trimmedSmiles || trimmedSmiles.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid SMILES generated' },
        { status: 500 }
      );
    }

    console.log(`✅ OPSIN: "${iupacName}" → SMILES: "${trimmedSmiles}"`);

    return NextResponse.json({
      success: true,
      iupacName,
      smiles: trimmedSmiles
    });

  } catch (error) {
    console.error('OPSIN API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'OPSIN service unavailable'
      },
      { status: 500 }
    );
  }
}
