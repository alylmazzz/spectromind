import { NextRequest, NextResponse } from 'next/server';
import { IUPACService } from './services/iupac.service';
import { PubChemService } from './services/pubchem.service';
import { loadEnhancedLibraryFromFile } from '@/lib/utils/enhancedLibraryServer';
import type { EnhancedLibraryMolecule } from '@/lib/types';

/**
 * PubChem Title'ı kullanıcı aramasına göre temizle
 * Örn: "qs-21-apiose isomer" → "QS-21" (eğer kullanıcı "qs-21" aradıysa)
 */
function cleanMoleculeName(pubchemTitle: string, userQuery: string): string {
  const lowerTitle = pubchemTitle.toLowerCase();
  const lowerQuery = userQuery.toLowerCase().trim();

  // Eğer Title, kullanıcının arama terimini içeren bir isomer/varyant ismiyse
  // daha basit versiyonu tercih et
  if (lowerTitle.includes(lowerQuery)) {
    // "qs-21-apiose isomer" → "QS-21"
    if (lowerTitle.includes('isomer') || lowerTitle.includes('variant')) {
      // Kullanıcının arama terimini title case'e çevir
      return userQuery.toUpperCase();
    }
  }

  return pubchemTitle;
}

/**
 * PubChem Unified API
 * GET /api/pubchem?type=[name|formula|nmr]&query=[value]
 */
