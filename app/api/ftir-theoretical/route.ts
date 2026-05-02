import { NextRequest, NextResponse } from 'next/server';
import { predictFTIR } from '@/lib/spectromind/ir_engine/ftirEngine';

/**
 * Theoretical FTIR Prediction API
 * Uses SpectroMind rule-based engine (NO database lookup)
 *
 * Based on:
 * - Hooke's Law force constant model
 * - Normal mode analysis
 * - Wilson's GF-matrix method
 */
export async function POST(request: NextRequest) {
  try {
    const { smiles } = await request.json();

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string required' },
        { status: 400 }
      );
    }

    console.log('🔬 Theoretical FTIR Prediction');
    console.log('SMILES:', smiles);

    // Run theoretical prediction
    const result = await predictFTIR(smiles);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.warnings.join('; ') },
        { status: 500 }
      );
    }

    console.log(`✅ Predicted ${result.peaks.length} IR peaks`);

    // Format peaks for frontend
    const formattedPeaks = result.peaks.map(peak => ({
      wavenumber: peak.wavenumber,
      intensity: peak.intensity,
      type: peak.type,
      assignment: peak.assignment,
      mode: peak.mode
    }));

    return NextResponse.json({
      success: true,
      peaks: formattedPeaks,
      formula: result.molecularFormula,
      smiles: result.smiles,
      warnings: result.warnings,
      method: 'Theoretical (SpectroMind Rule-Based Engine)',
      reference: 'Pavia - Introduction to Spectroscopy, Chapter 2'
    });

  } catch (error) {
    console.error('❌ Theoretical FTIR error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Prediction failed'
      },
      { status: 500 }
      );
  }
}
