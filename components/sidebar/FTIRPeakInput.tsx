'use client';

import React, { useState } from 'react';
import { FTIRPeak } from '@/lib/types';
import { validateWavenumber } from '@/lib/utils/peakValidation';

interface FTIRPeakInputProps {
  peak: FTIRPeak;
  index: number;
  onUpdate: (index: number, peak: FTIRPeak) => void;
  onRemove: (index: number) => void;
}

export default function FTIRPeakInput({ peak, index, onUpdate, onRemove }: FTIRPeakInputProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Validate wavenumber
  const wavenumberValidation = validateWavenumber(peak.wavenumber);

  const getWavenumberBorderClass = () => {
    if (!wavenumberValidation.isValid) return 'border-red-500';
    if (wavenumberValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  const handleWavenumberChange = (value: string) => {
    const numValue = parseFloat(value);
    setShowWarning(true);
    if (!isNaN(numValue)) {
      onUpdate(index, { ...peak, wavenumber: numValue });
    } else if (value === '') {
      onUpdate(index, { ...peak, wavenumber: 0 });
    }
  };

  const handleIntensityChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      onUpdate(index, { ...peak, intensity: numValue });
    } else if (value === '') {
      onUpdate(index, { ...peak, intensity: 0 });
    }
  };

  const handleTypeChange = (value: string) => {
    if (value === 'strong' || value === 'medium' || value === 'weak') {
      onUpdate(index, { ...peak, type: value });
    }
  };

  const handleWidthChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdate(index, { ...peak, width: numValue });
    } else if (value === '') {
      onUpdate(index, { ...peak, width: 50 });
    }
  };

  return (
    <div className="bg-slate-700 p-2 rounded space-y-1.5">
      <div className="flex gap-1.5">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Wavenumber (cm⁻¹)"
            value={peak.wavenumber || ''}
            onChange={(e) => handleWavenumberChange(e.target.value)}
            onFocus={() => setShowWarning(true)}
            className={`w-full bg-slate-900 border ${getWavenumberBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base`}
            title={wavenumberValidation.warning || 'FTIR wavenumber (cm⁻¹)'}
          />
        </div>
        <input
          type="text"
          placeholder="Intensity (0-100)"
          value={peak.intensity || ''}
          onChange={(e) => handleIntensityChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        />
        <select
          value={peak.type || 'medium'}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        >
          <option value="strong">Strong</option>
          <option value="medium">Medium</option>
          <option value="weak">Weak</option>
        </select>
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="Width (cm⁻¹)"
          value={peak.width || ''}
          onChange={(e) => handleWidthChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        />
        <input
          type="text"
          placeholder="Assignment (optional)"
          value={peak.assignment || ''}
          onChange={(e) => onUpdate(index, { ...peak, assignment: e.target.value })}
          className="flex-2 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        />
      </div>

      {/* Warning messages */}
      {showWarning && wavenumberValidation.warning && (
        <div className={`text-[10px] @sm:text-xs p-1.5 rounded ${!wavenumberValidation.isValid ? 'bg-red-900/30 text-red-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
          {!wavenumberValidation.isValid && (
            <div>⚠️ {wavenumberValidation.warning}</div>
          )}
          {wavenumberValidation.isValid && wavenumberValidation.warning && (
            <div>💡 {wavenumberValidation.warning}</div>
          )}
          {wavenumberValidation.suggestion && (
            <div className="text-slate-400 mt-0.5">→ {wavenumberValidation.suggestion}</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs @sm:text-sm @lg:text-base text-slate-300">
          {peak.wavenumber} cm⁻¹ ({peak.type}, {peak.intensity})
        </span>
        <button
          onClick={() => onRemove(index)}
          className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-xs @sm:text-sm @lg:text-base font-bold transition"
        >
          Sil
        </button>
      </div>
    </div>
  );
}
