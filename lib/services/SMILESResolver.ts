/**
 * SMILESResolver Service
 *
 * Single Responsibility: Convert molecule names/CIDs to SMILES strings
 *
 * Principles Applied:
 * - DRY: Centralized SMILES resolution logic
 * - SoC: Only handles SMILES resolution, nothing else
 * - Fail Fast: Returns null immediately if inputs are invalid
 */

export interface SMILESResolutionResult {
  smiles: string | null;
  source: 'pubchem' | 'opsin' | 'cached' | null;
  originalSource?: 'pubchem' | 'opsin' | null;
  isomeric: boolean; // IsomericSMILES (with stereochemistry) vs CanonicalSMILES
  inchi?: string;
  error?: string;
  validated?: boolean;
}

interface CachedSMILESResult {
  value: SMILESResolutionResult;
  fetchedAt: number; // timestamp
  status: 'ok' | 'fail';
}

export class SMILESResolver {
  private static validateResolutionResult(result: SMILESResolutionResult): SMILESResolutionResult {
    if (result.smiles && !result.source) {
      return {
        smiles: null,
        source: null,
        originalSource: null,
        isomeric: false,
        validated: false,
        error: 'Invalid resolution result: smiles present but source missing',
      };
    }
    if (result.inchi && !result.inchi.startsWith('InChI=')) {
      return {
        ...result,
        validated: false,
        error: 'Invalid InChI format',
      };
    }
    return { ...result, validated: true };
  }

  private static cache = new Map<number, CachedSMILESResult>();
  
  // TTL constants (milliseconds)
  private static readonly CACHE_TTL_OK = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly CACHE_TTL_FAIL = 30 * 60 * 1000; // 30 minutes

  /**
   * Resolve SMILES from PubChem CID
   *
   * @param cid - PubChem Compound ID
   * @returns SMILES string or null
   */
  static async fromCID(cid: number): Promise<SMILESResolutionResult> {
    // Fail Fast: Invalid input
    if (!cid || cid <= 0) {
      return { smiles: null, source: null, isomeric: false, error: 'Invalid CID' };
    }

    // Check cache with TTL
    if (this.cache.has(cid)) {
      const cached = this.cache.get(cid)!;
      const age = Date.now() - cached.fetchedAt;
      const ttl = cached.status === 'ok' ? this.CACHE_TTL_OK : this.CACHE_TTL_FAIL;
      
      if (age < ttl) {
        console.log(`✅ SMILES cache hit for CID ${cid} (age: ${Math.round(age / 1000)}s)`);
        return this.validateResolutionResult({
          ...cached.value,
          source: 'cached',
          originalSource: cached.value.source === 'cached' ? cached.value.originalSource ?? null : (cached.value.source as 'pubchem' | 'opsin' | null),
        });
      } else {
        // Cache expired, remove it
        this.cache.delete(cid);
        console.log(`⏰ SMILES cache expired for CID ${cid}, fetching fresh data`);
      }
    }

    try {
      console.log(`🔬 Resolving SMILES for CID ${cid}...`);

      // PubChem Property API (CoC: Convention - always prefer IsomericSMILES)
      const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IsomericSMILES,CanonicalSMILES,InChI/JSON`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'SpectroMind/1.0' }
      });

      if (!response.ok) {
        throw new Error(`PubChem API returned ${response.status}`);
      }

      const data = await response.json();
      const props = data.PropertyTable?.Properties?.[0];

      if (!props) {
        throw new Error('No properties in PubChem response');
      }

      // Prefer IsomericSMILES (includes stereochemistry)
      const smiles = props.IsomericSMILES || props.CanonicalSMILES;
      const isomeric = !!props.IsomericSMILES;

      if (!smiles) {
        throw new Error('No SMILES found in PubChem response');
      }

      const result: SMILESResolutionResult = {
        smiles,
        source: 'pubchem',
        originalSource: 'pubchem',
        isomeric,
        inchi: props.InChI
      };

      // Cache the result with timestamp
      this.cache.set(cid, {
        value: result,
        fetchedAt: Date.now(),
        status: 'ok'
      });

      console.log(`✅ SMILES resolved: ${smiles.substring(0, 50)}... (${isomeric ? 'isomeric' : 'canonical'})`);

      return this.validateResolutionResult(result);

    } catch (error) {
      console.error(`❌ Failed to resolve SMILES for CID ${cid}:`, error);
      
      const errorResult: SMILESResolutionResult = {
        smiles: null,
        source: null,
        originalSource: null,
        isomeric: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      // Cache failure (with shorter TTL)
      this.cache.set(cid, {
        value: errorResult,
        fetchedAt: Date.now(),
        status: 'fail'
      });
      
      return this.validateResolutionResult(errorResult);
    }
  }

  /**
   * Resolve SMILES from IUPAC name using OPSIN
   *
   * @param iupacName - IUPAC chemical name
   * @returns SMILES string or null
   */
  static async fromIUPAC(iupacName: string): Promise<SMILESResolutionResult> {
    // Fail Fast: Invalid input
    if (!iupacName || iupacName.trim() === '' || iupacName === 'undefined') {
      return { smiles: null, source: null, isomeric: false, error: 'Invalid IUPAC name' };
    }

    try {
      console.log(`🔬 Converting IUPAC to SMILES: "${iupacName}"`);

      const response = await fetch(`/api/opsin?name=${encodeURIComponent(iupacName)}`);

      if (!response.ok) {
        throw new Error(`OPSIN API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.smiles) {
        throw new Error(data.error || 'OPSIN conversion failed');
      }

      console.log(`✅ OPSIN conversion: ${data.smiles.substring(0, 50)}...`);

      return this.validateResolutionResult({
        smiles: data.smiles,
        source: 'opsin',
        originalSource: 'opsin',
        isomeric: false // OPSIN usually returns canonical SMILES
      });

    } catch (error) {
      console.error(`❌ Failed to convert IUPAC to SMILES:`, error);
      return this.validateResolutionResult({
        smiles: null,
        source: null,
        originalSource: null,
        isomeric: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resolve SMILES with fallback chain: CID → IUPAC → fail
   *
   * @param molecule - Object with CID and/or IUPAC name
   * @returns SMILES string or null
   */
  static async resolve(molecule: {
    cid?: number;
    iupacName?: string;
    name?: string;
  }): Promise<SMILESResolutionResult> {
    // Strategy 1: Try CID first (most reliable)
    if (molecule.cid) {
      const result = await this.fromCID(molecule.cid);
      if (result.smiles) {
        return result;
      }
    }

    // Strategy 2: Try IUPAC name
    const iupacName = molecule.iupacName || molecule.name;
    if (iupacName) {
      const result = await this.fromIUPAC(iupacName);
      if (result.smiles) {
        return result;
      }
    }

    // Fail: All strategies failed
    return this.validateResolutionResult({
      smiles: null,
      source: null,
      originalSource: null,
      isomeric: false,
      error: 'All SMILES resolution strategies failed'
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
