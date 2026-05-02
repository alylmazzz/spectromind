import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * AI-Powered Synonym/Alternative Name Suggestion
 * POST /api/ai-suggest-synonyms
 *
 * Kullanıcının aradığı molekül bulunamadığında,
 * AI'dan alternatif isimler ve benzer moleküller önerir.
 */
export async function POST(request: NextRequest) {
  try {
    const { moleculeName } = await request.json();

    if (!moleculeName) {
      return NextResponse.json(
        { success: false, error: 'moleculeName gerekli' },
        { status: 400 }
      );
    }

    console.log(`\n🤖 AI Synonym Suggestion Request:`);
    console.log(`  Molecule: ${moleculeName}`);

    // OpenAI client oluştur
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const systemPrompt = `Sen bir kimya uzmanısın. Kullanıcının aradığı molekülün alternatif isimlerini ve benzer molekülleri öneriyorsun.

GÖREV:
1. Verilen molekül isminin alternatif isimlerini bul (IUPAC, trivial names, trade names)
2. Benzer yapıdaki molekülleri öner
3. Yaygın yazım hatalarını düzelt
4. Her öneriyi kısa açıklamasıyla birlikte ver

ÇIKTI FORMATI (JSON):
{
  "suggestions": [
    {
      "name": "Alternatif molekül ismi",
      "type": "synonym" | "similar" | "correction",
      "reason": "Neden önerildiğine dair kısa açıklama"
    }
  ]
}

KURALLAR:
- Maksimum 5 öneri ver
- Kısa ve net isimler kullan (>50 karakter olmasın)
- Sadece kimyasal isimler ver, kod/numara verme
- En alakalı olanları önce sırala`;

    const userPrompt = `Molekül: "${moleculeName}"

Bu molekülün alternatif isimlerini, benzer molekülleri ve olası yazım düzeltmelerini öner.`;

    console.log(`  📤 Sending to OpenAI...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const aiResponse = completion.choices[0].message.content;
    console.log(`  ✅ AI response received`);

    if (!aiResponse) {
      console.log(`  ❌ Empty AI response`);
      return NextResponse.json({
        success: false,
        error: 'AI boş yanıt döndü'
      });
    }

    const parsedResponse = JSON.parse(aiResponse);
    console.log(`  📊 Suggestions: ${parsedResponse.suggestions?.length || 0}`);

    if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
      parsedResponse.suggestions.forEach((sug: any, i: number) => {
        console.log(`    ${i + 1}. ${sug.name} (${sug.type}): ${sug.reason}`);
      });
    }

    return NextResponse.json({
      success: true,
      suggestions: parsedResponse.suggestions || [],
      moleculeName
    });

  } catch (error) {
    console.error('❌ AI synonym suggestion hatası:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI synonym suggestion başarısız',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
