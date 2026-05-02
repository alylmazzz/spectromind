import { NextRequest, NextResponse } from 'next/server';

/**
 * PubChem SMILES to CID Converter
 * 
 * Converts SMILES string to PubChem CID
 * GET /api/pubchem/smiles-to-cid?smiles=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const smiles = searchParams.get('smiles');

  if (!smiles) {
    return NextResponse.json(
      { success: false, error: 'SMILES parametresi gerekli' },
      { status: 400 }
    );
  }

  try {
    console.log(`🔍 PubChem SMILES → CID: ${smiles.substring(0, 50)}...`);

    // PubChem API: SMILES'tan CID bul
    const pubchemURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/cids/JSON`;

    const response = await fetch(pubchemURL, {
      headers: { 'User-Agent': 'SpectroMind/1.0' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`⚠️ SMILES için CID bulunamadı: ${smiles.substring(0, 50)}...`);
        return NextResponse.json(
          { success: false, error: 'CID bulunamadı', cid: null },
          { status: 404 }
        );
      }
      
      // Handle 400 Bad Request (invalid SMILES format)
      if (response.status === 400) {
        console.warn(`⚠️ PubChem API 400: SMILES format may be invalid: ${smiles.substring(0, 50)}...`);
        // Try to clean SMILES (remove stereochemistry markers that might cause issues)
        const cleanedSmiles = smiles.replace(/[\/\\@]/g, '');
        if (cleanedSmiles !== smiles) {
          console.log(`  🔄 Trying cleaned SMILES (without stereochemistry markers)...`);
          // Recursive call with cleaned SMILES (but limit depth to prevent infinite loop)
          const retryURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(cleanedSmiles)}/cids/JSON`;
          const retryResponse = await fetch(retryURL, {
            headers: { 'User-Agent': 'SpectroMind/1.0' }
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const retryCids = retryData.IdentifierList?.CID;
            if (retryCids && retryCids.length > 0) {
              console.log(`  ✅ Cleaned SMILES worked, found CID: ${retryCids[0]}`);
              return NextResponse.json({
                success: true,
                cid: retryCids[0],
                allCids: retryCids,
                smiles: smiles,
                note: 'Used cleaned SMILES (stereochemistry markers removed)'
              });
            }
          }
        }
        return NextResponse.json(
          { success: false, error: 'SMILES format geçersiz olabilir veya PubChem\'de bulunamadı', cid: null },
          { status: 400 }
        );
      }
      
      console.error(`❌ PubChem API error: HTTP ${response.status}`);
      return NextResponse.json(
        { success: false, error: `PubChem API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const cids = data.IdentifierList?.CID;

    if (!cids || cids.length === 0) {
      console.log(`⚠️ SMILES için CID bulunamadı: ${smiles.substring(0, 50)}...`);
      return NextResponse.json(
        { success: false, error: 'CID bulunamadı', cid: null },
        { status: 404 }
      );
    }

    // İlk CID'yi al (genellikle en yaygın olan)
    const cid = cids[0];
    console.log(`✅ SMILES → CID: ${cid}`);

    return NextResponse.json({
      success: true,
      cid: cid,
      allCids: cids, // Tüm eşleşen CID'ler (alternatifler için)
      smiles: smiles
    });

  } catch (error) {
    console.error('❌ SMILES → CID conversion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'SMILES → CID conversion failed',
        cid: null
      },
      { status: 500 }
    );
  }
}

