import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import { findFileRecursive, listTree } from '@/lib/fid/fsUtils';
import { detectFormatFromRelPaths } from '@/lib/fid/formatDetector';
import { finalizeFidFailure, finalizeFidSuccess } from '@/lib/fid/buildFidProcessResponse';
import { FidErrorCodes, inferErrorCodeFromPython } from '@/lib/fid/fidErrorCodes';
import type { FidLegacyChartData } from '@/lib/fid/buildFidProcessResponse';
import { buildRecipeProvenance } from '@/lib/fid/processingPresets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Python fid_process / fid_processor stdout JSON -> frontend schema.
 *  Supports both improved ProcessingMeta fields (spectrometer_freq_mhz, spectral_width_ppm, carrier_ppm)
 *  and legacy metadata keys (spectrometer_freq, spectral_width, offset).
 */
function normalizeFidPythonPayload(
  raw: Record<string, unknown>,
  processingSpecRaw?: string | null
): FidLegacyChartData {
  const rawMeta = (raw.metadata ?? {}) as Record<string, unknown>;
  const fallbackMeta = (raw.meta ?? {}) as Record<string, unknown>;

  const specFreq =
    (rawMeta.spectrometer_freq as number) ??
    (rawMeta.spectrometer_freq_mhz as number) ??
    (rawMeta.sfo1_mhz as number) ??
    (fallbackMeta.obs_mhz as number) ?? 0;

  const specWidth =
    (rawMeta.spectral_width as number) ??
    (rawMeta.spectral_width_ppm as number) ??
    (rawMeta.sw_ppm as number) ??
    (fallbackMeta.sw_ppm as number) ?? 0;

  const offset =
    (rawMeta.offset as number) ??
    (rawMeta.carrier_ppm as number) ??
    (rawMeta.car_ppm as number) ??
    (fallbackMeta.car_ppm as number) ?? 0;

  const dataPoints =
    (rawMeta.data_points as number) ??
    (rawMeta.processed_points as number) ??
    (fallbackMeta.n as number) ?? 0;

  const meta: FidLegacyChartData['metadata'] = {
    spectrometer_freq: specFreq,
    spectral_width: specWidth,
    offset,
    data_points: dataPoints,
    raw_fid_points: (rawMeta.raw_fid_points as number) ?? undefined,
    axis_type: (rawMeta.axis_type as string) ?? undefined,
    ppm_source: (rawMeta.ppm_source as string) ?? undefined,
    solvent_hint: (rawMeta.solvent_hint as string | null) ?? undefined,
    reference_mode: (rawMeta.reference_mode as string) ?? undefined,
    reference_offset_ppm_applied: (rawMeta.reference_offset_ppm_applied as number) ?? undefined,
    metadata_confidence: (rawMeta.metadata_confidence as string) ?? undefined,
    actual_ppm_range: (rawMeta.actual_ppm_range as [number, number]) ?? undefined,
    nucleus: (rawMeta.nucleus as string) ?? undefined,
    vendor: (rawMeta.vendor as string) ?? undefined,
    source_format: (rawMeta.source_format as string) ?? undefined,
    display_direction: (rawMeta.display_direction as string) ?? undefined,
    default_display_range_ppm: (rawMeta.default_display_range_ppm as number[]) ?? undefined,
    default_wide_range_ppm: (rawMeta.default_wide_range_ppm as number[] | null) ?? undefined,
    solvent_normalized: (rawMeta.solvent_normalized as string | null) ?? undefined,
    spectral_width_hz: (rawMeta.spectral_width_hz as number) ?? undefined,
    carrier_hz: (rawMeta.carrier_hz as number) ?? undefined,
  };

  const ppmAxisReferencedRaw = (raw.ppm_axis_referenced as number[]) ?? [];
  const ppmAxisRaw = (raw.ppm as number[]) ?? [];
  const intensityProcessedRaw = (raw.intensity_processed as number[]) ?? [];
  const intensityRawFallback = (raw.intensity as number[]) ?? (raw.y as number[]) ?? [];
  const rawWarnings = [...(((raw.warnings as string[]) ?? []))];

  const sanitize = (arr: number[]) => arr.map((v) => (Number.isFinite(v) ? v : 0));

  let ppmSource = '';
  let intensitySource = '';
  let ppm = sanitize(ppmAxisRaw);
  let intensity = sanitize(intensityRawFallback);

  if (
    ppmAxisReferencedRaw.length > 0 &&
    intensityProcessedRaw.length > 0 &&
    ppmAxisReferencedRaw.length === intensityProcessedRaw.length
  ) {
    ppm = sanitize(ppmAxisReferencedRaw);
    intensity = sanitize(intensityProcessedRaw);
    ppmSource = 'ppm_axis_referenced';
    intensitySource = 'intensity_processed';
  } else if (
    ppmAxisRaw.length > 0 &&
    intensityProcessedRaw.length > 0 &&
    ppmAxisRaw.length === intensityProcessedRaw.length
  ) {
    ppm = sanitize(ppmAxisRaw);
    intensity = sanitize(intensityProcessedRaw);
    ppmSource = 'ppm_raw';
    intensitySource = 'intensity_processed';
    rawWarnings.push(
      'AUTHORITATIVE_AXIS_FALLBACK: ppm_axis_referenced/intensity_processed eslesmedi, ppm_raw + intensity_processed kullanildi.'
    );
  } else if (ppmAxisRaw.length === intensityRawFallback.length && ppmAxisRaw.length > 0) {
    ppmSource = 'ppm_raw';
    intensitySource = 'intensity_raw';
    rawWarnings.push(
      'AUTHORITATIVE_TRACE_UNAVAILABLE: processed axis/intensity eslesmedi, legacy raw trace kullanildi.'
    );
  } else {
    rawWarnings.push(
      `FID_AXIS_LENGTH_MISMATCH: ref=${ppmAxisReferencedRaw.length}, ppm=${ppmAxisRaw.length}, processed=${intensityProcessedRaw.length}, rawIntensity=${intensityRawFallback.length}`
    );
  }

  if (!meta.ppm_source && ppmSource && intensitySource) {
    meta.ppm_source = `${ppmSource}:${intensitySource}`;
  }

  const pyProcessing = (raw.processing as FidLegacyChartData['processing']) ?? {};
  const recipeProvenance = buildRecipeProvenance({
    nucleus: (rawMeta.nucleus as string | undefined) ?? String((pyProcessing as Record<string, unknown>)?.nucleus ?? '1H'),
    processingSpecRaw,
    vendorImportedProcessing: {
      vendor: (rawMeta.vendor as string | undefined) ?? null,
      solvent_imported: Boolean(rawMeta.solvent_normalized ?? rawMeta.solvent_hint),
      solvent_value:
        (rawMeta.solvent_normalized as string | undefined) ??
        (rawMeta.solvent_hint as string | undefined) ??
        null,
      field_mhz_imported: Number.isFinite(rawMeta.spectrometer_freq_mhz as number),
      field_mhz_value: (rawMeta.spectrometer_freq_mhz as number | undefined) ?? null,
      zero_fill_imported: Boolean((pyProcessing as Record<string, unknown>)?.zero_fill),
      reference_imported: Boolean((pyProcessing as Record<string, unknown>)?.reference),
    },
  });

  return {
    metadata: meta,
    ppm,
    intensity,
    ppm_axis_raw: (raw.ppm_axis_raw as number[]) ?? undefined,
    ppm_axis_referenced: ppmAxisReferencedRaw.length > 0 ? ppmAxisReferencedRaw : undefined,
    intensity_raw: (raw.intensity_raw as number[]) ?? undefined,
    intensity_processed: intensityProcessedRaw.length > 0 ? intensityProcessedRaw : undefined,
    baseline: (raw.baseline as number[]) ?? undefined,
    peaks: (raw.peaks as FidLegacyChartData['peaks']) ?? [],
    warnings: rawWarnings,
    processing: {
      ...pyProcessing,
      vendor_imported_processing: recipeProvenance.vendor_imported_processing,
      advised_preset_applied: recipeProvenance.advised_preset_applied,
      user_overrides: recipeProvenance.user_overrides,
      final_processing_recipe: recipeProvenance.final_processing_recipe,
      audit_hash: recipeProvenance.audit_hash,
    } as FidLegacyChartData['processing'],
    qc: raw.qc as FidLegacyChartData['qc'],
    integral_regions: (raw.integral_regions as FidLegacyChartData['integral_regions']) ?? [],
    multiplet_regions: (raw.multiplet_regions as FidLegacyChartData['multiplet_regions']) ?? [],
    processing_steps_detail: raw.processing_steps as FidLegacyChartData['processing_steps_detail'],
    intensity_scale_mode: raw.intensity_scale_mode as string | undefined,
    intensity_raw_max_scale: raw.intensity_raw_max_scale as number | undefined,
    display: raw.display as FidLegacyChartData['display'],
  };
}

