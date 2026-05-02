'use client';

import { useFIDUpload, type FidProcessingPresetId } from '@/lib/hooks/useFIDUpload';
import type { FidProcessApiEnvelope } from '@/lib/fid/buildFidProcessResponse';
import SpectrumPlot from '@/components/fid/SpectrumPlot';
import AuthorityBadge from '@/components/common/AuthorityBadge';

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

interface FIDUploaderCompactProps {
  theoreticalPeaks?: number[];
  solvent?: string;
  onProcessingComplete?: (data: FIDData, comparison?: ComparisonData) => void;
  onFidApiResult?: (envelope: FidProcessApiEnvelope) => void;
}

/**
 * Compact FID Uploader for Sidebar
 * Uses useFIDUpload hook for shared logic (Composition over Inheritance)
 */
const PHASE_LABEL: Record<string, string> = {
  uploading: 'Klasör yükleniyor…',
  processing: 'Ham veri işleniyor (FFT/faz)…',
  validating: 'Spektrum doğrulanıyor…',
};

export default function FIDUploaderCompact({
  theoreticalPeaks,
  solvent,
  onProcessingComplete,
  onFidApiResult,
}: FIDUploaderCompactProps) {
  const {
    phase,
    isProcessing,
    comparison,
    error,
    lastEnvelope,
    fidData,
    processingPreset,
    setProcessingPreset,
    handleFileUpload,
    handleFolderUpload,
  } =
    useFIDUpload({
      theoreticalPeaks,
      solventHint: solvent,
      onProcessingComplete,
      onFidApiResult,
    });

  const observedPpm = lastEnvelope?.observed_spectrum?.x ?? fidData?.ppm ?? [];
  const observedIntensity = lastEnvelope?.observed_spectrum?.y ?? fidData?.intensity ?? [];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
        🧪 FID Analyzer
      </h3>
      <AuthorityBadge
        label={fidData ? 'AUTHORITATIVE_OBSERVED_FID' : 'DISPLAY_ONLY_FALLBACK'}
        tone={fidData ? 'authoritative' : 'fallback'}
      />
      <div className="rounded border border-slate-700 bg-slate-900/50 p-2">
        <label className="block text-[10px] text-slate-400 mb-1">Authoritative Processing Preset</label>
        <select
          value={processingPreset}
          onChange={(e) => setProcessingPreset(e.target.value as FidProcessingPresetId)}
          disabled={isProcessing}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200"
        >
          <option value="1H_standard">1H Standard (Mnova-style advised)</option>
          <option value="13C_standard">13C Standard (Mnova-style advised)</option>
          <option value="1H_mnova_parity">1H Mnova Parity</option>
          <option value="13C_mnova_parity">13C Mnova Parity</option>
          <option value="custom">Custom (override-ready)</option>
        </select>
      </div>

      {isProcessing ? (
        <div className="border-2 border-dashed border-purple-400 bg-purple-900/20 rounded p-3 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mx-auto"></div>
          <p className="text-purple-300 text-xs mt-1">{PHASE_LABEL[phase] || 'İşleniyor…'}</p>
          <p className="text-slate-500 text-[10px] mt-1">Gözlenen spektrum (teorikten ayrı)</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* File Upload Button - JEOL .jdf files */}
          <label
            htmlFor="fid-file-compact"
            className="block border-2 border-dashed rounded p-2 text-center cursor-pointer transition-colors border-slate-600 hover:border-purple-500"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-300 text-xs">📄 JEOL/ZIP Dosya (.jdf/.zip)</p>
            </div>
            <input
              id="fid-file-compact"
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              accept=".jdf,.fid,.zip,application/octet-stream,application/zip"
            />
          </label>

          {/* Folder Upload Button - Bruker/Varian .fid folders */}
          <label
            htmlFor="fid-folder-compact"
            className="block border-2 border-dashed rounded p-2 text-center cursor-pointer transition-colors border-slate-600 hover:border-blue-500"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-slate-300 text-xs">📁 Bruker/Varian Klasör</p>
            </div>
            <p className="text-slate-400 text-[10px] mt-1">(fid, .fid uzantılı klasörler)</p>
            <input
              id="fid-folder-compact"
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleFolderUpload(files);
                }
                e.target.value = '';
              }}
              {...({ webkitdirectory: '', directory: '' } as any)}
            />
          </label>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500 rounded p-2 space-y-1">
          <p className="text-red-300 text-xs">{error}</p>
          {lastEnvelope?.error_code && (
            <p className="text-red-200/80 text-[10px] font-mono">Kod: {lastEnvelope.error_code}</p>
          )}
          {lastEnvelope?.debug_id && (
            <p className="text-slate-500 text-[10px] font-mono">debug_id: {lastEnvelope.debug_id}</p>
          )}
          {lastEnvelope?.debug_export?.processing_recipe_provenance?.advised_preset_applied && (
            <p className="text-slate-400 text-[10px]">
              preset: {lastEnvelope.debug_export.processing_recipe_provenance.advised_preset_applied}
            </p>
          )}
        </div>
      )}

      {observedPpm.length > 0 && observedIntensity.length > 0 && (
        <div className="rounded border border-emerald-700/50 bg-slate-900/60 p-2">
          <p className="text-emerald-400 text-[10px] font-semibold mb-1">
            {lastEnvelope?.observed_spectrum?.experiment_type === '13C' ? 'Gözlenen ¹³C (FID)' : 'Gözlenen ¹H (FID)'}
          </p>
          <div className="h-36">
            <SpectrumPlot
              ppm={observedPpm}
              intensity={observedIntensity}
              title=""
              height={140}
              defaultXPpm={lastEnvelope?.observed_spectrum?.default_display_range_ppm}
              experimentType={lastEnvelope?.observed_spectrum?.experiment_type}
              axisFallbackApplied={lastEnvelope?.observed_spectrum?.axis_fallback_applied}
              axisFallbackReason={lastEnvelope?.observed_spectrum?.axis_fallback_reason}
            />
          </div>
        </div>
      )}

      {comparison && (
        <div className="bg-slate-700/50 rounded p-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Match:</span>
            <span className={`font-bold ${
              comparison.match_rate > 0.8 ? 'text-green-400' :
              comparison.match_rate > 0.5 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {(comparison.match_rate * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Impurities:</span>
            <span className="text-orange-400">{comparison.summary.impurities}</span>
          </div>
        </div>
      )}
    </div>
  );
}
