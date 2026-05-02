'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { NMRPeak, Carbon13Peak, FTIRPeak, MSPeak, Solvent } from '@/lib/types';
import { loadSettings, saveSettings, initializeDefaults } from '@/lib/utils/storage';
import { detectOverlappingPeaks, OverlappingPeak, normalizeIntegrationRatios, NormalizedIntegration } from '@/lib/utils/peakValidation';
import PeakInput from './PeakInput';
import Carbon13PeakInput from './Carbon13PeakInput';
import FTIRPeakInput from './FTIRPeakInput';
import MSPeakInput from './MSPeakInput';
import MultipletSkewingInfo from './MultipletSkewingInfo';
import FIDUploaderCompact from '@/components/fid/FIDUploaderCompact';
import { mapSpectroMindXToMnovaX } from '@/lib/nmr/mnovaBridge';
import { fidPickedPeaksToNmrSimulationPeaks } from '@/lib/utils/fidPeakToSimulation';
import { applyCarbon13Assignment } from '@/lib/nmr/carbon13/assignment';
import {
  defaultDomainForObservedModality,
  normalizeObservedExperimentType,
  spectrumTypeForObservedModality,
} from '@/lib/fid/modalityRouting';

// ✅ BulkInput lazy load (1054 satır = ~200KB tasarruf!)
const BulkInput = dynamic(() => import('./BulkInput'), {
  loading: () => (
    <div className="bg-slate-800/50 rounded p-3 animate-pulse">
      <div className="h-8 bg-slate-700 rounded"></div>
    </div>
  ),
  ssr: false // Client-side only
});

interface SidebarProps {
  peaks: NMRPeak[];
  carbon13Peaks?: Carbon13Peak[];
  ftirPeaks?: FTIRPeak[];
  msPeaks?: MSPeak[];
  onPeaksChange: (peaks: NMRPeak[]) => void;
  onCarbon13PeaksChange?: (peaks: Carbon13Peak[]) => void;
  onFtirPeaksChange?: (peaks: FTIRPeak[]) => void;
  onMsPeaksChange?: (peaks: MSPeak[]) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  spectrumType: 'nmr' | 'ftir' | 'c13' | 'ms';
  onSpectrumTypeChange: (type: 'nmr' | 'ftir' | 'c13' | 'ms') => void;
  solvent: string;
  onSolventChange: (solvent: string) => void;
  frequency: number;
  onFrequencyChange: (freq: number) => void;
  onKnownMoleculeChange?: (molecule: any) => void;
  /** FID pipeline başarılı olunca ana ¹H grafiğine turuncu gözlem katmanı */
  onObservedNmrOverlayChange?: (
    data: {
      ppm: number[];
      intensity: number[];
      qcSummary?: string;
      yScaleMode?: string;
      advisedPresetApplied?: string;
      defaultXPpm?: [number, number];
      experimentType?: '1H' | '13C';
      sessionId?: string;
      axisFallbackApplied?: boolean;
      axisFallbackReason?: string;
      qcRules?: Array<{ id: string; passed: boolean; severity: 'info' | 'warn' | 'fatal'; message: string }>;
      interpretationBlocked?: boolean;
    } | null
  ) => void;
  /** Gözlenen FID işlendiğinde ilgili NMR görünümüne geç (1H/13C) */
  onObservedNmrLoaded?: (target: 'nmr' | 'c13') => void;
  /** FID `peak_list` → ana grafikte Lorentzian pik simülasyonu (manuel pikleri ezmez; yalnızca çizgi kaynağı) */
  onFidSimulationPeaksChange?: (peaks: NMRPeak[] | null) => void;
}

