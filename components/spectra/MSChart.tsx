'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface MSPeak {
  mz: number;
  intensity: number;
  assignment: string;
  formula?: string;
}

interface MSChartProps {
  peaks: MSPeak[];
  molecularIon?: number;
  title?: string;
  height?: number;
}

/**
 * MS (Mass Spectrometry) Chart Component
 * 
 * Displays mass spectrum with m/z on x-axis and intensity on y-axis
 */
export default function MSChart({
  peaks,
  molecularIon,
  title = 'Mass Spectrum',
  height = 300
}: MSChartProps) {
  const chartRef = useRef<ChartJS>(null);

  // Sort peaks by m/z
  const sortedPeaks = [...peaks].sort((a, b) => a.mz - b.mz);

  // Prepare data for chart
  const mzValues = sortedPeaks.map(p => p.mz);
  const intensities = sortedPeaks.map(p => p.intensity);

  // Create labels with assignments
  const labels = sortedPeaks.map((p, idx) => {
    if (molecularIon && Math.abs(p.mz - molecularIon) < 0.1) {
      return `M+ (${p.mz.toFixed(2)})`;
    }
    return `${p.mz.toFixed(2)}`;
  });

  const data = {
    labels: mzValues.map(mz => mz.toFixed(2)),
    datasets: [
      {
        label: 'Intensity',
        data: intensities,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        fill: true,
        tension: 0.1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const index = context.dataIndex;
            const peak = sortedPeaks[index];
            return [
              `m/z: ${peak.mz.toFixed(4)}`,
              `Intensity: ${peak.intensity.toFixed(1)}%`,
              `Assignment: ${peak.assignment}`,
              peak.formula ? `Formula: ${peak.formula}` : ''
            ].filter(Boolean);
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'm/z (Mass-to-Charge Ratio)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        title: {
          display: true,
          text: 'Relative Intensity (%)',
          font: {
            size: 12,
            weight: 'bold' as const
          }
        },
        beginAtZero: true,
        max: 100
      }
    }
  };

  return (
    <div style={{ height: `${height}px`, position: 'relative' }}>
      <Line ref={chartRef as any} data={data} options={options} />
      
      {/* Molecular Ion Indicator */}
      {molecularIon && (
        <div className="absolute top-2 right-2 bg-blue-100 px-2 py-1 rounded text-sm font-semibold">
          M+ = {molecularIon.toFixed(4)}
        </div>
      )}
    </div>
  );
}

