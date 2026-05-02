import { NextRequest, NextResponse } from 'next/server';

/**
 * PubChem Structure API
 * Fetches 2D PNG/SVG, 3D SDF, and Crystal Structure from PubChem
 * 
 * GET /api/pubchem/structure?cid=445154&type=2d-png
 * GET /api/pubchem/structure?cid=445154&type=2d-svg
 * GET /api/pubchem/structure?cid=445154&type=3d-sdf
 * GET /api/pubchem/structure?cid=445154&type=crystal
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cid = searchParams.get('cid');
  const type = searchParams.get('type') || '2d-png'; // Default: 2D PNG

  if (!cid) {
    return NextResponse.json(
      { success: false, error: 'CID parameter required' },
      { status: 400 }
    );
  }

  try {
    let url: string;
    let contentType: string;
    let responseType: 'json' | 'binary' = 'binary';

    switch (type) {
      case '2d-png':
        url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`;
        contentType = 'image/png';
        break;
      
      case '2d-svg':
        url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SVG`;
        contentType = 'image/svg+xml';
        break;
      
      case '3d-sdf':
        url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
        contentType = 'chemical/x-mdl-sdfile';
        break;
      
      case 'crystal':
        // Crystal structure (if available) - try to get from PubChem
        url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=crystal`;
        contentType = 'chemical/x-mdl-sdfile';
        break;
      
      default:
        return NextResponse.json(
          { success: false, error: `Invalid type: ${type}. Use: 2d-png, 2d-svg, 3d-sdf, or crystal` },
          { status: 400 }
        );
    }

    console.log(`🔍 Fetching ${type} from PubChem for CID ${cid}...`);
    console.log(`   URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SpectroMind-App/1.0',
        'Accept': contentType
      },
      signal: AbortSignal.timeout(15000) // 15 saniye timeout
    });

    if (!response.ok) {
      // Try fallback for 3D if 3d-sdf fails
      if (type === '3d-sdf' && response.status === 404) {
        console.log(`⚠️ 3D SDF not available, trying 2D SDF...`);
        const fallbackUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`;
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'SpectroMind-App/1.0' },
          signal: AbortSignal.timeout(15000)
        });

        if (fallbackResponse.ok) {
          const sdfData = await fallbackResponse.text();
          console.log(`✅ 2D SDF retrieved (fallback for 3D)`);
          return new NextResponse(sdfData, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'X-Fallback': '2d-sdf'
            }
          });
        }
      }

      console.error(`❌ PubChem ${type} fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { 
          success: false, 
          error: `PubChem ${type} not available for CID ${cid}`,
          status: response.status
        },
        { status: response.status }
      );
    }

    // For binary data (PNG, SVG, SDF), return as-is
    if (responseType === 'binary') {
      const data = await response.arrayBuffer();
      console.log(`✅ ${type} retrieved for CID ${cid} (${data.byteLength} bytes)`);

      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'PubChem',
          'X-CID': cid,
          'X-Type': type
        }
      });
    }

    // For JSON responses (if needed in future)
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data,
      source: 'PubChem',
      cid: parseInt(cid),
      type
    });

  } catch (error) {
    console.error(`❌ PubChem structure fetch error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        cid: parseInt(cid),
        type
      },
      { status: 500 }
    );
  }
}

