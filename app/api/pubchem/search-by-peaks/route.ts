import { NextRequest, NextResponse } from 'next/server';
import { moleculeLibraryData } from '@/lib/data/moleculeLibraryData';

/**
 * Peak Araması - SADECE YEREL KÜTÜPHANE (chatgpt_enhanced_library.json)
 * POST /api/pubchem/search-by-peaks
 *
 * Strateji:
 * 1. Sadece chatgpt_enhanced_library.json dosyasında ara (794 molekül - HIZLI)
 * 2. Bulunamazsa null döndür (AI serbest tahmin yapsın)
 *
 * NOT: SDBS ve PubChem API çağrıları kaldırıldı - sadece lokal kütüphane kullanılıyor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { peaks, nmrType, frequency, solvent, tolerance = 0.15, formula } = body; // Default tolerance düşürüldü (0.3 → 0.15)

    if (!peaks || peaks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Peak verisi gerekli' },
        { status: 400 }
      );
    }

    console.log('🔍 SADECE YEREL KÜTÜPHANEDE (chatgpt_enhanced_library.json) ARAMA başlatılıyor...');
    console.log('📊 Girilen peak\'ler:', peaks);
    console.log(`⚙️ Tolerance: ±${tolerance} ppm`);

    // Peak formatını normalize et (eski: sadece number array, yeni: {shift, integ} array)
    const userPeaks = peaks.map((p: any) =>
      typeof p === 'number' ? { shift: p, integ: 1 } : { shift: p.shift, integ: p.integ || 1 }
    );

    // ==========================================
    // YEREL KÜTÜPHANEDE ARA (chatgpt_enhanced_library.json - 794 molekül)
    // ==========================================
    console.log('📚 chatgpt_enhanced_library.json içinde arama başlatılıyor (794 molekül)...');

    const allLocalMolecules = moleculeLibraryData.categories.flatMap(cat => cat.molecules);
    console.log(`📖 Toplam ${allLocalMolecules.length} yerel molekül kontrol edilecek`);

    const localMatches = [];

    for (const molecule of allLocalMolecules) {
      if (!molecule.peaks || molecule.peaks.length === 0) continue;

      const moleculePeaks = molecule.peaks; // Artık {shift, integ} formatında

      // İKİ YÖNLÜ EŞLEŞME KONTROLÜ (PPM + İNTEGRASYON)
      // 1. Kullanıcının peak'lerinin kaçı kütüphanede var?
      let userMatchedCount = 0;
      for (const userPeak of userPeaks) {
        const hasMatch = moleculePeaks.some(molPeak => {
          const ppmMatch = Math.abs(molPeak.shift - userPeak.shift) <= tolerance;
          const integMatch = Math.abs((molPeak.integ || 1) - userPeak.integ) <= 0.5; // İntegrasyon toleransı ±0.5H
          return ppmMatch && integMatch; // HER İKİSİ DE UYUMLU OLMALI
        });
        if (hasMatch) userMatchedCount++;
      }

      // 2. Kütüphane peak'lerinin kaçı kullanıcıda var?
      let libraryMatchedCount = 0;
      for (const molPeak of moleculePeaks) {
        const hasMatch = userPeaks.some((userPeak: any) => {
          const ppmMatch = Math.abs(molPeak.shift - userPeak.shift) <= tolerance;
          const integMatch = Math.abs((molPeak.integ || 1) - userPeak.integ) <= 0.5;
          return ppmMatch && integMatch;
        });
        if (hasMatch) libraryMatchedCount++;
      }

      // Skor: Her iki yönde de eşleşme oranının ortalaması
      const userScore = (userMatchedCount / userPeaks.length) * 100;
      const libraryScore = (libraryMatchedCount / moleculePeaks.length) * 100;
      const score = (userScore + libraryScore) / 2;

      if (score >= 70) {
        localMatches.push({
          cid: molecule.cid || 0,
          name: molecule.name,
          formula: '',
          score: Math.round(score),
          matchedPeaks: userMatchedCount,
          totalPeaks: userPeaks.length,
          libraryPeaks: moleculePeaks.map((p: any) => p.shift), // Sadece shift değerleri
          source: 'Yerel Kütüphane',
          explanation: molecule.explanation || ''
        });

        console.log(`✅ YEREL: ${molecule.name} (${score.toFixed(1)}% - User:${userMatchedCount}/${userPeaks.length}, Lib:${libraryMatchedCount}/${moleculePeaks.length})`);

        // %100 eşleşme bulunduysa aramayı hemen durdur
        if (score === 100) {
          console.log(`🎯 YEREL KÜTÜPHANEDE MÜKEMMEL EŞLEŞME! ${molecule.name}`);

          return NextResponse.json({
            success: true,
            match: {
              cid: molecule.cid || 0,
              name: molecule.name,
              formula: '',
              source: 'Yerel Kütüphane',
              peaks: moleculePeaks.map((p: any) => p.shift), // Sadece shift değerleri döndür
              explanation: molecule.explanation || `Mükemmel eşleşme (PPM + İntegrasyon): ${userMatchedCount}/${userPeaks.length} user peaks, ${libraryMatchedCount}/${moleculePeaks.length} library peaks`
            },
            score: 100,
            details: `${userMatchedCount}/${userPeaks.length} peak matched (Yerel Kütüphane - Perfect Match with Integration)`,
            matchedPeaks: userMatchedCount,
            totalPeaks: userPeaks.length,
            allMatches: [localMatches[0]]
          });
        }
      }
    }

    // Yerel kütüphanede eşleşme bulunduysa döndür
    if (localMatches.length > 0) {
      localMatches.sort((a, b) => b.score - a.score);
      const bestMatch = localMatches[0];

      console.log(`🎯 YEREL KÜTÜPHANEDE BULUNDU: ${bestMatch.name} (%${bestMatch.score})`);

      return NextResponse.json({
        success: true,
        match: {
          cid: bestMatch.cid,
          name: bestMatch.name,
          formula: bestMatch.formula,
          source: bestMatch.source,
          peaks: bestMatch.libraryPeaks,
          explanation: bestMatch.explanation || `Yerel kütüphane peak eşleşmesi: ${bestMatch.matchedPeaks}/${bestMatch.totalPeaks} peak eşleşti`
        },
        score: bestMatch.score,
        details: `${bestMatch.matchedPeaks}/${bestMatch.totalPeaks} peak matched (Yerel Kütüphane)`,
        matchedPeaks: bestMatch.matchedPeaks,
        totalPeaks: bestMatch.totalPeaks,
        allMatches: localMatches.slice(0, 5)
      });
    }

    // Eşleşme bulunamadı - AI serbest tahmin yapsın
    console.log('❌ Yerel kütüphanede eşleşme bulunamadı - AI serbest tahmin yapacak');

    return NextResponse.json({
      success: false,
      message: 'Yerel kütüphanede peak eşleşmesi bulunamadı, AI analizi yapılacak'
    });

  } catch (error) {
    console.error('Peak araması hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
