'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useClientFIDProcessing } from '@/hooks/useClientFIDProcessing';
import NMRChart from '@/components/charts/NMRChart';
import { processFID, FIDProcessingOptions } from '@/lib/utils/v2/clientProcessing';

/**
 * FID Processor Component v2.0
 * 
 * Client-side FID processing using Pyodide (WebAssembly) + Web Worker
 * Supports Bruker FID format with real-time phase correction
 */
export default function FIDProcessorV2() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acqusInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [acqusFile, setAcqusFile] = useState<File | null>(null);
  const [acqusContent, setAcqusContent] = useState<string>('');
  const [fidData, setFidData] = useState<ArrayBuffer | null>(null);
  const [processedSpectrum, setProcessedSpectrum] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Phase correction parameters
  const [phase0, setPhase0] = useState(0.0);
  const [phase1, setPhase1] = useState(0.0);
  const [lineBroadening, setLineBroadening] = useState(0.3);

  // Load FID file
  const handleFIDFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      setFidData(arrayBuffer);
      
      // Process with default parameters
      await processWithCurrentParams(arrayBuffer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FID file');
    }
  };

  // Load ACQUS file
  const handleAcqusFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setAcqusFile(selectedFile);

    try {
      const text = await selectedFile.text();
      setAcqusContent(text);
      
      // Reprocess if FID is already loaded
      if (fidData) {
        await processWithCurrentParams(fidData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ACQUS file');
    }
  };

  // Process FID with current parameters
  const processWithCurrentParams = useCallback(async (data: ArrayBuffer) => {
    try {
      setLoading(true);
      setError(null);

      const options: FIDProcessingOptions = {
        fftSize: 65536,
        phaseCorrection: { ph0: phase0, ph1: phase1 },
        apodization: 'exponential',
        apodizationParam: lineBroadening,
        baselineCorrection: true
      };

      const result = await processFID(data, acqusContent || undefined, options);
      setProcessedSpectrum(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FID processing failed');
    } finally {
      setLoading(false);
    }
  }, [phase0, phase1, lineBroadening, acqusContent]);

  // Real-time phase correction
  useEffect(() => {
    if (fidData && processedSpectrum) {
      const timeoutId = setTimeout(() => {
        processWithCurrentParams(fidData);
      }, 100); // Debounce 100ms
      return () => clearTimeout(timeoutId);
    }
  }, [phase0, phase1, lineBroadening, fidData, processWithCurrentParams]);

  return (
    <div className="w-full p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">📊 FID Processor v2.0 (Client-Side)</h2>

      {/* File Inputs */}
      <div className="mb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select FID File (Bruker format):
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fid,.FID"
            onChange={handleFIDFileSelect}
            disabled={loading}
            className="w-full p-2 border rounded disabled:opacity-50"
          />
          {file && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Select ACQUS File (Optional):
          </label>
          <input
            ref={acqusInputRef}
            type="file"
            accept="acqus,ACQUS"
            onChange={handleAcqusFileSelect}
            disabled={loading}
            className="w-full p-2 border rounded disabled:opacity-50"
          />
          {acqusFile && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {acqusFile.name}
            </div>
          )}
        </div>
      </div>

      {/* Processing Parameters */}
      {fidData && (
        <div className="mb-4 p-4 bg-gray-50 rounded space-y-4">
          <h3 className="font-semibold">Processing Parameters (Real-time)</h3>
          
          {/* Phase 0 (Zero Order) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Phase 0 (Zero Order): {phase0.toFixed(1)}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="0.1"
              value={phase0}
              onChange={(e) => setPhase0(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Phase 1 (First Order) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Phase 1 (First Order): {phase1.toFixed(1)}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="0.1"
              value={phase1}
              onChange={(e) => setPhase1(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Line Broadening */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Line Broadening: {lineBroadening.toFixed(2)} Hz
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.01"
              value={lineBroadening}
              onChange={(e) => setLineBroadening(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="mb-4 p-4 bg-blue-50 rounded text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Processing FID file...</p>
        </div>
      )}

      {/* Processed Spectrum */}
      {processedSpectrum && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Processed Spectrum:</h3>
          <div className="mb-2 text-sm text-gray-600">
            Frequency: {processedSpectrum.metadata.frequency} MHz • 
            Points: {processedSpectrum.metadata.points} • 
            Processing Time: {processedSpectrum.metadata.processingTime?.toFixed(2) || 'N/A'} ms
          </div>
          
          {/* Spectrum Chart */}
          {processedSpectrum.spectrum && processedSpectrum.spectrum.length > 0 && (
            <div className="mb-4">
              <NMRChart
                peaks={processedSpectrum.peaks.map((p: { shift: number }) => ({
                  shift: p.shift,
                  integ: 1,
                  mult: 's' as const
                }))}
                solvent="CDCl3"
                frequency={400}
              />
            </div>
          )}

          {/* Peak List */}
          {processedSpectrum.peaks && processedSpectrum.peaks.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Detected Peaks ({processedSpectrum.peaks.length}):</h4>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">δ (ppm)</th>
                      <th className="p-2 text-left">Intensity</th>
                      <th className="p-2 text-left">Width (Hz)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedSpectrum.peaks.map((peak: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{peak.shift.toFixed(2)}</td>
                        <td className="p-2">{peak.intensity.toFixed(1)}</td>
                        <td className="p-2">{peak.width?.toFixed(2) || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-gray-700">
        <strong>ℹ️ Client-Side Processing (v2.0):</strong>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>FID files are processed entirely in your browser (Web Worker)</li>
          <li>No data is sent to the server - 100% privacy</li>
          <li>Processing uses Pyodide (Python in WebAssembly)</li>
          <li>Supports Bruker FID format with ACQUS file</li>
          <li>Real-time phase correction with sliders</li>
          <li>First load may take a few seconds to download Pyodide</li>
        </ul>
      </div>
    </div>
  );
}

