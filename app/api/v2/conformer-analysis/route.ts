import { NextRequest, NextResponse } from 'next/server';
import { analyzeConformers, ConformerOptions } from '@/lib/services/v2/ConformerService';

/**
 * 3D Conformer Analysis API v2.0
 * 
 * Generates 3D conformer ensembles and applies Boltzmann weighting
 * 
 * POST /api/v2/conformer-analysis
 * Body: {
 *   smiles: string;
 *   numConformers?: number;  // Default: 50
 *   temperature?: number;     // K, default: 298.15
 *   forceField?: 'MMFF94' | 'UFF';
 *   optimizeGeometry?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, numConformers, temperature, forceField, optimizeGeometry } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string is required' },
        { status: 400 }
      );
    }

    console.log(`🔬 Conformer Analysis Request (v2.0):`);
    console.log(`   SMILES: ${smiles.substring(0, 50)}...`);
    console.log(`   Number of conformers: ${numConformers || 50}`);

    const options: ConformerOptions = {
      numConformers: numConformers || 50,
      temperature: temperature || 298.15,
      forceField: forceField || 'MMFF94',
      optimizeGeometry: optimizeGeometry !== false
    };

    const result = await analyzeConformers(smiles, options);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Conformer analysis failed',
          analysis: null
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: {
        conformers: result.conformers,
        weightedAverage: result.weightedAverage,
        method: result.method,
        smiles: result.smiles,
        totalConfsGenerated: result.totalConfsGenerated,
        significantConfs: result.significantConfs,
        globalMinEnergy: result.globalMinEnergy,
        vicinalCouplings: result.vicinalCouplings || [],
        topConformerMolBlock: result.topConformerMolBlock,
        ensembleSummary: result.ensembleSummary || [],
        warnings: result.warnings || []
      },
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        options: options,
        statistics: {
          totalConformers: result.conformers.length,
          energyRange: {
            min: result.globalMinEnergy || Math.min(...result.conformers.map(c => c.energy)),
            max: Math.max(...result.conformers.map(c => c.energy))
          },
          weightRange: {
            min: Math.min(...result.conformers.map(c => c.weight)),
            max: Math.max(...result.conformers.map(c => c.weight))
          },
          vicinalCouplingsCount: result.vicinalCouplings?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Conformer Analysis API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis: null
      },
      { status: 500 }
    );
  }
}

