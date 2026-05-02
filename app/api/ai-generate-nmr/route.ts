import { NextRequest, NextResponse } from 'next/server';
import { loadSettings } from '@/lib/utils/storage';

/**
 * AI ile NMR Peak Tahmini
 * POST /api/ai-generate-nmr
 *
 * Molekül yapısına göre AI ile 1H NMR peak'lerini tahmin eder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moleculeName, formula, cid } = body;

    if (!moleculeName || !formula) {
      return NextResponse.json(
        { success: false, error: 'Molekül ismi ve formül gerekli' },
        { status: 400 }
      );
    }

    console.log(`🤖 AI ile NMR peak tahmini başlatılıyor: ${moleculeName} (${formula})`);

    // Settings'ten AI provider ve key al
    const settings = loadSettings();
    const aiProvider = settings.aiProvider;
    const geminiKey = settings.geminiApiKey;
    const openaiKey = settings.openaiApiKey;

    const apiKey = aiProvider === 'gemini' ? geminiKey : openaiKey;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI API anahtarı bulunamadı' },
        { status: 401 }
      );
    }

    // AI'ya prompt gönder
    const prompt = `Molekül: ${moleculeName}
Formül: ${formula}
${cid ? `PubChem CID: ${cid}` : ''}

Bu molekül için tahmini 1H NMR peak'lerini oluştur.

Format (her satır bir peak):
ppm: multiplicity (integration)

Örnek:
7.26: d (2H)
3.65: s (3H)
1.23: t (3H)

SADECE peak verilerini ver, açıklama yapma. Her peak yeni satırda olsun.`;

    let generatedPeaks = '';

    if (aiProvider === 'gemini') {
      // Gemini API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      generatedPeaks = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else {
      // OpenAI-compatible API (OpenAI / DeepSeek / local vLLM)
      const selectedModel = settings.aiModel || 'gpt-4o';
      const isDeepSeekModel = selectedModel.startsWith('deepseek-');
      const deepSeekBaseRaw = process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com';
      const isLocalDeepSeek = /localhost|127\.0\.0\.1/i.test(deepSeekBaseRaw) || deepSeekBaseRaw.includes('.local');
      const deepSeekBaseUrl = deepSeekBaseRaw.endsWith('/v1')
        ? deepSeekBaseRaw
        : `${deepSeekBaseRaw.replace(/\/$/, '')}/v1`;
      const apiBaseUrl = isDeepSeekModel ? deepSeekBaseUrl : 'https://api.openai.com/v1';
      const finalModel = (isDeepSeekModel && !isLocalDeepSeek && (selectedModel === 'deepseek-v4-pro' || selectedModel === 'deepseek-v4-flash'))
        ? (process.env.DEEPSEEK_CLOUD_MODEL?.trim() || 'deepseek-chat')
        : selectedModel;

      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: finalModel,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`LLM API error: ${response.status} ${bodyText}`);
      }

      const data = await response.json();
      generatedPeaks = data.choices?.[0]?.message?.content || '';
    }

    // Peak verilerini temizle
    const peakText = generatedPeaks
      .split('\n')
      .filter(line => line.trim() && /^\d+\.?\d*\s*:/.test(line.trim()))
      .map(line => line.trim())
      .join('\n');

    if (!peakText) {
      console.log('❌ AI geçerli peak formatı oluşturamadı');
      return NextResponse.json({
        success: false,
        error: 'AI geçerli NMR peak\'leri oluşturamadı'
      });
    }

    console.log(`✅ AI ${peakText.split('\n').length} peak oluşturdu`);

    return NextResponse.json({
      success: true,
      peakText,
      source: 'AI Generated',
      provider: aiProvider,
      warning: 'Bu veriler AI tahminidir ve doğrulanmalıdır'
    });

  } catch (error) {
    console.error('AI NMR oluşturma hatası:', error);
    return NextResponse.json(
      { success: false, error: 'AI ile NMR peak\'leri oluşturulamadı' },
      { status: 500 }
    );
  }
}
