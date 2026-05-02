import { NextRequest, NextResponse } from 'next/server';
import { predictMS, MSPredictionOptions } from '@/lib/services/v2/MSService';

/**
 * MS (Mass Spectrometry) Prediction API v2.0
 * 
 * Provides in-silico fragmentation and MS spectrum prediction
 * 
 * POST /api/v2/ms-predict
 * Body: {
 *   smiles: string;
 *   ionization?: 'EI' | 'ESI' | 'MALDI' | 'APCI';
 *   energy?: number;  // eV for EI
 *   charge?: number;
 *   includeIsotopes?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, ionization, energy, charge, includeIsotopes } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string is required' },
        { status: 400 }
      );
    }

    console.log(`🔬 MS Prediction Request (v2.0):`);
    console.log(`   SMILES: ${smiles.substring(0, 50)}...`);
    console.log(`   Ionization: ${ionization || 'EI'}`);
    console.log(`   Energy: ${energy || 70} eV`);

    const options: MSPredictionOptions = {
      ionization: ionization || 'EI',
      energy: energy || 70,
      charge: charge || 1,
      includeIsotopes: includeIsotopes !== false
    };

    const result = await predictMS(smiles, options);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'MS prediction failed',
          prediction: null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prediction: {
        molecularIon: result.molecularIon,
        peaks: result.peaks,
        method: result.method,
        formula: result.formula,
        diagnosticIons: result.diagnosticIons || [],
        mclaffertyRearrangements: result.mclaffertyRearrangements || [],
        parameters: result.parameters,
        warnings: result.warnings || []
      },
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        options: options
      }
    });

  } catch (error) {
    console.error('❌ MS Prediction API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        prediction: null
      },
      { status: 500 }
    );
  }
}

