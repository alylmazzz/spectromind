import { NextRequest, NextResponse } from 'next/server';
import { predictGNN } from '@/lib/services/v2/GNNService';

/**
 * GNN-Based NMR Prediction API v2.0
 * 
 * Predicts NMR chemical shifts using Graph Neural Networks
 * 
 * POST /api/v2/gnn-nmr-predict
 * Body: {
 *   smiles: string;
 *   atomIndices?: number[];  // Optional: specific atoms to predict
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, atomIndices } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string is required' },
        { status: 400 }
      );
    }

    console.log(`🔬 GNN NMR Prediction Request (v2.0):`);
    console.log(`   SMILES: ${smiles.substring(0, 50)}...`);
    if (atomIndices) {
      console.log(`   Atom indices: ${atomIndices.join(', ')}`);
    }

    const result = await predictGNN(smiles, atomIndices);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'GNN prediction failed',
          predictions: null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      predictions: result.predictions,
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        method: result.method,
        modelVersion: result.modelVersion,
        warnings: result.warnings || []
      }
    });

  } catch (error) {
    console.error('❌ GNN Prediction API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        predictions: null
      },
      { status: 500 }
    );
  }
}

