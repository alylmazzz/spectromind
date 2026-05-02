'use client';

import { useState, useCallback } from 'react';
import { processFID, checkPyodideAvailable, loadPyodide, FIDProcessingOptions, ProcessedSpectrum } from '@/lib/utils/v2/clientProcessing';

/**
 * Hook for client-side FID processing
 * 
 * Processes FID files in the browser using Pyodide (Python in WebAssembly)
 */
export function useClientFIDProcessing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pyodideAvailable, setPyodideAvailable] = useState<boolean | null>(null);
  const [processedSpectrum, setProcessedSpectrum] = useState<ProcessedSpectrum | null>(null);

  // Check Pyodide availability on mount
  const checkAvailability = useCallback(async () => {
    const available = await checkPyodideAvailable();
    setPyodideAvailable(available);
    return available;
  }, []);

  // Load Pyodide
  const initializePyodide = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await loadPyodide();
      setPyodideAvailable(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Pyodide');
      setPyodideAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Process FID file
  const processFIDFile = useCallback(async (
    file: File,
    options: FIDProcessingOptions = {}
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Check if Pyodide is available
      if (pyodideAvailable === null) {
        const available = await checkAvailability();
        if (!available) {
          await initializePyodide();
        }
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Process FID
      const result = await processFID(arrayBuffer, undefined, options);
      setProcessedSpectrum(result);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'FID processing failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pyodideAvailable, checkAvailability, initializePyodide]);

  return {
    loading,
    error,
    pyodideAvailable,
    processedSpectrum,
    checkAvailability,
    initializePyodide,
    processFIDFile,
    reset: () => {
      setError(null);
      setProcessedSpectrum(null);
    }
  };
}

