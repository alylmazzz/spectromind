'use client';

import { useEffect, useRef } from 'react';
import AuthorityBadge from '@/components/common/AuthorityBadge';
import { resolveAuthoritativeAxisDomain } from '@/lib/nmr/axisParity';

let Chart: any;
let zoomPlugin: any;

interface SpectrumPlotProps {
  ppm: number[];
  intensity: number[];
  title?: string;
  height?: number;
  defaultXPpm?: [number, number] | number[] | undefined;
  experimentType?: '1H' | '13C' | string;
  axisFallbackApplied?: boolean;
  axisFallbackReason?: string;
}

/**
 * Spectrum Plot Component
 * Displays processed FID spectrum (ppm vs intensity)
 */
export default function SpectrumPlot({ 
  ppm, 
  intensity, 
  title = 'Processed Spectrum',
  height = 400,
  defaultXPpm,
  experimentType = '1H',
  axisFallbackApplied,
  axisFallbackReason,
}: SpectrumPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<typeof Chart | null>(null);

  useEffect(() => {
    if (!ppm || !intensity || ppm.length === 0 || intensity.length === 0) {
      return;
    }

    // Load Chart.js only on client side
    const loadChart = async () => {
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

      if (!canvasRef.current) return;

      // Destroy existing chart
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Prepare data points (downsample if too many)
      const maxPoints = 5000;
      let dataPoints: { x: number; y: number }[];
      
      if (ppm.length > maxPoints) {
        // Downsample for performance
        const step = Math.ceil(ppm.length / maxPoints);
        dataPoints = [];
        for (let i = 0; i < ppm.length; i += step) {
          dataPoints.push({ x: ppm[i], y: intensity[i] });
        }
      } else {
        dataPoints = ppm.map((x, i) => ({ x, y: intensity[i] }));
      }

      const axisResolution = resolveAuthoritativeAxisDomain({
        ppm,
        experimentType,
        defaultXPpm,
        axisFallbackApplied,
        axisFallbackReason,
      });

      const config: any = {
        type: 'line',
        data: {
          datasets: [{
            label: experimentType === '13C' ? '¹³C NMR' : '¹H NMR',
            data: dataPoints,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0,
            pointRadius: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear',
              reverse: true, // Mnova-like NMR direction: high ppm on left
              min: axisResolution.domain.min,
              max: axisResolution.domain.max,
              title: {
                display: true,
                text: 'δ (ppm)',
                color: '#e2e8f0',
                font: { size: 14, weight: 'bold' }
              },
              ticks: { color: '#cbd5e1' },
              grid: { color: 'rgba(203, 213, 225, 0.1)' }
            },
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: 'Intensity',
                color: '#e2e8f0',
                font: { size: 14, weight: 'bold' }
              },
              ticks: { color: '#cbd5e1' },
              grid: { color: 'rgba(203, 213, 225, 0.1)' }
            }
          },
          plugins: {
            title: {
              display: !!title,
              text: title,
              color: '#e2e8f0',
              font: { size: 16, weight: 'bold' }
            },
            legend: { display: false },
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
      };

      chartRef.current = new Chart(ctx, config);

      // Cleanup
      return () => {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      };
    };

    loadChart();
  }, [ppm, intensity, title, defaultXPpm, experimentType, axisFallbackApplied, axisFallbackReason]);

  if (!ppm || !intensity || ppm.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p>No spectrum data available</p>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <div className="mb-1">
        <AuthorityBadge label="AUTHORITATIVE_OBSERVED_FID" tone="authoritative" />
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
