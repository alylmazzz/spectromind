/**
 * Structure Cache Service
 *
 * PURPOSE:
 * - Check libraries FIRST before generating with RDKit
 * - PubChem has free 2D/3D structures and images
 * - Avoid expensive RDKit calculations if data already exists
 *
 * STRATEGY:
 * 1. Check PubChem (has 2D PNG, 3D SDF)
 * 2. Check enhanced library (cached data)
 * 3. Only if not found → generate with RDKit
 *
 * USAGE:
 * import { structureCache } from '@/lib/services/StructureCache';
 * const structure = await structureCache.getStructure(cid, smiles);
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CachedStructure {
  source: 'pubchem' | 'enhanced-library' | 'rdkit-generated';
  cid?: number;

  // 2D
  image2D?: string; // URL to PNG image
  coords2D?: Array<{ element: string; x: number; y: number }>;

  // 3D
  coords3D?: Array<{ element: string; x: number; y: number; z: number }>;
  sdf3D?: string; // 3D structure file

  // Metadata
  iupacName?: string; // IUPAC systematic name
  pointGroup?: string;
  symmetryElements?: string[];
  molecularFormula?: string;
  molecularWeight?: number;
}

// ============================================================================
// STRUCTURE CACHE SERVICE
// ============================================================================

class StructureCacheService {

  /**
   * Get structure from cache or generate
   *
   * @param cid - PubChem CID (if available)
   * @param smiles - SMILES string (required for generation)
   * @param moleculeName - Molecule name (for enhanced library lookup)
   * @param expectedFormula - Expected molecular formula for validation
   * @returns Structure data from best available source
   */
  async getStructure(
    cid?: number,
    smiles?: string,
    moleculeName?: string,
    expectedFormula?: string
  ): Promise<CachedStructure> {

    // ========================================
    // STEP 1: Try PubChem (if CID available)
    // ========================================
    if (cid) {
      console.log(`🔍 Checking PubChem for CID ${cid}...`);
      const pubchemStructure = await this.getPubChemStructure(cid, expectedFormula);

      if (pubchemStructure) {
        console.log(`✅ Found in PubChem! (2D: ${pubchemStructure.image2D ? 'YES' : 'NO'}, 3D: ${pubchemStructure.coords3D ? 'YES' : 'NO'}, IUPAC: ${pubchemStructure.iupacName ? 'YES' : 'NO'})`);
        return pubchemStructure;
      }
    }

    // ========================================
    // STEP 2: Try Enhanced Library
    // ========================================
    if (moleculeName) {
      console.log(`🔍 Checking enhanced library for "${moleculeName}"...`);
      const libraryStructure = await this.getEnhancedLibraryStructure(moleculeName);

      if (libraryStructure) {
        console.log(`✅ Found in enhanced library!`);
        return libraryStructure;
      }
    }

    // ========================================
    // STEP 3: Generate with RDKit (fallback)
    // ========================================
    if (smiles) {
      console.log(`⚙️ Generating structure with RDKit for "${smiles}"...`);
      const generatedStructure = await this.generateWithRDKit(smiles);

      if (generatedStructure) {
        console.log(`✅ Generated with RDKit!`);
        return generatedStructure;
      }
    }

    // ========================================
    // STEP 4: No structure available
    // ========================================
    console.log(`❌ No structure data available`);
    return { source: 'pubchem' }; // Empty result
  }

  /**
   * Get structure from PubChem
   * PubChem provides FREE 2D PNG images, 3D SDF files, and IUPAC names
   */
  private async getPubChemStructure(cid: number, expectedFormula?: string): Promise<CachedStructure | null> {
    try {
      // PubChem REST API endpoints
      const image2D = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`;
      const sdf3D = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
      const propertiesURL = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`;

      // Check if 2D image exists (quick HEAD request)
      const imageExists = await this.checkURL(image2D);

      // Try to get properties (IUPAC + Formula) from PubChem
      let iupacName: string | undefined;
      let molecularFormula: string | undefined;
      let molecularWeight: number | undefined;
      let formulaMatch = true;

      try {
        const propertiesResponse = await fetch(propertiesURL);
        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          const props = propertiesData.PropertyTable?.Properties?.[0];

          iupacName = props?.IUPACName;
          molecularFormula = props?.MolecularFormula;
          molecularWeight = props?.MolecularWeight;

          // ⚠️ VALIDATION: Formül kontrolü
          if (expectedFormula && molecularFormula && molecularFormula !== expectedFormula) {
            console.warn(`⚠️ PubChem formula mismatch for CID ${cid}:`);
            console.warn(`   Expected: ${expectedFormula}`);
            console.warn(`   PubChem:  ${molecularFormula}`);
            console.warn(`   → Bu CID yanlış olabilir!`);
            formulaMatch = false;
          }
        }
      } catch (error) {
        console.log('PubChem properties not available');
      }

      // Try to get 3D coordinates from PubChem
      let coords3D: CachedStructure['coords3D'] | undefined;
      let pointGroup: string | undefined;

      try {
        const sdfResponse = await fetch(sdf3D);
        if (sdfResponse.ok) {
          const sdfText = await sdfResponse.text();
          coords3D = this.parseSDF(sdfText);

          // PubChem doesn't provide point group, but we can estimate
          // based on molecule symmetry (simplified)
        }
      } catch (error) {
        // 3D not available, that's ok
      }

      if (imageExists || coords3D || iupacName) {
        return {
          source: 'pubchem',
          cid,
          image2D: imageExists && formulaMatch ? image2D : undefined, // ⚠️ Sadece formula match ise göster
          iupacName,
          molecularFormula,
          molecularWeight,
          coords3D,
          sdf3D: coords3D ? sdf3D : undefined
        };
      }

      return null;

    } catch (error) {
      console.error('PubChem structure fetch error:', error);
      return null;
    }
  }

  /**
   * Get structure from enhanced library
   */
  private async getEnhancedLibraryStructure(moleculeName: string): Promise<CachedStructure | null> {
    try {
      // Check if enhanced library has this molecule with structure data
      const response = await fetch(`/api/enhanced-library?provider=chatgpt`);

      if (!response.ok) return null;

      const library = await response.json();

      // Search for molecule in library
      const molecule = library.molecules?.find((m: any) =>
        m.name?.toLowerCase() === moleculeName.toLowerCase() ||
        m.iupac?.toLowerCase() === moleculeName.toLowerCase()
      );

      if (molecule && (molecule.coords2D || molecule.coords3D || molecule.cid)) {
        return {
          source: 'enhanced-library',
          cid: molecule.cid,
          coords2D: molecule.coords2D,
          coords3D: molecule.coords3D,
          image2D: molecule.cid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${molecule.cid}/PNG` : undefined,
          iupacName: molecule.iupac || molecule.iupacName,
          pointGroup: molecule.pointGroup,
          symmetryElements: molecule.symmetryElements
        };
      }

      return null;

    } catch (error) {
      console.error('Enhanced library fetch error:', error);
      return null;
    }
  }

  /**
   * Generate structure with RDKit (expensive, use as last resort)
   */
  private async generateWithRDKit(smiles: string): Promise<CachedStructure | null> {
    try {
      const response = await fetch('/api/rdkit/analyze-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles })
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (!data.success) return null;

      return {
        source: 'rdkit-generated',
        coords2D: data.coords_2d,
        coords3D: data.coords_3d,
        pointGroup: data.point_group,
        symmetryElements: data.symmetry_elements,
        molecularFormula: data.molecular_formula,
        molecularWeight: data.molecular_weight
      };

    } catch (error) {
      console.error('RDKit generation error:', error);
      return null;
    }
  }

  /**
   * Check if URL exists (HEAD request)
   */
  private async checkURL(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Parse SDF file to extract 3D coordinates
   */
  private parseSDF(sdf: string): Array<{ element: string; x: number; y: number; z: number }> | undefined {
    try {
      const lines = sdf.split('\n');

      // Find atom count line (line 4 in SDF format)
      const countsLine = lines[3];
      if (!countsLine) return undefined;

      const atomCount = parseInt(countsLine.substring(0, 3).trim());

      // Parse atom block (starts at line 5)
      const coords: Array<{ element: string; x: number; y: number; z: number }> = [];

      for (let i = 0; i < atomCount; i++) {
        const line = lines[4 + i];
        if (!line) break;

        const x = parseFloat(line.substring(0, 10).trim());
        const y = parseFloat(line.substring(10, 20).trim());
        const z = parseFloat(line.substring(20, 30).trim());
        const element = line.substring(31, 34).trim();

        coords.push({ element, x, y, z });
      }

      return coords.length > 0 ? coords : undefined;

    } catch (error) {
      console.error('SDF parsing error:', error);
      return undefined;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const structureCache = new StructureCacheService();
