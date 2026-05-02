'use client';

import React, { useState } from 'react';
import { MSPeak } from '@/lib/types';

interface MSPeakInputProps {
  peak: MSPeak;
  index: number;
  onUpdate: (index: number, peak: MSPeak) => void;
  onRemove: (index: number) => void;
}

export default function MSPeakInput({ peak, index, onUpdate, onRemove }: MSPeakInputProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Validate m/z (should be positive and reasonable)
  const validateMz = (mz: number) => {
    if (mz <= 0) {
      return { isValid: false, warning: 'm/z değeri pozitif olmalıdır' };
    }
    if (mz > 10000) {
      return { isValid: false, warning: 'm/z değeri çok yüksek (max: 10000)' };
    }
    if (mz < 10) {
      return { isValid: true, warning: 'm/z değeri çok düşük olabilir' };
    }
    return { isValid: true, warning: null };
  };

  const mzValidation = validateMz(peak.mz);

  const getMzBorderClass = () => {
    if (!mzValidation.isValid) return 'border-red-500';
    if (mzValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  const handleMzChange = (value: string) => {
    const numValue = parseFloat(value);
    setShowWarning(true);
    if (!isNaN(numValue)) {
      onUpdate(index, { ...peak, mz: numValue });
    } else if (value === '') {
      onUpdate(index, { ...peak, mz: 0 });
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

  const handleAssignmentChange = (value: string) => {
    onUpdate(index, { ...peak, assignment: value, type: value });
  };

  const handleFormulaChange = (value: string) => {
    onUpdate(index, { ...peak, formula: value });
  };

  const handleChargeChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0) {
      onUpdate(index, { ...peak, charge: numValue });
    } else if (value === '') {
      onUpdate(index, { ...peak, charge: 1 });
    }
  };

  return (
    <div className="bg-slate-700 p-2 rounded space-y-1.5">
      <div className="flex gap-1.5">
        <div className="flex-1 min-w-0">
          <input
            type="number"
            step="0.01"
            placeholder="m/z"
            value={peak.mz || ''}
            onChange={(e) => handleMzChange(e.target.value)}
            onFocus={() => setShowWarning(true)}
            className={`w-full bg-slate-900 border ${getMzBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base`}
            title={mzValidation.warning || 'Mass-to-charge ratio (m/z)'}
          />
        </div>
        <input
          type="number"
          step="0.1"
          placeholder="Intensity (%)"
          value={peak.intensity || ''}
          onChange={(e) => handleIntensityChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
          min="0"
          max="100"
        />
        <input
          type="number"
          step="1"
          placeholder="Charge"
          value={peak.charge || 1}
          onChange={(e) => handleChargeChange(e.target.value)}
          className="w-20 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base"
          min="1"
        />
      </div>

      <div className="flex gap-1.5">
        <select
          value={peak.assignment || peak.type || ''}
          onChange={(e) => handleAssignmentChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        >
          <option value="">Assignment seçin</option>
          <option value="M+">M+ (Molecular Ion)</option>
          <option value="[M+H]+">[M+H]+</option>
          <option value="[M+Na]+">[M+Na]+</option>
          <option value="[M+K]+">[M+K]+</option>
          <option value="Fragment">Fragment</option>
        </select>
        <input
          type="text"
          placeholder="Formula (optional)"
          value={peak.formula || ''}
          onChange={(e) => handleFormulaChange(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        />
      </div>

      {/* Warning messages */}
      {showWarning && mzValidation.warning && (
        <div className={`text-[10px] @sm:text-xs p-1.5 rounded ${!mzValidation.isValid ? 'bg-red-900/30 text-red-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
          {!mzValidation.isValid && (
            <div>⚠️ {mzValidation.warning}</div>
          )}
          {mzValidation.isValid && mzValidation.warning && (
            <div>💡 {mzValidation.warning}</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs @sm:text-sm @lg:text-base text-slate-300">
          m/z {peak.mz?.toFixed(2) || '0.00'} ({peak.assignment || 'N/A'}, {peak.intensity?.toFixed(1) || '0'}%)
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

