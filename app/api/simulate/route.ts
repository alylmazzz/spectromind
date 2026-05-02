/**
 * Spectrum simulation API: SMILES → Chem Core → engine(s) → UnifiedSpectrum.
 * Engine: spectromind | spectrotester | hybrid (later).
 * Vertical slice: SpectroMind engine only (HOSE via hose-predict or nmr-engine).
 */

import { NextRequest, NextResponse } from 'next/server';
import type { UnifiedSpectrum, NMR1DSpectrum, Peak1D } from '@/packages/schemas';

const CHEM_CORE_URL = process.env.CHEM_CORE_URL || 'http://127.0.0.1:8001';
const NMR_ENGINE_URL = process.env.NMR_ENGINE_URL || '';

type Engine = 'spectromind' | 'spectrotester' | 'hybrid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, engine = 'spectromind', solvent = 'DMSO-d6', frequency_MHz = 400 } = body as {
      smiles?: string;
      engine?: Engine;
      solvent?: string;
      frequency_MHz?: number;
    };

    if (!smiles || !smiles.trim()) {
      return NextResponse.json(
        { success: false, error: 'SMILES is required for simulation' },
        { status: 400 }
      );
    }

    // 1) Chem Core: parse-standardize (optional; if service down, continue with SMILES)
    let graph: any = null;
    let features: any = null;
    try {
      const parseRes = await fetch(`${CHEM_CORE_URL}/parse-standardize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: smiles.trim() }),
      });
      if (parseRes.ok) {
        const parsed = await parseRes.json();
        graph = parsed.graph;
        features = parsed.features;
      }
    } catch (_) {
      // Chem Core not running: proceed with SMILES-only
    }

    const result: UnifiedSpectrum = {};

    // 2) SpectroMind engine: 1H via HOSE (existing API)
    if (engine === 'spectromind' || engine === 'hybrid') {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin;
      const hoseRes = await fetch(`${base}/api/hose-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: smiles.trim() }),
      });
      if (hoseRes.ok) {
        const hoseData = await hoseRes.json();
        if (hoseData.success && Array.isArray(hoseData.predicted_shifts)) {
          const peaks1h: Peak1D[] = hoseData.predicted_shifts.map((ppm: number, i: number) => ({
            ppm_or_mz: ppm,
            intensity: 1,
            integ: 1,
            mult: 's',
            label: `H${i + 1}`,
          }));
          const nmr1h: NMR1DSpectrum = {
            peaks: peaks1h,
            solvent,
            frequency_MHz,
          };
          result.nmr1h = nmr1h;
          result.source_engine = engine === 'hybrid' ? 'hybrid' : 'spectromind';
        }
      }
    }

    // 3) Spectrotester engine: (future) spectrotester-compat; for now skip if engine === 'spectrotester'
    if (engine === 'spectrotester') {
      // TODO: call spectrotester-compat or external Spectrotester service
      return NextResponse.json({
        success: false,
        error: 'Spectrotester engine not yet wired; use spectromind or hybrid',
      }, { status: 501 });
    }

    if (!result.nmr1h) {
      return NextResponse.json(
        { success: false, error: 'No 1H spectrum could be generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      spectrum: result,
      graph: graph || undefined,
      features: features || undefined,
    });
  } catch (e) {
    console.error('Simulate API error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}
