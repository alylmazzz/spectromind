/**
 * SpectroMind v2.0 - FID Processing Web Worker
 * 
 * Pyodide + Python NMR processor in isolated worker thread
 */

let pyodide = null;
let processorLoaded = false;

// Load Pyodide and Python module
async function initialize() {
  try {
    console.log('[Worker] Loading Pyodide...');
    
    // Import Pyodide using importScripts (for Web Workers)
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');
    
    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
    });

    // Install required packages
    await pyodide.loadPackage(['numpy', 'scipy']);
    
    console.log('[Worker] Pyodide loaded');
    
    // Load Python processor module
    console.log('[Worker] Loading Python processor module...');
    
    // Fetch Python module
    const response = await fetch('/pyodide/browser_nmr_processor.py');
    const pythonCode = await response.text();
    
    // Run Python code
    pyodide.runPython(pythonCode);
    
    processorLoaded = true;
    console.log('[Worker] Processor module loaded');
    
    self.postMessage({
      type: 'ready',
      message: 'Pyodide and processor loaded'
    });
  } catch (error) {
    console.error('[Worker] Initialization error:', error);
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
}

// Initialize on worker start
initialize();

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'process':
        await processFID(data);
        break;
      
      case 'ping':
        self.postMessage({ type: 'pong' });
        break;
      
      default:
        self.postMessage({
          type: 'error',
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
};

// Process FID file
async function processFID({ fidBytes, acqusContent, options }) {
  try {
    if (!processorLoaded) {
      throw new Error('Processor not loaded yet');
    }

    self.postMessage({
      type: 'progress',
      message: 'Processing FID...',
      progress: 10
    });

    // Convert Uint8Array to Python bytes using Pyodide's virtual filesystem
    const fidArray = new Uint8Array(fidBytes);
    
    // Write to Pyodide's virtual filesystem
    pyodide.FS.writeFile('/tmp/fid', fidArray);
    
    self.postMessage({
      type: 'progress',
      message: 'Running FFT...',
      progress: 50
    });

    // Escape acqus content for Python string
    const acqusEscaped = acqusContent
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    // Call Python processing function
    const result = pyodide.runPython(`
import json
from browser_nmr_processor import run_processing

# Read FID bytes
with open('/tmp/fid', 'rb') as f:
    fid_bytes = f.read()

# Process
acqus_str = """${acqusEscaped}"""

result = run_processing(
    fid_bytes,
    acqus_str,
    ${options.lb || 0.3},
    ${options.p0 || 0.0},
    ${options.p1 || 0.0}
)

result
`);

    self.postMessage({
      type: 'progress',
      message: 'Finalizing...',
      progress: 90
    });

    // Parse JSON result
    const processed = JSON.parse(result);

    self.postMessage({
      type: 'complete',
      data: processed,
      progress: 100
    });

  } catch (error) {
    console.error('[Worker] Processing error:', error);
    self.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    });
  }
}
