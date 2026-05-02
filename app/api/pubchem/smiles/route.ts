import { NextRequest, NextResponse } from 'next/server';

/**
 * PubChem SMILES Fetcher
 *
 * CID'den SMILES alır (IsomericSMILES + CanonicalSMILES)
 * CSP bypass için backend proxy
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get('cid');

  if (!cid) {
    return NextResponse.json(
      { success: false, error: 'CID parametresi gerekli' },
      { status: 400 }
    );
  }

  try {
    console.log(`🔬 PubChem SMILES API: CID ${cid}`);

    const pubchemURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/CanonicalSMILES,IsomericSMILES/JSON`;

    const response = await fetch(pubchemURL);

    if (!response.ok) {
      console.error(`❌ PubChem API error: HTTP ${response.status}`);
      return NextResponse.json(
        { success: false, error: `PubChem API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // ✅ ADIM 1: PubChem Raw Props'u logla (debug için)
    console.log('🔍 PubChem Raw Response:', JSON.stringify(data, null, 2));
    
    const props = data.PropertyTable?.Properties?.[0];

    if (!props) {
      console.error('❌ PubChem yanıtında SMILES bulunamadı');
      console.error('   Raw data:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { success: false, error: 'SMILES bulunamadı' },
        { status: 404 }
      );
    }

    // ✅ ADIM 1: Props dizisinde döngü kur ve Isomeric/Canonical SMILES'ı bul
    let isomericSMILES: string | null = null;
    let canonicalSMILES: string | null = null;
    let genericSMILES: string | null = null; // ✅ Genel SMILES alanı (büyük harf)
    
    // Önce direkt alan adlarına bak (standart format)
    if (props.IsomericSMILES) {
      isomericSMILES = props.IsomericSMILES;
    }
    if (props.CanonicalSMILES) {
      canonicalSMILES = props.CanonicalSMILES;
    }
    // ✅ PubChem bazen sadece "SMILES" alanı döndürüyor (büyük harf)
    if (props.SMILES && typeof props.SMILES === 'string') {
      genericSMILES = props.SMILES;
      console.log(`   ✅ Generic SMILES bulundu (key: SMILES, length: ${props.SMILES.length})`);
      // Eğer IsomericSMILES yoksa ve SMILES Isomeric görünüyorsa (@ sembolleri varsa), onu kullan
      if (!isomericSMILES && props.SMILES.includes('@')) {
        isomericSMILES = props.SMILES;
        console.log(`   ✅ Generic SMILES Isomeric olarak kabul edildi (@ sembolleri var)`);
      }
    }
    
    // Eğer bulunamadıysa, props içinde döngü kur (alternatif formatlar için)
    if (!isomericSMILES && !canonicalSMILES && !genericSMILES) {
      console.log('🔍 Alternatif format aranıyor...');
      for (const [key, value] of Object.entries(props)) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('isomeric') && value && typeof value === 'string') {
          isomericSMILES = value as string;
          console.log(`   ✅ Isomeric SMILES bulundu (key: ${key})`);
        }
        if (keyLower.includes('canonical') && value && typeof value === 'string') {
          canonicalSMILES = value as string;
          console.log(`   ✅ Canonical SMILES bulundu (key: ${key})`);
        }
        // ✅ Genel "smiles" alanını da kontrol et (küçük harf)
        if (keyLower === 'smiles' && value && typeof value === 'string' && !genericSMILES) {
          genericSMILES = value as string;
          console.log(`   ✅ Generic SMILES bulundu (key: ${key}, length: ${genericSMILES.length})`);
        }
      }
    }
    
    // ✅ Log: PubChem Raw Props (debug için)
    console.log('🔍 PubChem Raw Props:', JSON.stringify(props, null, 2));
    console.log(`✅ PubChem SMILES parse sonucu:`);
    console.log(`   Isomeric: ${isomericSMILES || 'N/A'}`);
    console.log(`   Canonical: ${canonicalSMILES || 'N/A'}`);

    // ✅ Öncelik sırası: Isomeric > Canonical > Generic SMILES
    const finalSMILES = isomericSMILES || canonicalSMILES || genericSMILES;

    if (!finalSMILES) {
      console.error('❌ PubChem yanıtında hiçbir SMILES formatı bulunamadı');
      console.error('   Mevcut alanlar:', Object.keys(props).join(', '));
      return NextResponse.json(
        { success: false, error: 'SMILES bulunamadı (Isomeric, Canonical ve Generic SMILES yok)' },
        { status: 404 }
      );
    }
    
    console.log(`✅ Final SMILES seçildi (length: ${finalSMILES.length}): ${finalSMILES.substring(0, 50)}...`);

    return NextResponse.json({
      success: true,
      isomericSMILES: isomericSMILES || null,
      canonicalSMILES: canonicalSMILES || null,
      smiles: finalSMILES // Prefer isomeric, fallback to canonical
    });

  } catch (error) {
    console.error('❌ PubChem SMILES fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
