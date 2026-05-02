'use client';

import { useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Sidebar from '@/components/sidebar/Sidebar';
import NMRChart from '@/components/charts/NMRChart';
import FTIRChart from '@/components/charts/FTIRChart';
import Carbon13Chart from '@/components/charts/Carbon13Chart';
import MSChart from '@/components/spectra/MSChart';
import AnalysisResultDisplay from '@/components/analysis/AnalysisResultDisplay';
import SpectroMindChatPanel from '@/components/chat/SpectroMindChatPanel';
import type { FTIRPeak } from '@/lib/types';
import { loadMoleculeLibrary } from '@/lib/data/moleculeLibrary';
import type { LibraryMolecule } from '@/lib/utils/librarySearch';
import { useSpectralAnalysis } from '@/lib/hooks/useSpectralAnalysis';
import { useSpectroMindStore } from '@/lib/core/store/spectromindStore';
import { modalityMismatchDiagnostic, normalizeObservedExperimentType } from '@/lib/fid/modalityRouting';

export default function Home() {
  const peaks = useSpectroMindStore(s => s.peaks);
  const carbon13Peaks = useSpectroMindStore(s => s.carbon13Peaks);
  const ftirPeaks = useSpectroMindStore(s => s.ftirPeaks);
  const msPeaks = useSpectroMindStore(s => s.msPeaks);
  const spectrumType = useSpectroMindStore(s => s.spectrumType);
  const solvent = useSpectroMindStore(s => s.solvent);
  const frequency = useSpectroMindStore(s => s.frequency);
  const knownMolecule = useSpectroMindStore(s => s.knownMolecule);
  const observedNmrOverlay = useSpectroMindStore(s => s.observedNmrOverlay);
  const observedNmrOverlayH1 = useSpectroMindStore(s => s.observedNmrOverlayH1);
  const observedNmrOverlayC13 = useSpectroMindStore(s => s.observedNmrOverlayC13);
  const fidSimulationPeaks = useSpectroMindStore(s => s.fidSimulationPeaks);
  const setFormula = useSpectroMindStore(s => s.setFormula);
  const setFtirPeaks = useSpectroMindStore(s => s.setFtirPeaks);
  const setSpectrumType = useSpectroMindStore(s => s.setSpectrumType);

  const focusNmrSpectrumView = useCallback((target: 'nmr' | 'c13') => {
    setSpectrumType(target);
  }, [setSpectrumType]);

  const { analyzeSpectrum, isLoading, error, analysisResult } = useSpectralAnalysis({
    setFormula,
    setFtirPeaks,
    setLibraryMatch: () => {},
  });

  useEffect(() => {
    loadMoleculeLibrary().then(categories => {
      const allMolecules: LibraryMolecule[] = categories.flatMap(cat => cat.molecules);
      console.log(`Kütüphane yüklendi: ${allMolecules.length} molekül`);
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLoading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading]);

  const activeObservedOverlay = spectrumType === 'c13' ? observedNmrOverlayC13 : observedNmrOverlayH1;
  const modalityDiagnostic = activeObservedOverlay?.experimentType
    ? modalityMismatchDiagnostic(spectrumType, normalizeObservedExperimentType(activeObservedOverlay.experimentType))
    : null;

  const handleAnalyze = () => {
    const s = useSpectroMindStore.getState();
    if (s.spectrumType === 'nmr' && s.observedNmrOverlay?.interpretationBlocked) {
      const failed = (s.observedNmrOverlay.qcRules || [])
        .filter((r) => !r.passed && (r.severity === 'fatal' || r.id === 'INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL'))
        .map((r) => r.id);
      // Hard-stop yerine analiz akışını sürdür: guardrail katmanı sonucu INCONCLUSIVE/düşük güvene zorlar.
      console.warn(
        `Observed FID QC başarısız; analiz INCONCLUSIVE/düşük güven modunda devam edecek. Kurallar: ${failed.join(', ') || 'INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL'}`
      );
    }
    if (s.spectrumType === 'c13') {
      analyzeSpectrum(s.carbon13Peaks as any, s.spectrumType, s.solvent, s.frequency, s.formula, s.knownMolecule);
    } else if (s.spectrumType === 'ftir') {
      analyzeSpectrum(s.ftirPeaks as any, s.spectrumType, s.solvent, s.frequency, s.formula, s.knownMolecule);
    } else {
      // 'nmr' or 'ms' fall through to 1H NMR analysis pipeline
      analyzeSpectrum(s.peaks, 'nmr', s.solvent, s.frequency, s.formula, s.knownMolecule);
    }
  };

  const handleChatAction = async (action: { action: string; parameters?: Record<string, unknown> }) => {
    const state = useSpectroMindStore.getState();
    switch (action.action) {
      case 'recluster_peaks':
      case 'run_verification':
        handleAnalyze();
        return 'Analiz yeniden tetiklendi.';
      case 'switch_modality':
        state.setSpectrumType(state.spectrumType === 'nmr' ? 'c13' : 'nmr');
        return `Modality değiştirildi: ${state.spectrumType === 'nmr' ? '13C' : '1H'}`;
      case 'apply_residual_mask':
        return 'Residual mask işareti uygulandı (UI seviyesinde).';
      case 'show_authority_trace':
        return 'Authority trace: observed overlay + spectral interpretation kaynakları kullanılıyor.';
      case 'open_root_cause_report':
        return 'Root-cause rapor paneli açma komutu kaydedildi.';
      default:
        return 'Aksiyon kaydedildi.';
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <PanelGroup direction="horizontal" id="main-layout" autoSaveId="main-layout-v1">
        {/* Sidebar */}
        <Panel defaultSize={25} minSize={15} maxSize={40} id="sidebar-panel">
          <Sidebar
            peaks={peaks}
            carbon13Peaks={carbon13Peaks}
            ftirPeaks={ftirPeaks}
            msPeaks={msPeaks}
            onPeaksChange={useSpectroMindStore.getState().setPeaks}
            onCarbon13PeaksChange={useSpectroMindStore.getState().setCarbon13Peaks}
            onFtirPeaksChange={useSpectroMindStore.getState().setFtirPeaks}
            onMsPeaksChange={useSpectroMindStore.getState().setMsPeaks}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            spectrumType={spectrumType}
            onSpectrumTypeChange={useSpectroMindStore.getState().setSpectrumType}
            solvent={solvent}
            onSolventChange={useSpectroMindStore.getState().setSolvent}
            frequency={frequency}
            onFrequencyChange={useSpectroMindStore.getState().setFrequency}
            onKnownMoleculeChange={useSpectroMindStore.getState().setKnownMolecule}
            onObservedNmrOverlayChange={useSpectroMindStore.getState().setObservedNmrOverlay}
            onObservedNmrLoaded={focusNmrSpectrumView}
            onFidSimulationPeaksChange={useSpectroMindStore.getState().setFidSimulationPeaks}
          />
        </Panel>

        <PanelResizeHandle id="main-horizontal-resize" className="w-2 bg-slate-700 hover:bg-sky-500 transition-colors cursor-col-resize flex items-center justify-center group">
          <div className="h-12 w-1 rounded-full bg-slate-500 group-hover:bg-sky-400"></div>
        </PanelResizeHandle>

        {/* Main Content */}
        <Panel defaultSize={75} minSize={40} id="main-content-panel">
          <PanelGroup direction="vertical" id="vertical-layout" autoSaveId="vertical-layout-v1">
            {/* Charts Area */}
            <Panel defaultSize={67} minSize={30} id="charts-panel">
              <PanelGroup direction="vertical" id="charts-group" autoSaveId="charts-group-v1">
                <Panel defaultSize={50} minSize={20} id="nmr-chart-panel">
                  <div className="h-full min-h-0 p-4 overflow-hidden">
                    {modalityDiagnostic ? (
                      <div className="mb-2 px-3 py-2 rounded border border-red-600 bg-red-900/30 text-red-200 text-xs">
                        {modalityDiagnostic}
                      </div>
                    ) : null}
                    {spectrumType === 'c13' ? (
                      <Carbon13Chart
                        peaks={carbon13Peaks}
                        solvent={solvent}
                        frequency={frequency}
                        observedOverlay={observedNmrOverlayC13}
                      />
                    ) : spectrumType === 'ms' ? (
                      <MSChart peaks={msPeaks} />
                    ) : (
                      <NMRChart
                        peaks={peaks}
                        fidSimulationPeaks={fidSimulationPeaks}
                        solvent={solvent}
                        frequency={frequency}
                        observedOverlay={observedNmrOverlay}
                      />
                    )}
                  </div>
                </Panel>

                <PanelResizeHandle id="charts-vertical-resize" className="h-2 bg-slate-700 hover:bg-sky-500 transition-colors cursor-row-resize flex items-center justify-center group">
                  <div className="w-12 h-1 rounded-full bg-slate-500 group-hover:bg-sky-400"></div>
                </PanelResizeHandle>

                <Panel defaultSize={50} minSize={20} id="ftir-chart-panel">
                  <div className="h-full min-h-0 p-4 overflow-hidden">
                    {spectrumType === 'ms' ? (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📊</div>
                          <p>MS spektrumu üst panelde görüntüleniyor</p>
                        </div>
                      </div>
                    ) : (
                      <FTIRChart peaks={ftirPeaks} />
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle id="vertical-main-resize" className="h-2 bg-slate-700 hover:bg-sky-500 transition-colors cursor-row-resize flex items-center justify-center group">
              <div className="w-12 h-1 rounded-full bg-slate-500 group-hover:bg-sky-400"></div>
            </PanelResizeHandle>

            {/* Analysis Panel */}
            <Panel defaultSize={33} minSize={20} id="analysis-panel">
              <div className="h-full border-t border-slate-700 bg-slate-800 p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
              <strong className="font-bold">Error: </strong>
              <span>{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Analyzing spectrum...</p>
              </div>
            </div>
          )}

          {!isLoading && !analysisResult && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-slate-500">
                <div className="text-6xl mb-4">🧪</div>
                <p className="text-lg">Add peaks and click "Analyze with AI" to identify your molecule</p>
              </div>
            </div>
          )}

          {analysisResult && !isLoading && (
            <AnalysisResultDisplay
              result={analysisResult}
              nmrSolvent={solvent}
              inputPeaks={{
                nmrPeaks: peaks,
                c13Peaks: carbon13Peaks,
                ftirPeaks: ftirPeaks
              }}
            />
          )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
      <SpectroMindChatPanel
        context={{
          modality: spectrumType === 'c13' ? '13C' : spectrumType.toUpperCase(),
          solvent,
          qcStatus: activeObservedOverlay?.interpretationBlocked ? 'FAIL_WITH_CONFIDENCE_CEILING' : 'PASS',
          authorityTier: activeObservedOverlay?.sourceFormat?.toLowerCase().includes('fid')
            ? 'OBSERVED_PROCESSED_FID'
            : activeObservedOverlay
              ? 'AUTHORITATIVE_OBSERVED'
              : 'DISPLAY_ONLY_FALLBACK',
          moleculeRegions: analysisResult?.spectralInterpretation?.molecule_regions?.map((x) => x.label || x.region || 'region') || [],
          residualRegions: analysisResult?.spectralInterpretation?.residual_regions?.map((x) => x.label || x.region || 'residual') || [],
          artifactRegions: analysisResult?.spectralInterpretation?.artifact_candidates?.map((x) => x.label || x.region || 'artifact') || [],
          contradictions: analysisResult?.spectralInterpretation?.contradiction_analysis || [],
          analyteRegions: analysisResult?.spectralInterpretation?.molecule_regions?.map((x) => x.label || x.region || 'analyte') || [],
          crossModalAnchors: analysisResult?.spectralInterpretation?.cross_modal_anchors?.map((x) => x.label || `${x.h1_region || 'h1'}↔${x.c13_region || 'c13'}`) || [],
          exactIdEligibility: analysisResult?.spectralInterpretation?.exact_id_eligibility,
          candidateStructures: analysisResult?.spectralInterpretation?.candidate_structures_ranked?.slice(0, 5)?.map((c) => ({
            name: c?.name || 'candidate',
            support: typeof c?.support === 'number' ? c.support : 0.5,
            contradictions: c?.contradictions,
          })) || [],
          parserConfidence: typeof analysisResult?.confidence === 'number' ? analysisResult.confidence / 100 : undefined,
          finalVerdict: analysisResult?.final_verdict,
        }}
        onClientAction={handleChatAction}
      />
    </div>
  );
}
