/**
 * UltraThink Comprehensive Theoretical Spectrum Prediction API
 * 
 * ULTRATHINK dokümanındaki tüm kuralları kullanarak
 * 1H NMR, 13C NMR ve FTIR spektrumlarını tahmin eder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { predictUltraThinkSpectrum, UltraThinkOptions } from '@/lib/services/v2/UltraThinkService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, solvent, temperature, frequency } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string is required', prediction: null },
        { status: 400 }
      );
    }

    const options: UltraThinkOptions = {
      solvent: solvent || 'CDCl3',
      temperature: temperature || 298.15,
      frequency: frequency || 400
    };

    const result = await predictUltraThinkSpectrum(smiles, options);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'UltraThink prediction failed',
          prediction: null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prediction: {
        h1NMR: result.h1NMR,
        c13NMR: result.c13NMR,
        ftir: result.ftir,
        properties: result.properties,
        confidence: result.confidence,
        warnings: result.warnings,
        method: result.method
      },
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        options: options,
        statistics: {
          h1Peaks: result.h1NMR.length,
          c13Peaks: result.c13NMR.length,
          ftirPeaks: result.ftir.length,
          totalIntegration: result.h1NMR.reduce((sum, p) => sum + (p.integ || 1), 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ UltraThink Prediction API error:', error);
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

