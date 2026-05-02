import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Rate limiting için basit in-memory cache
const requestCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // İstekler per dakika
const RATE_WINDOW = 60000; // 1 dakika

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const cached = requestCache.get(ip);

  if (!cached || now > cached.resetTime) {
    requestCache.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (cached.count >= RATE_LIMIT) {
    return false;
  }

  cached.count++;
  return true;
}

function getLibraryPath(): string {
  // Sadece chatgpt kütüphanesi kullanılıyor
  const fileName = 'chatgpt_enhanced_library.json';
  // Dosyalar artık public dışında, sadece server-side erişilebilir
  return path.join(process.cwd(), 'data', fileName);
}

// GET - Kütüphaneyi oku
export async function GET(request: NextRequest) {
  try {
    // Rate limiting kontrolü
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const libraryPath = getLibraryPath();

    // Check if file exists
    try {
      await fs.access(libraryPath);
    } catch {
      console.warn(`⚠️  Library file not found: ${libraryPath}`);
      const emptyLibrary = {
        molecules: {},
        version: '2.0.0',
        provider: 'chatgpt',
        lastUpdated: Date.now()
      };
      return NextResponse.json(emptyLibrary, {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    const fileContent = await fs.readFile(libraryPath, 'utf-8');
    
    // Check if file is empty
    if (!fileContent || fileContent.trim().length === 0) {
      console.warn(`⚠️  Library file is empty`);
      const emptyLibrary = {
        molecules: {},
        version: '2.0.0',
        provider: 'chatgpt',
        lastUpdated: Date.now()
      };
      return NextResponse.json(emptyLibrary, {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    // Try to parse JSON
    let library: any;
    try {
      library = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`❌ JSON parse error in library file:`, parseError);
      console.error(`   File content preview: ${fileContent.substring(0, 200)}...`);
      const emptyLibrary = {
        molecules: {},
        version: '2.0.0',
        provider: 'chatgpt',
        lastUpdated: Date.now()
      };
      return NextResponse.json(emptyLibrary, {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      });
    }

    return NextResponse.json(library, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    // Dosya yoksa boş kütüphane döndür
    console.error('Library load error:', error);
    const emptyLibrary = {
      molecules: {},
      version: '2.0.0',
      provider: 'chatgpt',
      lastUpdated: Date.now()
    };
    return NextResponse.json(emptyLibrary, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }
}

// POST - Kütüphaneyi güncelle
export async function POST(request: NextRequest) {
  try {
    // Rate limiting kontrolü
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Content-Type validation
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    const library = await request.json();

    // Input validation
    if (!library || typeof library !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const libraryPath = getLibraryPath();

    // JSON boyut kontrolü (max 10MB)
    const jsonSize = JSON.stringify(library).length;
    if (jsonSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      );
    }

    // JSON'u formatlı şekilde kaydet
    await fs.writeFile(libraryPath, JSON.stringify(library, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Library saved successfully' });
  } catch (error) {
    console.error('Library save error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save library' },
      { status: 500 }
    );
  }
}

// DELETE - Kütüphaneyi temizle
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting kontrolü
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const libraryPath = getLibraryPath();

    const emptyLibrary = {
      entries: [],
      version: '1.0.0',
      provider: 'chatgpt',
      lastUpdated: Date.now()
    };

    await fs.writeFile(libraryPath, JSON.stringify(emptyLibrary, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Library cleared successfully' });
  } catch (error) {
    console.error('Library clear error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear library' },
      { status: 500 }
    );
  }
}
