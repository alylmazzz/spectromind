import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { safeJoin, findFileRecursive } from '@/lib/fid/fsUtils';
import { detectFormatFromRelPaths } from '@/lib/fid/formatDetector';

export const runtime = 'nodejs';

export const maxDuration = 60;

/**
 * FID Folder Upload API
 * 
 * Accepts multiple files with relative paths (from webkitRelativePath)
 * Reconstructs directory structure in temp/<datasetId>/
 * Finds required Bruker files (fid, acqus)
 * 
 * @route POST /api/fid/upload
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    
    const datasetId = String(form.get('datasetId') || '');
    if (!datasetId) {
      return NextResponse.json(
        { error: 'datasetId missing' },
        { status: 400 }
      );
    }
    
    const files = form.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json(
        { error: 'no files uploaded' },
        { status: 400 }
      );
    }
    
    const relPaths = form.getAll('paths').map(String);
    
    if (relPaths.length !== files.length) {
      return NextResponse.json(
        { error: 'paths array length must match files array' },
        { status: 400 }
      );
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📁 FID FOLDER UPLOAD');
    console.log(`📦 Dataset ID: ${datasetId}`);
    console.log(`📄 Files: ${files.length}`);
    console.log('═══════════════════════════════════════════════════════');
    
    // Create base directory
    const baseDir = path.join(process.cwd(), 'temp', datasetId);
    await fs.mkdir(baseDir, { recursive: true });
    
    console.log(`📂 Base directory: ${baseDir}`);
    
    // Collect all unique parent directories first, then write files
    const writeOps: Array<{ targetPath: string; relPath: string; file: File }> = [];
    const dirs = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = relPaths[i] || file.name;
      const targetPath = safeJoin(baseDir, relPath);
      dirs.add(path.dirname(targetPath));
      writeOps.push({ targetPath, relPath, file });
    }

    // Create all directories
    await Promise.all(
      Array.from(dirs).map(d => fs.mkdir(d, { recursive: true }))
    );

    // Write all files in parallel, then flush via stat to confirm on-disk
    await Promise.all(
      writeOps.map(async ({ targetPath, relPath, file }) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(targetPath, buffer, { flush: true });
        // Verify file was actually written
        const stat = await fs.stat(targetPath);
        console.log(`  ✅ ${relPath} → ${path.relative(baseDir, targetPath)} (${stat.size} bytes)`);
      })
    );
    
    // Search for raw + metadata (Bruker: fid or ser; Varian: fid + procpar)
    const fidPath = await findFileRecursive(baseDir, 'fid');
    const serPath = await findFileRecursive(baseDir, 'ser');
    const acqusPath = await findFileRecursive(baseDir, 'acqus');
    const procparPath = await findFileRecursive(baseDir, 'procpar');
    const rawPath = fidPath || serPath;

    const pathGuess = detectFormatFromRelPaths(relPaths);

    const warnings: string[] = [...pathGuess.flags.map((f) => `detect:${f}`)];
    let datasetType: 'varian' | 'bruker' | 'unknown' = 'unknown';

    if (!rawPath) {
      return NextResponse.json(
        {
          ok: false,
          error: 'RAW_DATA_NOT_FOUND',
          message:
            'Yüklenen klasörde ham veri yok: “fid” (Bruker/Varian) veya “ser” (Bruker) dosyası bulunamadı.',
          baseDir,
          warnings: ['fid/ser not found — klasörü bir üst seviye (pulse program klasörü) seçin'],
          pathGuess,
        },
        { status: 400 }
      );
    }
    
    // Detect dataset type
    if (procparPath) {
      datasetType = 'varian';
      console.log(`✅ Varian dataset detected (procpar found)`);
    } else if (acqusPath) {
      datasetType = 'bruker';
      console.log(`✅ Bruker dataset detected (acqus found)`);
    } else {
      datasetType = 'unknown';
      warnings.push('Neither procpar (Varian) nor acqus (Bruker) found - format will be auto-detected');
    }
    
    if (!acqusPath && !procparPath) {
      warnings.push('Metadata file (acqus/procpar) not found - processing may use defaults');
    }
    
    if (serPath && !fidPath) {
      warnings.push('Bruker "ser" ham verisi kullanılıyor (klasik "fid" yok).');
    }
    console.log(`✅ Raw data: ${path.relative(baseDir, rawPath)}`);
    if (acqusPath) {
      console.log(`✅ ACQUS found: ${path.relative(baseDir, acqusPath)}`);
    }
    if (procparPath) {
      console.log(`✅ PROCPAR found: ${path.relative(baseDir, procparPath)}`);
    }
    
    console.log('═══════════════════════════════════════════════════════\n');
    
    return NextResponse.json({
      ok: true,
      datasetId,
      baseDir,
      fidPath: fidPath || null,
      serPath: serPath || null,
      rawPath,
      acqusPath: acqusPath || null,
      procparPath: procparPath || null,
      datasetType,
      pathGuess,
      warnings,
    });
    
  } catch (error: any) {
    console.error('❌ FID Upload Error:', error);
    
    return NextResponse.json(
      {
        error: 'UPLOAD_FAILED',
        message: error.message || 'Failed to upload FID folder'
      },
      { status: 500 }
    );
  }
}
