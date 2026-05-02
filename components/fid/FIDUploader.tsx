'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import SpectrumPlot from './SpectrumPlot';
import type { FidProcessingPresetId } from '@/lib/hooks/useFIDUpload';

interface FIDData {
  metadata: {
    spectrometer_freq: number;
    spectral_width: number;
    offset: number;
    data_points: number;
  };
  ppm: number[];
  intensity: number[];
  peaks: Array<{
    ppm: number;
    height: number;
    area: number;
  }>;
}

interface ComparisonData {
  matched_peaks: Array<{
    experimental: number;
    theoretical: number;
    delta: number;
    type: string;
    height: number;
  }>;
  impurity_peaks: Array<{
    ppm: number;
    height: number;
    type: string;
  }>;
  missing_theoretical: number[];
  match_rate: number;
  summary: {
    total_experimental: number;
    total_theoretical: number;
    matched: number;
    impurities: number;
    missing: number;
  };
}

interface FIDUploaderProps {
  theoreticalPeaks?: number[];
  onProcessingComplete?: (data: FIDData, comparison?: ComparisonData) => void;
}

export default function FIDUploader({ theoreticalPeaks, onProcessingComplete }: FIDUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [fidData, setFidData] = useState<FIDData | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [processingPreset, setProcessingPreset] = useState<FidProcessingPresetId>('1H_standard');
  const stageLabels = [
    '1) upload',
    '2) parse metadata',
    '3) process fid',
    '4) calibrate axis',
    '5) pick peaks',
    '6) render chart',
  ];

  // Generate unique dataset ID
  const generateDatasetId = () => {
    return `fid_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  };

  const createProcessingSpec = useCallback(() => {
    const nucleus =
      processingPreset === '13C_standard'
        ? '13C'
        : processingPreset === '13C_mnova_parity'
          ? '13C'
          : '1H';
    const lb_hz =
      processingPreset === '13C_standard'
        ? 0.8
        : processingPreset === '13C_mnova_parity'
          ? 1.0
          : 0.3;
    const zfFactor =
      processingPreset === '1H_mnova_parity' || processingPreset === '13C_mnova_parity' ? 4 : 2;
    const baseline =
      'xi_rocke_ps';
    const phaseMode =
      processingPreset === '13C_standard' ||
      processingPreset === '1H_mnova_parity' ||
      processingPreset === '13C_mnova_parity'
        ? 'regions_analysis'
        : 'auto_entropy';

    return {
      preset_id: processingPreset,
      nucleus,
      apodization: { window: 'exp', lb_hz },
      zeroFill: { factor: zfFactor },
      phase: { mode: phaseMode, manual: false },
      baseline: { algorithm: baseline },
      reference: { method: 'solvent', target_ppm: 0, standard: 'solvent', confidence: 'high', solvent: 'CDCl3' },
    };
  }, [processingPreset]);

  const handleFolderUpload = useCallback(async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setUploadStatus('Klasör yükleniyor...');

    try {
      const files = Array.from(fileList);
      const datasetId = generateDatasetId();

      // Upload folder to server
      const formData = new FormData();
      formData.append('datasetId', datasetId);

      files.forEach((file) => {
        formData.append('files', file);
        // @ts-ignore - webkitRelativePath is available in directory upload
        const relPath = (file as any).webkitRelativePath || file.name;
        formData.append('paths', relPath);
      });

      const uploadResponse = await fetch('/api/fid/upload', {
        method: 'POST',
        body: formData
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadResult.ok) {
        throw new Error(uploadResult.message || uploadResult.error || 'Klasör yükleme başarısız');
      }

      setUploadStatus('FID işleniyor...');

      // Small delay to let the server flush files to disk before processing
      await new Promise(r => setTimeout(r, 200));

      // Process FID with retry on transient ENOENT errors
      const processFormData = new FormData();
      processFormData.append('datasetId', datasetId);
      processFormData.append('format', 'auto');
      processFormData.append('processingSpec', JSON.stringify(createProcessingSpec()));

      if (theoreticalPeaks && theoreticalPeaks.length > 0) {
        processFormData.append('theoreticalPeaks', JSON.stringify(theoreticalPeaks));
      }

      let processResponse: Response | null = null;
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        processResponse = await fetch('/api/fid/process', {
          method: 'POST',
          body: processFormData
        });

        const peek = await processResponse.clone().json();
        if (processResponse.ok || !peek.error?.includes('not found')) break;

        // File not ready yet — wait and retry
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }

      if (!processResponse) {
        throw new Error('FID process isteği gönderilemedi');
      }

      const processResult = await processResponse.json();

      if (!processResult.success) {
        throw new Error(processResult.error || 'FID işleme başarısız');
      }

      setFidData(processResult.data);

      if (processResult.comparison) {
        setComparison(processResult.comparison);
      }

      if (onProcessingComplete) {
        onProcessingComplete(processResult.data, processResult.comparison);
      }

      setUploadStatus('');

    } catch (err: any) {
      setError(err.message || 'Klasör yükleme hatası');
      setUploadStatus('');
    } finally {
      setIsProcessing(false);
    }
  }, [theoreticalPeaks, onProcessingComplete, createProcessingSpec]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    if (process.env.NODE_ENV === 'development') {
      console.log('🔬 Processing FID file:', file.name);
    }

    try {
      const formData = new FormData();
      formData.append('fid', file);
      formData.append('format', 'auto'); // Auto-detect format
      formData.append('processingSpec', JSON.stringify(createProcessingSpec()));

      if (theoreticalPeaks && theoreticalPeaks.length > 0) {
        formData.append('theoreticalPeaks', JSON.stringify(theoreticalPeaks));
      }

      const response = await fetch('/api/fid/process', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'FID processing failed');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ FID processing complete');
        console.log('📊 Peaks detected:', result.data.peaks.length);
      }

      setFidData(result.data);

      if (result.comparison) {
        setComparison(result.comparison);
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 Match rate:', (result.comparison.match_rate * 100).toFixed(1) + '%');
          console.log('⚠️ Impurities:', result.comparison.impurity_peaks.length);
        }
      }

      if (onProcessingComplete) {
        onProcessingComplete(result.data, result.comparison);
      }

    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ FID processing error:', err);
      }
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [theoreticalPeaks, onProcessingComplete, createProcessingSpec]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const asList = {
      length: acceptedFiles.length,
      item: (idx: number) => acceptedFiles[idx] ?? null,
    } as unknown as FileList;
    if (acceptedFiles.length > 1) {
      handleFolderUpload(asList);
      return;
    }
    handleFileUpload(acceptedFiles[0]);
  }, [handleFileUpload, handleFolderUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    multiple: true,
  });

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-purple-400 mb-4">
        🧪 FID Spectrum Analyzer
      </h2>

      <p className="text-slate-300 text-sm mb-4">
        Upload raw FID files (Bruker/Varian/JEOL) to visualize processed spectrum and compare with theoretical predictions.
      </p>
      <div className="mb-4">
        <label className="text-xs text-slate-400 mr-2">Authoritative Processing Preset</label>
        <select
          value={processingPreset}
          onChange={(e) => setProcessingPreset(e.target.value as FidProcessingPresetId)}
          className="bg-slate-700 text-slate-100 rounded px-2 py-1 text-xs border border-slate-600"
        >
          <option value="1H_standard">1H Standard</option>
          <option value="13C_standard">13C Standard</option>
          <option value="1H_mnova_parity">1H Mnova Parity</option>
          <option value="13C_mnova_parity">13C Mnova Parity</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragActive
            ? 'border-purple-400 bg-purple-900/20'
            : 'border-slate-600 hover:border-purple-500'
        }`}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
            <p className="text-purple-300 font-medium">Processing FID file...</p>
            <p className="text-slate-400 text-sm">
              Applying FFT, phase correction, baseline correction...
            </p>
          </div>
        ) : (
          <>
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-slate-300">
              Click to upload or drag and drop
            </p>
            <p className="text-[11px] text-emerald-300 mt-1">
              ✅ Authoritative observed pipeline (upload → process → reference/QC)
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Bruker (fid folder / zip), Varian (.fid), JEOL (.jdf)
            </p>

            <div className="flex gap-3 justify-center">
              <label htmlFor="fid-file-upload" className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition">
                📄 Dosya Seç (.jdf, .fid, .zip)
              </label>
              <label htmlFor="fid-folder-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition">
                📁 Klasör Seç (fid)
              </label>
            </div>

            {/* File Upload */}
            <input
              id="fid-file-upload"
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              accept=".fid,.jdf,.zip,application/octet-stream,application/zip"
            />

            {/* Folder Upload */}
            <input
              id="fid-folder-upload"
              type="file"
              className="hidden"
              // @ts-ignore - webkitdirectory is a valid HTML attribute
              webkitdirectory=""
              directory=""
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleFolderUpload(files);
                }
              }}
            />
          </>
        )}
      </div>

      {/* Upload Status */}
      {uploadStatus && (
        <div className="mt-4 bg-blue-900/30 border border-blue-500 rounded-lg p-4">
          <p className="text-blue-300 font-medium">⏳ {uploadStatus}</p>
          <p className="text-[11px] text-blue-200 mt-1">{stageLabels.join('  ->  ')}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-300 font-medium">❌ Hata</p>
          <p className="text-red-200 text-sm mt-1">{error}</p>
          {error.includes('FID_NOT_FOUND') && (
            <div className="mt-2 text-red-200 text-xs">
              <p>• Seçtiğiniz klasör Bruker dataset olmalı (*.fid veya */fid)</p>
              <p>• Klasör içinde "fid" dosyası bulunamadı</p>
              <p>• Eğer sadece pdata/ seçtiyseniz ham FID yoktur</p>
            </div>
          )}
        </div>
      )}

      {/* Spectrum Display */}
      {fidData && fidData.ppm && fidData.intensity && (
        <div className="mt-6">
          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-green-400 mb-4">📈 Processed Spectrum</h3>
            <SpectrumPlot
              ppm={fidData.ppm}
              intensity={fidData.intensity}
              title="FID Processed Spectrum"
              height={400}
            />
          </div>
        </div>
      )}

      {/* Metadata Display */}
      {fidData && (
        <div className="mt-6 space-y-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-green-400 mb-2">📊 Acquisition Parameters</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400">Spectrometer:</span>
                <span className="text-white ml-2 font-mono">{fidData.metadata.spectrometer_freq.toFixed(2)} MHz</span>
              </div>
              <div>
                <span className="text-slate-400">Spectral Width:</span>
                <span className="text-white ml-2 font-mono">{fidData.metadata.spectral_width.toFixed(2)} ppm</span>
              </div>
              <div>
                <span className="text-slate-400">Data Points:</span>
                <span className="text-white ml-2 font-mono">{fidData.metadata.data_points.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400">Detected Peaks:</span>
                <span className="text-white ml-2 font-mono">{fidData.peaks.length}</span>
              </div>
            </div>
          </div>

          {/* Comparison Summary */}
          {comparison && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-bold text-yellow-400 mb-2">🎯 Comparison with Theoretical</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Match Rate:</span>
                  <span className={`font-bold ${
                    comparison.match_rate > 0.8 ? 'text-green-400' :
                    comparison.match_rate > 0.5 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {(comparison.match_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Matched Peaks:</span>
                  <span className="text-green-400 font-mono">{comparison.summary.matched}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Impurity/Solvent Peaks:</span>
                  <span className="text-orange-400 font-mono">{comparison.summary.impurities}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Missing Theoretical:</span>
                  <span className="text-red-400 font-mono">{comparison.summary.missing}</span>
                </div>
              </div>
            </div>
          )}


          {/* Peak List */}
          {comparison && comparison.impurity_peaks.length > 0 && (
            <div className="bg-orange-900/30 border border-orange-500 rounded-lg p-4">
              <h3 className="text-lg font-bold text-orange-400 mb-2">⚠️ Detected Impurities/Solvent Peaks</h3>
              <div className="space-y-1 text-sm">
                {comparison.impurity_peaks.map((peak, idx) => (
                  <div key={idx} className="text-orange-200 font-mono">
                    δ {peak.ppm.toFixed(2)} ppm (height: {peak.height.toFixed(3)})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
