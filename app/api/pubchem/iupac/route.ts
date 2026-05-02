import { NextRequest, NextResponse } from 'next/server';

/**
 * Normalize molecular formula: Convert Unicode subscripts to normal numbers
 * Example: C₄₇H₅₁NO₁₄ → C47H51NO14
 */
function normalizeFormula(formula: string): string {
  if (!formula) return '';
  
  // Unicode subscript to normal number mapping
  const subscriptMap: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
    '₆': '6', '₇': '7', '₈': '8', '₉': '9'
  };
  
  return formula.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => subscriptMap[char] || char);
}

/**
 * Compare two formulas (handles Unicode subscripts)
 */
function formulasMatch(formula1: string, formula2: string): boolean {
  if (!formula1 || !formula2) return false;
  const normalized1 = normalizeFormula(formula1).toUpperCase();
  const normalized2 = normalizeFormula(formula2).toUpperCase();
  return normalized1 === normalized2;
}

/**
 * PubChem IUPAC Name API
 * Get IUPAC name for a given CID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get('cid');

    if (!cid) {
      return NextResponse.json(
        { success: false, error: 'CID required' },
        { status: 400 }
      );
    }

    // Optional: expectedFormula for validation
    const expectedFormula = searchParams.get('formula');

    console.log(`🔍 Fetching IUPAC name for CID ${cid}...`);
    if (expectedFormula) {
      console.log(`   Expected formula: ${expectedFormula}`);
    }

    // Fetch both IUPAC name AND molecular formula from PubChem
    const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula/JSON`;
    const pubchemResponse = await fetch(pubchemUrl, {
      headers: { 'User-Agent': 'NMR-MIND-App/1.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!pubchemResponse.ok) {
      throw new Error(`PubChem HTTP ${pubchemResponse.status}`);
    }

    const pubchemData = await pubchemResponse.json();
    const properties = pubchemData.PropertyTable?.Properties?.[0];
    const iupacName = properties?.IUPACName;
    const pubchemFormula = properties?.MolecularFormula;

    if (!iupacName) {
      return NextResponse.json(
        { success: false, error: 'IUPAC name not found' },
        { status: 404 }
      );
    }

    // ⚠️ VALIDATION: Check if PubChem formula matches expected formula
    // ✅ Unicode subscript'leri normalize et (C₄₇H₅₁NO₁₄ → C47H51NO14)
    let formulaMatch = true;
    if (expectedFormula && pubchemFormula) {
      formulaMatch = formulasMatch(expectedFormula, pubchemFormula);
      
      if (!formulaMatch) {
        console.error(`🚨 CRITICAL: Formula mismatch for CID ${cid}:`);
        console.error(`   Expected: ${expectedFormula} (normalized: ${normalizeFormula(expectedFormula)})`);
        console.error(`   PubChem:  ${pubchemFormula} (normalized: ${normalizeFormula(pubchemFormula)})`);
        console.error(`   → This CID is WRONG! Returning error to prevent wrong data usage.`);
        
        // ⚠️ Formül uyuşmazlığı varsa yanlış bilgileri döndürme!
        return NextResponse.json({
          success: false,
          error: 'Formula mismatch detected',
          cid: parseInt(cid),
          iupacName: null, // Yanlış IUPAC adını döndürme!
          formula: null, // Yanlış formülü döndürme!
          formulaMatch: false,
          warning: `CID ${cid} has formula ${pubchemFormula} but expected ${expectedFormula}. This CID may be wrong for the searched molecule.`
        }, { status: 400 });
      }
    }

    console.log(`✅ IUPAC name for CID ${cid}: "${iupacName}"`);
    console.log(`   Formula: ${pubchemFormula} ${formulaMatch ? '✓' : '✗ MISMATCH'}`);

    return NextResponse.json({
      success: true,
      cid: parseInt(cid),
      iupacName,
      formula: pubchemFormula,
      formulaMatch: true
    });

  } catch (error) {
    console.error('PubChem IUPAC fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch IUPAC name'
      },
      { status: 500 }
    );
  }
}
