import axios from 'axios';

/**
 * PubChem NMR Peak Scraper
 * PUG-View API kullanarak NMR spektrum verilerini (ppm değerleri) toplar
 */
export class PubChemNMRScraper {
  constructor() {
    this.baseURL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';
    this.session = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });
  }

  /**
   * CID'den 1D NMR spektrum verilerini al
   * @param {number} cid - PubChem Compound ID
   * @returns {Promise<Object>} NMR spektrum verileri
   */
  async getNMRSpectra(cid) {
    try {
      const url = `${this.baseURL}/data/compound/${cid}/JSON?heading=1D+NMR+Spectra`;
      const response = await this.session.get(url);

      const result = {
        cid,
        name: response.data.Record.RecordTitle,
        spectra: {
          '1H': [],
          '13C': [],
          '31P': [],
          '19F': []
        }
      };

      // Spectral Information section'ı bul
      const spectralSection = response.data.Record.Section.find(
        s => s.TOCHeading === 'Spectral Information'
      );

      if (!spectralSection) {
        return result;
      }

      // 1D NMR Spectra section'ı bul
      const nmrSection = spectralSection.Section.find(
        s => s.TOCHeading === '1D NMR Spectra'
      );

      if (!nmrSection || !nmrSection.Section) {
        return result;
      }

      // Her NMR tipi için veri topla
      for (const section of nmrSection.Section) {
        const nmrType = section.TOCHeading; // "1H NMR Spectra", "13C NMR Spectra", etc.

        if (!section.Information) continue;

        for (const info of section.Information) {
          // "Shifts [ppm]:Intensity" field'ını bul
          if (info.Name === 'Shifts [ppm]:Intensity') {
            const peaksString = info.Value.StringWithMarkup[0].String;
            const peaks = this.parsePeaks(peaksString);

            // Solvent bilgisini bul (varsa)
            const solventInfo = section.Information.find(i => i.Name === 'Solvent');
            const solvent = solventInfo ?
              solventInfo.Value.StringWithMarkup[0].String : 'unknown';

            // Frequency bilgisini bul (varsa)
            const freqInfo = section.Information.find(i => i.Name === 'Frequency');
            const frequency = freqInfo ?
              freqInfo.Value.StringWithMarkup[0].String : 'unknown';

            // Source bilgisini bul
            const sourceInfo = section.Information.find(i => i.Name === 'Source of Spectrum');
            const source = sourceInfo ?
              sourceInfo.Value.StringWithMarkup[0].String : 'unknown';

            const spectrum = {
              peaks,
              solvent,
              frequency,
              source
            };

            // Doğru array'e ekle
            if (nmrType.includes('1H')) {
              result.spectra['1H'].push(spectrum);
            } else if (nmrType.includes('13C')) {
              result.spectra['13C'].push(spectrum);
            } else if (nmrType.includes('31P')) {
              result.spectra['31P'].push(spectrum);
            } else if (nmrType.includes('19F')) {
              result.spectra['19F'].push(spectrum);
            }
          }
        }
      }

      return result;

    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`CID ${cid} bulunamadı`);
      }
      throw new Error(`PubChem NMR verisi alınamadı: ${error.message}`);
    }
  }

  /**
   * Peak string'ini parse et
   * Format: "15.65:805.00, 16.00:805.00, 64.19:1000.00"
   * @param {string} peaksString - Peak string
   * @returns {Array} [{ppm, intensity}, ...]
   */
  parsePeaks(peaksString) {
    const peaks = [];
    const parts = peaksString.split(',').map(s => s.trim());

    for (const part of parts) {
      const [ppm, intensity] = part.split(':').map(s => parseFloat(s.trim()));
      if (!isNaN(ppm) && !isNaN(intensity)) {
        peaks.push({ ppm, intensity });
      }
    }

    return peaks.sort((a, b) => b.ppm - a.ppm); // ppm'e göre sırala (büyükten küçüğe)
  }

  /**
   * Molekül isminden CID bul
   * @param {string} name - Molekül ismi
   * @returns {Promise<number|null>} CID veya null
   */
  async getCIDByName(name) {
    try {
      const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`;
      const response = await this.session.get(url);
      return response.data.IdentifierList.CID[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Formülden tüm CID'leri bul
   * @param {string} formula - Molekül formülü (örn: "C2H6O")
   * @returns {Promise<Array<number>>} CID listesi
   */
  async getCIDsByFormula(formula) {
    try {
      const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${formula}/cids/JSON`;
      const response = await this.session.get(url);
      return response.data.IdentifierList.CID || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Peak değeri ile arama yap (closest match)
   * @param {number} targetPpm - Hedef ppm değeri
   * @param {string} nmrType - NMR tipi ("1H" veya "13C")
   * @param {Array<number>} cids - Aranacak CID listesi
   * @param {number} tolerance - Tolerans (ppm)
   * @returns {Promise<Array>} Eşleşen moleküller
   */
  async searchByPeak(targetPpm, nmrType = '1H', cids = [], tolerance = 0.5) {
    const matches = [];

    for (const cid of cids) {
      try {
        const data = await this.getNMRSpectra(cid);
        const spectra = data.spectra[nmrType];

        if (!spectra || spectra.length === 0) continue;

        // Her spektrum için en yakın peak'i bul
        for (const spectrum of spectra) {
          for (const peak of spectrum.peaks) {
            const diff = Math.abs(peak.ppm - targetPpm);
            if (diff <= tolerance) {
              matches.push({
                cid,
                name: data.name,
                nmrType,
                matchedPeak: peak,
                difference: diff,
                solvent: spectrum.solvent,
                frequency: spectrum.frequency,
                source: spectrum.source,
                allPeaks: spectrum.peaks
              });
              break; // Bu spektrum için bir eşleşme bulduk
            }
          }
        }

        // Rate limiting: PubChem max 5 request/second
        await new Promise(r => setTimeout(r, 200));

      } catch (error) {
        console.error(`CID ${cid} için hata:`, error.message);
      }
    }

    return matches.sort((a, b) => a.difference - b.difference);
  }

  /**
   * Kombine arama: formül + peak
   * @param {string} formula - Molekül formülü
   * @param {number} targetPpm - Hedef ppm değeri
   * @param {string} nmrType - NMR tipi
   * @param {number} tolerance - Tolerans
   * @returns {Promise<Array>} Eşleşen moleküller
   */
  async searchByFormulaAndPeak(formula, targetPpm, nmrType = '1H', tolerance = 0.5) {
    console.log(`\n🔍 PubChem'de arama: ${formula} formülü, ${targetPpm} ppm (${nmrType} NMR)`);

    // 1. Formülden CID'leri bul
    const cids = await this.getCIDsByFormula(formula);
    console.log(`📚 ${cids.length} molekül bulundu`);

    if (cids.length === 0) {
      return [];
    }

    // 2. Peak ile eşleştir
    const matches = await this.searchByPeak(targetPpm, nmrType, cids, tolerance);
    console.log(`✅ ${matches.length} eşleşme bulundu`);

    return matches;
  }

  /**
   * 🎯 KULLANICI UYGULAMASINDAN ÇAĞRILACAK ANA ARAMA FONKSİYONU
   * Tüm parametreler kullanıcı tarafından değiştirilebilir
   *
   * @param {Object} options - Arama parametreleri
   * @param {number} options.peak - Aranacak peak değeri (ppm)
   * @param {string} [options.formula] - Molekül formülü (opsiyonel, yoksa tüm veritabanında arar)
   * @param {string} [options.nmrType='1H'] - NMR tipi: '1H', '13C', '31P', '19F'
   * @param {number} [options.frequency] - Frekans (MHz): 400, 500, 600, vb.
   * @param {string} [options.solvent] - Solvent: 'CDCl3', 'D2O', 'DMSO', 'Water', vb.
   * @param {number} [options.tolerance=0.5] - Peak toleransı (ppm)
   * @param {number} [options.maxResults=50] - Maksimum sonuç sayısı
   * @returns {Promise<Array>} Eşleşen moleküller
   */
  async search(options) {
    const {
      peak,
      formula = null,
      nmrType = '1H',
      frequency = null,
      solvent = null,
      tolerance = 0.5,
      maxResults = 50
    } = options;

    console.log(`\n🔍 PubChem Arama Başlıyor...`);
    console.log(`   Peak: ${peak} ppm (±${tolerance})`);
    console.log(`   NMR Type: ${nmrType}`);
    if (formula) console.log(`   Formula: ${formula}`);
    if (frequency) console.log(`   Frequency: ${frequency} MHz`);
    if (solvent) console.log(`   Solvent: ${solvent}`);

    // 1. CID'leri bul
    let cids = [];
    if (formula) {
      cids = await this.getCIDsByFormula(formula);
      console.log(`📚 ${cids.length} molekül bulundu (formül: ${formula})`);
    } else {
      // Formül yoksa, popüler molekülleri dene (veya başka strateji)
      console.log(`⚠️ Formül verilmedi. Peak-only arama PubChem'de desteklenmiyor.`);
      console.log(`💡 Öneri: Formül ekle veya CID listesi sağla.`);
      return [];
    }

    if (cids.length === 0) {
      return [];
    }

    // Sonuç sayısını sınırla (performans için)
    cids = cids.slice(0, maxResults);

    // 2. Peak ile eşleştir
    let matches = await this.searchByPeak(peak, nmrType, cids, tolerance);

    // 3. Frequency filtresi (opsiyonel)
    if (frequency !== null) {
      matches = matches.filter(match => {
        // "600 MHz" → "600" çıkar
        const freq = match.frequency?.match(/(\d+)\s*MHz/)?.[1];
        return freq && parseInt(freq) === parseInt(frequency);
      });
      console.log(`🔧 Frequency filtresi uygulandı (${frequency} MHz): ${matches.length} sonuç kaldı`);
    }

    // 4. Solvent filtresi (opsiyonel)
    if (solvent !== null) {
      matches = matches.filter(match => {
        // Case-insensitive solvent match
        return match.solvent?.toLowerCase().includes(solvent.toLowerCase());
      });
      console.log(`🔧 Solvent filtresi uygulandı (${solvent}): ${matches.length} sonuç kaldı`);
    }

    console.log(`✅ Toplam ${matches.length} eşleşme bulundu`);

    return matches;
  }
}

// Test için
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new PubChemNMRScraper();

  // Test 1: Ethanol NMR verilerini al
  console.log('=== Test 1: Ethanol (CID 702) NMR Verileri ===\n');
  const ethanol = await scraper.getNMRSpectra(702);
  console.log('Molekül:', ethanol.name);
  console.log('\n1H NMR Spektrumları:', ethanol.spectra['1H'].length);
  ethanol.spectra['1H'].forEach((spec, i) => {
    console.log(`\nSpektrum ${i + 1}:`);
    console.log('  Solvent:', spec.solvent);
    console.log('  Frequency:', spec.frequency);
    console.log('  Peaks:', spec.peaks.slice(0, 5).map(p => `${p.ppm} ppm`).join(', '));
  });

  console.log('\n13C NMR Spektrumları:', ethanol.spectra['13C'].length);
  ethanol.spectra['13C'].forEach((spec, i) => {
    console.log(`\nSpektrum ${i + 1}:`);
    console.log('  Peaks:', spec.peaks.map(p => `${p.ppm} ppm`).join(', '));
  });

  // Test 2: YENİ SEARCH API - Kullanıcı uygulamasından gelecek parametreler
  console.log('\n\n=== Test 2: Kullanıcı Uygulamasından İstek ===\n');

  // Kullanıcı uygulamadan şunları değiştirip gönderebilir:
  const userRequest = {
    peak: 3.65,        // Kullanıcının girdiği peak
    formula: 'C2H6O',  // Kullanıcının girdiği formül
    nmrType: '1H',     // Kullanıcının seçtiği NMR tipi
    frequency: 600,    // Kullanıcının seçtiği frekans (MHz)
    solvent: 'Water',  // Kullanıcının seçtiği solvent
    tolerance: 0.1     // Kullanıcının ayarladığı tolerans
  };

  const results = await scraper.search(userRequest);

  console.log('\n📊 SONUÇLAR:\n');
  results.forEach((match, i) => {
    console.log(`${i + 1}. ${match.name} (CID: ${match.cid})`);
    console.log(`   ✅ Eşleşen peak: ${match.matchedPeak.ppm} ppm (fark: ${match.difference.toFixed(3)})`);
    console.log(`   🧪 Solvent: ${match.solvent}`);
    console.log(`   📡 Frequency: ${match.frequency}`);
    console.log(`   📈 Tüm peak'ler:`, match.allPeaks.slice(0, 5).map(p => `${p.ppm}`).join(', '));
    console.log('');
  });

  // Test 3: Farklı parametrelerle
  console.log('\n\n=== Test 3: Farklı Parametreler (13C NMR) ===\n');

  const userRequest2 = {
    peak: 60,
    formula: 'C2H6O',
    nmrType: '13C',    // 13C NMR
    tolerance: 5
  };

  const results2 = await scraper.search(userRequest2);

  console.log('\n📊 SONUÇLAR:\n');
  results2.forEach((match, i) => {
    console.log(`${i + 1}. ${match.name} (CID: ${match.cid})`);
    console.log(`   ✅ Eşleşen peak: ${match.matchedPeak.ppm} ppm (fark: ${match.difference.toFixed(3)})`);
    console.log('');
  });
}