const solvents: Record<Solvent, { res: number; water: number; label: string }> = {
  CDCl3: { res: 7.26, water: 1.56, label: 'Chloroform-d' },
  DMSO: { res: 2.5, water: 3.33, label: 'DMSO-d₆' },
  Acetone: { res: 2.05, water: 2.84, label: 'Acetone-d₆' },
  D2O: { res: 4.79, water: 4.79, label: 'D₂O' },
  MeOD: { res: 3.31, water: 4.87, label: 'Methanol-d₄' },
  C6D6: { res: 7.16, water: 0.40, label: 'Benzene-d₆' },
  CD2Cl2: { res: 5.32, water: 1.50, label: 'Dichloromethane-d₂' },
  CD3CN: { res: 1.94, water: 2.13, label: 'Acetonitrile-d₃' },
  'THF-d8': { res: 3.58, water: 2.40, label: 'Tetrahydrofuran-d₈' },
  'Toluene-d8': { res: 7.09, water: 0.40, label: 'Toluene-d₈' },
  'Pyridine-d5': { res: 8.74, water: 4.96, label: 'Pyridine-d₅' },
  'DMF-d7': { res: 8.03, water: 3.50, label: 'Dimethylformamide-d₇' },
  'AcOH-d4': { res: 11.65, water: 11.65, label: 'Acetic Acid-d₄' },
  'TFA-d': { res: 11.50, water: 11.50, label: 'Trifluoroacetic Acid-d' },
};

