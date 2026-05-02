import { NextRequest, NextResponse } from 'next/server';

/**
 * FTIR Multi-Source Aggregator
 *
 * Tries multiple FTIR data sources in order:
 * 1. NIST WebBook (free, ~17K spectra)
 * 2. SDBS Japan (visual only, metadata)
 * 3. Theoretical SpectroMind engine (rule-based)
 * 4. AI prediction (fallback)
 */
export async function POST(request: NextRequest) {
  try {
    const { cid, smiles, molecularFormula, moleculeName } = await request.json();

    if (!cid && !smiles) {
      return NextResponse.json(
        { success: false, error: 'CID or SMILES required' },
        { status: 400 }
      );
    }

    const results: any = {
      sources: [],
      bestSource: null,
      allAttempts: []
    };

    console.log('🔍 FTIR Multi-Source Search başlatıldı...');
    console.log('Molecule:', moleculeName || 'Unknown');
    console.log('CID:', cid);
    console.log('SMILES:', smiles);

    // ========================================
    // 1. NIST WebBook FTIR
    // ========================================
    console.log('\n📚 1. NIST WebBook kontrol ediliyor...');
    try {
      const nistUrl = `https://webbook.nist.gov/cgi/cbook.cgi?ID=C${cid}&Units=SI&Type=IR-SPEC&Index=0`;
      const nistResponse = await fetch(nistUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      results.allAttempts.push({
        source: 'NIST WebBook',
        url: nistUrl,
        status: nistResponse.status,
        success: nistResponse.ok
      });

      if (nistResponse.ok) {
        const html = await nistResponse.text();

        // Check if actual spectrum data exists
        if (html.includes('IR-SPEC') && !html.includes('no data available')) {
          console.log('✅ NIST WebBook: IR spectrum bulundu!');

          results.sources.push({
            name: 'NIST WebBook',
            type: 'experimental',
            format: 'JCAMP-DX',
            url: nistUrl,
            dataAvailable: true,
            quality: 'high',
            note: 'Experimental FTIR data from NIST Chemistry WebBook'
          });

          if (!results.bestSource) {
            results.bestSource = 'NIST WebBook';
          }
        } else {
          console.log('⏭️  NIST WebBook: Spektrum yok');
        }
      }
    } catch (error) {
      console.error('❌ NIST WebBook error:', error);
      results.allAttempts.push({
        source: 'NIST WebBook',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // ========================================
    // 2. SDBS Japan (Metadata only)
    // ========================================
    console.log('\n📚 2. SDBS Japan kontrol ediliyor...');
    try {
      const sdbsUrl = `https://sdbs.db.aist.go.jp/sdbs/cgi-bin/direct_frame_top.cgi?sdbsno=${cid}`;
      const sdbsResponse = await fetch(sdbsUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      results.allAttempts.push({
        source: 'SDBS Japan',
        url: sdbsUrl,
        status: sdbsResponse.status,
        success: sdbsResponse.ok
      });

      if (sdbsResponse.ok) {
        console.log('✅ SDBS Japan: Metadata mevcut (görsel only)');

        results.sources.push({
          name: 'SDBS Japan',
          type: 'experimental',
          format: 'PDF/Image',
          url: sdbsUrl,
          dataAvailable: false, // Visual only, no machine-readable data
          quality: 'high',
          note: 'Visual spectrum only - no JSON/API access'
        });
      }
    } catch (error) {
      console.error('❌ SDBS error:', error);
      results.allAttempts.push({
        source: 'SDBS Japan',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // ========================================
    // 3. Theoretical SpectroMind Engine
    // ========================================
    if (smiles) {
      console.log('\n🔬 3. Theoretical FTIR Engine çalıştırılıyor...');
      try {
        const theoreticalResponse = await fetch('http://localhost:3000/api/ftir-theoretical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smiles }),
          signal: AbortSignal.timeout(30000)
        });

        results.allAttempts.push({
          source: 'SpectroMind Theoretical',
          status: theoreticalResponse.status,
          success: theoreticalResponse.ok
        });

        if (theoreticalResponse.ok) {
          const theoreticalData = await theoreticalResponse.json();

          if (theoreticalData.success && theoreticalData.peaks.length > 0) {
            console.log(`✅ Theoretical Engine: ${theoreticalData.peaks.length} peaks predicted`);

            results.sources.push({
              name: 'SpectroMind Theoretical',
              type: 'theoretical',
              format: 'JSON',
              peaks: theoreticalData.peaks,
              dataAvailable: true,
              quality: 'medium',
              warnings: theoreticalData.warnings,
              note: 'Rule-based prediction using Hooke\'s Law + Normal Mode Analysis',
              method: theoreticalData.method,
              reference: theoreticalData.reference
            });

            // Use theoretical as best source if no experimental data found
            if (!results.bestSource) {
              results.bestSource = 'SpectroMind Theoretical';
            }
          }
        }
      } catch (error) {
        console.error('❌ Theoretical engine error:', error);
        results.allAttempts.push({
          source: 'SpectroMind Theoretical',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      console.log('⏭️  Theoretical engine: SMILES bulunamadı, atlanıyor');
    }

    // ========================================
    // 4. AI Prediction (Fallback)
    // ========================================
    // Sadece tüm diğer kaynaklar başarısız olduysa kullan
    if (!results.bestSource) {
      console.log('\n🤖 4. AI Prediction (fallback) çalıştırılıyor...');
      console.log('⚠️ Tüm kaynaklar başarısız - AI son çare olarak kullanılıyor');
      try {
        // Collect context from previous attempts
        const aiContext = `
📊 FTIR Spektrum Arama Sonuçları:

Molekül: ${moleculeName || 'Bilinmiyor'}
Formül: ${molecularFormula || 'Bilinmiyor'}
SMILES: ${smiles || 'Bilinmiyor'}
CID: ${cid || 'Bilinmiyor'}

Denenen Kaynaklar:
${results.allAttempts.map((a: any) => `- ${a.source}: ${a.success ? '✅ Erişildi' : '❌ Başarısız'}`).join('\n')}

NIST WebBook: ${results.sources.find((s: any) => s.name === 'NIST WebBook') ? 'Metadata mevcut' : 'Veri yok'}
SDBS: ${results.sources.find((s: any) => s.name === 'SDBS Japan') ? 'Görsel mevcut' : 'Veri yok'}
Theoretical Engine: ${results.sources.find((s: any) => s.name === 'SpectroMind Theoretical') ? 'Tahmin yapıldı' : 'Başarısız'}
`;

        const aiResponse = await fetch('http://localhost:3000/api/ftir-predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cid,
            smiles,
            molecularFormula,
            aiContext,
            moleculeName
          }),
          signal: AbortSignal.timeout(30000)
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();

          if (aiData.success && aiData.analysis) {
            console.log('✅ AI Prediction başarılı');

            results.sources.push({
              name: 'AI Prediction',
              type: 'ai-generated',
              format: 'JSON',
              analysis: aiData.analysis,
              dataAvailable: true,
              quality: 'low',
              note: 'AI-generated prediction - requires experimental validation'
            });

            results.bestSource = 'AI Prediction';
          }
        }
      } catch (error) {
        console.error('❌ AI prediction error:', error);
        results.allAttempts.push({
          source: 'AI Prediction',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // ========================================
    // Final Summary
    // ========================================
    console.log('\n📊 SONUÇ:');
    console.log(`Toplam kaynak denendi: ${results.allAttempts.length}`);
    console.log(`Veri bulunan kaynak: ${results.sources.length}`);
    console.log(`En iyi kaynak: ${results.bestSource || 'Hiçbiri'}`);

    return NextResponse.json({
      success: results.sources.length > 0,
      sources: results.sources,
      bestSource: results.bestSource,
      totalAttempts: results.allAttempts.length,
      successfulSources: results.sources.length,
      allAttempts: results.allAttempts,
      recommendation: results.bestSource
        ? `Use ${results.bestSource} for FTIR data`
        : 'No FTIR data available from any source'
    });

  } catch (error) {
    console.error('❌ FTIR Multi-Source error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Multi-source search failed'
      },
      { status: 500 }
    );
  }
}
