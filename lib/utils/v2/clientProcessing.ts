/**
 * Client-Side Processing Utilities
 * 
 * WebAssembly-based signal processing for FID files
 * Uses Pyodide for Python runtime in browser
 */

export interface FIDProcessingOptions {
  fftSize?: number;           // FFT size (default: 65536)
  phaseCorrection?: {
    ph0: number;              // Zero-order phase correction (degrees)
    ph1: number;              // First-order phase correction (degrees)
  };
  baselineCorrection?: boolean;
  apodization?: 'none' | 'exponential' | 'gaussian';
  apodizationParam?: number;
}

export interface ProcessedSpectrum {
  peaks: Array<{
    shift: number;            // δ ppm
    intensity: number;        // 0-100
    width?: number;           // Peak width (Hz)
  }>;
  spectrum: Float32Array;     // Full spectrum data
  metadata: {
    frequency: number;        // MHz
    points: number;
    processingTime: number;   // ms
  };
}

/**
 * Check if Pyodide is available
 */
export async function checkPyodideAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // @ts-ignore - Pyodide is loaded dynamically
    return typeof window.pyodide !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Load Pyodide runtime
 */
export async function loadPyodide(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Pyodide can only be loaded in browser environment');
  }

  // @ts-ignore
  if (window.pyodide) {
    // @ts-ignore
    return window.pyodide;
  }

  // Dynamic import of Pyodide
  const pyodideModule = await import('pyodide');
  const pyodide = await pyodideModule.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
  });

  // Install required packages
  await pyodide.loadPackage(['numpy', 'scipy']);

  // @ts-ignore
  window.pyodide = pyodide;
  
  return pyodide;
}

/**
 * Process FID file in browser using Web Worker
 * 
 * Supports Bruker FID format with ACQUS file
 */
export async function processFID(
  fidData: ArrayBuffer,
  acqusContent?: string,
  options: FIDProcessingOptions = {}
): Promise<ProcessedSpectrum> {
  const startTime = performance.now();

  const {
    fftSize = 65536,
    phaseCorrection = { ph0: 0, ph1: 0 },
    baselineCorrection = true,
    apodization = 'exponential',
    apodizationParam = 0.3  // Line broadening (Hz)
  } = options;

  try {
    // Use Web Worker for processing
    return await processFIDInWorker(
      fidData,
      acqusContent || '',
      {
        lb: apodization === 'exponential' ? apodizationParam : 0.0,
        p0: phaseCorrection.ph0,
        p1: phaseCorrection.ph1
      }
    );

  } catch (error) {
    console.error('FID processing error:', error);
    throw new Error(`FID processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process FID in Web Worker
 */
async function processFIDInWorker(
  fidData: ArrayBuffer,
  acqusContent: string,
  options: { lb: number; p0: number; p1: number }
): Promise<ProcessedSpectrum> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/pyodide/fid_worker.js', { type: 'module' });
    
    let resolved = false;

    worker.onmessage = (e) => {
      const { type, data, error, progress, message } = e.data;

      switch (type) {
        case 'ready':
          console.log('[FID Processor] Worker ready');
          // Start processing
          worker.postMessage({
            type: 'process',
            data: {
              fidBytes: fidData,
              acqusContent: acqusContent,
              options: options
            }
          });
          break;

        case 'progress':
          console.log(`[FID Processor] ${message} (${progress}%)`);
          break;

        case 'complete':
          if (!resolved) {
            resolved = true;
            // Convert to ProcessedSpectrum format
            const processed: ProcessedSpectrum = {
              peaks: extractPeaks(data.x, data.y),
              spectrum: new Float32Array(data.y),
              metadata: {
                frequency: data.meta?.freq || 400.0,
                points: data.meta?.points || data.y.length,
                processingTime: performance.now() - performance.now()
              }
            };
            worker.terminate();
            resolve(processed);
          }
          break;

        case 'error':
          if (!resolved) {
            resolved = true;
            worker.terminate();
            reject(new Error(error || 'FID processing failed'));
          }
          break;
      }
    };

    worker.onerror = (error) => {
      if (!resolved) {
        resolved = true;
        worker.terminate();
        reject(new Error(`Worker error: ${error.message}`));
      }
    };

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        worker.terminate();
        reject(new Error('FID processing timeout'));
      }
    }, 60000);
  });
}

/**
 * Extract peaks from spectrum data
 */
function extractPeaks(ppmAxis: number[], intensity: number[]): Array<{
  shift: number;
  intensity: number;
  width?: number;
}> {
  const peaks: Array<{ shift: number; intensity: number; width?: number }> = [];
  const threshold = Math.max(...intensity) * 0.1;

  for (let i = 1; i < intensity.length - 1; i++) {
    if (intensity[i] > threshold && 
        intensity[i] > intensity[i - 1] && 
        intensity[i] > intensity[i + 1]) {
      peaks.push({
        shift: ppmAxis[i],
        intensity: intensity[i],
        width: 0.01  // Estimated
      });
    }
  }

  // Sort by intensity and take top 20
  peaks.sort((a, b) => b.intensity - a.intensity);
  return peaks.slice(0, 20);
}

/**
 * Simple FFT in JavaScript (fallback if Pyodide not available)
 */
export function simpleFFT(data: Float32Array, size: number = 65536): Float32Array {
  // Simplified FFT implementation
  // For production, use a proper FFT library like fft.js
  
  const result = new Float32Array(size);
  const N = Math.min(data.length, size);
  
  // Simple DFT (slow, but works)
  for (let k = 0; k < size; k++) {
    let real = 0;
    let imag = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / size;
      real += data[n] * Math.cos(angle);
      imag += data[n] * Math.sin(angle);
    }
    
    result[k] = Math.sqrt(real * real + imag * imag);
  }
  
  return result;
}

