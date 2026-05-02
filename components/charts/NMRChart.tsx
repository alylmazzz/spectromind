'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { NMRPeak } from '@/lib/types';
import { generateNMRSpectrumData } from '@/lib/utils/spectrumGenerator';
import {
  H1_DISPLAY_PRESETS,
  H1_EXTENDED_X_DOMAIN,
  H1_PRO_FIRST_VIEW_PPM,
  computeYBounds,
  downsampleXY,
  fitSignalXDomain,
  normalizeSimulatedToUnitMax,
  type NmrYScaleMode,
} from '@/lib/nmr/nmrChartScaling';
import { resolveAuthoritativeAxisDomain } from '@/lib/nmr/axisParity';
import ManualPhaseRefPanel from './ManualPhaseRefPanel';
import { exportToJcampDx, downloadJcampDx } from '@/lib/export/jcampDxExport';
import AuthorityBadge from '@/components/common/AuthorityBadge';

let Chart: any;
let zoomPlugin: any;

const nmrBaselineZeroLinePlugin = {
  id: 'nmrBaselineZeroLine',
  beforeDatasetsDraw(chart: any) {
    const yScale = chart.scales?.y;
    const { top, bottom, left, right } = chart.chartArea || {};
    if (!yScale || typeof top !== 'number' || typeof bottom !== 'number') return;
    const y0 = yScale.getPixelForValue(0);
    if (!Number.isFinite(y0) || y0 < top || y0 > bottom) return;
    const c = chart.ctx;
    c.save();
    c.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(left, y0);
    c.lineTo(right, y0);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  },
};

export interface NmrObservedOverlay {
  ppm: number[];
  intensity: number[];
  qcSummary?: string;
  yScaleMode?: string;
  advisedPresetApplied?: string;
  defaultXPpm?: [number, number];
  experimentType?: '1H' | '13C';
  sessionId?: string;
  autoPh0?: number;
  autoPh1?: number;
  autoRefOffset?: number;
  solventHint?: string;
  axisFallbackApplied?: boolean;
  axisFallbackReason?: string;
  qcRules?: Array<{ id: string; passed: boolean; severity: 'info' | 'warn' | 'fatal'; message: string }>;
  interpretationBlocked?: boolean;
}

interface NMRChartProps {
  peaks: NMRPeak[];
  /** FID `peak_list` ile doldurulursa simülasyon çizgisi bununla çizilir (Lorentzian + ham yükseklik oranları). */
  fidSimulationPeaks?: NMRPeak[] | null;
  solvent: string;
  frequency: number;
  observedOverlay?: NmrObservedOverlay | null;
}

interface LabelPosition {
  peak: NMRPeak;
  peakIndex: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  xPos: number;
  peakYPos: number;
}

/**
 * Blank-chart prevention: checks that x/y arrays are usable.
 */
function chartDataUsable(
  points: Array<{ x: number; y: number }> | null
): { ok: boolean; reason?: string } {
  if (!points || points.length === 0) return { ok: false, reason: 'no_points' };
  if (points.length < 4) return { ok: false, reason: 'too_few_points' };

  let finiteCount = 0;
  let hasNonZeroY = false;
  for (const p of points) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      finiteCount++;
      if (Math.abs(p.y) > 1e-15) hasNonZeroY = true;
    }
  }
  if (finiteCount < 4) return { ok: false, reason: 'insufficient_finite_points' };
  if (!hasNonZeroY) return { ok: false, reason: 'all_zero_intensity' };
  return { ok: true };
}

