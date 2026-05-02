import { NextRequest, NextResponse } from 'next/server';

/**
 * PubChem Search API Endpoint
 * Kullanıcının girdiği peak, formül, frequency, solvent bilgileriyle
 * direkt PubChem'den molekül arar
 */

interface SearchParams {
  peak: number;
  formula?: string;
  nmrType?: '1H' | '13C' | '31P' | '19F';
  frequency?: number;
  solvent?: string;
  tolerance?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchParams = await request.json();

    const { peak, formula, nmrType = '1H', frequency, solvent, tolerance = 0.5 } = body;

    // Validasyon
    if (!peak) {
      return NextResponse.json(
        { success: false, error: 'Peak değeri gerekli' },
        { status: 400 }
      );
    }

    console.log('🔍 PubChem arama başlıyor:', { peak, formula, nmrType, frequency, solvent, tolerance });

    // PubChem API'ye istek
    const pubchemUrl = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

    // 1. Formül varsa, önce CID'leri al
    let cids: number[] = [];

    if (formula) {
      const formulaResponse = await fetch(
        `${pubchemUrl}/fastformula/${encodeURIComponent(formula)}/cids/JSON`,
        { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
      );

      if (formulaResponse.ok) {
        const data = await formulaResponse.json();
        cids = data.IdentifierList?.CID || [];
        console.log(`📚 ${cids.length} molekül bulundu (formül: ${formula})`);
      }
    }

    if (cids.length === 0 && !formula) {
      return NextResponse.json(
        { success: false, error: 'Formül veya molekül ismi gerekli' },
        { status: 400 }
      );
    }

    // Maksimum 50 CID ile çalış (performans için)
    cids = cids.slice(0, 50);

    // 2. Her CID için NMR verilerini çek ve peak ile eşleştir
    const matches = [];

    for (const cid of cids) {
      try {
        // PUG-View API'den NMR verilerini al
        const nmrResponse = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=1D+NMR+Spectra`,
          { headers: { 'User-Agent': 'NMR-MIND-App/1.0' } }
        );

        if (!nmrResponse.ok) continue;

        const nmrData = await nmrResponse.json();
        const record = nmrData.Record;

        // Spektral veriyi parse et
        const spectralSection = record.Section.find(
          (s: any) => s.TOCHeading === 'Spectral Information'
        );

        if (!spectralSection) continue;

        const nmrSection = spectralSection.Section?.find(
          (s: any) => s.TOCHeading === '1D NMR Spectra'
        );

        if (!nmrSection?.Section) continue;

        // İlgili NMR tipini bul
        const nmrTypeSection = nmrSection.Section.find(
          (s: any) => s.TOCHeading === `${nmrType} NMR Spectra`
        );

        if (!nmrTypeSection?.Information) continue;

        // Peak verilerini işle
        for (const info of nmrTypeSection.Information) {
          const peaksInfo = info.find((i: any) => i.Name === 'Shifts [ppm]:Intensity');
          if (!peaksInfo) continue;

          const peaksString = peaksInfo.Value.StringWithMarkup[0].String;
          const peaks = peaksString.split(',').map((p: string) => {
            const [ppm, intensity] = p.trim().split(':').map(parseFloat);
            return { ppm, intensity };
          });

          // Peak eşleşmesini kontrol et
          for (const peakData of peaks) {
            const diff = Math.abs(peakData.ppm - peak);

            if (diff <= tolerance) {
              // Solvent ve frequency bilgilerini al
              const solventInfo = info.find((i: any) => i.Name === 'Solvent');
              const freqInfo = info.find((i: any) => i.Name === 'Frequency');

              const matchSolvent = solventInfo?.Value.StringWithMarkup[0].String || 'unknown';
              const matchFrequency = freqInfo?.Value.StringWithMarkup[0].String || 'unknown';

              // Filtreler
              if (frequency) {
                const freqValue = matchFrequency.match(/(\d+)\s*MHz/)?.[1];
                if (!freqValue || parseInt(freqValue) !== frequency) continue;
              }

              if (solvent) {
                if (!matchSolvent.toLowerCase().includes(solvent.toLowerCase())) continue;
              }

              matches.push({
                cid,
                name: record.RecordTitle,
                matchedPeak: peakData,
                difference: diff,
                solvent: matchSolvent,
                frequency: matchFrequency,
                allPeaks: peaks,
                nmrType
              });

              break; // Bu CID için bir eşleşme bulduk
            }
          }
        }

        // Rate limiting: max 5 request/second
        await new Promise(r => setTimeout(r, 200));

      } catch (error) {
        console.error(`CID ${cid} için hata:`, error);
        continue;
      }
    }

    // Sonuçları farka göre sırala
    matches.sort((a, b) => a.difference - b.difference);

    console.log(`✅ ${matches.length} eşleşme bulundu`);

    return NextResponse.json({
      success: true,
      data: {
        matches,
        searchParams: { peak, formula, nmrType, frequency, solvent, tolerance },
        totalChecked: cids.length
      }
    });

  } catch (error) {
    console.error('PubChem arama hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Arama başarısız oldu' },
      { status: 500 }
    );
  }
}
