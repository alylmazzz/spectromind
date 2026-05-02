// Molekül Kütüphanesi - API üzerinden veri yükleyici
// VERİ KAYNAĞI: /app/api/molecule-library/route.ts (Source code'da GÖRÜNMEYECEK)
import { LibraryMolecule } from '@/lib/utils/librarySearch';

// Kategori tanımı
export interface MoleculeCategory {
  id: string;
  name: string;
  description: string;
  molecules: LibraryMolecule[];
}

// API üzerinden molecule library'yi yükle (GÜVENLİ - Source'ta dosya gözükmez)
export async function loadMoleculeLibrary(): Promise<MoleculeCategory[]> {
  try {
    // API endpoint'ten veri çek
    const response = await fetch('/api/molecule-library', {
      cache: 'force-cache', // Cache için
      next: { revalidate: 3600 } // 1 saat cache
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid API response');
    }

    // Kategorileri parse et
    return result.data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      molecules: cat.molecules.map((mol: any) => ({
        name: mol.name || 'Unknown',
        cid: mol.cid || null,
        source: mol.source || 'Unknown',
        peaks: (mol.peaks || []).map((p: any) => ({
          shift: parseFloat(p.shift || 0),
          integ: parseFloat(p.integ || 1),
          mult: (p.mult || 's').toString()
        })),
        explanation: mol.explanation || ''
      }))
    }));
  } catch (error) {
    console.error('Molekül kütüphanesi yüklenemedi:', error);
    return [];
  }
}
