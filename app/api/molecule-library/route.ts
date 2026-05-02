import { NextResponse } from 'next/server';
import { moleculeLibraryData } from '@/lib/data/moleculeLibraryData';

// API endpoint - Molekül kütüphanesini güvenli şekilde servis et
// Source code'da dosya gözükmez, sadece API response olarak gelir
export async function GET() {
  try {
    // Kategorileri döndür
    const response = NextResponse.json({
      success: true,
      data: moleculeLibraryData.categories
    });

    // Cache headers - Performance için (1 saat cache)
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');

    return response;
  } catch (error) {
    console.error('Molekül kütüphanesi API hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Kütüphane yüklenemedi' },
      { status: 500 }
    );
  }
}
