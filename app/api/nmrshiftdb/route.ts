import { NextRequest, NextResponse } from 'next/server';
import https from 'https';

/**
 * NMRShiftDB2 API Route
 *
 * Queries NMRShiftDB2 database for NMR spectroscopy data
 * Uses InChI or SMILES to search for molecules
 *
 * Query Parameters:
 * - inchi: InChI identifier (preferred)
 * - smiles: SMILES notation (alternative)
 * - spectrumtype: 1H, 13C, 15N, 31P, etc. (default: 1H)
 */

interface NMRPeak {
  shift: number;
  intensity?: number;
  multiplicity?: string;
  coupling?: number[];
  atomRefs?: string[];
}

interface NMRSpectrum {
  id: string;
  spectrumType: string;
  frequency?: string;
  temperature?: string;
  solvent?: string;
  peaks: NMRPeak[];
  reference?: {
    title?: string;
    year?: string;
    journal?: string;
    authors?: string;
  };
}

interface NMRShiftDBResponse {
  success: boolean;
  molecule?: {
    id: string;
    name: string;
    formula?: string;
  };
  spectra: NMRSpectrum[];
  source: string;
  message?: string;
}

/**
 * Parse CML XML response from NMRShiftDB2
 */
function parseCMLResponse(xmlText: string): NMRShiftDBResponse {
  const spectra: NMRSpectrum[] = [];
  let moleculeName = '';
  let moleculeId = '';

  try {
    // Extract molecule info
    const moleculeMatch = xmlText.match(/<molecule[^>]*title="([^"]+)"[^>]*id="([^"]+)"/);
    if (moleculeMatch) {
      moleculeName = moleculeMatch[1];
      moleculeId = moleculeMatch[2];
    }

    // Extract all spectrum blocks
    const spectrumRegex = /<spectrum[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/spectrum>/g;
    let spectrumMatch;

    while ((spectrumMatch = spectrumRegex.exec(xmlText)) !== null) {
      const spectrumId = spectrumMatch[1];
      const spectrumContent = spectrumMatch[2];

      // Extract spectrum type (1H, 13C, etc.)
      const nucleusMatch = spectrumContent.match(/OBSERVENUCLEUS"[^>]*content="([^"]+)"/);
      const spectrumType = nucleusMatch ? nucleusMatch[1] : 'Unknown';

      // Extract frequency
      const frequencyMatch = spectrumContent.match(/dictRef="cml:field"[^>]*>([^<]+)</);
      const frequency = frequencyMatch ? frequencyMatch[1] + ' MHz' : undefined;

      // Extract temperature
      const tempMatch = spectrumContent.match(/dictRef="cml:temp"[^>]*>([^<]+)</);
      const temperature = tempMatch ? tempMatch[1] + ' K' : undefined;

      // Extract solvent
      const solventMatch = spectrumContent.match(/title="([^"]+)"[^>]*\/>/);
      const solvent = solventMatch ? solventMatch[1] : undefined;

      // Extract peaks
      const peaks: NMRPeak[] = [];
      const peakRegex = /<peak\s+xValue="([^"]+)"[^>]*peakShape="([^"]+)"[^>]*atomRefs="([^"]*)"/g;
      let peakMatch;

      while ((peakMatch = peakRegex.exec(spectrumContent)) !== null) {
        const shift = parseFloat(peakMatch[1]);
        const peakShape = peakMatch[2];
        const atomRefs = peakMatch[3] ? peakMatch[3].split(' ') : [];

        peaks.push({
          shift,
          multiplicity: peakShape === 'sharp' ? 's' : peakShape,
          atomRefs: atomRefs.length > 0 ? atomRefs : undefined
        });
      }

      // Extract reference info
      const titleMatch = spectrumContent.match(/<title>([^<]+)<\/title>/);
      const yearMatch = spectrumContent.match(/<year>([^<]+)<\/year>/);
      const journalMatch = spectrumContent.match(/<journal>([^<]+)<\/journal>/);
      const authorMatch = spectrumContent.match(/<author>([^<]+)<\/author>/);

      const reference = titleMatch ? {
        title: titleMatch[1],
        year: yearMatch ? yearMatch[1] : undefined,
        journal: journalMatch ? journalMatch[1] : undefined,
        authors: authorMatch ? authorMatch[1] : undefined
      } : undefined;

      spectra.push({
        id: spectrumId,
        spectrumType,
        frequency,
        temperature,
        solvent,
        peaks,
        reference
      });
    }

    return {
      success: spectra.length > 0,
      molecule: moleculeName ? {
        id: moleculeId,
        name: moleculeName
      } : undefined,
      spectra,
      source: 'NMRShiftDB2',
      message: spectra.length === 0 ? 'No spectra found in NMRShiftDB2' : undefined
    };

  } catch (error) {
    console.error('❌ Error parsing CML:', error);
    return {
      success: false,
      spectra: [],
      source: 'NMRShiftDB2',
      message: 'Failed to parse NMRShiftDB2 response'
    };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inchi = searchParams.get('inchi');
  const smiles = searchParams.get('smiles');
  const spectrumtype = searchParams.get('spectrumtype') || '1H';

  console.log('\n🔬 NMRShiftDB2 API Request:');
  console.log(`  InChI: ${inchi || 'not provided'}`);
  console.log(`  SMILES: ${smiles || 'not provided'}`);
  console.log(`  Spectrum Type: ${spectrumtype}`);

  // Validate input
  if (!inchi && !smiles) {
    return NextResponse.json({
      success: false,
      spectra: [],
      source: 'NMRShiftDB2',
      message: 'Either inchi or smiles parameter is required'
    }, { status: 400 });
  }

  try {
    let url: string;

    if (inchi) {
      // Use InChI endpoint (preferred)
      const encodedInchi = encodeURIComponent(inchi);
      url = `https://nmrshiftdb.nmr.uni-koeln.de/NmrshiftdbServlet?nmrshiftdbaction=exportcmlbyinchi&inchi=${encodedInchi}&spectrumtype=${spectrumtype}`;
      console.log(`📡 Querying by InChI: ${inchi.substring(0, 50)}...`);
    } else {
      // Use SMILES endpoint
      const encodedSmiles = encodeURIComponent(smiles!);
      url = `https://nmrshiftdb.nmr.uni-koeln.de/NmrshiftdbServlet?nmrshiftdbaction=searchorpredict&smiles=${encodedSmiles}&spectrumtype=${spectrumtype}`;
      console.log(`📡 Querying by SMILES: ${smiles}`);
    }

    console.log(`🌐 URL: ${url}`);

    // Önce fetch ile dene (daha güvenilir)
    let xmlText: string;
    try {
      // SSL sertifika sorununu bypass etmek için https agent kullan
      // Note: In production, use proper SSL certificates
      const httpsAgent = new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false // Only bypass in development
      });
      
      const fetchResponse = await fetch(url, {
        headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
        signal: AbortSignal.timeout(10000), // 10 saniye timeout
        // @ts-ignore - Node.js özel agent ayarı (fetch API'de desteklenmiyor, curl fallback kullanılacak)
        // agent: httpsAgent
      });

      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
      }

      xmlText = await fetchResponse.text();

      if (!xmlText || xmlText.length < 100) {
        throw new Error('Empty or invalid response from NMRShiftDB2');
      }
    } catch (fetchError) {
      console.warn(`⚠️ Fetch failed, trying curl fallback:`, fetchError);
      
      // Fallback: curl kullan (Windows'ta curl olmayabilir)
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execPromise = promisify(exec);

        const { stdout, stderr } = await execPromise(`curl -k -A "NMR-MIND-App/1.0" "${url}"`, {
          timeout: 10000
        });

        if (stderr && stderr.includes('error')) {
          throw new Error(`Curl error: ${stderr}`);
        }

        xmlText = stdout;

        if (!xmlText || xmlText.length < 100) {
          throw new Error('Empty response from NMRShiftDB2');
        }
      } catch (curlError) {
        console.error(`❌ Both fetch and curl failed:`, curlError);
        return NextResponse.json({
          success: false,
          spectra: [],
          source: 'NMRShiftDB2',
          message: curlError instanceof Error ? curlError.message : 'Failed to fetch from NMRShiftDB2'
        }, { status: 500 });
      }
    }
    console.log(`📄 Received ${xmlText.length} bytes of CML data`);

    // Parse the CML response
    const result = parseCMLResponse(xmlText);

    console.log(`📊 Parsed ${result.spectra.length} spectra`);
    if (result.molecule) {
      console.log(`🧪 Molecule: ${result.molecule.name}`);
    }

    result.spectra.forEach((spectrum, index) => {
      console.log(`  Spectrum ${index + 1}:`);
      console.log(`    Type: ${spectrum.spectrumType}`);
      console.log(`    Peaks: ${spectrum.peaks.length}`);
      console.log(`    Frequency: ${spectrum.frequency || 'N/A'}`);
      console.log(`    Solvent: ${spectrum.solvent || 'N/A'}`);
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error fetching from NMRShiftDB2:', error);
    return NextResponse.json({
      success: false,
      spectra: [],
      source: 'NMRShiftDB2',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
