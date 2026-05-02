/**
 * PubChem API Service
 *
 * Handles all PubChem REST API interactions:
 * - CID searches (by name, formula)
 * - Synonym retrieval
 * - Property fetching (InChI, SMILES)
 * - Batch NMR data processing
 */

// Türkçe -> İngilizce molekül ismi çevirisi
const TURKISH_TO_ENGLISH: Record<string, string> = {
  'aseton': 'acetone',
  'etanol': 'ethanol',
  'metanol': 'methanol',
  'benzen': 'benzene',
  'toluen': 'toluene',
  'kloroform': 'chloroform',
  'asetik asit': 'acetic acid',
  'sükroz': 'sucrose',
  'glikoz': 'glucose',
  'fruktoz': 'fructose',
  'kafein': 'caffeine',
  'aspirin': 'aspirin',
  'su': 'water',
  'amonyak': 'ammonia',
};

interface CIDSearchResult {
  cids: number[];
  detectedType: 'name' | 'formula';
}

interface NMRPeak {
  shift: number;
  intensity: number;
  multiplicity?: string;
  integration?: string;
  assignment?: string;
}

interface NMRSpectrum {
  nucleus: string;
  solvent?: string;
  frequency?: string;
  peaks: NMRPeak[];
}

interface MoleculeData {
  cid: number;
  name: string;
  formula?: string;
  nmrData?: NMRSpectrum[];
  source: string;
  synonyms?: string[];
  smiles?: string;
  inchi?: string;
}

export class PubChemService {
  private static readonly BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
  private static readonly USER_AGENT = 'NMR-MIND-App/1.0';
  private static readonly BATCH_SIZE = 800;

  /**
   * Translate Turkish molecule names to English
   */
  static translateTurkishName(query: string): string {
    const lowerQuery = query.toLowerCase().trim();
    return TURKISH_TO_ENGLISH[lowerQuery] || query;
  }

  /**
   * Detect if query is a chemical formula or name
   */
  static detectQueryType(query: string): 'name' | 'formula' {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return 'name';
    }

    // 1. Classic formula: C6H12O6, H2O, CH4
    const classicFormulaPattern = /^([A-Z][a-z]?\d*)+$/;
    if (classicFormulaPattern.test(trimmedQuery)) {
      console.log(`🔬 Formül algılandı (klasik): ${trimmedQuery}`);
      return 'formula';
    }

    // 2. Formula with parentheses: Ca(OH)2, Fe(CN)6
    const parenthesisFormulaPattern = /^([A-Z][a-z]?\d*|\(([A-Z][a-z]?\d*)+\)\d*)+$/;
    if (parenthesisFormulaPattern.test(trimmedQuery)) {
      console.log(`🔬 Formül algılandı (parantezli): ${trimmedQuery}`);
      return 'formula';
    }

    // 3. Check for element symbols
    if (!trimmedQuery.includes(' ')) {
      const commonElements = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
                              'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
                              'Fe', 'Cu', 'Zn', 'Br', 'Ag', 'I', 'Au', 'Hg', 'Pb'];

      let hasElement = false;
      let hasOnlyElementsAndNumbers = true;

      for (let j = 0; j < trimmedQuery.length; j++) {
        const char = trimmedQuery[j];

        if (/[A-Z]/.test(char)) {
          const nextChar = trimmedQuery[j + 1];
          const symbol = nextChar && /[a-z]/.test(nextChar) ? char + nextChar : char;

          if (commonElements.includes(symbol)) {
            hasElement = true;
          } else if (!/\d/.test(char)) {
            hasOnlyElementsAndNumbers = false;
          }
        } else if (!/[\da-z()]/.test(char)) {
          hasOnlyElementsAndNumbers = false;
        }
      }