export async function GET(request: NextRequest) {
  console.log('🚀🚀🚀 ROUTE.TS VERSION: 2024-12-18-FALLBACK-CHAIN-V2 🚀🚀🚀');
  try {
    const searchParams = request.nextUrl.searchParams;
    let type = searchParams.get('type');
    let query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query parametresi gerekli' },
        { status: 400 }
      );
    }

    // TÜM ARAMALAR KÜÇÜK HARFLE YAPILMALI
    query = query.toLowerCase().trim();

    // OTOMATIK ALGILAMA: Eğer type verilmemişse, otomatik algıla
    if (!type) {
      const detectedType = PubChemService.detectQueryType(query);
      console.log(`✨ Otomatik algılama: "${query}" → ${detectedType}`);
      type = detectedType;
    }

    // Türkçe ismi İngilizce'ye çevir
    if (type === 'name') {
      const translatedQuery = PubChemService.translateTurkishName(query);
      if (translatedQuery !== query) {
        console.log(`🔄 Türkçe -> İngilizce: ${query} -> ${translatedQuery}`);
        query = translatedQuery;
      }
    }

    console.log(`🔍 PubChem ${type} araması:`, query);

    // Arama aşamalarını kaydet (frontend'e göstermek için)
    const searchStages: string[] = [];

    // AI prediction için gerekli veriler
    let aiPredictionData: any = null;

    // 1. İSİM veya FORMÜL ile ARAMA
    let cids: number[] = [];
    let molecules: any[] = [];

    searchStages.push('PubChem veritabanında aranıyor...');

    if (type === 'name' || type === 'formula') {
      const endpoint = type === 'name'
        ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`
        : `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${encodeURIComponent(query)}/cids/JSON`;

      const cidResponse = await fetch(endpoint, {
        headers: { 'User-Agent': 'NMR-MIND-App/1.0' }
      });

      if (!cidResponse.ok) {
        console.log(`⚠️  PubChem'de CID bulunamadı, fallback'lara geçiliyor...`);
        searchStages.push('PubChem\'de bulunamadı');
        // DON'T RETURN - continue to fallbacks
      } else {
        const cidData = await cidResponse.json();
        cids = cidData.IdentifierList?.CID || [];

        if (cids.length === 0) {
          console.log(`⚠️  PubChem'de CID bulunamadı (0 sonuç), fallback'lara geçiliyor...`);
          searchStages.push('PubChem\'de bulunamadı');
          // DON'T RETURN - continue to fallbacks
        } else {
          console.log(`📊 PubChem'de ${cids.length.toLocaleString()} CID bulundu`);
          searchStages.push(`PubChem'de ${cids.length} molekül bulundu`);

          // İlk 3 CID'yi kontrol et (hız için)
          const maxCheck = Math.min(cids.length, 3);
          console.log(`🔬 İlk ${maxCheck} CID'nin NMR verisi PARALEL kontrol edilecek...`);

          const limitedCids = cids.slice(0, maxCheck);

      // Paralel fetch için tüm CID'leri aynı anda kontrol et
      const checkResults = await Promise.all(limitedCids.map(async (cid) => {
        try {
          // Önce molekül bilgilerini al (NMR olsun olmasın)
          const propResponse = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,Title,InChI,CanonicalSMILES/JSON`,
            { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
          );

          if (!propResponse.ok) {
            console.log(`  ⏭️  CID ${cid}: Molekül bilgileri alınamadı`);
            return null;
          }

          const propData = await propResponse.json();
          const props = propData.PropertyTable.Properties[0];

          // NMR verisi var mı kontrol et
          const nmrCheckResponse = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=1D+NMR+Spectra`,
            { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
          );

          // NMR verisi yoksa - ama molekül bilgilerini döndür (AI prediction için)
          if (!nmrCheckResponse.ok) {
            const cleanedName = cleanMoleculeName(props.Title, query);
            console.log(`  ⚠️  CID ${cid}: ${cleanedName} - NMR yok, AI prediction için ekleniyor`);

            // AI prediction için gerekli verileri hazırla
            if (!aiPredictionData) {
              aiPredictionData = {
                moleculeName: cleanedName,
                userQuery: query, // Kullanıcının yazdığı orijinal isim
                cid,
                formula: props.MolecularFormula,
                smiles: props.CanonicalSMILES,
                inchi: props.InChI,
                source: 'PubChem (No NMR data, AI prediction available)'
              };
            }

            return null; // molecules array'e ekleme (çünkü NMR yok)
          }

          const nmrCheckData = await nmrCheckResponse.json();

          // NMR section var mı kontrol et
          const spectralSection = nmrCheckData.Record?.Section?.find(
            (s: any) => s.TOCHeading === 'Spectral Information'
          );

          const nmrSection = spectralSection?.Section?.find(
            (s: any) => s.TOCHeading === '1D NMR Spectra'
          );

          const h1Section = nmrSection?.Section?.find(
            (s: any) => s.TOCHeading === '1H NMR Spectra'
          );

          // 1H NMR verisi yoksa - ama molekül bilgilerini döndür (AI prediction için)
          if (!h1Section?.Information) {
            const cleanedName = cleanMoleculeName(props.Title, query);
            console.log(`  ⚠️  CID ${cid}: ${cleanedName} - 1H NMR section yok, AI prediction için ekleniyor`);

            // AI prediction için gerekli verileri hazırla
            if (!aiPredictionData) {
              aiPredictionData = {
                moleculeName: cleanedName,
                userQuery: query, // Kullanıcının yazdığı orijinal isim
                cid,
                formula: props.MolecularFormula,
                smiles: props.CanonicalSMILES,
                inchi: props.InChI,
                source: 'PubChem (No 1H NMR data, AI prediction available)'
              };
            }

            return null;
          }

          // Peak verisi var mı kontrol et
          const hasPeakData = h1Section.Information.some(
            (info: any) => info.Name === 'Shifts [ppm]:Intensity' && info.Value?.StringWithMarkup
          );

          if (!hasPeakData) {
            const cleanedName = cleanMoleculeName(props.Title, query);
            console.log(`  ⚠️  CID ${cid}: ${cleanedName} - Peak verisi yok, AI prediction için ekleniyor`);

            // AI prediction için gerekli verileri hazırla
            if (!aiPredictionData) {
              aiPredictionData = {
                moleculeName: cleanedName,
                userQuery: query, // Kullanıcının yazdığı orijinal isim
                cid,
                formula: props.MolecularFormula,
                smiles: props.CanonicalSMILES,
                inchi: props.InChI,
                source: 'PubChem (No peak data, AI prediction available)'
              };
            }

            return null;
          }

          // NMR verisi VAR!
          const cleanedName = cleanMoleculeName(props.Title, query);
          console.log(`  ✅ CID ${cid}: ${cleanedName} - NMR VERİSİ VAR!`);

          // ✅ 13C NMR ve FTIR kontrolü (isteğe bağlı, hız için sadece 1H NMR yeterli)
          // PubChem'de 1H NMR peak verisi varsa, bu molekül spektral veriye sahip
          return {
            cid,
            name: cleanedName,
            formula: props.MolecularFormula,
            userQuery: query, // Kullanıcının yazdığı orijinal isim
            source: 'PubChem',
            // ✅ PubChem'den gelen moleküller için spektral veri bilgisi
            hasNMR: true, // PubChem'de 1H NMR peak verisi var
            hasC13: false, // 13C NMR kontrolü yapılmadı (hız için)
            hasFTIR: false, // FTIR kontrolü yapılmadı (hız için)
            spectralDataCount: 1 // En az 1H NMR var
          };

        } catch (err) {
          console.error(`CID ${cid} için hata:`, err);
          return null;
        }
      }));

      // Null olmayan sonuçları filtrele
      const validMolecules = checkResults.filter(m => m !== null);
      molecules.push(...validMolecules);

      console.log('═══════════════════════════════════════════════════════');
      console.log(`✅ ARAMA TAMAMLANDI`);
      console.log(`📊 Kontrol Edilen: ${limitedCids.length} molekül`);
      console.log(`🧪 NMR Bulunan: ${validMolecules.length} molekül`);
      console.log(`🎯 Başarı Oranı: ${((validMolecules.length / limitedCids.length) * 100).toFixed(1)}%`);
      if (cids.length > maxCheck) {
        console.log(`⚠️  Not: ${(cids.length - maxCheck).toLocaleString()} molekül daha var ama hız için atlandı`);
      }
      if (aiPredictionData) {
        console.log(`✅ AI Prediction Data hazırlandı: ${aiPredictionData.moleculeName} (CID: ${aiPredictionData.cid})`);
      }
      console.log('═══════════════════════════════════════════════════════');
        }
      }
    }

    // ✅ ENHANCED LIBRARY'DEN ÖNCE ARA (ÖNCELİKLİ - AI ile analiz edilmiş moleküller)
    // Enhanced Library molekülleri listenin başına eklenecek (öncelikli sıralama)
    console.log('📚 Enhanced Library\'de aranıyor (ÖNCELİKLİ)...');
    searchStages.push('Geliştirilmiş kütüphanede aranıyor (Öncelikli)...');
    const enhancedLibrary = await loadEnhancedLibraryFromFile(); // Server-side: dosyadan yükle
    const searchQuery = query.toLowerCase();
    
    // Enhanced Library moleküllerini saklamak için geçici array
    const enhancedLibraryMolecules: any[] = [];

    // Enhanced Library'deki tüm molekülleri kontrol et
    const enhancedMatches: Array<{
      name: string;
      cid: number | null;
      formula: string;
      usageCount: number;
    }> = [];

    // Synonym mapping: taksol -> Taxol, Paclitaxel
    const synonymMap: Record<string, string[]> = {
      'taksol': ['taxol', 'paclitaxel', 'abraxane', 'docetaxel', 'taxotere'],
      'taxol': ['paclitaxel', 'taksol', 'abraxane', 'docetaxel', 'taxotere'],
      'paclitaxel': ['taxol', 'taksol', 'abraxane', 'docetaxel', 'taxotere'],
      'paclitaxel (taxol)': ['taxol', 'taksol', 'paclitaxel', 'abraxane'],
      'qs 21': ['qs-21', 'qs21', 'quillaja saponin-21', 'quillaja saponin 21'],
      'qs-21': ['qs 21', 'qs21', 'quillaja saponin-21', 'quillaja saponin 21'],
      'qs21': ['qs 21', 'qs-21', 'quillaja saponin-21', 'quillaja saponin 21']
    };
    
    const synonyms = synonymMap[searchQuery] || [];
    const allSearchTerms = [searchQuery, ...synonyms].map(t => t.toLowerCase());
    
    // ✅ Normalize fonksiyonu: boşluk, tire, alt çizgi gibi karakterleri normalize et
    const normalizeSearchTerm = (str: string): string => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/[\s\-_\.]/g, '') // Boşluk, tire, alt çizgi, nokta kaldır
        .trim();
    };
    
    console.log(`🔍 Enhanced Library araması: "${searchQuery}" → synonyms: [${synonyms.join(', ')}]`);

    for (const [moleculeName, moleculeData] of Object.entries(enhancedLibrary.molecules) as [string, EnhancedLibraryMolecule][]) {
      const nameLower = moleculeName.toLowerCase();
      const nameNormalized = normalizeSearchTerm(moleculeName);

      // Her molekülün en son analizinden formül ve CID al
      const latestAnalysis = moleculeData.analyses[moleculeData.analyses.length - 1];
      const formula = latestAnalysis?.aiResult?.formula?.toLowerCase() || '';
      
      // ✅ Unicode subscript'leri normalize et (formül karşılaştırması için)
      const normalizeFormula = (f: string): string => {
        if (!f) return '';
        const subscriptMap: Record<string, string> = {
          '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5',
          '₆': '6', '₇': '7', '₈': '8', '₉': '9'
        };
        return f.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => subscriptMap[char] || char);
      };
      const normalizedFormula = normalizeFormula(formula);

      // İsim, formül veya synonym eşleşmesi (normalize edilmiş karşılaştırma)
      const nameMatch = allSearchTerms.some(term => {
        const termNormalized = normalizeSearchTerm(term);
        return nameLower === term || 
               nameLower.includes(term) || 
               term.includes(nameLower) ||
               nameNormalized === termNormalized ||
               nameNormalized.includes(termNormalized) ||
               termNormalized.includes(nameNormalized);
      });
      const formulaMatch = normalizedFormula.includes(searchQuery) || normalizedFormula === searchQuery;
      
      if (nameMatch || formulaMatch) {
        console.log(`  ✅ Eşleşme bulundu: "${moleculeName}" (nameMatch: ${nameMatch}, formulaMatch: ${formulaMatch})`);

        // Tüm analizlerin toplam kullanım sayısı
        const totalUsage = moleculeData.analyses.reduce((sum, a) => sum + a.usageCount, 0);

        enhancedMatches.push({
          name: moleculeName,
          cid: moleculeData.cid || null,
          formula: latestAnalysis?.aiResult?.formula || '',
          usageCount: totalUsage
        });
      }
    }

    if (enhancedMatches.length > 0) {
      console.log(`✅ Enhanced Library'de ${enhancedMatches.length} eşleşme bulundu (ÖNCELİKLİ)`);
      searchStages.push(`Geliştirilmiş kütüphanede ${enhancedMatches.length} eşleşme bulundu (Öncelikli)`);

      // Enhanced Library moleküllerini geçici array'e ekle (öncelikli sıralama için)
      for (const match of enhancedMatches) {
        // Enhanced Library'den tüm analizleri al (1H NMR, 13C NMR, FTIR)
        const moleculeData = enhancedLibrary.molecules[match.name];
        const allAnalyses = moleculeData?.analyses || [];
        
        // Her analiz tipi için peak'leri topla
        const nmrAnalysis = allAnalyses.find(a => a.spectrumType === 'nmr');
        const c13Analysis = allAnalyses.find(a => a.spectrumType === 'c13');
        const ftirAnalysis = allAnalyses.find(a => a.spectrumType === 'ftir');
        
        // AI result'ı en iyi analizden al (öncelik: nmr > c13 > ftir)
        const bestAiResult = nmrAnalysis?.aiResult || c13Analysis?.aiResult || ftirAnalysis?.aiResult;
        
        const moleculeEntry: any = {
          cid: match.cid || 0,
          name: match.name,
          formula: match.formula,
          source: 'Enhanced Library (AI Cache)',
          usageCount: match.usageCount,
          userQuery: query, // Kullanıcının yazdığı orijinal isim
          // Enhanced Library'den gelen tüm spektral veriler
          enhancedLibraryData: {
            nmrPeaks: nmrAnalysis?.peaks || [],
            nmrAnalysis: nmrAnalysis, // Tüm analiz objesi (peaks + aiResult)
            c13Analysis: c13Analysis, // Tüm analiz objesi (peaks + aiResult)
            ftirAnalysis: ftirAnalysis, // Tüm analiz objesi (peaks + aiResult)
            aiResult: bestAiResult, // En iyi AI sonucu
            hasNMR: !!nmrAnalysis,
            hasC13: !!c13Analysis,
            hasFTIR: !!ftirAnalysis
          },
          // Öncelik işareti (Enhanced Library molekülleri öncelikli)
          priority: true,
          // Detaylı spektral veri sayısı (sıralama için)
          spectralDataCount: (nmrAnalysis ? 1 : 0) + (c13Analysis ? 1 : 0) + (ftirAnalysis ? 1 : 0)
        };
        
        // ✅ Enhanced Library'den bulunan molekül için aiPredictionData hazırla (SMILES ile)
        if (bestAiResult && bestAiResult.smiles && !aiPredictionData) {
          aiPredictionData = {
            moleculeName: match.name,
            userQuery: query, // Orijinal kullanıcı sorgusu (taksol)
            cid: match.cid,
            formula: match.formula,
            smiles: bestAiResult.smiles, // Enhanced Library'den SMILES
            iupacName: bestAiResult.iupacName,
            source: 'Enhanced Library (AI Cache)',
            image2D: moleculeData.imageUrl,
            predictionMethods: {
              hose: bestAiResult.smiles ? true : false,
              ai: true,
              theoretical: bestAiResult.smiles ? true : false
            }
          };
          console.log(`  ✅ Enhanced Library'den aiPredictionData hazırlandı (SMILES: ${bestAiResult.smiles ? '✓' : '✗'})`);
        }

        enhancedLibraryMolecules.push(moleculeEntry);

        console.log(`  ✨ ${match.name} - ${match.usageCount}x kullanıldı (AI Cache) [ÖNCELİKLİ]`);
        console.log(`     📊 Analizler: 1H NMR: ${nmrAnalysis ? '✓' : '✗'}, 13C NMR: ${c13Analysis ? '✓' : '✗'}, FTIR: ${ftirAnalysis ? '✓' : '✗'}`);
      }
    } else {
      console.log('ℹ️ Enhanced Library\'de eşleşme bulunamadı');
      searchStages.push('Geliştirilmiş kütüphanede eşleşme yok');
    }

    // FALLBACK 1: NMRShiftDB2'de ara (PubChem'de NMR yoksa)
    if (molecules.length === 0) {
        console.log(`\n🔄 FALLBACK: NMRShiftDB2'de aranıyor...`);
        searchStages.push('NMRShiftDB2 veritabanında aranıyor...');

        try {
          // InChI almayı dene (CID varsa CID'den, yoksa isimden)
          let inchi = null;
          let moleculeName = query;
          let moleculeFormula = null;
          let moleculeCid = 0;

          if (cids.length > 0 && cids[0]) {
            // CID varsa InChI ve bilgileri CID'den al
            const firstCid = cids[0];
            const inchiResponse = await fetch(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${firstCid}/property/InChI,MolecularFormula,Title/JSON`,
              { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
            );

            if (inchiResponse.ok) {
              const inchiData = await inchiResponse.json();
              const props = inchiData.PropertyTable?.Properties?.[0];
              inchi = props?.InChI;
              moleculeName = props?.Title || query;
              moleculeFormula = props?.MolecularFormula;
              moleculeCid = firstCid;
            }
          } else {
            // CID yoksa isimle InChI almayı dene
            const inchiResponse = await fetch(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/InChI,MolecularFormula,Title/JSON`,
              { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
            );

            if (inchiResponse.ok) {
              const inchiData = await inchiResponse.json();
              const props = inchiData.PropertyTable?.Properties?.[0];
              inchi = props?.InChI;
              moleculeName = props?.Title || query;
              moleculeFormula = props?.MolecularFormula;
            }
          }

          // InChI bulunduysa NMRShiftDB2'ye sor
          // ⚠️ NULL CHECK: InChI yoksa gereksiz API çağrısı yapma
          if (inchi && inchi.trim() !== '') {
            console.log(`  📋 InChI alındı, NMRShiftDB2'ye sorgulanıyor...`);
            const nmrshiftdbUrl = `${request.nextUrl.origin}/api/nmrshiftdb?inchi=${encodeURIComponent(inchi)}&spectrumtype=1H`;
            const nmrshiftdbResponse = await fetch(nmrshiftdbUrl);

            if (nmrshiftdbResponse.ok) {
              const nmrshiftdbData = await nmrshiftdbResponse.json();

              if (nmrshiftdbData.success && nmrshiftdbData.spectra?.length > 0) {
                console.log(`  ✅ NMRShiftDB2'de NMR verisi bulundu!`);
                searchStages.push('NMRShiftDB2 veritabanında NMR bulundu');

                // ✅ NMRShiftDB2'den gelen spektral veri türlerini belirle
                const nmrshiftdbSpectra = nmrshiftdbData.spectra || [];
                const has1HNMR = nmrshiftdbSpectra.some((s: any) => s.type === '1H' || s.type === '1H NMR');
                const has13CNMR = nmrshiftdbSpectra.some((s: any) => s.type === '13C' || s.type === '13C NMR');
                
                molecules.push({
                  cid: moleculeCid,
                  name: moleculeName,
                  formula: moleculeFormula || '',
                  source: 'NMRShiftDB2',
                  nmrData: nmrshiftdbData.spectra,
                  userQuery: query, // Kullanıcının yazdığı orijinal isim
                  // ✅ Spektral veri bilgileri
                  hasNMR: has1HNMR,
                  hasC13: has13CNMR,
                  hasFTIR: false, // NMRShiftDB2'de FTIR yok
                  spectralDataCount: (has1HNMR ? 1 : 0) + (has13CNMR ? 1 : 0)
                });
              } else {
                console.log(`  ⚠️  NMRShiftDB2'de spektrum bulunamadı`);
                searchStages.push('NMRShiftDB2 veritabanında bulunamadı');
              }
            }
          } else {
            console.log(`  ⚠️  InChI alınamadı veya boş, NMRShiftDB2'ye sorgulanamıyor`);
            searchStages.push('InChI alınamadı');
            // Early return: Gereksiz API çağrısı yapma
          }
        } catch (err) {
          console.error('  ❌ NMRShiftDB2 fallback hatası:', err);
        }
    }

      // FALLBACK 2: Crossref + AI (hiçbir yerde bulunamadıysa)
      // Formula olarak algılanan ama bulunamayan şeyler de muhtemelen isimdir
      if (molecules.length === 0 && (type === 'name' || type === 'formula')) {
        console.log(`\n🔄 FALLBACK: Crossref'te literatür aranıyor...`);
        searchStages.push('Crossref literatür veritabanında aranıyor...');

        try {
          // Crossref'te literatür ara
          const crossrefUrl = `${request.nextUrl.origin}/api/crossref?query=${encodeURIComponent(query)}&rows=5`;
          const crossrefResponse = await fetch(crossrefUrl);

          if (crossrefResponse.ok) {
            const crossrefData = await crossrefResponse.json();

            if (crossrefData.success && crossrefData.publications?.length > 0) {
              console.log(`  ✅ Crossref'te ${crossrefData.publications.length} yayın bulundu`);
              searchStages.push(`Crossref'te ${crossrefData.publications.length} yayın bulundu`);

              // AI tahmini için gerekli bilgileri topla
              let smiles = null;
              let inchi = null;
              let molFormula = null;
              let molName = query;
              let iupacName = null;

              if (cids.length > 0 && cids[0]) {
                const firstCid = cids[0];
                try {
                  // Get SMILES, InChI, Formula, Title
                  const identifiersResponse = await fetch(
                    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${firstCid}/property/CanonicalSMILES,InChI,MolecularFormula,Title,IUPACName/JSON`,
                    { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
                  );

                  if (identifiersResponse.ok) {
                    const identifiersData = await identifiersResponse.json();
                    const props = identifiersData.PropertyTable?.Properties?.[0];
                    smiles = props?.CanonicalSMILES;
                    inchi = props?.InChI;
                    molFormula = props?.MolecularFormula;
                    iupacName = props?.IUPACName;

                    // Prefer IUPAC name, fallback to Title, then user query
                    molName = iupacName || props?.Title || query;
                    console.log(`  📝 Molekül adları:`);
                    console.log(`     User Query: ${query}`);
                    console.log(`     PubChem Title: ${props?.Title}`);
                    console.log(`     IUPAC Name: ${iupacName || 'N/A'}`);
                    console.log(`     Seçilen: ${molName}`);
                  }
                } catch (e) {
                  console.log('  ⚠️ Molekül identifiers alınamadı');
                }
              }

              // AI prediction için gerekli verileri kaydet
              const firstCid = (cids.length > 0 && cids[0]) ? cids[0] : 0;
              aiPredictionData = {
                moleculeName: molName, // IUPAC preferred, fallback to Title or query
                userQuery: query, // Kullanıcının yazdığı orijinal isim
                smiles: smiles || undefined,
                inchi: inchi || undefined,
                formula: molFormula || undefined,
                iupacName: iupacName || undefined, // IUPAC sistematik adı
                literature: crossrefData.publications,
                cid: firstCid,
                // 2D structure image URL (PubChem provides this)
                image2D: firstCid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${firstCid}/PNG` : undefined,
                // Prediction methods available
                predictionMethods: {
                  hose: smiles ? true : false, // HOSE requires SMILES
                  ai: true, // AI can work with SMILES + literature
                  theoretical: smiles ? true : false // Theoretical also needs SMILES
                }
              };

              searchStages.push('Literatür bulundu - NMR tahmini yapılabilir');
              console.log(`  ℹ️  Prediction için veriler hazır:`);
              console.log(`     SMILES: ${smiles ? '✓' : '✗'}`);
              console.log(`     Literatür: ${crossrefData.publications.length} makale`);
              console.log(`     2D Görsel: ${aiPredictionData.image2D ? '✓' : '✗'}`);
            }
          }
        } catch (err) {
          console.error('  ❌ Crossref + AI fallback hatası:', err);
        }
      }

    // SONUÇ BULUNAMADIĞINDA: Synonyms (alternatif isimler) al
    let synonymSuggestions: Array<{name: string; type?: string; reason?: string}> = [];
    if (molecules.length === 0 && (type === 'name' || type === 'formula')) {
      console.log(`\n📝 Sonuç bulunamadı, synonym'ler aranıyor...`);
      searchStages.push('Alternatif molekül isimleri aranıyor...');

      try {
        // PubChem'den synonyms al
        const synonymResponse = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/synonyms/JSON`,
          { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
        );

        if (synonymResponse.ok) {
          const synonymData = await synonymResponse.json();
          const allSynonyms = synonymData.InformationList?.Information?.[0]?.Synonym || [];

          // Synonym'leri filtrele ve en alakalı olanları al
          const filteredSynonyms = allSynonyms
            .filter((s: string) => {
              // Çok uzun veya karmaşık isimleri filtrele
              if (s.length > 50) return false;
              // Sadece sayı/kod olan isimleri filtrele
              if (/^[\d\-]+$/.test(s)) return false;
              // IUPAC kodlarını filtrele
              if (s.startsWith('CHEMBL') || s.startsWith('CHEBI') || s.startsWith('SCHEMBL')) return false;
              return true;
            })
            .slice(0, 5); // İlk 5 alakalı synonym

          if (filteredSynonyms.length > 0) {
            // PubChem synonym'lerini obje formatına çevir
            synonymSuggestions = filteredSynonyms.map((name: string) => ({
              name,
              type: 'synonym',
              reason: 'PubChem veritabanından alternatif isim'
            }));
            console.log(`  ✅ ${synonymSuggestions.length} alternatif isim bulundu (PubChem):`, synonymSuggestions);
            searchStages.push(`${synonymSuggestions.length} alternatif isim bulundu`);
          } else {
            console.log(`  ⚠️ PubChem'de synonym bulunamadı, AI'ya soruluyor...`);
            searchStages.push('AI ile alternatif isimler aranıyor...');

            // PubChem'de synonym yoksa AI'ya sor
            try {
              const aiSynonymResponse = await fetch(
                `${request.nextUrl.origin}/api/ai-suggest-synonyms`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ moleculeName: query })
                }
              );

              if (aiSynonymResponse.ok) {
                const aiSynonymData = await aiSynonymResponse.json();
                if (aiSynonymData.success && aiSynonymData.suggestions?.length > 0) {
                  // AI önerilerini tam olarak al (name, type, reason ile)
                  synonymSuggestions = aiSynonymData.suggestions;
                  console.log(`  ✅ ${synonymSuggestions.length} alternatif isim bulundu (AI):`, synonymSuggestions);
                  searchStages.push(`AI ile ${synonymSuggestions.length} alternatif isim bulundu`);
                } else {
                  console.log(`  ⚠️ AI synonym önerisi boş`);
                  searchStages.push('Alternatif isim bulunamadı');
                }
              } else {
                console.log(`  ⚠️ AI synonym API yanıt vermedi`);
              }
            } catch (aiErr) {
              console.error('  ❌ AI synonym fetch hatası:', aiErr);
            }
          }
        } else {
          console.log(`  ⚠️ PubChem Synonym API yanıt vermedi (HTTP ${synonymResponse.status}), AI'ya soruluyor...`);
          searchStages.push('AI ile alternatif isimler aranıyor...');

          // PubChem API başarısız oldu, AI'ya sor
          try {
            const aiSynonymResponse = await fetch(
              `${request.nextUrl.origin}/api/ai-suggest-synonyms`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moleculeName: query })
              }
            );

            if (aiSynonymResponse.ok) {
              const aiSynonymData = await aiSynonymResponse.json();
              if (aiSynonymData.success && aiSynonymData.suggestions?.length > 0) {
                synonymSuggestions = aiSynonymData.suggestions;
                console.log(`  ✅ ${synonymSuggestions.length} alternatif isim bulundu (AI):`, synonymSuggestions);
                searchStages.push(`AI ile ${synonymSuggestions.length} alternatif isim bulundu`);
              }
            }
          } catch (aiErr) {
            console.error('  ❌ AI synonym fetch hatası:', aiErr);
          }
        }
      } catch (err) {
        console.error('  ❌ Synonym fetch hatası:', err);

        // Hata durumunda da AI'ya sor
        try {
          console.log(`  🤖 Hata nedeniyle AI'ya soruluyor...`);
          const aiSynonymResponse = await fetch(
            `${request.nextUrl.origin}/api/ai-suggest-synonyms`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ moleculeName: query })
            }
          );

          if (aiSynonymResponse.ok) {
            const aiSynonymData = await aiSynonymResponse.json();
            if (aiSynonymData.success && aiSynonymData.suggestions?.length > 0) {
              synonymSuggestions = aiSynonymData.suggestions;
              console.log(`  ✅ ${synonymSuggestions.length} alternatif isim bulundu (AI fallback):`, synonymSuggestions);
              searchStages.push(`AI ile ${synonymSuggestions.length} alternatif isim bulundu`);
            }
          }
        } catch (aiErr) {
          console.error('  ❌ AI synonym fallback hatası:', aiErr);
        }
      }

      // 🔄 RECURSIVE SYNONYM SEARCH: AI önerisi alındıktan sonra tekrar arama yap
      if (synonymSuggestions.length > 0 && molecules.length === 0) {
        // Öncelikli önerileri seç: "Paclitaxel" veya "Taxol" varsa önce onları dene
        let bestSuggestion = synonymSuggestions.find(s => 
          s.name.toLowerCase() === 'paclitaxel' || s.name.toLowerCase() === 'taxol'
        )?.name;
        
        // Öncelikli öneri yoksa ilk öneriyi al
        if (!bestSuggestion) {
          bestSuggestion = synonymSuggestions[0]?.name;
        }
        
        if (bestSuggestion && bestSuggestion !== query) {
          console.log(`\n🔄 RECURSIVE SEARCH: AI önerisi ile tekrar arama yapılıyor...`);
          console.log(`   Orijinal sorgu: "${query}"`);
          console.log(`   AI önerisi: "${bestSuggestion}"`);
          searchStages.push(`AI önerisi "${bestSuggestion}" ile tekrar aranıyor...`);

          try {
            // Yeni isimle PubChem sorgusunu tekrarla (sadece 1 retry, sonsuz döngüyü engelle)
            const retryEndpoint = type === 'name'
              ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(bestSuggestion)}/cids/JSON`
              : `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${encodeURIComponent(bestSuggestion)}/cids/JSON`;

            const retryResponse = await fetch(retryEndpoint, {
              headers: { 'User-Agent': 'NMR-MIND-App/1.0' }
            });

            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const retryCids = retryData.IdentifierList?.CID || [];

              if (retryCids.length > 0) {
                console.log(`  ✅ Recursive search başarılı! ${retryCids.length} CID bulundu`);
                searchStages.push(`Recursive search: ${retryCids.length} molekül bulundu`);

                // İlk CID'yi kontrol et (hız için sadece 1 tane)
                const retryCid = retryCids[0];
                const retryPropResponse = await fetch(
                  `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${retryCid}/property/MolecularFormula,Title,InChI,CanonicalSMILES,IsomericSMILES/JSON`,
                  { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
                );

                if (retryPropResponse.ok) {
                  const retryPropData = await retryPropResponse.json();
                  const retryProps = retryPropData.PropertyTable?.Properties?.[0];

                  if (retryProps) {
                    const cleanedName = cleanMoleculeName(retryProps.Title, bestSuggestion);
                    
                    // ✅ SMILES'ı çek (IsomericSMILES öncelikli, yoksa CanonicalSMILES)
                    let retrySmiles = retryProps.IsomericSMILES || retryProps.CanonicalSMILES;
                    
                    // Eğer hala SMILES yoksa, ayrı bir API çağrısı ile çek
                    if (!retrySmiles) {
                      try {
                        const smilesResponse = await fetch(
                          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${retryCid}/property/CanonicalSMILES,IsomericSMILES/JSON`,
                          { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
                        );
                        if (smilesResponse.ok) {
                          const smilesData = await smilesResponse.json();
                          const smilesProps = smilesData.PropertyTable?.Properties?.[0];
                          retrySmiles = smilesProps?.IsomericSMILES || smilesProps?.CanonicalSMILES || '';
                        }
                      } catch (smilesErr) {
                        console.warn(`  ⚠️ SMILES çekilemedi:`, smilesErr);
                      }
                    }
                    
                    // AI prediction için veri hazırla
                    if (!aiPredictionData) {
                      aiPredictionData = {
                        moleculeName: cleanedName,
                        userQuery: query, // Orijinal kullanıcı sorgusu
                        cid: retryCid,
                        formula: retryProps.MolecularFormula,
                        smiles: retrySmiles || '', // ✅ SMILES eklendi
                        inchi: retryProps.InChI,
                        source: 'PubChem (Recursive search with AI suggestion)'
                      };
                    }

                    // ✅ Recursive search sonucunda bulunan molekülü molecules array'ine ekle
                    // Bu sayede frontend'e dönecek ve AI prediction için kullanılabilecek
                    molecules.push({
                      cid: retryCid,
                      name: cleanedName,
                      formula: retryProps.MolecularFormula || '',
                      smiles: retrySmiles || '', // ✅ SMILES eklendi
                      inchi: retryProps.InChI,
                      source: 'PubChem (Recursive search)',
                      userQuery: query, // Orijinal kullanıcı sorgusu
                      hasNMR: false, // NMR verisi yok, AI prediction gerekli
                      spectralDataCount: 0
                    });

                    console.log(`  ✅ Recursive search sonucu: ${cleanedName} (CID: ${retryCid})`);
                    console.log(`  ✅ SMILES: ${retrySmiles ? retrySmiles.substring(0, 50) + '...' : 'N/A (ayrı API çağrısı gerekli)'}`);
                    searchStages.push(`Recursive search başarılı: ${cleanedName}`);
                  }
                }
              } else {
                console.log(`  ⚠️ Recursive search: CID bulunamadı`);
                searchStages.push('Recursive search: Sonuç bulunamadı');
              }
            } else {
              console.log(`  ⚠️ Recursive search: PubChem API hatası (HTTP ${retryResponse.status})`);
              searchStages.push('Recursive search: API hatası');
            }
          } catch (retryErr) {
            console.error('  ❌ Recursive search hatası:', retryErr);
            searchStages.push('Recursive search: Hata oluştu');
          }
        }
      }
    }

    // Final sonuçları döndür (name veya formula araması için)
    if (type === 'name' || type === 'formula') {
      if (molecules.length === 0) {
        console.log(`⚠️ "${query}" için NMR verisi olan molekül bulunamadı (tüm kaynaklar denendi)`);
      } else {
        console.log(`\n🎉 TOPLAM ${molecules.length} MOLEKÜL HAZIR!`);
        console.log(`📋 Sonuçlar kullanıcıya gönderiliyor...\n`);
      }

      // ✅ ÖNCELİKLİ SIRALAMA: Enhanced Library moleküllerini listenin başına ekle
      // Enhanced Library molekülleri önce, sonra diğer moleküller
      const sortedMolecules = [
        ...enhancedLibraryMolecules.sort((a, b) => {
          // Önce spektral veri sayısına göre (daha fazla spektrum = daha öncelikli)
          if (b.spectralDataCount !== a.spectralDataCount) {
            return b.spectralDataCount - a.spectralDataCount;
          }
          // Sonra kullanım sayısına göre
          return (b.usageCount || 0) - (a.usageCount || 0);
        }),
        ...molecules
      ];

      return NextResponse.json({
        success: true,
        molecules: sortedMolecules, // Öncelikli sıralanmış liste
        total: cids.length + enhancedLibraryMolecules.length,
        searchStages, // Frontend için arama aşamaları
        aiPredictionData, // AI prediction için gerekli veriler (kullanıcı onaylarsa kullanılacak)
        synonymSuggestions, // Alternatif molekül isimleri (sonuç bulunamadığında)
        message: sortedMolecules.length === 0 ? 'Molekül bulunamadı' : undefined
      });
    }

    // 2. NMR VERİSİ AL (query = CID)
    if (type === 'nmr') {
      const cid = query;

      console.log(`🔬 CID ${cid} için NMR verisi alınıyor...`);

      const nmrResponse = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=1D+NMR+Spectra`,
        { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
      );

      if (!nmrResponse.ok) {
        console.log(`❌ PubChem API yanıt vermedi (HTTP ${nmrResponse.status})`);
        return NextResponse.json({
          success: false,
          peaks: [],
          message: `PubChem API hatası: ${nmrResponse.status}`
        });
      }

      const nmrData = await nmrResponse.json();
      console.log('📦 PubChem Response alındı, parsing başlıyor...');

      // NMR peak'lerini parse et
      const spectralSection = nmrData.Record?.Section?.find(
        (s: any) => s.TOCHeading === 'Spectral Information'
      );

      if (!spectralSection) {
        console.log('❌ Spectral Information section bulunamadı');
        return NextResponse.json({
          success: false,
          peaks: [],
          message: 'Spektral bilgi bulunamadı'
        });
      }

      const nmrSection = spectralSection.Section?.find(
        (s: any) => s.TOCHeading === '1D NMR Spectra'
      );

      if (!nmrSection) {
        console.log('❌ 1D NMR Spectra section bulunamadı');
        return NextResponse.json({
          success: false,
          peaks: [],
          message: '1D NMR spektrumu bulunamadı'
        });
      }

      const h1Section = nmrSection.Section?.find(
        (s: any) => s.TOCHeading === '1H NMR Spectra'
      );

      if (!h1Section?.Information) {
        console.log('❌ 1H NMR Spectra section veya Information bulunamadı');
        return NextResponse.json({
          success: false,
          peaks: [],
          message: '1H NMR verisi bulunamadı'
        });
      }

      console.log(`📊 ${h1Section.Information.length} Information item bulundu`);

      // Peak verilerini çıkar
      let formattedPeaks: string[] = [];

      for (const info of h1Section.Information) {
        console.log(`  - Checking info.Name: ${info.Name}`);

        // info bir object, array değil
        if (info.Name === 'Shifts [ppm]:Intensity' && info.Value?.StringWithMarkup) {
          const peaksString = info.Value.StringWithMarkup[0].String;
          console.log(`  ✅ Peak string bulundu: ${peaksString.substring(0, 100)}...`);

          // Peak'leri parse et ve intensity değerlerini al
          const parsedPeaks = peaksString.split(',').map((p: string) => {
            const parts = p.trim().split(':');
            const ppm = parseFloat(parts[0]);
            const intensity = parts.length > 1 ? parseFloat(parts[1].trim()) : 1;
            return { ppm, intensity };
          }).filter((p: { ppm: number; intensity: number }) => !isNaN(p.ppm) && !isNaN(p.intensity));

          // Yakın peak'leri gruplandır (multiplicity için)
          // Quartet/Triplet gibi splitting pattern'leri tek peak olarak göster
          const groupedPeaks: Array<{ center: number; count: number; totalIntensity: number }> = [];
          const tolerance = 0.1; // 0.1 ppm içindeki peak'leri grupla

          for (const peak of parsedPeaks) {
            let grouped = false;
            for (const group of groupedPeaks) {
              if (Math.abs(peak.ppm - group.center) <= tolerance) {
                // Aynı gruba ait, ortalamayı güncelle
                const totalCount = group.count + 1;
                group.center = (group.center * group.count + peak.ppm) / totalCount;
                group.count = totalCount;
                group.totalIntensity += peak.intensity;
                grouped = true;
                break;
              }
            }
            if (!grouped) {
              groupedPeaks.push({ center: peak.ppm, count: 1, totalIntensity: peak.intensity });
            }
          }

          // En yüksek intensity'i bul (normalize için)
          const maxIntensity = Math.max(...groupedPeaks.map(g => g.totalIntensity));

          // Format edilmiş peak'leri oluştur
          formattedPeaks = groupedPeaks.map(group => {
            // Intensity'i normalize et (en yüksek peak = en fazla H sayısı)
            const normalizedH = Math.round((group.totalIntensity / maxIntensity) * 3); // Max 3H varsay
            const hCount = normalizedH > 0 ? normalizedH : 1;

            // Multiplicity'i peak sayısına göre tahmin et
            let mult = 's'; // singlet
            if (group.count === 2) mult = 'd'; // doublet
            else if (group.count === 3) mult = 't'; // triplet
            else if (group.count === 4) mult = 'q'; // quartet
            else if (group.count > 4) mult = 'm'; // multiplet

            return `${group.center.toFixed(2)}: ${mult} (${hCount}H)`;
          });

          console.log(`  📊 Parse edilen peak'ler (${formattedPeaks.length}): ${formattedPeaks.join(', ')}`);
          break; // İlk NMR spektrumunu kullan
        }
      }

      if (formattedPeaks.length === 0) {
        console.log('❌ Hiç peak bulunamadı - "Shifts [ppm]:Intensity" field yok');
        return NextResponse.json({
          success: false,
          peaks: [],
          message: 'Bu molekül için NMR peak verisi mevcut değil'
        });
      }

      console.log(`✅ ${formattedPeaks.length} NMR peak bulundu`);

      return NextResponse.json({
        success: true,
        peaks: formattedPeaks,
        peakText: formattedPeaks.join('\n')
      });
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz type parametresi' },
      { status: 400 }
    );

  } catch (error) {
    console.error('PubChem API hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
