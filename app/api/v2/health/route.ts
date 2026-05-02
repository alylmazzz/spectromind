import { NextRequest, NextResponse } from 'next/server';

/**
 * SpectroMind v2.0 Health Check Endpoint
 * 
 * Checks the health status of all v2.0 services:
 * - MS Prediction Service
 * - GNN Service
 * - Conformer Service
 * - DFT Service
 * - Vector Search Service
 */
export async function GET(request: NextRequest) {
  const healthStatus = {
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    services: {
      ms: await checkMSService(),
      gnn: await checkGNNService(),
      conformer: await checkConformerService(),
      dft: await checkDFTService(),
      vector: await checkVectorService(),
    }
  };

  const allHealthy = Object.values(healthStatus.services).every(s => s.status === 'healthy');
  
  return NextResponse.json({
    ...healthStatus,
    status: allHealthy ? 'healthy' : 'degraded'
  }, {
    status: allHealthy ? 200 : 503
  });
}

/**
 * Check MS Prediction Service health
 */
async function checkMSService(): Promise<{ status: string; message?: string }> {
  try {
    // Check if RDKit is available (MS service uses RDKit for fragmentation)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { getPythonPath } = await import('@/lib/utils/pythonPath');
    const pythonPath = getPythonPath();
    
    // Quick test: try to import rdkit
    await execAsync(`"${pythonPath}" -c "import rdkit; print('OK')"`, { timeout: 5000 });
    
    return { status: 'healthy' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'MS service unavailable' 
    };
  }
}

/**
 * Check GNN Service health
 */
async function checkGNNService(): Promise<{ status: string; message?: string }> {
  try {
    // Check if model files exist (will be implemented when GNN service is ready)
    const fs = await import('fs');
    const path = await import('path');
    
    const modelPath = path.join(process.cwd(), 'lib', 'models', 'chemprop');
    const modelExists = fs.existsSync(modelPath);
    
    return { 
      status: modelExists ? 'healthy' : 'degraded',
      message: modelExists ? undefined : 'GNN model not found (service will use fallback)'
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'GNN service unavailable' 
    };
  }
}

/**
 * Check Conformer Service health
 */
async function checkConformerService(): Promise<{ status: string; message?: string }> {
  try {
    // Check if RDKit is available
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const { getPythonPath } = await import('@/lib/utils/pythonPath');
    const pythonPath = getPythonPath();
    
    await execAsync(`"${pythonPath}" -c "import rdkit; print('OK')"`, { timeout: 5000 });
    
    return { status: 'healthy' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Conformer service unavailable' 
    };
  }
}

/**
 * Check DFT Service health
 */
async function checkDFTService(): Promise<{ status: string; message?: string }> {
  try {
    // Check if xTB is available (will check ORCA separately if needed)
    // For now, return degraded as DFT service requires external setup
    return { 
      status: 'degraded',
      message: 'DFT service requires xTB/ORCA setup (optional)' 
    };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'DFT service unavailable' 
    };
  }
}

/**
 * Check Vector Search Service health
 */
async function checkVectorService(): Promise<{ status: string; message?: string }> {
  try {
    // Check if Pinecone API key is configured (optional)
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    
    if (!pineconeApiKey) {
      return { 
        status: 'degraded',
        message: 'Vector search requires PINECONE_API_KEY (optional)' 
      };
    }
    
    return { status: 'healthy' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      message: error instanceof Error ? error.message : 'Vector service unavailable' 
    };
  }
}

