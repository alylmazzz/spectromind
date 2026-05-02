import { NextRequest, NextResponse } from 'next/server';
import { moleculeLibraryData } from '@/lib/data/moleculeLibraryData';

/**
 * Yerel Kütüphanede Molekül Ara (İsme Göre)
 * POST /api/molecule-library/search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Molekül ismi gerekli' },
        { status: 400 }
      );
    }

    console.log(`📚 Yerel kütüphanede "${name}" aranıyor...`);

    // Tüm kategorilerdeki molekülleri birleştir
    const allMolecules = moleculeLibraryData.categories.flatMap(cat => cat.molecules);

    // İsme göre ara (case-insensitive)
    const molecule = allMolecules.find(
      m => m.name.toLowerCase() === name.toLowerCase()
    );

    if (molecule) {
      console.log(`✅ Yerel kütüphanede bulundu: ${molecule.name}`);
      return NextResponse.json({
        success: true,
        molecule: {
          name: molecule.name,
          cid: molecule.cid,
          peaks: molecule.peaks,
          explanation: (molecule as any).explanation
        }
      });
    }

    console.log(`❌ "${name}" yerel kütüphanede bulunamadı`);
    return NextResponse.json({
      success: false,
      message: 'Molekül yerel kütüphanede bulunamadı'
    });

  } catch (error) {
    console.error('Yerel kütüphane arama hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
