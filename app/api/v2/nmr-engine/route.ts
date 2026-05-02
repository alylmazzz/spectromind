/**
 * NMR Engine Proxy API
 * 
 * Next.js API route that proxies requests to FastAPI microservice
 */

import { NextRequest, NextResponse } from 'next/server';
import { nmrEngineService } from '@/lib/services/v2/NMREngineService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (endpoint === 'health') {
      const health = await nmrEngineService.healthCheck();
      return NextResponse.json(health);
    }

    return NextResponse.json(
      { error: 'Invalid endpoint' },
      { status: 400 }
    );
  } catch (error) {
    console.error('NMR Engine health check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health check failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'predict-nmr':
        const nmrResult = await nmrEngineService.predictNMR(params);
        return NextResponse.json(nmrResult);

      case 'analyze-conformers':
        const conformerResult = await nmrEngineService.analyzeConformers(params);
        return NextResponse.json(conformerResult);

      case 'predict-ftir':
        const ftirResult = await nmrEngineService.predictFTIR(
          params.smiles,
          params.anharmonicCorrection,
          params.scalingFactor
        );
        return NextResponse.json(ftirResult);

      case 'predict-ms':
        const msResult = await nmrEngineService.predictMS(
          params.smiles,
          params.ionizationMode,
          params.collisionEnergy
        );
        return NextResponse.json(msResult);

      case 'calculate-qm':
        const qmResult = await nmrEngineService.calculateQM(
          params.smiles,
          params.method,
          params.level
        );
        return NextResponse.json(qmResult);

      case 'qm-status':
        const status = await nmrEngineService.getQMStatus(params.jobId);
        return NextResponse.json(status);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('NMR Engine API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      },
      { status: 500 }
    );
  }
}