export default function Sidebar({
  peaks,
  carbon13Peaks = [],
  ftirPeaks = [],
  msPeaks = [],
  onPeaksChange,
  onCarbon13PeaksChange,
  onFtirPeaksChange,
  onMsPeaksChange,
  onAnalyze,
  isLoading,
  spectrumType,
  onSpectrumTypeChange,
  solvent,
  onSolventChange,
  frequency,
  onFrequencyChange,
  onKnownMoleculeChange,
  onObservedNmrOverlayChange,
  onObservedNmrLoaded,
  onFidSimulationPeaksChange,
}: SidebarProps) {
  const [inputMethod, setInputMethod] = useState<'manual' | 'grid'>('manual');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'chatgpt'>('chatgpt');
  const [model, setModel] = useState('deepseek-v4-pro');
  const [theoreticalPeaks, setTheoreticalPeaks] = useState<number[]>([]);

  useEffect(() => {
    initializeDefaults();
    const settings = loadSettings();
    const allowedModels = new Set(['deepseek-v4-pro', 'deepseek-v4-flash', 'gpt-4o']);
    const normalizedModel = allowedModels.has(settings.aiModel) ? settings.aiModel : 'deepseek-v4-pro';

    setAiProvider(settings.aiProvider);
    setModel(normalizedModel);
    if (settings.aiModel !== normalizedModel) {
      saveSettings({
        aiProvider: 'chatgpt',
        aiModel: normalizedModel,
      });
    }
  }, []);

  // 1H NMR peaklarından teorik peakler oluştur
  useEffect(() => {
    if (spectrumType === 'nmr' && peaks.length > 0) {
      const peakPPMs = peaks.map(p => p.shift);
      setTheoreticalPeaks(peakPPMs);
    }
  }, [peaks, spectrumType]);

  const handleAddPeak = () => {
    console.log('🔵 Peak Ekle butonuna tıklandı, spectrum type:', spectrumType);

    if (spectrumType === 'c13') {
      console.log('🔵 13C peak ekleniyor, mevcut peak sayısı:', carbon13Peaks.length);
      onCarbon13PeaksChange?.([...carbon13Peaks, { ppm: 0 }]);
      console.log('🔵 13C peak eklendi, yeni peak sayısı:', carbon13Peaks.length + 1);
    } else if (spectrumType === 'ftir') {
      console.log('🔵 FTIR peak ekleniyor, mevcut peak sayısı:', ftirPeaks.length);
      onFtirPeaksChange?.([...ftirPeaks, { wavenumber: 0, intensity: 50, type: 'medium', width: 50 }]);
      console.log('🔵 FTIR peak eklendi, yeni peak sayısı:', ftirPeaks.length + 1);
    } else if (spectrumType === 'ms') {
      console.log('🔵 MS peak ekleniyor, mevcut peak sayısı:', msPeaks.length);
      onMsPeaksChange?.([...msPeaks, { mz: 0, intensity: 0, assignment: 'Fragment', charge: 1 }]);
      console.log('🔵 MS peak eklendi, yeni peak sayısı:', msPeaks.length + 1);
    } else {
      console.log('🔵 1H NMR peak ekleniyor, mevcut peak sayısı:', peaks.length);
      onPeaksChange([...peaks, { shift: 0, integ: 1, mult: 's' }]);
      console.log('🔵 1H NMR peak eklendi, yeni peak sayısı:', peaks.length + 1);
    }
  };

  const handleBulkImport = (newPeaks: NMRPeak[]) => {
    onPeaksChange([...peaks, ...newPeaks]);
  };

  const handleUpdatePeak = (index: number, peak: NMRPeak) => {
    const newPeaks = [...peaks];
    newPeaks[index] = peak;
    onPeaksChange(newPeaks);
  };

  const handleRemovePeak = (index: number) => {
    onPeaksChange(peaks.filter((_, i) => i !== index));
  };

  const handleUpdateCarbon13Peak = (index: number, peak: Carbon13Peak) => {
    const newPeaks = [...carbon13Peaks];
    newPeaks[index] = peak;
    onCarbon13PeaksChange?.(newPeaks);
  };

  const handleRemoveCarbon13Peak = (index: number) => {
    onCarbon13PeaksChange?.(carbon13Peaks.filter((_, i) => i !== index));
  };

  const handleUpdateFtirPeak = (index: number, peak: FTIRPeak) => {
    const newPeaks = [...ftirPeaks];
    newPeaks[index] = peak;
    onFtirPeaksChange?.(newPeaks);
  };

  const handleRemoveFtirPeak = (index: number) => {
    onFtirPeaksChange?.(ftirPeaks.filter((_, i) => i !== index));
  };

  const handleUpdateMsPeak = (index: number, peak: MSPeak) => {
    const newPeaks = [...msPeaks];
    newPeaks[index] = peak;
    onMsPeaksChange?.(newPeaks);
  };

  const handleRemoveMsPeak = (index: number) => {
    onMsPeaksChange?.(msPeaks.filter((_, i) => i !== index));
  };

  // Clear all peaks for current spectrum type
  const handleClearAllPeaks = () => {
    if (spectrumType === 'nmr') {
      onPeaksChange([]);
    } else if (spectrumType === 'c13') {
      onCarbon13PeaksChange?.([]);
    } else if (spectrumType === 'ftir') {
      onFtirPeaksChange?.([]);
    } else if (spectrumType === 'ms') {
      onMsPeaksChange?.([]);
    }
  };

  // ✅ Memoize: Detect overlapping peaks for NMR (30-40% daha hızlı re-render!)
  const overlappingPeaks: OverlappingPeak[] = useMemo(() => {
    return spectrumType === 'nmr' && peaks.length > 0
      ? detectOverlappingPeaks(peaks)
      : [];
  }, [spectrumType, peaks]); // Sadece spectrum type veya peaks değişince hesapla

  // ✅ Memoize: Check integration ratio normalization for NMR
  const integrationNormalization: NormalizedIntegration | null = useMemo(() => {
    return spectrumType === 'nmr' && peaks.length > 1
      ? normalizeIntegrationRatios(peaks.map(p => p.integ))
      : null;
  }, [spectrumType, peaks]);

  // Handler for normalizing integration values
  const handleNormalizeIntegrations = () => {
    if (integrationNormalization && integrationNormalization.shouldNormalize) {
      const normalizedPeaks = peaks.map((peak, idx) => ({
        ...peak,
        integ: integrationNormalization.normalized[idx]
      }));
      onPeaksChange(normalizedPeaks);
    }
  };

  const openTesterPage = () => {
    window.open('/api/tester-app', '_blank', 'noopener,noreferrer');
  };

  return (
    <aside
      className="h-full w-full bg-slate-800 border-r border-slate-700 flex flex-col shadow-xl @container"
      role="complementary"
      aria-label="Spectroscopy analysis settings"
    >
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Header */}
        <header className="pb-2 border-b border-slate-700 grid grid-cols-3 items-center gap-2">
          <h1 className="text-lg @sm:text-xl @md:text-2xl @lg:text-3xl font-bold text-sky-400 tracking-wide">
            SpectroMind v19.0
          </h1>
          <button
            type="button"
            onClick={openTesterPage}
            className="justify-self-center px-3 py-1 text-xs @sm:text-sm font-semibold rounded-md border border-cyan-600 text-cyan-300 hover:text-cyan-200 hover:border-cyan-500 hover:bg-slate-700/50 transition-colors"
          >
            Tester
          </button>
          <Link href="/simulate" className="justify-self-end text-sky-400 hover:text-sky-300 text-sm whitespace-nowrap">Simülasyon</Link>
        </header>

      {/* API Configuration */}
      <section className="space-y-2" aria-labelledby="ai-config-heading">
        <h2 id="ai-config-heading" className="text-xs @sm:text-sm @lg:text-base font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Image
            src="/setting.png"
            alt="Settings"
            width={20}
            height={20}
            className="w-3.5 h-3.5 @sm:w-4 @sm:h-4 @lg:w-5 @lg:h-5"
            priority
          />
          AI Yapılandırma
        </h2>

        <div>
          <label className="text-xs @sm:text-sm @lg:text-base text-slate-400 mb-1 block">AI Model</label>
          <select
            value={model}
            onChange={(e) => {
              const newModel = e.target.value;
              setModel(newModel);
              saveSettings({
                aiProvider: 'chatgpt',
                aiModel: newModel
              });
            }}
            className="w-full bg-slate-900 border border-slate-600 text-white px-2 py-1.5 rounded text-[10px] @sm:text-xs @lg:text-sm"
          >
            <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
            <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
            <option value="gpt-4o">GPT-4o</option>
          </select>
        </div>
      </section>

      {/* Spectrum Settings */}
      <section className="space-y-2" aria-labelledby="spectrum-settings-heading">
        <h2 id="spectrum-settings-heading" className="text-[10px] @sm:text-xs @lg:text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Image
            src="/science.png"
            alt="Science"
            width={20}
            height={20}
            className="w-3.5 h-3.5 @sm:w-4 @sm:h-4 @lg:w-5 @lg:h-5"
            priority
          />
          Spektrum Ayarları
        </h2>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Spektrum Tipi</label>
          <select
            value={spectrumType}
            onChange={(e) => onSpectrumTypeChange(e.target.value as 'nmr' | 'ftir' | 'c13' | 'ms')}
            className="w-full bg-slate-900 border border-slate-600 text-white px-2 py-1.5 rounded text-[10px] @sm:text-xs @lg:text-sm"
          >
            <option value="nmr">1H NMR Spektroskopisi</option>
            <option value="c13">13C NMR Spektroskopisi</option>
            <option value="ftir">FTIR Spektroskopisi</option>
            <option value="ms">MS (Kütle Spektrometrisi)</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Çözücü (Solvent)</label>
          <select
            value={solvent}
            onChange={(e) => onSolventChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white px-2 py-1.5 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={spectrumType === 'ftir' || spectrumType === 'ms'}
          >
            {Object.entries(solvents).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Spektrometre Frekansı (MHz)</label>
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-600 text-white px-2 py-1.5 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={spectrumType === 'ftir' || spectrumType === 'ms'}
          >
            <option value={300}>300 MHz</option>
            <option value={400}>400 MHz</option>
            <option value={500}>500 MHz</option>
            <option value={600}>600 MHz</option>
          </select>
        </div>
      </section>

      {/* Bulk Input */}
      <BulkInput
        onPeaksImport={handleBulkImport}
        onCarbon13PeaksImport={(peaks) => onCarbon13PeaksChange?.(peaks)}
        onFtirPeaksImport={(peaks) => onFtirPeaksChange?.(peaks)}
        onAnalyze={onAnalyze}
        spectrumType={spectrumType as 'nmr' | 'ftir' | 'c13'}
        onKnownMoleculeChange={onKnownMoleculeChange}
      />

      {/* Chemical Equivalence Warnings */}
      {overlappingPeaks.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-500 rounded p-2 space-y-1.5" role="alert" aria-labelledby="overlap-warning">
          <div id="overlap-warning" className="text-yellow-300 text-xs @sm:text-sm @lg:text-base font-bold">⚠️ Overlapping Peaks Detected</div>
          {overlappingPeaks.map((overlap, idx) => (
            <div key={idx} className="text-[10px] @sm:text-xs text-yellow-200 space-y-0.5">
              <div>δ {overlap.shift.toFixed(2)} ppm ({overlap.count} peaks)</div>
              <div className="text-slate-300">→ {overlap.suggestion}</div>
            </div>
          ))}
        </div>
      )}

      {/* Integration Normalization Suggestion */}
      {integrationNormalization && integrationNormalization.shouldNormalize && (
        <div className="bg-blue-900/30 border border-blue-500 rounded p-2 space-y-1.5" role="alert" aria-labelledby="normalization-suggestion">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 space-y-0.5">
              <div id="normalization-suggestion" className="text-blue-300 text-xs @sm:text-sm @lg:text-base font-bold">💡 Integration Ratio Suggestion</div>
              <div className="text-[10px] @sm:text-xs text-blue-200">
                {integrationNormalization.suggestion}
              </div>
            </div>
            <button
              onClick={handleNormalizeIntegrations}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[10px] @sm:text-xs font-bold transition whitespace-nowrap"
              aria-label="Normalize integration values"
            >
              Normalize
            </button>
          </div>
        </div>
      )}

      {/* Multiplet Skewing Info - Only show for NMR with J values */}
      {spectrumType === 'nmr' && peaks.some(p => p.coupling && (Array.isArray(p.coupling) ? p.coupling.some(j => j > 0) : p.coupling > 0)) && (
        <MultipletSkewingInfo />
      )}

      {/* Peak List */}
      <section className="flex flex-col gap-2" aria-labelledby="peaks-heading">
        <div className="flex justify-between items-center">
          <h2 id="peaks-heading" className="text-[10px] @sm:text-xs @lg:text-sm font-bold text-slate-400 uppercase tracking-wider">
            📊 {spectrumType === 'nmr' ? '1H NMR' : spectrumType === 'c13' ? '13C NMR' : spectrumType === 'ftir' ? 'FTIR' : 'MS'} Peaks
          </h2>
          <div className="flex gap-1">
            <button
              onClick={handleAddPeak}
              className="bg-sky-600 hover:bg-sky-700 text-white px-2 py-1 rounded text-[10px] @sm:text-xs @lg:text-sm font-bold transition"
              aria-label="Add new peak"
            >
              + Peak
            </button>
            {((spectrumType === 'nmr' && peaks.length > 0) ||
              (spectrumType === 'c13' && carbon13Peaks.length > 0) ||
              (spectrumType === 'ftir' && ftirPeaks.length > 0) ||
              (spectrumType === 'ms' && msPeaks.length > 0)) && (
              <button
                onClick={handleClearAllPeaks}
                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] @sm:text-xs @lg:text-sm font-bold transition"
                aria-label="Clear all peaks"
                title="Tüm peak'leri sil"
              >
                🗑️ Tümünü Sil
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[180px] overflow-y-auto bg-slate-900 border border-slate-700 p-2 rounded space-y-1.5">
          {spectrumType === 'nmr' && (
            peaks.length === 0 ? (
              <p className="text-slate-500 text-[10px] @sm:text-xs @lg:text-sm text-center py-3">Peak eklenmedi</p>
            ) : (
              peaks.map((peak, index) => (
                <PeakInput
                  key={index}
                  peak={peak}
                  index={index}
                  onUpdate={handleUpdatePeak}
                  onRemove={handleRemovePeak}
                />
              ))
            )
          )}

          {spectrumType === 'c13' && (
            carbon13Peaks.length === 0 ? (
              <p className="text-slate-500 text-[10px] @sm:text-xs @lg:text-sm text-center py-3">Peak eklenmedi</p>
            ) : (
              carbon13Peaks.map((peak, index) => (
                <Carbon13PeakInput
                  key={index}
                  peak={peak}
                  index={index}
                  onUpdate={handleUpdateCarbon13Peak}
                  onRemove={handleRemoveCarbon13Peak}
                />
              ))
            )
          )}

          {spectrumType === 'ftir' && (
            ftirPeaks.length === 0 ? (
              <p className="text-slate-500 text-[10px] @sm:text-xs @lg:text-sm text-center py-3">Peak eklenmedi</p>
            ) : (
              ftirPeaks.map((peak, index) => (
                <FTIRPeakInput
                  key={index}
                  peak={peak}
                  index={index}
                  onUpdate={handleUpdateFtirPeak}
                  onRemove={handleRemoveFtirPeak}
                />
              ))
            )
          )}

          {spectrumType === 'ms' && (
            msPeaks.length === 0 ? (
              <p className="text-slate-500 text-[10px] @sm:text-xs @lg:text-sm text-center py-3">Peak eklenmedi</p>
            ) : (
              msPeaks.map((peak, index) => (
                <MSPeakInput
                  key={index}
                  peak={peak}
                  index={index}
                  onUpdate={handleUpdateMsPeak}
                  onRemove={handleRemoveMsPeak}
                />
              ))
            )
          )}
        </div>
      </section>

      {/* Peak List Summary */}
      {spectrumType === 'nmr' && peaks.length > 0 && (
        <section className="border-t border-slate-700 pt-4" aria-labelledby="peak-list-heading">
          <h2 id="peak-list-heading" className="text-[10px] @sm:text-xs @lg:text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
            📋 Peak Listesi
          </h2>
          <div className="bg-slate-900 border border-slate-700 p-2 rounded space-y-1 max-h-[200px] overflow-y-auto">
            {peaks.map((peak, index) => {
              const jValueStr = Array.isArray(peak.coupling)
                ? `J=${peak.coupling.map(v => v.toFixed(1)).join(', ')} Hz`
                : peak.coupling
                ? `J=${peak.coupling.toFixed(1)} Hz`
                : '';
              const broadStr = peak.isBroad ? ' (br)' : '';
              return (
                <div
                  key={index}
                  className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1 rounded"
                >
                  δ {peak.shift.toFixed(2)} ({peak.mult}{broadStr}, {peak.integ}H){jValueStr ? `, ${jValueStr}` : ''}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FTIR Peak List Summary */}
      {spectrumType === 'ftir' && ftirPeaks.length > 0 && (
        <section className="border-t border-slate-700 pt-4" aria-labelledby="ftir-peak-list-heading">
          <h2 id="ftir-peak-list-heading" className="text-[10px] @sm:text-xs @lg:text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
            📋 Peak Listesi
          </h2>
          <div className="bg-slate-900 border border-slate-700 p-2 rounded space-y-1 max-h-[200px] overflow-y-auto">
            {ftirPeaks.map((peak, index) => {
              const assignmentStr = peak.assignment ? ` → ${peak.assignment}` : '';
              return (
                <div
                  key={index}
                  className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1 rounded"
                >
                  {peak.wavenumber.toFixed(0)} cm⁻¹ ({peak.type || 'medium'}, {peak.intensity || 0}){assignmentStr}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* MS Peak List Summary */}
      {spectrumType === 'ms' && msPeaks.length > 0 && (
        <section className="border-t border-slate-700 pt-4" aria-labelledby="ms-peak-list-heading">
          <h2 id="ms-peak-list-heading" className="text-[10px] @sm:text-xs @lg:text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
            📋 Peak Listesi
          </h2>
          <div className="bg-slate-900 border border-slate-700 p-2 rounded space-y-1 max-h-[200px] overflow-y-auto">
            {msPeaks.map((peak, index) => {
              const formulaStr = peak.formula ? ` (${peak.formula})` : '';
              return (
                <div
                  key={index}
                  className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1 rounded"
                >
                  m/z {peak.mz?.toFixed(2) || '0.00'} ({peak.assignment || 'N/A'}, {peak.intensity?.toFixed(1) || '0'}%){formulaStr}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Carbon-13 Peak List Summary */}
      {spectrumType === 'c13' && carbon13Peaks.length > 0 && (
        <section className="border-t border-slate-700 pt-4" aria-labelledby="c13-peak-list-heading">
          <h2 id="c13-peak-list-heading" className="text-[10px] @sm:text-xs @lg:text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
            📋 Peak Listesi
          </h2>
          <div className="bg-slate-900 border border-slate-700 p-2 rounded space-y-1 max-h-[200px] overflow-y-auto">
            {carbon13Peaks.map((peak, index) => {
              const carbonTypeStr = peak.carbonType ? ` (${peak.carbonType})` : '';
              const assignmentStr = peak.assignment ? ` → ${peak.assignment}` : '';
              return (
                <div
                  key={index}
                  className="text-[10px] @sm:text-xs text-slate-300 font-mono bg-slate-800/50 px-2 py-1 rounded"
                >
                  δ {peak.ppm.toFixed(2)} ppm{carbonTypeStr}{assignmentStr}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FID Analyzer Section */}
      <section className="border-t border-slate-700 pt-4">
        <FIDUploaderCompact
          solvent={solvent}
          theoreticalPeaks={theoreticalPeaks}
          onProcessingComplete={(data, comparison) => {
            console.log('FID Processing complete:', data);
            if (comparison) {
              console.log('Comparison:', comparison);
            }
          }}
          onFidApiResult={(env) => {
            if (
              env.success &&
              env.observed_spectrum?.x?.length &&
              env.observed_spectrum?.y?.length
            ) {
              const obs = env.observed_spectrum;
              const modality = normalizeObservedExperimentType(obs.experiment_type);
              const targetSpectrumType = spectrumTypeForObservedModality(modality);
              console.groupCollapsed('[FID Modalite Routing Debug]');
              console.log('selectedSpectrumType_before_routing', spectrumType);
              console.log('detected_modality_from_fid', modality);
              console.log('manifest.modality', obs.modality);
              console.log('manifest.nucleus', obs.experiment_type);
              console.log('store_target_key', modality === '13C' ? 'observedNmrOverlayC13' : 'observedNmrOverlayH1');
              console.log('chart_selector_target', targetSpectrumType === 'c13' ? 'Carbon13Chart' : 'NMRChart');
              console.log('peak_list_selector_target', targetSpectrumType === 'c13' ? 'carbon13Peaks' : 'peaks');
              console.log('preview_selector_target', 'FIDUploaderCompact.observed_spectrum');
              console.log(
                'empty_state_will_be_ignored',
                modality === '13C' && Boolean(obs.x.length && obs.y.length)
              );
              console.groupEnd();
              onObservedNmrLoaded?.(targetSpectrumType as 'nmr' | 'c13');
              const q = env.observed_spectrum.quality;
              const qcSummary = [
                q?.overallStatus,
                q?.phaseFailedHeuristic ? 'faz şüpheli' : null,
                q?.intensityScaleMode ? `ölçek:${q.intensityScaleMode}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              const rawPicks =
                obs.peaks?.length ? obs.peaks : env.peak_list?.length ? env.peak_list : [];
              const maxArea = Math.max(...rawPicks.map((p) => Number(p.area || 0)), 1e-9);
              const authoritativeNmrPeaks: NMRPeak[] = rawPicks.map((p) => ({
                shift: Number(p.position),
                integ: Number((Math.max(0.2, Number(p.area || 0) / maxArea * 3)).toFixed(2)),
                mult: 'unresolved_multiplet',
                fidPickIntensity: p.intensity,
                fidPickArea: p.area,
                fidRegionId: (p as any).region_id,
                fidOverlapFlag: Boolean((p as any).overlap_flag),
                fidLinewidthEstimate: Number((p as any).linewidth_estimate ?? 0) || undefined,
                fidShapeModel: (p as any).shape_model,
                fidFitResidual: Number((p as any).fit_residual ?? 0) || undefined,
                fidConfidence: Number((p as any).confidence ?? 0) || undefined,
                hideChartLabel: true,
                label: `FID δ${Number(p.position).toFixed(3)}`,
              }));
              const authoritativeC13Peaks: Carbon13Peak[] = rawPicks.map((p, idx) => ({
                id: `obs-c13-${idx}-${Number(p.position).toFixed(3)}`,
                ppm: Number(p.position),
                intensity: Number(p.intensity ?? 0),
                assignment: `FID δ${Number(p.position).toFixed(2)}`,
              })).map((peak) => applyCarbon13Assignment(peak, solvent));
              const hasAromaticOrDownfield = rawPicks.some((p) => p.position >= 6.0);
              const hasAliphatic = rawPicks.some((p) => p.position >= 0.7 && p.position <= 2.3);
              const helperLowConfidence = !(hasAromaticOrDownfield && hasAliphatic);
              if (modality === '13C') {
                onFidSimulationPeaksChange?.(null);
                onCarbon13PeaksChange?.(authoritativeC13Peaks);
              } else {
                const simPeaks =
                  !helperLowConfidence && rawPicks.length > 0
                    ? fidPickedPeaksToNmrSimulationPeaks(rawPicks)
                    : [];
                onFidSimulationPeaksChange?.(simPeaks);
                if (peaks.length === 0) {
                  if (authoritativeNmrPeaks.length > 0) {
                    onPeaksChange(authoritativeNmrPeaks);
                  } else {
                    onPeaksChange([]);
                  }
                }
              }

              onObservedNmrOverlayChange?.({
              ppm: obs.x,
              intensity: obs.y,
              qcSummary: qcSummary || undefined,
              yScaleMode: obs.current_scale_mode || obs.quality?.intensityScaleMode,
              advisedPresetApplied: String(
                ((obs.processing as Record<string, unknown> | undefined)?.advised_preset_applied as string | undefined) ||
                  ''
              ),
              defaultXPpm: obs.default_display_range_ppm ?? env.default_x_range_ppm ?? defaultDomainForObservedModality(modality),
              experimentType: modality,
              sessionId: env.debug_id,
              solventHint: (env.data as Record<string, any>)?.metadata?.solvent_hint as string | undefined,
              sourceFormat: (env.data as Record<string, any>)?.metadata?.source_format as string | undefined,
              referenceMode: (env.data as Record<string, any>)?.metadata?.reference_mode as string | undefined,
              sourcePackageComplete: (env.data as Record<string, any>)?.metadata?.source_package_complete !== false,
                axisFallbackApplied:
                  obs.provenance?.axis_status === 'uncertain' ||
                  env.warnings?.some((w) => String(w).includes('AXIS_UNCERTAIN')) ||
                  false,
                axisFallbackReason:
                  obs.provenance?.axis_status === 'uncertain'
                    ? 'invalid ppm metadata / processed axis unavailable'
                    : env.warnings?.find((w) => String(w).includes('AXIS_UNCERTAIN')) || undefined,
                qcRules: obs.quality?.qc_rules,
                interpretationBlocked: obs.quality?.interpretation_blocked,
              } as any);

              try {
                const ox = obs.x || [];
                const oy = obs.y || [];
                const ppmRaw = Array.isArray(env.data?.ppm) ? env.data.ppm : [];
                const ppmRef = Array.isArray((env.data as any)?.ppm_axis_referenced)
                  ? ((env.data as any).ppm_axis_referenced as number[])
                  : [];
                const take = 20;
                console.groupCollapsed('[Observed Axis Diagnostics]');
                console.log('ppm_axis_raw_first20', ppmRaw.slice(0, take));
                console.log('ppm_axis_raw_last20', ppmRaw.slice(-take));
                console.log('ppm_axis_referenced_first20', ppmRef.slice(0, take));
                console.log('ppm_axis_referenced_last20', ppmRef.slice(-take));
                console.log(
                  'ppm_axis_referenced_descending',
                  ppmRef.length > 1 ? ppmRef[0] > ppmRef[ppmRef.length - 1] : null
                );
                console.log('x_first20', ox.slice(0, take));
                console.log('x_last20', ox.slice(-take));
                console.log(
                  'debug_mnova_bridge_x_first20',
                  ox.slice(0, take).map((v) => mapSpectroMindXToMnovaX(Number(v)))
                );
                console.log(
                  'debug_mnova_bridge_x_last20',
                  ox.slice(-take).map((v) => mapSpectroMindXToMnovaX(Number(v)))
                );
                console.log('y_first20', oy.slice(0, take));
                console.log('y_last20', oy.slice(-take));
                console.log('x_len', ox.length, 'y_len', oy.length);
                console.log('x_descending', ox.length > 1 ? ox[0] > ox[ox.length - 1] : null);
                console.log(
                  'ref_standard',
                  (obs.processing as Record<string, unknown> | undefined)?.reference_standard
                );
                console.log(
                  'ref_offset_ppm',
                  ((obs.processing as Record<string, unknown> | undefined)?.reference as Record<string, unknown> | undefined)?.offset_ppm_applied
                );
                console.groupEnd();
              } catch {
                // no-op diagnostics
              }
            } else if (!env.success) {
              onObservedNmrOverlayChange?.(null);
              onFidSimulationPeaksChange?.(null);
            }
          }}
        />
      </section>
      </div>

      {/* Sticky Analyze Button */}
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <button
          onClick={onAnalyze}
          disabled={isLoading || (spectrumType === 'nmr' ? peaks.length === 0 : spectrumType === 'c13' ? carbon13Peaks.length === 0 : spectrumType === 'ftir' ? ftirPeaks.length === 0 : msPeaks.length === 0)}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-bold text-xs @sm:text-sm @lg:text-base transition flex items-center justify-center gap-2 shadow-lg"
          aria-label={isLoading ? "Analyzing spectrum" : "Analyze spectrum with AI"}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading"></div>
              <span>Analiz ediliyor...</span>
            </>
          ) : (
            <>
              <Image
                src="/robot.png"
                alt="AI Robot"
                width={20}
                height={20}
                className={`w-4 h-4 @sm:w-5 @sm:h-5 ${(spectrumType === 'nmr' ? peaks.length === 0 : spectrumType === 'c13' ? carbon13Peaks.length === 0 : ftirPeaks.length === 0) ? '' : 'brightness-0'}`}
              />
              <span>AI ile Analiz Et</span>
            </>
          )}
        </button>
      </div>

    </aside>
  );
}
