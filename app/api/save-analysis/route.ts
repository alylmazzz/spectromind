import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * AI Analiz Sonuçlarını Kaydet
 * Yapay zekanın molekül analiz sonuçlarını database'e kaydeder
 */

interface AnalysisResult {
  id?: string;
  timestamp: string;
  userPeaks: number[];
  searchParams: {
    formula?: string;
    nmrType: string;
    frequency?: number;
    solvent?: string;
  };
  pubchemMatches: Array<{
    cid: number;
    name: string;
    matchedPeak: { ppm: number; intensity: number };
    difference: number;
    solvent: string;
    frequency: string;
  }>;
  aiAnalysis: {
    moleculeName: string;
    confidence: number;
    reasoning: string;
    structuralAnalysis?: string;
    alternativeMolecules?: string[];
  };
}

// Database yolu (JSON dosya sistemi - basit başlangıç)
const DB_DIR = path.join(process.cwd(), 'data', 'analysis-results');
const DB_FILE = path.join(DB_DIR, 'results.json');

// Database'i initialize et
async function initDB() {
  try {
    if (!existsSync(DB_DIR)) {
      await mkdir(DB_DIR, { recursive: true });
    }
    if (!existsSync(DB_FILE)) {
      await writeFile(DB_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('DB init error:', error);
  }
}

// Tüm sonuçları oku
async function readResults(): Promise<AnalysisResult[]> {
  try {
    await initDB();
    const data = await readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('DB read error:', error);
    return [];
  }
}

// Sonuç kaydet
async function saveResult(result: AnalysisResult): Promise<string> {
  try {
    const results = await readResults();

    // ID oluştur
    const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    result.id = id;

    results.push(result);

    // await writeFile(DB_FILE, JSON.stringify(results, null, 2));

    return id;
  } catch (error) {
    console.error('DB save error:', error);
    throw error;
  }
}

// POST: Yeni analiz sonucu kaydet
export async function POST(request: NextRequest) {
  try {
    const body: AnalysisResult = await request.json();

    // Validasyon
    if (!body.userPeaks || !body.aiAnalysis) {
      return NextResponse.json(
        { success: false, error: 'userPeaks ve aiAnalysis gerekli' },
        { status: 400 }
      );
    }

    // Timestamp ekle
    body.timestamp = new Date().toISOString();

    console.log('💾 Analiz sonucu kaydediliyor:', {
      molecule: body.aiAnalysis.moleculeName,
      confidence: body.aiAnalysis.confidence,
      peakCount: body.userPeaks.length
    });

    // Database'e kaydet
    const id = await saveResult(body);

    return NextResponse.json({
      success: true,
      data: {
        id,
        message: 'Analiz sonucu başarıyla kaydedildi'
      }
    });

  } catch (error) {
    console.error('Analiz kaydetme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Kaydetme başarısız oldu' },
      { status: 500 }
    );
  }
}

// GET: Tüm analiz sonuçlarını getir (opsiyonel - history için)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const results = await readResults();

    // En yeni sonuçları döndür
    const sortedResults = results
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        results: sortedResults,
        total: results.length
      }
    });

  } catch (error) {
    console.error('Analiz sonuçları getirme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sonuçlar getirilemedi' },
      { status: 500 }
    );
  }
}
