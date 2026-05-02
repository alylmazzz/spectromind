import { NextRequest, NextResponse } from 'next/server';
import { predictMS } from '@/lib/services/v2/MSService';
import { predictGNN } from '@/lib/services/v2/GNNService';
import { analyzeConformers } from '@/lib/services/v2/ConformerService';
import { verifyDFT } from '@/lib/services/v2/DFTService';
import { vectorSearch } from '@/lib/services/v2/VectorSearchService';

/**
 * Comprehensive Prediction API v2.0
 * 
 * Combines all v2.0 modules for comprehensive spectrum prediction
 * 
 * POST /api/v2/predict
 * Body: {
 *   smiles: string;
 *   options: {
 *     includeMS?: boolean;
 *     includeGNN?: boolean;
 *     includeConformers?: boolean;
 *     includeDFT?: boolean;
 *     includeVectorSearch?: boolean;
 *     // ... module-specific options
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smiles, options = {} } = body;

    if (!smiles) {
      return NextResponse.json(
        { success: false, error: 'SMILES string is required' },
        { status: 400 }
      );
    }

    console.log(`🚀 Comprehensive Prediction Request (v2.0):`);
    console.log(`   SMILES: ${smiles.substring(0, 50)}...`);

    const {
      includeMS = true,
      includeGNN = true,
      includeConformers = true,
      includeDFT = false,  // Optional, slower
      includeVectorSearch = true,
      ...moduleOptions
    } = options;

    // Run predictions in parallel where possible
    const predictions: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // 1. GNN NMR Prediction (fast, always recommended)
    if (includeGNN) {
      try {
        const gnnResult = await predictGNN(smiles, moduleOptions.atomIndices);
        if (gnnResult.success) {
          predictions.nmr = {
            method: 'GNN',
            predictions: gnnResult.predictions,
            modelVersion: gnnResult.modelVersion
          };
        } else {
          errors.nmr = gnnResult.error || 'GNN prediction failed';
        }
      } catch (error) {
        errors.nmr = error instanceof Error ? error.message : 'GNN prediction error';
      }
    }

    // 2. MS Prediction (fast)
    if (includeMS) {
      try {
        const msResult = await predictMS(smiles, {
          ionization: moduleOptions.ionization,
          energy: moduleOptions.energy,
          charge: moduleOptions.charge,
          includeIsotopes: moduleOptions.includeIsotopes
        });
        if (msResult.success) {
          predictions.ms = {
            molecularIon: msResult.molecularIon,
            peaks: msResult.peaks,
            method: msResult.method
          };
        } else {
          errors.ms = msResult.error || 'MS prediction failed';
        }
      } catch (error) {
        errors.ms = error instanceof Error ? error.message : 'MS prediction error';
      }
    }

    // 3. Conformer Analysis (moderate speed)
    if (includeConformers) {
      try {
        const conformerResult = await analyzeConformers(smiles, {
          numConformers: moduleOptions.numConformers,
          temperature: moduleOptions.temperature,
          forceField: moduleOptions.forceField,
          optimizeGeometry: moduleOptions.optimizeGeometry
        });
        if (conformerResult.success) {
          predictions.conformers = {
            conformers: conformerResult.conformers,
            weightedAverage: conformerResult.weightedAverage,
            method: conformerResult.method
          };
        } else {
          errors.conformers = conformerResult.error || 'Conformer analysis failed';
        }
      } catch (error) {
        errors.conformers = error instanceof Error ? error.message : 'Conformer analysis error';
      }
    }

    // 4. DFT Verification (slow, optional)
    if (includeDFT) {
      try {
        const dftResult = await verifyDFT(smiles, {
          method: moduleOptions.dftMethod,
          level: moduleOptions.dftLevel,
          optimizeGeometry: moduleOptions.optimizeGeometry,
          calculateShielding: moduleOptions.calculateShielding
        });
        if (dftResult.success) {
          predictions.dft = {
            shifts: dftResult.shifts,
            method: dftResult.method,
            computationTime: dftResult.computationTime
          };
        } else {
          errors.dft = dftResult.error || 'DFT verification failed';
        }
      } catch (error) {
        errors.dft = error instanceof Error ? error.message : 'DFT verification error';
      }
    }

    // 5. Vector Search (fast)
    if (includeVectorSearch) {
      try {
        const vectorResult = await vectorSearch({
          type: 'molecule',
          data: smiles,
          topK: moduleOptions.vectorTopK || 10,
          threshold: moduleOptions.vectorThreshold || 0.5
        });
        if (vectorResult.success) {
          predictions.similar = {
            results: vectorResult.results,
            method: vectorResult.method
          };
        } else {
          errors.similar = vectorResult.error || 'Vector search failed';
        }
      } catch (error) {
        errors.similar = error instanceof Error ? error.message : 'Vector search error';
      }
    }

    // Determine overall success
    const hasPredictions = Object.keys(predictions).length > 0;
    const hasErrors = Object.keys(errors).length > 0;

    return NextResponse.json({
      success: hasPredictions,
      predictions,
      errors: hasErrors ? errors : undefined,
      metadata: {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        smiles: smiles.substring(0, 100),
        modules: {
          nmr: includeGNN,
          ms: includeMS,
          conformers: includeConformers,
          dft: includeDFT,
          vectorSearch: includeVectorSearch
        }
      }
    });

  } catch (error) {
    console.error('❌ Comprehensive Prediction API error:', error);
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

