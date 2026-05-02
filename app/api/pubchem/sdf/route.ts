import { NextRequest, NextResponse } from 'next/server';

/**
 * PubChem SDF Proxy
 * Fetches 3D SDF files from PubChem (avoids CORS)
 *
 * GET /api/pubchem/sdf?cid=996
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get('cid');

  if (!cid) {
    return NextResponse.json(
      { success: false, error: 'CID parameter required' },
      { status: 400 }
    );
  }

  try {
    // STEP 1: Try 3D SDF from PubChem
    console.log(`🔍 Fetching 3D SDF for CID ${cid}...`);
    const sdf3dURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;

    const response3d = await fetch(sdf3dURL, {
      headers: { 'User-Agent': 'NMR-MIND-App/1.0' }
    });

    if (response3d.ok) {
      const sdfData = await response3d.text();
      console.log(`✅ 3D SDF retrieved for CID ${cid} (${sdfData.length} bytes)`);

      return new NextResponse(sdfData, {
        status: 200,
        headers: {
          'Content-Type': 'chemical/x-mdl-sdfile',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // STEP 2: Fallback to 2D SDF (no 3D coordinates available)
    // 2D SDF contains stereochemistry info - convert it to 3D with RDKit
    console.log(`⚠️ 3D SDF not available for CID ${cid}, fetching 2D SDF...`);
    const sdf2dURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`;

    const response2d = await fetch(sdf2dURL, {
      headers: { 'User-Agent': 'NMR-MIND-App/1.0' }
    });

    if (response2d.ok) {
      const sdf2dData = await response2d.text();
      console.log(`✅ 2D SDF retrieved for CID ${cid} (${sdf2dData.length} bytes)`);
      console.log(`🔬 Converting 2D SDF to stereo-correct 3D using RDKit...`);

      // Call RDKit to convert 2D SDF to 3D (preserving stereochemistry)
      const rdkitResponse = await fetch(`${request.nextUrl.origin}/api/rdkit/sdf-to-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdf2d: sdf2dData })
      });

      if (rdkitResponse.ok) {
        const rdkitData = await rdkitResponse.json();

        if (rdkitData.success && rdkitData.sdf3d) {
          console.log(`✅ RDKit converted 2D→3D for CID ${cid} (${rdkitData.sdf3d.length} bytes)`);
          console.log(`   Stereochemistry preserved: ${rdkitData.chiralCenters || 0} chiral centers`);

          return new NextResponse(rdkitData.sdf3d, {
            status: 200,
            headers: {
              'Content-Type': 'chemical/x-mdl-sdfile',
              'Cache-Control': 'public, max-age=86400',
              'X-Generated-By': 'RDKit-2D-to-3D',
              'X-Chiral-Centers': String(rdkitData.chiralCenters || 0),
              'X-Stereochemistry': 'Preserved from PubChem 2D SDF',
            },
          });
        } else {
          console.warn(`⚠️ RDKit 2D→3D conversion failed, falling back to raw 2D SDF`);
        }
      }

      // If RDKit conversion fails, return 2D SDF as-is (better than nothing)
      console.log(`⚠️ Returning 2D SDF without 3D conversion`);
      return new NextResponse(sdf2dData, {
        status: 200,
        headers: {
          'Content-Type': 'chemical/x-mdl-sdfile',
          'Cache-Control': 'public, max-age=86400',
          'X-Generated-By': 'PubChem-2D',
          'X-Warning': '2D structure - no 3D coordinates',
        },
      });
    }

    // STEP 3: Last resort - generate 3D from SMILES using RDKit
    console.log(`⚠️ 2D SDF also not available for CID ${cid}, generating from SMILES...`);

    // Get SMILES from PubChem
    const smilesURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/CanonicalSMILES/JSON`;
    const smilesResponse = await fetch(smilesURL, {
      headers: { 'User-Agent': 'NMR-MIND-App/1.0' }
    });

    if (!smilesResponse.ok) {
      throw new Error('Failed to fetch SMILES from PubChem');
    }

    const smilesData = await smilesResponse.json();
    const smiles = smilesData.PropertyTable?.Properties?.[0]?.CanonicalSMILES;

    if (!smiles) {
      throw new Error('SMILES not found in PubChem response');
    }

    console.log(`🔬 Generating 3D structure from SMILES: ${smiles.substring(0, 50)}...`);

    // Call RDKit to generate SDF
    const rdkitResponse = await fetch(`${request.nextUrl.origin}/api/rdkit/generate-sdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles })
    });

    if (!rdkitResponse.ok) {
      throw new Error('RDKit SDF generation failed');
    }

    const rdkitData = await rdkitResponse.json();

    if (!rdkitData.success || !rdkitData.sdf) {
      throw new Error('RDKit did not return valid SDF');
    }

    console.log(`✅ RDKit generated 3D SDF for CID ${cid} (${rdkitData.sdf.length} bytes)`);

    return new NextResponse(rdkitData.sdf, {
      status: 200,
      headers: {
        'Content-Type': 'chemical/x-mdl-sdfile',
        'Cache-Control': 'public, max-age=86400',
        'X-Generated-By': 'RDKit', // Flag to indicate this is generated, not from PubChem
      },
    });

  } catch (error) {
    console.error(`❌ SDF fetch/generation error for CID ${cid}:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch/generate SDF' },
      { status: 500 }
    );
  }
}
