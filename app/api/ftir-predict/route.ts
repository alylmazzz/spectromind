import { NextRequest, NextResponse } from 'next/server';
import { fetchChatGPTAnalysis } from '@/lib/api/openai';
import { loadSettings } from '@/lib/utils/storage';

/**
 * FTIR Prediction API
 *
 * Aggregated context kullanarak AI'dan FTIR peaks prediction alır
 */
export async function POST(request: NextRequest) {
  try {
    const { cid, smiles, molecularFormula, aiContext, moleculeName } = await request.json();

    if (!cid && !smiles) {
      return NextResponse.json(
        { success: false, error: 'CID or SMILES required' },
        { status: 400 }
      );
    }

    // Load API settings
    const settings = loadSettings();
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY || '';
    const model = settings.aiModel || 'gpt-4o';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('🤖 AI FTIR Prediction başlatılıyor...');
    console.log('Formula:', molecularFormula);
    console.log('SMILES:', smiles);
    console.log('Context:', aiContext);

    // Molekül adını VERME - AI formül ve yapıdan tahmin etsin
    const enhancedContext = `🔬 **BİLİNMEYEN MOLEKÜL TAHMİNİ**

📊 VERİLEN BİLGİLER:
- Moleküler Formül: ${molecularFormula}
- SMILES: ${smiles || 'bilinmiyor'}
- PubChem CID: ${cid || 'bilinmiyor'}

${aiContext}

🎯 **GÖREV:**
1. Moleküler formül ve yapısal bilgilerden FTIR spektrumunu tahmin et
2. Fonksiyonel grupları belirle ve karakteristik IR absorpsiyonlarını bul
3. Table 2.3 ve Table 2.4'teki base values kullan
4. predicted_ftir array'ine 7-10 peak ekle

⚠️ KRİTİK:
- Molekül adını tahmin ederken SMILES ve formülü kullan
- FTIR peaks'leri Silverstein IR correlation tables'a göre belirle
- Sadece formülde VAR olan atomlar için peaks ekle`;

    // Call AI with FTIR spectrum type
    const result = await fetchChatGPTAnalysis(
      apiKey,
      model,
      [], // Empty peaks - AI will predict
      'ftir',
      enhancedContext, // Enhanced context WITHOUT molecule name
      '', // No library matches for FTIR yet
      'KBr', // Default FTIR solvent
      400 // Placeholder frequency
    );

    console.log('✅ AI Prediction tamamlandı');

    return NextResponse.json({
      success: true,
      analysis: result
    });

  } catch (error) {
    console.error('FTIR Prediction Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Prediction failed'
      },
      { status: 500 }
    );
  }
}