/**
 * FID Processing API Endpoint
 *
 * Processes raw FID files and returns processed spectrum
 * Pipeline: FID → Pre-process → FFT → Phase/Baseline Correction → Peak Detection
 *
 * @route POST /api/fid/process
 */
export async function POST(request: NextRequest) {
  try {
    // Determine processing strategy
    const processorUrl = process.env.FID_PROCESSOR_URL;
    const processorApiKey = process.env.FID_PROCESSOR_API_KEY;
    const isVercel = !!process.env.VERCEL;

    // If running on Vercel without remote processor configured
    if (isVercel && !processorUrl) {
      const debugId = randomUUID();
      return NextResponse.json(
        finalizeFidFailure({
          error_message:
            'Production FID processing için FID_PROCESSOR_URL tanımlanmalı. ' +
            'Detaylar: https://github.com/alylmazzz/spectromind/tree/main/services/fid-processor',
          error_code: FidErrorCodes.PRODUCTION_CONFIG_MISSING,
          debugId,
          processing_steps: [{ step: 'runtime_check', ok: false, detail: 'vercel_no_processor_url' }],
        }),
        { status: 503 }
      );
    }

    // Production mode: proxy to remote FID processor
    if (processorUrl) {
      return handleRemoteProcessing(request, processorUrl, processorApiKey);
    }

    const formData = await request.formData();
    
    // Support both old (single file) and new (datasetId) upload methods
    const datasetId = formData.get('datasetId') as string | null;
    const file = formData.get('fid') as File | null;
    const format = formData.get('format') as string || 'auto';
    const theoreticalPeaks = formData.get('theoreticalPeaks');
    const processingSpecJson = formData.get('processingSpec') as string | null;

    if (datasetId) {
      const debugId = randomUUID();
      const processing_steps: Array<{ step: string; ok: boolean; detail?: string }> = [];

      const baseDir = path.join(os.tmpdir(), 'spectromind', datasetId);

      const maxRetries = 5;
      const retryDelayMs = 300;
      let dirReady = false;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await fs.access(baseDir);
          dirReady = true;
          break;
        } catch {
          if (attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, retryDelayMs));
          }
        }
      }

      if (!dirReady) {
        processing_steps.push({ step: 'resolve_temp_dataset', ok: false });
        return NextResponse.json(
          finalizeFidFailure({
            error_message: 'Veri seti bulunamadı. Önce klasör yüklemesini tamamlayın.',
            error_code: FidErrorCodes.DATASET_NOT_FOUND,
            debugId,
            processing_steps,
          }),
          { status: 400 }
        );
      }
      processing_steps.push({ step: 'resolve_temp_dataset', ok: true, detail: baseDir });

      const tree = await listTree(baseDir, 10);
      const relPaths = tree.map((f) => path.relative(baseDir, f).replace(/\\/g, '/'));
      const pathGuess = detectFormatFromRelPaths(relPaths);
      processing_steps.push({
        step: 'format_heuristic',
        ok: true,
        detail: `${pathGuess.vendor}/${pathGuess.rawFileKind}`,
      });

      let rawReady: string | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const fidFile = await findFileRecursive(baseDir, 'fid');
        const serFile = await findFileRecursive(baseDir, 'ser');
        rawReady = fidFile || serFile;
        if (rawReady) break;
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }

      if (!rawReady) {
        processing_steps.push({ step: 'locate_raw_fid_or_ser', ok: false });
        return NextResponse.json(
          finalizeFidFailure({
            error_message:
              'Ham veri (fid veya ser) diske yazılmadan işlem başlatıldı veya klasör eksik.',
            error_code: FidErrorCodes.RAW_FILE_NOT_FOUND,
            debugId,
            processing_steps,
            pathGuess,
          }),
          { status: 400 }
        );
      }
      processing_steps.push({ step: 'locate_raw_fid_or_ser', ok: true, detail: rawReady });

      const hasProcpar = await findFileRecursive(baseDir, 'procpar');
      const hasAcqus = await findFileRecursive(baseDir, 'acqus');
      const hasLog = await findFileRecursive(baseDir, 'log');
      const hasText = await findFileRecursive(baseDir, 'text');
      const sourcePackageComplete = Boolean(rawReady && hasProcpar && hasLog && hasText);
      processing_steps.push({
        step: 'authority_package_check',
        ok: sourcePackageComplete,
        detail: `fid_or_ser=${Boolean(rawReady)} procpar=${Boolean(hasProcpar)} log=${Boolean(hasLog)} text=${Boolean(hasText)}`,
      });

      const detectedFormat = hasProcpar ? 'varian' : hasAcqus ? 'bruker' : format;

      console.log('═══════════════════════════════════════════════════════');
      console.log('🧪 FID PROCESSING REQUEST (Folder Upload)');
      console.log(`📦 Dataset ID: ${datasetId}`);
      console.log(`🪪 debug_id: ${debugId}`);
      console.log(`📁 Base Directory: ${baseDir}`);
      console.log(`🔬 Detected Format: ${detectedFormat}`);
      console.log(`   - procpar: ${hasProcpar ? '✓' : '✗'}`);
      console.log(`   - acqus: ${hasAcqus ? '✓' : '✗'}`);
      console.log('═══════════════════════════════════════════════════════');

      const result = await processFIDDataset(
        baseDir,
        detectedFormat,
        theoreticalPeaks,
        processingSpecJson
      );

      if (!result.success) {
        processing_steps.push({
          step: 'python_fid_process',
          ok: false,
          detail: result.error,
        });
        const code =
          inferErrorCodeFromPython(result.stderr || '', '') || FidErrorCodes.PYTHON_EXIT;
        return NextResponse.json(
          finalizeFidFailure({
            error_message: result.error || 'Python FID işlemcisi başarısız',
            error_code: code,
            debugId,
            processing_steps,
            stderr: result.stderr,
            pathGuess,
          }),
          { status: 500 }
        );
      }

      processing_steps.push({ step: 'python_fid_process', ok: true });
      const body = finalizeFidSuccess({
        data: result.data,
        comparison: result.comparison,
        datasetId,
        vendor: detectedFormat,
        pathGuess,
        debugId,
        processing_steps,
      });

      if (body.success) {
        if (body.data) {
          const meta = ((body.data.metadata as Record<string, unknown>) || {});
          body.data.metadata = {
            ...meta,
            source_package_complete: sourcePackageComplete,
            source_package_trace: {
              fid_or_ser: Boolean(rawReady),
              procpar: Boolean(hasProcpar),
              log: Boolean(hasLog),
              text: Boolean(hasText),
            },
          } as any;
        }
        if (!sourcePackageComplete) {
          body.warnings = [...(body.warnings || []), 'FID_SOURCE_PACKAGE_INCOMPLETE'];
        }
        console.log('✅ FID processing completed');
        console.log(`📊 Spectrum points: ${body.data?.ppm?.length || 0}`);
        if (body.warnings?.length) console.log(`⚠️ Warnings: ${body.warnings.join(', ')}`);
      } else {
        console.warn('⚠️ FID validation failed after Python OK:', body.error_message);
      }
      console.log('═══════════════════════════════════════════════════════\n');

      return NextResponse.json(body, { status: body.success ? 200 : 422 });
      
    } else if (file) {
      const debugId = randomUUID();
      const processing_steps: Array<{ step: string; ok: boolean; detail?: string }> = [];
      const pathGuess = detectFormatFromRelPaths([file.name]);

      console.log('═══════════════════════════════════════════════════════');
      console.log('🧪 FID PROCESSING REQUEST (File Upload)');
      console.log(`🪪 debug_id: ${debugId}`);
      console.log(`📁 File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
      console.log(`🔬 Format: ${format}`);
      console.log('═══════════════════════════════════════════════════════');

      const tempDir = path.join(os.tmpdir(), 'spectromind');
      await fs.mkdir(tempDir, { recursive: true });

      const isZip = file.name.toLowerCase().endsWith('.zip');
      const safeFileName = path.basename(file.name.replace(/[/\\]/g, path.sep));
      let inputPath = '';
      if (isZip) {
        const datasetId = `zip_${debugId.slice(0, 8)}`;
        inputPath = await unpackZipToDataset(file, datasetId);
        processing_steps.push({ step: 'zip_unpack', ok: true, detail: inputPath });
      } else {
        const fidPath = path.join(tempDir, `${debugId.slice(0, 8)}_${safeFileName || 'fid'}`);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(fidPath, buffer);
        processing_steps.push({ step: 'single_file_write', ok: true, detail: fidPath });
        inputPath = fidPath;
      }

      console.log(`💾 Saved to: ${inputPath}`);

      const result = await processFIDPath(inputPath, format, theoreticalPeaks, processingSpecJson);

      try {
        if (!isZip) {
          await fs.unlink(inputPath);
        }
      } catch (e) {
        console.warn('⚠️ Temp file cleanup failed:', e);
      }

      if (!result.success) {
        processing_steps.push({ step: 'python_fid_process', ok: false, detail: result.error });
        const code =
          inferErrorCodeFromPython(result.stderr || '', '') || FidErrorCodes.PYTHON_EXIT;
        return NextResponse.json(
          finalizeFidFailure({
            error_message: result.error || 'Tek dosya FID işleme başarısız',
            error_code: code,
            debugId,
            processing_steps,
            stderr: result.stderr,
            pathGuess,
          }),
          { status: 500 }
        );
      }

      processing_steps.push({ step: 'python_fid_process', ok: true });
      const body = finalizeFidSuccess({
        data: result.data,
        comparison: result.comparison,
        vendor: format,
        pathGuess,
        debugId,
        processing_steps,
      });

      console.log('═══════════════════════════════════════════════════════\n');
      return NextResponse.json(body, { status: body.success ? 200 : 422 });
    } else {
      const debugId = randomUUID();
      return NextResponse.json(
        finalizeFidFailure({
          error_message: 'datasetId veya fid dosyası gönderilmedi.',
          error_code: FidErrorCodes.MISSING_INPUT,
          debugId,
          processing_steps: [{ step: 'parse_formdata', ok: false }],
        }),
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ FID Processing Error:', error);
    const debugId = randomUUID();
    return NextResponse.json(
      finalizeFidFailure({
        error_message: error?.message || 'FID API beklenmeyen hata',
        error_code: FidErrorCodes.API_INTERNAL,
        debugId,
        processing_steps: [{ step: 'api_unhandled', ok: false, detail: String(error) }],
        stderr: error?.stack,
      }),
      { status: 500 }
    );
  }
}

/**
 * Process FID dataset folder using Python worker
 */
async function processFIDDataset(
  baseDir: string,
  format: string,
  theoreticalPeaks?: FormDataEntryValue | null,
  processingSpecJson?: string | null
): Promise<any> {
  return processFIDPath(baseDir, format, theoreticalPeaks, processingSpecJson);
}

/**
 * Single authoritative python worker path:
 * scripts/fid_process.py handles both folder datasets and direct fid/ser file path.
 */
async function processFIDPath(
  inputPath: string,
  format: string,
  theoreticalPeaks?: FormDataEntryValue | null,
  processingSpecJson?: string | null
): Promise<any> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'fid_process.py');
    
    // Windows: venv_rdkit\Scripts\python.exe
    // Unix: venv_rdkit/bin/python3
    const isWindows = process.platform === 'win32';
    const venvPythonPath = isWindows
      ? path.join(process.cwd(), 'venv_rdkit', 'Scripts', 'python.exe')
      : path.join(process.cwd(), 'venv_rdkit', 'bin', 'python3');
    
    // Parse processing spec if provided (default: auto phase in Python — do not pass ph0/ph1)
    let lb = 0.3;
    let zf = 2.0;
    let baselineMethod = 'xi_rocke_ps';
    let phaseMethod = 'auto_entropy';
    let referenceMethod = 'solvent';
    let referenceTargetPpm = 0;
    let referenceSolvent = '';
    const extraPhaseArgs: string[] = [];

    if (processingSpecJson) {
      try {
        const spec = JSON.parse(processingSpecJson) as Record<string, unknown>;
        const apo = spec.apodization as { lb_hz?: number } | undefined;
        const zfSpec = spec.zeroFill as { factor?: number } | undefined;
        const phase = spec.phase as
          | { manual?: boolean; mode?: string; ph0_deg?: number; ph1_deg?: number }
          | undefined;
        const baseline = spec.baseline as { algorithm?: string } | undefined;
        const reference = spec.reference as
          | { method?: string; target_ppm?: number; solvent?: string }
          | undefined;
        if (typeof apo?.lb_hz === 'number') lb = apo.lb_hz;
        if (typeof zfSpec?.factor === 'number') zf = zfSpec.factor;
        if (typeof phase?.mode === 'string') {
          const mode = phase.mode.toLowerCase();
          if (mode === 'auto_entropy' || mode === 'regions_analysis' || mode === 'manual_ph0_ph1') {
            phaseMethod = mode;
          }
        }
        if (typeof baseline?.algorithm === 'string') {
          const algorithm = baseline.algorithm.toLowerCase();
          if (algorithm === 'asls' || algorithm === 'xi_rocke_ps' || algorithm === 'min_envelope') {
            baselineMethod = algorithm;
          } else if (
            algorithm === 'polynomial' ||
            algorithm === 'whittaker_smoother' ||
            algorithm === 'bernstein'
          ) {
            // map existing UI aliases to currently supported CLI algorithm
            baselineMethod = 'xi_rocke_ps';
          }
        }
        if (typeof reference?.method === 'string') {
          const m = reference.method.toLowerCase();
          if (m === 'solvent' || m === 'manual' || m === 'tms') {
            referenceMethod = m;
          }
        }
        if (typeof reference?.target_ppm === 'number' && Number.isFinite(reference.target_ppm)) {
          referenceTargetPpm = reference.target_ppm;
        }
        if (typeof reference?.solvent === 'string') {
          referenceSolvent = reference.solvent;
        }
        const manualPhaseRequested =
          phase?.manual === true || String(phase?.mode ?? '').toLowerCase() === 'manual_ph0_ph1';
        if (
          manualPhaseRequested &&
          typeof phase?.ph0_deg === 'number' &&
          typeof phase?.ph1_deg === 'number'
        ) {
          extraPhaseArgs.push('--ph0', String(phase.ph0_deg), '--ph1', String(phase.ph1_deg));
        }
      } catch (e) {
        console.warn('Failed to parse processing spec, using defaults');
      }
    }

    const normalizeInputPathForVendorMetadata = async (): Promise<string> => {
      try {
        const st = await fs.stat(inputPath);
        if (!st.isFile()) return inputPath;

        const base = path.basename(inputPath).toLowerCase();
        if (base !== 'fid' && base !== 'ser') return inputPath;

        const parentDir = path.dirname(inputPath);
        const hasProcpar = await fs
          .access(path.join(parentDir, 'procpar'))
          .then(() => true)
          .catch(() => false);
        const hasAcqus = await fs
          .access(path.join(parentDir, 'acqus'))
          .then(() => true)
          .catch(() => false);

        return hasProcpar || hasAcqus ? parentDir : inputPath;
      } catch {
        return inputPath;
      }
    };

    const start = async () => {
      const resolvedInputPath = await normalizeInputPathForVendorMetadata();

      const args = [
      scriptPath,
      '--baseDir', resolvedInputPath,
      '--datasetType', format,
      '--lb', lb.toString(),
      '--zf', zf.toString(),
      '--phase_method', phaseMethod,
      '--baseline_method', baselineMethod,
      '--reference_method', referenceMethod,
      '--reference_target_ppm', String(referenceTargetPpm),
      '--reference_solvent', referenceSolvent,
      ...extraPhaseArgs,
      ];

      console.log(`🐍 Python: ${venvPythonPath}`);
      console.log(`📄 Script: fid_process.py`);
      console.log(`📁 InputPath: ${inputPath}`);
      if (resolvedInputPath !== inputPath) {
        console.log(`📁 Resolved InputPath (metadata-aware): ${resolvedInputPath}`);
      }
    
      const python = spawn(venvPythonPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdoutData = '';
      let stderrData = '';

    // Capture stdout
      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

    // Capture stderr (processing logs)
      python.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderrData += chunk;
        console.log(chunk.trim());
      });

    // Handle completion
      python.on('close', (exitCode) => {
        if (exitCode !== 0) {
          console.error(`⚠️ Python exited with code ${exitCode}`);
          console.error(`📄 stderr: ${stderrData.substring(0, 500)}`);

          resolve({
            success: false,
            error: `FID processor failed (exit code ${exitCode})`,
            stderr: stderrData
          });
          return;
        }

        try {
          const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in output');
          }

          const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

          if (raw.ok === false) {
            resolve({ success: false, error: (raw.message || raw.error || 'Python processing failed') as string });
            return;
          }

          const data = normalizeFidPythonPayload(raw, processingSpecJson);

          let comparison = null;
          if (theoreticalPeaks && data.peaks.length > 0) {
            const theoPeaksArray = JSON.parse(theoreticalPeaks as string);
            comparison = compareWithTheoretical(data.peaks, theoPeaksArray);
          }

          resolve({ success: true, data, comparison });

        } catch (parseError: any) {
          console.error('❌ JSON parse error:', parseError.message);
          console.error(`📄 stdout (first 500 chars): ${stdoutData.substring(0, 500)}`);

          resolve({
            success: false,
            error: 'Failed to parse FID processor output',
            stderr: `Parse error: ${parseError.message}\nOutput: ${stdoutData.substring(0, 200)}`
          });
        }
      });

      // Handle spawn errors
      python.on('error', (err) => {
        console.error('❌ Failed to spawn Python process:', err);

        resolve({
          success: false,
          error: 'Failed to execute FID processor',
          stderr: `Spawn error: ${err.message}`
        });
      });
    };

    void start();
  });
}

/**
 * Unpack uploaded zip into temp dataset directory for authoritative processing.
 */
async function unpackZipToDataset(file: File, datasetId: string): Promise<string> {
  const baseDir = path.join(os.tmpdir(), 'spectromind', datasetId);
  await fs.mkdir(baseDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const writes: Promise<void>[] = [];
  Object.keys(zip.files).forEach((entryName) => {
    const entry = zip.files[entryName];
    if (entry.dir) return;
    const sanitized = entryName.replace(/^\/+/, '');
    const target = path.join(baseDir, sanitized);
    writes.push(
      (async () => {
        await fs.mkdir(path.dirname(target), { recursive: true });
        const content = await entry.async('nodebuffer');
        await fs.writeFile(target, content);
      })()
    );
  });
  await Promise.all(writes);
  return baseDir;
}

/**
 * Compare experimental peaks with theoretical predictions
 */
function compareWithTheoretical(
  experimentalPeaks: any[],
  theoreticalPeaks: number[]
): any {
  const matched: any[] = [];
  const impurities: any[] = [];
  const missing: number[] = [];

  const tolerance = 0.2; // ±0.2 ppm

  // Match experimental to theoretical
  for (const expPeak of experimentalPeaks) {
    const expPpm = expPeak.ppm;

    const distances = theoreticalPeaks.map(theo => Math.abs(expPpm - theo));
    const minDistance = Math.min(...distances);

    if (minDistance < tolerance) {
      const closestTheo = theoreticalPeaks[distances.indexOf(minDistance)];
      matched.push({
        experimental: expPpm,
        theoretical: closestTheo,
        delta: minDistance,
        type: 'MOLECULE_PEAK',
        height: expPeak.height,
        area: expPeak.area
      });
    } else {
      impurities.push({
        ppm: expPpm,
        height: expPeak.height,
        area: expPeak.area,
        type: 'IMPURITY_OR_SOLVENT'
      });
    }
  }

  // Find missing theoretical peaks
  for (const theoPpm of theoreticalPeaks) {
    if (!matched.some(m => Math.abs(m.theoretical - theoPpm) < tolerance)) {
      missing.push(theoPpm);
    }
  }

  return {
    matched_peaks: matched,
    impurity_peaks: impurities,
    missing_theoretical: missing,
    match_rate: matched.length / theoreticalPeaks.length,
    summary: {
      total_experimental: experimentalPeaks.length,
      total_theoretical: theoreticalPeaks.length,
      matched: matched.length,
      impurities: impurities.length,
      missing: missing.length
    }
  };
}

/**
 * Proxy FID processing to remote Python processor (production mode).
 * Detects datasetId-based flow and reads actual files from /tmp.
 */
async function handleRemoteProcessing(
  request: NextRequest,
  processorUrl: string,
  apiKey?: string
): Promise<NextResponse> {
  const debugId = randomUUID();
  try {
    const formData = await request.formData();
    const datasetId = formData.get('datasetId') as string | null;
    const format = (formData.get('format') as string) || 'auto';
    const processingSpecJson = formData.get('processingSpec') as string | null;

    const remoteForm = new FormData();
    if (apiKey) remoteForm.append('api_key', apiKey);
    remoteForm.append('format', format);
    if (processingSpecJson) remoteForm.append('processingSpec', processingSpecJson);

    // DatasetId mode: read actual FID files from /tmp staging area
    if (datasetId) {
      const baseDir = path.join(os.tmpdir(), 'spectromind', datasetId);

      // Find the raw FID file (fid or ser)
      let rawFile: string | null = null;
      for (const candidate of ['fid', 'ser']) {
        const p = path.join(baseDir, candidate);
        try { await fs.access(p); rawFile = p; break; } catch {}
      }

      if (!rawFile) {
        // Try recursive find
        const found = await findFileRecursive(baseDir, 'fid') || await findFileRecursive(baseDir, 'ser');
        if (found) rawFile = found;
      }

      if (!rawFile) {
        return NextResponse.json(
          finalizeFidFailure({
            error_message: 'Staged dataset contains no raw FID file',
            error_code: FidErrorCodes.RAW_FILE_NOT_FOUND,
            debugId,
            processing_steps: [{ step: 'remote_prepare', ok: false, detail: 'no raw file in staging' }],
          }),
          { status: 400 }
        );
      }

      // Read file and attach to FormData
      const fileBuffer = await fs.readFile(rawFile);
      remoteForm.append('dataset', new Blob([fileBuffer]), path.basename(rawFile));
      console.log(`📦 Attached staged FID file: ${rawFile} (${fileBuffer.length} bytes)`);
    }
    // Direct file upload mode: file already in FormData
    else {
      const file = formData.get('fid') as File | null;
      if (file) {
        remoteForm.append('dataset', file, file.name);
      } else {
        return NextResponse.json(
          finalizeFidFailure({
            error_message: 'No FID file provided (dataset or fid field required)',
            error_code: FidErrorCodes.MISSING_INPUT,
            debugId,
            processing_steps: [{ step: 'remote_prepare', ok: false, detail: 'no file in request' }],
          }),
          { status: 400 }
        );
      }
    }

    const url = processorUrl.replace(/\/+$/, '') + '/process-fid';
    console.log(`🔄 Proxying FID process to: ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      body: remoteForm,
      signal: AbortSignal.timeout(120_000),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return NextResponse.json(
        finalizeFidFailure({
          error_message: data.error_message || data.detail || 'Remote FID processor returned error',
          error_code: data.error_code || FidErrorCodes.API_INTERNAL,
          debugId,
          processing_steps: [{ step: 'remote_process', ok: false, detail: String(res.status) }],
        }),
        { status: 502 }
      );
    }

    return NextResponse.json(
      finalizeFidSuccess({
        debugId,
        data: normalizeFidPythonPayload(data),
        processing_steps: [{ step: 'remote_process', ok: true, detail: processorUrl }],
      })
    );
  } catch (error: any) {
    console.error('Remote FID processor error:', error);
    return NextResponse.json(
      finalizeFidFailure({
        error_message: `Remote FID processor unreachable: ${error.message}`,
        error_code: FidErrorCodes.API_INTERNAL,
        debugId,
        processing_steps: [{ step: 'remote_process', ok: false, detail: error.message }],
      }),
      { status: 502 }
    );
  }
}