export default function NMRChart({ peaks, fidSimulationPeaks = null, solvent, frequency, observedOverlay }: NMRChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<typeof Chart | null>(null);
  const [selectedPeakIndex, setSelectedPeakIndex] = useState<number | null>(null);
  const labelPositionsRef = useRef<LabelPosition[]>([]);

  const [xDomain, setXDomain] = useState(() => ({ min: H1_PRO_FIRST_VIEW_PPM[1], max: H1_PRO_FIRST_VIEW_PPM[0] }));
  const [yScaleMode, setYScaleMode] = useState<NmrYScaleMode>('PHYSICAL_AUTO');
  const [solventMask, setSolventMask] = useState(false);
  const [showSimulated, setShowSimulated] = useState(false);
  const [showObserved, setShowObserved] = useState(() => !!observedOverlay?.ppm?.length);
  const [ppmWarning, setPpmWarning] = useState<string | null>(null);
  const [showManualPanel, setShowManualPanel] = useState(false);
  const [showQcOverlay, setShowQcOverlay] = useState(false);
  const [manualPh0, setManualPh0] = useState(0);
  const [manualPh1, setManualPh1] = useState(0);
  const [phaseMode, setPhaseMode] = useState<'auto' | 'manual'>('auto');
  const [manualRefOffset, setManualRefOffset] = useState(0);
  const [refMode, setRefMode] = useState<'auto' | 'manual' | 'none'>('none');

  const lastSessionRef = useRef<string | undefined>(undefined);

  const peaksForSim = useMemo(() => {
    // If FID helper state is explicitly provided (even empty), never fallback to stale manual peaks.
    if (fidSimulationPeaks !== null && fidSimulationPeaks !== undefined) {
      return fidSimulationPeaks;
    }
    return peaks;
  }, [fidSimulationPeaks, peaks]);

  useEffect(() => {
    setShowObserved(!!observedOverlay?.ppm?.length);
  }, [observedOverlay?.ppm?.length]);

  const obsPoints = useMemo(() => {
    if (
      !observedOverlay?.ppm?.length ||
      observedOverlay.intensity?.length !== observedOverlay.ppm.length
    ) {
      return null;
    }
    return downsampleXY(observedOverlay.ppm, observedOverlay.intensity, 8000);
  }, [observedOverlay?.ppm, observedOverlay?.intensity]);

  const obsDataCheck = useMemo(() => chartDataUsable(obsPoints), [obsPoints]);
  const axisResolution = useMemo(
    () =>
      resolveAuthoritativeAxisDomain({
        ppm: observedOverlay?.ppm,
        experimentType: observedOverlay?.experimentType,
        defaultXPpm: observedOverlay?.defaultXPpm,
        axisFallbackApplied: observedOverlay?.axisFallbackApplied,
        axisFallbackReason: observedOverlay?.axisFallbackReason,
      }),
    [
      observedOverlay?.ppm,
      observedOverlay?.experimentType,
      observedOverlay?.defaultXPpm,
      observedOverlay?.axisFallbackApplied,
      observedOverlay?.axisFallbackReason,
    ]
  );
  // Yeni FID: sunucunun defaultXPpm (14->0) kullanilir; tam SW penceresi otomatik acilmaz.
  // Eksen client tarafinda makul degilse veriye sigdir (smartInitialXDomain).
  useEffect(() => {
    const sid = observedOverlay?.sessionId;
    const hasPpm = !!observedOverlay?.ppm?.length;
    if (!hasPpm) {
      setPpmWarning(null);
      return;
    }
    if (sid !== undefined && sid !== lastSessionRef.current) {
      lastSessionRef.current = sid;
      const parityPreset =
        observedOverlay?.advisedPresetApplied === '1H_mnova_parity' ||
        observedOverlay?.advisedPresetApplied === '13C_mnova_parity';

      setPpmWarning(axisResolution.warning);
      setXDomain(axisResolution.domain);

      // Mnova parity preset: authoritative observed first, helper off.
      if (parityPreset) {
        setShowSimulated(false);
        setShowObserved(true);
        setYScaleMode('GLOBAL_MAX');
      } else {
        setYScaleMode('PHYSICAL_AUTO');
      }
      setSolventMask(false);
    }
  }, [
    observedOverlay?.sessionId,
    observedOverlay?.ppm?.length,
    observedOverlay?.defaultXPpm,
    observedOverlay?.ppm,
    observedOverlay?.experimentType,
    observedOverlay?.axisFallbackApplied,
    observedOverlay?.axisFallbackReason,
    observedOverlay?.advisedPresetApplied,
    axisResolution.warning,
    axisResolution.domain,
  ]);

  const spectrumData = useMemo(() => generateNMRSpectrumData(peaksForSim), [peaksForSim]);

  const simForBounds = useMemo(() => {
    const hasObs = obsDataCheck.ok;
    // Phase-5 contract: helper/simulated trace is display-only and must never
    // influence authoritative scale/domain decisions when observed exists.
    if (hasObs) {
      return null;
    }
    return showSimulated && peaksForSim.length > 0 ? spectrumData : null;
  }, [obsDataCheck.ok, showSimulated, peaksForSim.length, spectrumData, xDomain.min, xDomain.max]);

  const yBounds = useMemo(
    () =>
      computeYBounds(obsPoints, simForBounds ?? [], xDomain.min, xDomain.max, {
        yScaleMode,
        solventMask,
        includeObserved: showObserved && obsDataCheck.ok,
        includeSimulated: !obsDataCheck.ok && showSimulated && peaksForSim.length > 0,
      }),
    [obsPoints, simForBounds, xDomain.min, xDomain.max, yScaleMode, solventMask, showObserved, showSimulated, peaksForSim.length, obsDataCheck.ok]
  );

  const legendScaleNote = useMemo(() => {
    const parts = [`Y: ${yScaleMode}`];
    if (solventMask) parts.push('cozucu maskeli');
    if (obsDataCheck.ok && showSimulated && peaksForSim.length > 0) {
      parts.push('sim: normalize (pencere ici max=1)');
    }
    if (obsDataCheck.ok) {
      parts.push('helper scale-isolated');
    }
    return parts.join(' - ');
  }, [yScaleMode, solventMask, obsDataCheck.ok, showSimulated, peaksForSim.length]);

  const zoomLimitX = useMemo(() => {
    const xs: number[] = [];
    if (obsPoints?.length) {
      for (const p of obsPoints) xs.push(p.x);
    }
    if (spectrumData?.length) {
      for (const p of spectrumData) xs.push(p.x);
    }
    if (!xs.length) {
      return observedOverlay?.experimentType === '13C'
        ? { min: -10, max: 230 }
        : { min: -2, max: 14 };
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = Math.max(1e-6, maxX - minX);
    const pad = span * 0.03;
    return { min: minX - pad, max: maxX + pad };
  }, [obsPoints, spectrumData, observedOverlay?.experimentType]);

  const hasChartContent =
    (showSimulated && peaksForSim.length > 0) || (showObserved && obsDataCheck.ok);

  const obsFailReason = useMemo(() => {
    if (!showObserved) return null;
    if (!observedOverlay?.ppm?.length) return null;
    if (!obsDataCheck.ok) return obsDataCheck.reason || 'data_unusable';
    return null;
  }, [showObserved, observedOverlay?.ppm?.length, obsDataCheck]);

  useEffect(() => {
    let active = true;

    const loadChart = async (): Promise<(() => void) | void> => {
      if (typeof window === 'undefined') return;

      if (!Chart) {
        const ChartJS = await import('chart.js');
        const { LineController, LineElement, PointElement, LinearScale, Title, Tooltip, Legend, Filler } = ChartJS;

        Chart = ChartJS.Chart;

        Chart.register(
          LineController,
          LineElement,
          PointElement,
          LinearScale,
          Title,
          Tooltip,
          Legend,
          Filler
        );

        const zoomModule = await import('chartjs-plugin-zoom');
        zoomPlugin = zoomModule.default;
        Chart.register(zoomPlugin);
      }

      if (!active || !canvasRef.current) return undefined;

      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!active || !ctx) return undefined;

      const peakLabelsPlugin = {
        id: 'peakLabels',
        afterDatasetsDraw(chart: any) {
          const {
            ctx,
            chartArea: { top },
            scales: { x, y },
          } = chart;

          labelPositionsRef.current = [];

          if (!(showSimulated && peaksForSim.length > 0)) {
            return;
          }

          peaksForSim.forEach((peak, peakIndex) => {
            if (peak.isSolvent || peak.hideChartLabel || peakIndex === selectedPeakIndex) return;

            const xPos = x.getPixelForValue(peak.shift);
            const peakDataPoint = spectrumData.find((d) => Math.abs(d.x - peak.shift) < 0.05);
            const peakYValue = peakDataPoint ? peakDataPoint.y : y.max;
            const peakYPos = y.getPixelForValue(peakYValue);

            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            const labelText1 = `${peak.shift.toFixed(2)}`;
            const text1Width = ctx.measureText(labelText1).width;
            ctx.font = '10px sans-serif';
            const labelText2 = `${peak.mult} (${peak.integ}H)`;
            const text2Width = ctx.measureText(labelText2).width;
            const boxWidth = Math.max(text1Width, text2Width) + 12;
            const boxHeight = 36;

            const boxX = xPos - boxWidth / 2;
            const boxY = Math.max(top + 10, peakYPos - boxHeight - 25);

            labelPositionsRef.current.push({
              peak,
              peakIndex,
              boxX,
              boxY,
              boxWidth,
              boxHeight,
              xPos,
              peakYPos,
            });

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(xPos, peakYPos);
            ctx.lineTo(xPos, boxY + boxHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labelText1, xPos, boxY + 16);
            ctx.font = '10px sans-serif';
            ctx.fillText(labelText2, xPos, boxY + 28);
            ctx.restore();
          });

          if (showSimulated && selectedPeakIndex !== null) {
            const peak = peaksForSim[selectedPeakIndex];
            if (peak && !peak.isSolvent) {
              const xPos = x.getPixelForValue(peak.shift);
              const peakDataPoint = spectrumData.find((d) => Math.abs(d.x - peak.shift) < 0.05);
              const peakYValue = peakDataPoint ? peakDataPoint.y : y.max;
              const peakYPos = y.getPixelForValue(peakYValue);

              ctx.save();
              ctx.font = 'bold 12px sans-serif';
              const labelText1 = `${peak.shift.toFixed(2)}`;
              const text1Width = ctx.measureText(labelText1).width;
              ctx.font = '10px sans-serif';
              const labelText2 = `${peak.mult} (${peak.integ}H)`;
              const text2Width = ctx.measureText(labelText2).width;
              const boxWidth = Math.max(text1Width, text2Width) + 12;
              const boxHeight = 36;

              const boxX = xPos - boxWidth / 2;
              const boxY = Math.max(top + 10, peakYPos - boxHeight - 25);

              labelPositionsRef.current.push({
                peak,
                peakIndex: selectedPeakIndex,
                boxX,
                boxY,
                boxWidth,
                boxHeight,
                xPos,
                peakYPos,
              });

              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 3;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.moveTo(xPos, peakYPos);
              ctx.lineTo(xPos, boxY + boxHeight);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = 'rgba(56, 189, 248, 1)';
              ctx.strokeStyle = '#0ea5e9';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 12px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(labelText1, xPos, boxY + 16);
              ctx.font = 'bold 10px sans-serif';
              ctx.fillText(labelText2, xPos, boxY + 28);
              ctx.restore();
            }
          }
        },
      };

      const datasets: any[] = [];
      const hasObs = showObserved && obsDataCheck.ok && obsPoints && obsPoints.length > 0;

      if (showSimulated && peaksForSim.length > 0) {
        const simLine =
          hasObs && obsPoints
            ? normalizeSimulatedToUnitMax(spectrumData, xDomain.min, xDomain.max)
            : spectrumData;
        const simLabel =
          fidSimulationPeaks && fidSimulationPeaks.length > 0
            ? '1H (FID pik simulasyonu, Lorentzian)'
            : hasObs
              ? '1H (simulasyon, normalize)'
              : '1H NMR (simulasyon)';
        datasets.push({
          label: simLabel,
          data: simLine.map((d) => ({ x: d.x, y: d.y })),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
        });
      }

      if (hasObs) {
        const modeLabel = observedOverlay?.yScaleMode || 'GLOBAL_MAX';
        datasets.push({
          label: `Gozlenen (FID - ${modeLabel})`,
          data: obsPoints,
          borderColor: '#fb923c',
          backgroundColor: 'rgba(251, 146, 60, 0.03)',
          borderWidth: 1.1,
          fill: false,
          tension: 0.03,
          pointRadius: 0,
        });
      }

      if (datasets.length === 0) {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
        return undefined;
      }

      if (!active || !canvasRef.current) return undefined;

      const config: any = {
        type: 'line',
        data: {
          labels: spectrumData.map((d) => d.x),
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { left: 10, right: 14, top: 8, bottom: 20 },
          },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              type: 'linear',
              reverse: true,
              min: xDomain.min,
              max: xDomain.max,
              title: {
                display: true,
                text: `d (ppm) - ${xDomain.max.toFixed(1)} -> ${xDomain.min.toFixed(1)}`,
                color: '#e2e8f0',
                font: { size: 13, weight: 'bold' as const },
              },
              ticks: { color: '#cbd5e1', maxTicksLimit: 16 },
              grid: { color: 'rgba(203, 213, 225, 0.08)' },
            },
            y: {
              min: yBounds.min,
              max: yBounds.max,
              beginAtZero: false,
              grace: '4%',
              title: {
                display: true,
                text: legendScaleNote.slice(0, 80),
                color: '#94a3b8',
                font: { size: 11 },
              },
              ticks: { color: '#cbd5e1' },
              grid: { color: 'rgba(203, 213, 225, 0.1)' },
            },
          },
          plugins: {
            legend: {
              display: datasets.length > 0,
              labels: { color: '#cbd5e1', font: { size: 10 } },
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                title(items: any[]) {
                  const raw = items[0]?.raw as { x?: number } | undefined;
                  const xv = raw?.x;
                  return xv !== undefined ? `d ${Number(xv).toFixed(3)} ppm` : '';
                },
                label(ctx: any) {
                  const y = ctx.parsed?.y;
                  const ds = ctx.dataset?.label || '';
                  return y !== undefined ? `${ds}: ${Number(y).toFixed(4)}` : ds;
                },
                afterBody() {
                  return [`Olcek: ${legendScaleNote}`];
                },
              },
            },
            zoom: {
              pan: { enabled: true, mode: 'xy' },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                drag: { enabled: true },
                mode: 'xy',
              },
              limits: {
                x: { min: zoomLimitX.min, max: zoomLimitX.max },
                y: { min: 'original', max: 'original' },
              },
            },
          },
        },
        plugins: [nmrBaselineZeroLinePlugin, peakLabelsPlugin],
      };

      if (!active) return undefined;

      chartRef.current = new Chart(ctx, config);

      const handleCanvasClick = (event: MouseEvent) => {
        if (!canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const reversedLabels = [...labelPositionsRef.current].reverse();

        for (const label of reversedLabels) {
          if (
            clickX >= label.boxX &&
            clickX <= label.boxX + label.boxWidth &&
            clickY >= label.boxY &&
            clickY <= label.boxY + label.boxHeight
          ) {
            if (selectedPeakIndex === label.peakIndex) {
              setSelectedPeakIndex(null);
            } else {
              setSelectedPeakIndex(label.peakIndex);
            }
            return;
          }
        }

        setSelectedPeakIndex(null);
      };

      const handleMouseMove = (event: MouseEvent) => {
        if (!canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let isOverLabel = false;
        for (const label of labelPositionsRef.current) {
          if (
            mouseX >= label.boxX &&
            mouseX <= label.boxX + label.boxWidth &&
            mouseY >= label.boxY &&
            mouseY <= label.boxY + label.boxHeight
          ) {
            isOverLabel = true;
            break;
          }
        }

        canvasRef.current.style.cursor = isOverLabel ? 'pointer' : 'default';
      };

      canvasRef.current.addEventListener('click', handleCanvasClick);
      canvasRef.current.addEventListener('mousemove', handleMouseMove);

      return () => {
        if (canvasRef.current) {
          canvasRef.current.removeEventListener('click', handleCanvasClick);
          canvasRef.current.removeEventListener('mousemove', handleMouseMove);
        }
      };
    };

    let removeListeners: (() => void) | undefined;
    loadChart().then((fn) => {
      if (active && typeof fn === 'function') removeListeners = fn;
    });

    return () => {
      active = false;
      removeListeners?.();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [
    peaksForSim,
    fidSimulationPeaks,
    solvent,
    frequency,
    selectedPeakIndex,
    observedOverlay,
    spectrumData,
    obsPoints,
    obsDataCheck.ok,
    xDomain.min,
    xDomain.max,
    yBounds.min,
    yBounds.max,
    showSimulated,
    showObserved,
    legendScaleNote,
    zoomLimitX.min,
    zoomLimitX.max,
    observedOverlay?.yScaleMode,
  ]);

  const applyPreset = useCallback((min: number, max: number) => setXDomain({ min, max }), []);

  const handleFitSignal = useCallback(() => {
    if (!observedOverlay?.ppm?.length || observedOverlay.intensity.length !== observedOverlay.ppm.length) return;
    setXDomain(fitSignalXDomain(observedOverlay.ppm, observedOverlay.intensity));
  }, [observedOverlay?.ppm, observedOverlay?.intensity]);

  const handlePhaseChange = useCallback((ph0: number, ph1: number) => {
    setManualPh0(ph0);
    setManualPh1(ph1);
  }, []);

  const handlePhaseReset = useCallback(() => {
    setManualPh0(observedOverlay?.autoPh0 ?? 0);
    setManualPh1(observedOverlay?.autoPh1 ?? 0);
    setPhaseMode('auto');
  }, [observedOverlay?.autoPh0, observedOverlay?.autoPh1]);

  const handlePhaseApply = useCallback((ph0: number, ph1: number) => {
    setManualPh0(ph0);
    setManualPh1(ph1);
    setPhaseMode('manual');
  }, []);

  const handleRefOffsetChange = useCallback((offset: number) => {
    setManualRefOffset(offset);
  }, []);

  const handleRefReset = useCallback(() => {
    setManualRefOffset(observedOverlay?.autoRefOffset ?? 0);
    setRefMode(observedOverlay?.autoRefOffset ? 'auto' : 'none');
  }, [observedOverlay?.autoRefOffset]);

  const handleRefApply = useCallback((offset: number) => {
    setManualRefOffset(offset);
    setRefMode('manual');
  }, []);

  const handleExportJcamp = useCallback(() => {
    if (!observedOverlay?.ppm?.length) return;
    const content = exportToJcampDx({
      ppm: observedOverlay.ppm,
      intensity: observedOverlay.intensity,
      metadata: {
        title: `SpectroMind 1H NMR - ${solvent}`,
        solvent,
        nucleus: observedOverlay.experimentType || '1H',
        observeFrequency: frequency,
        sourceMode: 'observed',
        axisSource: axisResolution.source,
        processingInfo: `xDomain=${xDomain.max.toFixed(3)}->${xDomain.min.toFixed(3)} ppm`,
      },
    });
    downloadJcampDx(content, `spectromind_1h_${solvent}_${frequency}MHz`);
  }, [observedOverlay?.ppm, observedOverlay?.intensity, observedOverlay?.experimentType, solvent, frequency, axisResolution.source, xDomain.max, xDomain.min]);

  const handleResetFull = useCallback(() => {
    setXDomain(axisResolution.domain);
    setPpmWarning(axisResolution.warning);
    setYScaleMode('PHYSICAL_AUTO');
    setSolventMask(false);
    setShowQcOverlay(false);
    chartRef.current?.resetZoom?.();
  }, [axisResolution.domain, axisResolution.warning]);

  const handleMestReNovaParityView = useCallback(() => {
    setXDomain({ min: -1, max: 14 });
    setYScaleMode('GLOBAL_MAX');
    setShowSimulated(false);
    setShowObserved(true);
    setSolventMask(false);
    setShowQcOverlay(false);
    chartRef.current?.resetZoom?.();
  }, []);

  const handleDiagnosticView = useCallback(() => {
    setXDomain({ min: -2, max: 14 });
    setYScaleMode('ROBUST_P99');
    setShowSimulated(peaksForSim.length > 0);
    setShowObserved(true);
    setSolventMask(false);
    setShowQcOverlay(true);
    chartRef.current?.resetZoom?.();
  }, [peaksForSim.length]);

  const btn =
    'px-2 py-1 rounded text-[10px] font-semibold border transition border-slate-600 bg-slate-700/80 text-slate-200 hover:bg-slate-600 hover:border-sky-500';

  return (
    <div className="w-full h-full bg-slate-800 rounded-lg p-4 flex flex-col min-h-0">
      <div className="flex flex-wrap justify-between items-start gap-2 mb-2 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-sky-400">1H NMR Spectrum</h2>
          <div className="mt-1 flex gap-1">
            {observedOverlay?.ppm?.length ? (
              <AuthorityBadge label="AUTHORITATIVE_OBSERVED_FID" tone="authoritative" />
            ) : (
              <AuthorityBadge label="DISPLAY_ONLY_FALLBACK" tone="fallback" />
            )}
            {showSimulated ? <AuthorityBadge label="FID_DERIVED_HELPER (DISPLAY ONLY)" tone="helper" /> : null}
          </div>
          <p className="text-sm text-slate-400">
            {solvent} | {frequency} MHz
            {observedOverlay?.ppm?.length ? (
              <span className="text-orange-400 ml-2">
                - Gozlenen (FID)
                {observedOverlay.qcSummary ? ` -- ${observedOverlay.qcSummary}` : ''}
              </span>
            ) : null}
          </p>
          {observedOverlay?.advisedPresetApplied ? (
            <p className="text-[11px] text-emerald-300/90 mt-0.5">
              Processing preset: {observedOverlay.advisedPresetApplied}
            </p>
          ) : null}
          {fidSimulationPeaks && fidSimulationPeaks.length > 0 ? (
            <p className="text-[11px] text-sky-300/90 mt-0.5 max-w-3xl">
              Mavi cizgi: FID pik listesi ile Lorentzian ozet (-2…14 ppm); turuncu: tam islenmis FID.
              Pik listesi eksikse (orn. ~11 veya ~2 ppm) Python esigi dusuruldu — yeniden isleyin.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1 justify-end max-w-xl">
          <span className="text-[10px] text-slate-500 w-full text-right">X ppm - authoritative domain (1H: 14→-1)</span>
          {H1_DISPLAY_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={btn}
              onClick={() => applyPreset(p.min, p.max)}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className={btn} onClick={handleFitSignal} disabled={!obsDataCheck.ok}>
            Sinyale sigdir
          </button>
          <button type="button" className={`${btn} border-sky-700`} onClick={handleResetFull}>
            Tam gorunume don
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setXDomain({ ...H1_EXTENDED_X_DOMAIN })}
          >
            {'14 → −2'}
          </button>
          <button type="button" className={`${btn} border-emerald-600`} onClick={handleMestReNovaParityView}>
            MestReNova parity
          </button>
          <button type="button" className={`${btn} border-amber-600`} onClick={handleDiagnosticView}>
            Diagnostik
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-2 text-[11px] text-slate-400 shrink-0">
        <span className="text-slate-500">Y:</span>
        {(['PHYSICAL_AUTO', 'GLOBAL_MAX', 'AUTHORITATIVE_MAX', 'ROBUST_P99', 'ROBUST_P995'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`${btn} ${yScaleMode === m ? 'border-orange-400 text-orange-200' : ''}`}
            onClick={() => setYScaleMode(m)}
          >
            {m}
          </button>
        ))}
        <label className="flex items-center gap-1 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={solventMask}
            onChange={(e) => setSolventMask(e.target.checked)}
            className="rounded border-slate-500"
          />
          Cozucu maskeli Y
        </label>
        {peaksForSim.length > 0 ? (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showSimulated}
              onChange={(e) => setShowSimulated(e.target.checked)}
              className="rounded border-slate-500"
            />
            {fidSimulationPeaks && fidSimulationPeaks.length > 0 ? 'FID helper (display-only)' : 'Simulasyon'}
          </label>
        ) : null}
        {observedOverlay?.ppm?.length ? (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showObserved}
              onChange={(e) => setShowObserved(e.target.checked)}
              className="rounded border-slate-500"
            />
            Gozlenen
          </label>
        ) : null}
        {observedOverlay?.ppm?.length ? (
          <>
            <button type="button" className={`${btn} ml-2`} onClick={() => setShowManualPanel((p) => !p)}>
              {showManualPanel ? 'Faz/Ref kapat' : 'Faz/Ref'}
            </button>
            <button type="button" className={`${btn} ml-1`} onClick={handleExportJcamp}>
              JCAMP-DX
            </button>
          </>
        ) : null}
      </div>

      {/* Manual phase & reference panel */}
      {observedOverlay?.ppm?.length ? (
        <ManualPhaseRefPanel
          visible={showManualPanel}
          currentPh0={manualPh0}
          currentPh1={manualPh1}
          phaseMode={phaseMode}
          currentRefOffset={manualRefOffset}
          refMode={refMode}
          solventHint={observedOverlay.solventHint}
          onPhaseChange={handlePhaseChange}
          onPhaseReset={handlePhaseReset}
          onPhaseApply={handlePhaseApply}
          onRefOffsetChange={handleRefOffsetChange}
          onRefReset={handleRefReset}
          onRefApply={handleRefApply}
        />
      ) : null}

      {/* PPM axis warning */}
      {ppmWarning && (
        <div className="mb-2 px-3 py-1.5 rounded bg-yellow-900/40 border border-yellow-600/50 text-yellow-300 text-xs shrink-0">
          {`${ppmWarning} (source priority: processed axis -> metadata axis -> safe fallback)`}
        </div>
      )}

      {/* Observed data quality warning */}
      {obsFailReason && (
        <div className="mb-2 px-3 py-1.5 rounded bg-red-900/30 border border-red-600/40 text-red-300 text-xs shrink-0">
          Gozlenen veri goruntulenemedi: {obsFailReason === 'no_points' ? 'veri dizisi bos' :
            obsFailReason === 'too_few_points' ? 'cok az veri noktasi' :
            obsFailReason === 'all_zero_intensity' ? 'tum yogunluk degerleri sifir' :
            obsFailReason === 'insufficient_finite_points' ? 'yetersiz gecerli nokta (NaN/Inf)' :
            obsFailReason}
        </div>
      )}
      {observedOverlay?.interpretationBlocked ? (
        <div className="mb-2 px-3 py-1.5 rounded bg-red-900/35 border border-red-600/60 text-red-200 text-xs shrink-0">
          Observed QC fail: yorumlama geçici olarak bloklu (INTERPRETATION_BLOCK_IF_OBSERVED_QC_FAIL).
        </div>
      ) : null}

      {showQcOverlay && observedOverlay?.qcRules?.length ? (
        <div className="mb-2 px-3 py-2 rounded bg-slate-900/60 border border-slate-600 text-xs shrink-0">
          <div className="text-slate-300 font-semibold mb-1">Diagnostik QC Overlay</div>
          <div className="flex flex-wrap gap-1">
            {observedOverlay.qcRules.map((r) => (
              <span
                key={r.id}
                className={`px-2 py-0.5 rounded border ${
                  r.passed
                    ? 'bg-emerald-900/30 border-emerald-600 text-emerald-300'
                    : r.severity === 'fatal'
                      ? 'bg-red-900/30 border-red-600 text-red-300'
                      : 'bg-amber-900/30 border-amber-600 text-amber-300'
                }`}
                title={r.message}
              >
                {r.id}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative w-full flex-1 min-h-[280px]">
        {!hasChartContent ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-slate-500 text-sm text-center px-4 bg-slate-800/85 rounded">
            Goruntulecek spektrum yok -- pik ekleyin veya FID yukleyin.
          </div>
        ) : null}
        <canvas ref={canvasRef} className={!hasChartContent ? 'opacity-0 pointer-events-none' : 'w-full h-full'} />
      </div>
    </div>
  );
}
