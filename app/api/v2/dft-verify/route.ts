import { NextRequest, NextResponse } from 'next/server';
import { verifyDFT, DFTOptions } from '@/lib/services/v2/DFTService';

/**
 * DFT Verification API v2.0
 * 
 * Verifies NMR shifts using quantum mechanical calculations
 * 
 * POST /api/v2/dft-verify
 * Body: {
 *   smiles: string;
 *   method?: 'xtb' | 'orca' | 'gaussian';
 *   level?: string;  // e.g., 'B3LYP/6-31G*'
 *   optimizeGeometry?: boolean;
 *   calculateShielding?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, method, level, optimizeGeometry, calculateShielding } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string is required' },
        { status: 400 }
      );
    }

    console.log(`🔬 DFT Verification Request (v2.0):`);
    console.log(`   SMILES: ${smiles.substring(0, 50)}...`);
    console.log(`   Method: ${method || 'xtb'}`);

    const options: DFTOptions = {
      method: method || 'xtb',
      level: level || 'B3LYP/6-31G*',
      optimizeGeometry: optimizeGeometry !== false,
      calculateShielding: calculateShielding !== false,
      useLinearScaling: body.useLinearScaling !== false
    };

    const result = await verifyDFT(smiles, options);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'DFT verification failed',
          verification: null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      verification: {
        shifts: result.shifts,
        method: result.method,
        computationTime: result.computationTime,
        optimized: result.optimized,
        linearScaling: result.linearScaling,
        warnings: result.warnings || []
      },
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        options: options,
        statistics: {
          totalShifts: result.shifts.length,
          elements: {
            H: result.shifts.filter((s: any) => s.element === 'H').length,
            C: result.shifts.filter((s: any) => s.element === 'C').length,
            N: result.shifts.filter((s: any) => s.element === 'N').length,
            O: result.shifts.filter((s: any) => s.element === 'O').length
          },
          shiftRange: result.shifts.length > 0 ? {
            min: Math.min(...result.shifts.map((s: any) => s.shift)),
            max: Math.max(...result.shifts.map((s: any) => s.shift))
          } : null
        }
      }
    });

  } catch (error) {
    console.error('❌ DFT Verification API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        verification: null
      },
      { status: 500 }
    );
  }
}

