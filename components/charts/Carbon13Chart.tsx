'use client';

import { useEffect, useRef } from 'react';
import { Carbon13Peak } from '@/lib/types';
import AuthorityBadge from '@/components/common/AuthorityBadge';

let Chart: any;
let zoomPlugin: any;

interface Carbon13ChartProps {
  peaks: Carbon13Peak[];
  solvent: string;
  frequency: number;
  observedOverlay?: {
    ppm: number[];
    intensity: number[];
    experimentType?: '1H' | '13C';
    sessionId?: string;
    qcSummary?: string;
  } | null;
}

export default function Carbon13Chart({ peaks, solvent, frequency, observedOverlay }: Carbon13ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<typeof Chart | null>(null);

  useEffect(() => {
    // Load Chart.js only on client side - OPTIMIZED: Tree-shaking
    const loadChart = async () => {
      if (typeof window === 'undefined') return;

      if (!Chart) {
        // ✅ Sadece gerekli modülleri import et (150KB tasarruf!)
        const ChartJS = await import('chart.js');
        const { LineController, LineElement, PointElement, LinearScale, Title, Tooltip, Legend, Filler, ScatterController } = ChartJS;

        Chart = ChartJS.Chart;

        // Register only needed components
        Chart.register(
          LineController,
          LineElement,
          PointElement,
          LinearScale,
          Title,
          Tooltip,
          Legend,
          Filler,
          ScatterController
        );

        const zoomModule = await import('chartjs-plugin-zoom');
        zoomPlugin = zoomModule.default;
        Chart.register(zoomPlugin);
      }

      if (!canvasRef.current) return;

      // Destroy existing chart
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const hasObserved =
        !!observedOverlay?.ppm?.length &&
        observedOverlay.ppm.length === observedOverlay.intensity.length &&
        observedOverlay.experimentType === '13C';

      const dataPoints: { x: number; y: number }[] = hasObserved
        ? observedOverlay.ppm.map((x, i) => ({ x, y: observedOverlay.intensity[i] }))
        : [];
      if (!hasObserved) {
        const minPPM = 0;
        const maxPPM = 230;
        const resolution = 0.5;
        for (let ppm = minPPM; ppm <= maxPPM; ppm += resolution) {
          dataPoints.push({ x: ppm, y: 0 });
        }
        peaks.forEach(peak => {
          const peakPPM = peak.ppm;
          const width = 2;
          const intensity = peak.intensity || 100;
          for (let i = 0; i < dataPoints.length; i++) {
            const ppm = dataPoints[i].x;
            const distance = Math.abs(ppm - peakPPM);
            const lorentzian = intensity / (1 + Math.pow(distance / (width / 2), 2));
            dataPoints[i].y += lorentzian;
          }
        });
      }

      // Create gradient for fill
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');

      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            label: hasObserved ? 'AUTHORITATIVE OBSERVED 13C' : '13C NMR Spectrum (fallback helper)',
            data: dataPoints,
            borderColor: 'rgb(56, 189, 248)',
            backgroundColor: gradient,
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          },
          plugins: {
            legend: {
              display: false
            },
            title: {
              display: true,
              text: hasObserved
                ? `13C NMR (${frequency} MHz, ${solvent}) - AUTHORITATIVE OBSERVED`
                : `13C NMR (${frequency} MHz, ${solvent}) - fallback helper`,
              color: 'rgb(148, 163, 184)',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: 'rgb(56, 189, 248)',
              bodyColor: 'rgb(226, 232, 240)',
              borderColor: 'rgb(56, 189, 248)',
              borderWidth: 1,
              padding: 12,
              displayColors: false,
              callbacks: {
                title: (context: any) => {
                  if (!context || !context[0] || !context[0].parsed) return '';
                  const ppm = context[0].parsed.x;
                  if (ppm === undefined || ppm === null) return '';
                  return `δ ${ppm.toFixed(2)} ppm`;
                },
                label: (context: any) => {
                  if (!context || !context.parsed) return '';
                  const ppm = context.parsed.x;
                  const intensity = context.parsed.y;

                  if (ppm === undefined || ppm === null || intensity === undefined || intensity === null) {
                    return '';
                  }

                  const nearestPeak = hasObserved ? undefined : peaks.find(p => Math.abs(p.ppm - ppm) < 2);

                  if (nearestPeak) {
                    const labels = [`Intensity: ${intensity.toFixed(0)}`];
                    if (nearestPeak.carbonType) {
                      labels.push(`Type: ${nearestPeak.carbonType}`);
                    }
                    if (nearestPeak.assignment) {
                      labels.push(`Assignment: ${nearestPeak.assignment}`);
                    }
                    return labels;
                  }
                  return `Intensity: ${intensity.toFixed(0)}`;
                }
              }
            },
            zoom: {
              zoom: {
                wheel: {
                  enabled: true,
                  modifierKey: 'ctrl'
                },
                pinch: {
                  enabled: true
                },
                mode: 'x'
              },
              pan: {
                enabled: true,
                mode: 'x'
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              reverse: true,
              min: -10,
              max: 230,
              title: {
                display: true,
                text: hasObserved ? 'δ (ppm) - authoritative processed axis' : 'δ (ppm) - fallback domain',
                color: 'rgb(148, 163, 184)',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              grid: {
                color: 'rgba(71, 85, 105, 0.3)'
              },
              ticks: {
                color: 'rgb(148, 163, 184)',
                callback: function(value: any) {
                  return value;
                }
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Intensity',
                color: 'rgb(148, 163, 184)',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              grid: {
                color: 'rgba(71, 85, 105, 0.2)'
              },
              ticks: {
                color: 'rgb(148, 163, 184)',
                display: false // Hide y-axis numbers
              }
            }
          }
        }
      });

      // Add peak markers
      if (!hasObserved && peaks.length > 0) {
        const peakMarkers = peaks.map(peak => ({
          x: peak.ppm,
          y: 100
        }));

        chartRef.current.data.datasets.push({
          label: 'Peak Markers',
          data: peakMarkers,
          type: 'scatter',
          backgroundColor: 'rgb(239, 68, 68)',
          borderColor: 'rgb(239, 68, 68)',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false
        });

        chartRef.current.update();
      }
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [peaks, solvent, frequency, observedOverlay]);

  return (
    <div className="h-full w-full bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="mb-2">
        <AuthorityBadge
          label={observedOverlay?.experimentType === '13C'
            ? 'AUTHORITATIVE_OBSERVED_FID (13C 230→-10 ppm)'
            : 'DISPLAY_ONLY_FALLBACK'}
          tone={observedOverlay?.experimentType === '13C' ? 'authoritative' : 'fallback'}
        />
      </div>
      <div className="h-full relative">
        <canvas ref={canvasRef}></canvas>
        {peaks.length === 0 && !observedOverlay?.ppm?.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <p className="text-lg">13C NMR spektrumu için peak ekleyin</p>
              <p className="text-sm mt-2">Ctrl + Scroll ile zoom, Sürükle ile pan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