      if (hasElement && hasOnlyElementsAndNumbers) {
        console.log(`🔬 Formül algılandı (element sembolleri): ${trimmedQuery}`);
        return 'formula';
      }
    }

    // 4. Contains spaces → likely a name
    if (trimmedQuery.includes(' ')) {
      console.log(`📝 İsim algılandı (boşluk içeriyor): ${trimmedQuery}`);
      return 'name';
    }

    // 5. Starts with lowercase → name
    if (/^[a-z]/.test(trimmedQuery)) {
      console.log(`📝 İsim algılandı (küçük harf başlangıç): ${trimmedQuery}`);
      return 'name';
    }

    // 6. IUPAC pattern: 2-Methylpropane, 3-Hexanol
    if (/^\d+-[A-Za-z]/.test(trimmedQuery)) {
      console.log(`📝 İsim algılandı (IUPAC pattern): ${trimmedQuery}`);
      return 'name';
    }

    // 7. Long and complex → probably a name
    if (trimmedQuery.length > 15 && /[a-z]/.test(trimmedQuery)) {
      console.log(`📝 İsim algılandı (uzun string): ${trimmedQuery}`);
      return 'name';
    }

    console.log(`📝 İsim algılandı (default): ${trimmedQuery}`);
    return 'name';
  }

  /**
   * Search PubChem for CIDs by name or formula
   */
  static async searchCIDs(query: string, type: 'name' | 'formula'): Promise<CIDSearchResult> {
    const endpoint = type === 'name'
      ? `${this.BASE_URL}/compound/name/${encodeURIComponent(query)}/cids/JSON`
      : `${this.BASE_URL}/compound/fastformula/${encodeURIComponent(query)}/cids/JSON`;

    console.log(`📡 PubChem Endpoint: ${endpoint.substring(0, 100)}...`);

    const response = await fetch(endpoint, {
      headers: { 'User-Agent': this.USER_AGENT }
    });

    if (!response.ok) {
      // If formula search fails, try name search as fallback
      if (type === 'formula') {
        console.log(`🔄 Formula araması başarısız, name ile tekrar deneniyor...`);
        return this.searchCIDs(query, 'name');
      }
      return { cids: [], detectedType: type };
    }

    const data = await response.json();
    const cids: number[] = data.IdentifierList?.CID || [];

    console.log(`📊 PubChem'de ${cids.length.toLocaleString()} CID bulundu`);

    return { cids, detectedType: type };
  }

  /**
   * Get synonyms for a CID
   */
  static async getSynonyms(cid: number): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/compound/cid/${cid}/synonyms/JSON`,
        { headers: { 'User-Agent': this.USER_AGENT } }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const synonyms = data.InformationList?.Information?.[0]?.Synonym || [];

      // Return first 20 synonyms
      return synonyms.slice(0, 20);

    } catch (error) {
      console.error('Synonym alınamadı:', error);
      return [];
    }
  }

  /**
   * Get InChI for a CID
   */
  static async getInChI(cid: number): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/compound/cid/${cid}/property/InChI/JSON`,
        { headers: { 'User-Agent': this.USER_AGENT } }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.PropertyTable?.Properties?.[0]?.InChI || null;

    } catch (error) {
      console.error('InChI alınamadı:', error);
      return null;
    }
  }

  /**
   * Get SMILES and InChI for a CID
   */
  static async getMolecularIdentifiers(cid: number): Promise<{ smiles: string | null; inchi: string | null }> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/compound/cid/${cid}/property/CanonicalSMILES,InChI/JSON`,
        { headers: { 'User-Agent': this.USER_AGENT } }
      );

      if (!response.ok) {
        return { smiles: null, inchi: null };
      }

      const data = await response.json();
      const props = data.PropertyTable?.Properties?.[0];

      return {
        smiles: props?.CanonicalSMILES || null,
        inchi: props?.InChI || null
      };

    } catch (error) {
      console.error('Moleküler tanımlayıcılar alınamadı:', error);
      return { smiles: null, inchi: null };
    }
  }

  /**
   * Process batch of CIDs to find molecules with NMR data
   */
  static async processBatch(
    batchCids: number[],
    batchNumber: number,
    batchStart: number,
    batchEnd: number
  ): Promise<MoleculeData[]> {
    console.log(`\n🔄 Batch ${batchNumber}: CID ${batchStart.toLocaleString()} - ${batchEnd.toLocaleString()} (${batchCids.length} molekül)`);

    const batchUrl = `${this.BASE_URL}/compound/cid/${batchCids.join(',')}/JSON`;

    try {
      const batchResponse = await fetch(batchUrl, {
        headers: { 'User-Agent': this.USER_AGENT }
      });

      if (!batchResponse.ok) {
        console.log(`  ❌ Batch ${batchNumber} hatası: HTTP ${batchResponse.status}`);
        return [];
      }

      const batchData = await batchResponse.json();
      const compounds = batchData.PC_Compounds || [];

      console.log(`  ✅ ${compounds.length} molekül bilgisi alındı`);

      const moleculesWithNMR: MoleculeData[] = [];

      for (const compound of compounds) {
        const cid = compound.id?.id?.cid;
        if (!cid) continue;

        // Check for NMR data
        const nmrData = compound.props?.find((p: any) =>
          p.urn?.label?.toLowerCase().includes('nmr') ||
          p.urn?.name?.toLowerCase().includes('nmr')
        );

        if (nmrData) {
          const moleculeName = compound.props?.find((p: any) =>
            p.urn?.label === 'IUPAC Name' ||
            p.urn?.name === 'IUPAC Name'
          )?.value?.sval || `CID ${cid}`;

          const formula = compound.props?.find((p: any) =>
            p.urn?.label === 'Molecular Formula'
          )?.value?.sval;

          moleculesWithNMR.push({
            cid,
            name: moleculeName,
            formula,
            nmrData: [{ nucleus: '1H', peaks: [] }], // Placeholder
            source: 'PubChem'
          });

          console.log(`  🎯 NMR bulundu: ${moleculeName} (CID: ${cid})`);
        }
      }

      if (moleculesWithNMR.length > 0) {
        console.log(`  ✨ Batch ${batchNumber}'de ${moleculesWithNMR.length} molekülde NMR verisi bulundu!`);
      } else {
        console.log(`  ⚠️  Batch ${batchNumber}'de NMR verisi yok, devam ediliyor...`);
      }

      return moleculesWithNMR;

    } catch (error) {
      console.error(`  ❌ Batch ${batchNumber} işleme hatası:`, error);
      return [];
    }
  }

  /**
   * Process all CIDs with batch processing
   */
  static async processAllCIDs(cids: number[]): Promise<MoleculeData[]> {
    const molecules: MoleculeData[] = [];
    let batchNumber = 0;

    console.log(`🔬 ${this.BATCH_SIZE}'er ${this.BATCH_SIZE}'er batch işleme başlıyor...`);
    console.log(`📋 Toplam ${Math.ceil(cids.length / this.BATCH_SIZE)} batch olacak\n`);

    for (let i = 0; i < cids.length; i += this.BATCH_SIZE) {
      batchNumber++;
      const batchCids = cids.slice(i, i + this.BATCH_SIZE);
      const batchStart = i + 1;
      const batchEnd = Math.min(i + this.BATCH_SIZE, cids.length);

      const batchMolecules = await this.processBatch(batchCids, batchNumber, batchStart, batchEnd);
      molecules.push(...batchMolecules);

      // Early termination if we found enough molecules
      if (molecules.length >= 10) {
        console.log(`\n✅ ${molecules.length} molekül bulundu, batch işleme sonlandırılıyor (erken çıkış)`);
        break;
      }
    }

    return molecules;
  }
}
