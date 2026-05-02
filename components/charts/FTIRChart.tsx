'use client';

import { useEffect, useRef } from 'react';
import { FTIRPeak } from '@/lib/types';
import { generateFTIRSpectrumData } from '@/lib/utils/spectrumGenerator';

let Chart: any;
let zoomPlugin: any;

interface FTIRChartProps {
  peaks: FTIRPeak[];
}

export default function FTIRChart({ peaks }: FTIRChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<typeof Chart | null>(null);

  useEffect(() => {
    const loadChart = async () => {
      if (typeof window === 'undefined') return;

      if (!Chart) {
        // ✅ Sadece gerekli modülleri import et (150KB tasarruf!)
        const ChartJS = await import('chart.js');
        const { LineController, LineElement, PointElement, LinearScale, Title, Tooltip, Legend, Filler } = ChartJS;

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
          Filler
        );

        const zoomModule = await import('chartjs-plugin-zoom');
        zoomPlugin = zoomModule.default;
        Chart.register(zoomPlugin);
      }

      if (!canvasRef.current) return;

      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const spectrumData = generateFTIRSpectrumData(peaks);

      // Custom plugin to draw peak labels
      const peakLabelsPlugin = {
        id: 'peakLabels',
        afterDatasetsDraw(chart: any) {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;

          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          peaks.forEach((peak) => {
            const wavenumber = peak.wavenumber;
            const assignment = peak.assignment || '';

            // Find the Y value (transmittance) at this wavenumber
            const dataPoint = spectrumData.find(d => Math.abs(d.x - wavenumber) < 5);
            if (!dataPoint) return;

            const xPixel = chart.scales.x.getPixelForValue(wavenumber);
            const yPixel = chart.scales.y.getPixelForValue(dataPoint.y);

            // Draw vertical line from peak to label
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(xPixel, yPixel);
            ctx.lineTo(xPixel, yPixel - 40);
            ctx.stroke();

            // Draw circle at peak
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(xPixel, yPixel, 4, 0, Math.PI * 2);
            ctx.fill();

            // Draw label box
            const labelY = yPixel - 50;
            const labelText = `${wavenumber}`;
            const assignmentText = assignment;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;

            const boxWidth = Math.max(80, ctx.measureText(labelText).width + 20);
            const boxHeight = assignmentText ? 38 : 24;
            const boxX = xPixel - boxWidth / 2;
            const boxY = labelY - boxHeight;

            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            // Draw wavenumber text
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(labelText, xPixel, labelY - boxHeight + 16);

            // Draw assignment text
            if (assignmentText) {
              ctx.font = '10px sans-serif';
              ctx.fillStyle = '#cbd5e1';
              ctx.fillText(assignmentText.length > 15 ? assignmentText.substring(0, 15) + '..' : assignmentText, xPixel, labelY - boxHeight + 32);
              ctx.font = 'bold 11px sans-serif';
            }
          });

          ctx.restore();
        }
      };

      const config: any = {
        type: 'line',
        data: {
          labels: spectrumData.map(d => d.x),
          datasets: [{
            label: 'Transmittance (%)',
            data: spectrumData.map(d => ({ x: d.x, y: d.y })),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderWidth: 2,
            fill: true,
            tension: 0.1, // Reduced tension to preserve peak sharpness
            pointRadius: 0,
            stepped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 600,
            easing: 'easeOutQuart'
          },
          scales: {
            x: {
              type: 'linear',
              reverse: true, // 4000 on left, 400 on right
              min: 400,
              max: 4000,
              title: {
                display: true,
                text: 'Wavenumber (cm⁻¹)',
                color: '#94a3b8'
              },
              ticks: {
                color: '#64748b',
                maxTicksLimit: 12
              },
              grid: { color: '#334155' }
            },
            y: {
              display: true,
              min: 0,
              max: 105,
              title: {
                display: true,
                text: 'Transmittance (%)',
                color: '#94a3b8'
              },
              ticks: { color: '#64748b' },
              grid: {
                display: true,
                color: '#334155'
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: 'nearest',
              intersect: false,
              callbacks: {
                title: function(context: any) {
                  const wavenumber = context[0].label;
                  return `${wavenumber} cm⁻¹`;
                },
                label: function(context: any) {
                  const transmittance = context.parsed.y.toFixed(1);
                  return `Transmittance: ${transmittance}%`;
                }
              }
            },
            zoom: {
              pan: {
                enabled: true,
                mode: 'x',
              },
              zoom: {
                wheel: {
                  enabled: true,
                },
                pinch: {
                  enabled: true
                },
                mode: 'x',
              }
            }
          }
        },
        plugins: [peakLabelsPlugin]
      };

      chartRef.current = new Chart(ctx, config);
    };

    loadChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [peaks]);

  return (
    <div className="w-full h-full bg-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-amber-400">FTIR Spectrum (Transmittance)</h2>
          <p className="text-[11px] text-slate-500 mt-1">
            Teorik / demo çizim — gözlenen FTIR FID katmanı yok (NMR FID ile karıştırılmaz).
          </p>
        </div>
      </div>
      <div className="w-full h-[calc(100%-3rem)]">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
