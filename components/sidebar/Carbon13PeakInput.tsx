'use client';

import { Carbon13Peak } from '@/lib/types';
import { validateCarbonShift } from '@/lib/utils/peakValidation';
import { useState } from 'react';

interface Carbon13PeakInputProps {
  peak: Carbon13Peak;
  index: number;
  onUpdate: (index: number, peak: Carbon13Peak) => void;
  onRemove: (index: number) => void;
}

export default function Carbon13PeakInput({ peak, index, onUpdate, onRemove }: Carbon13PeakInputProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Validate 13C chemical shift
  const shiftValidation = validateCarbonShift(peak.ppm);

  const getShiftBorderClass = () => {
    if (!shiftValidation.isValid) return 'border-red-500';
    if (shiftValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  return (
    <div className="bg-slate-700 p-2 rounded space-y-1.5">
      <div className="flex gap-1.5">
        <div className="flex-1 min-w-0">
          <input
            type="number"
            step="0.01"
            placeholder="δ (ppm)"
            value={peak.ppm || ''}
            onChange={(e) => {
              onUpdate(index, { ...peak, ppm: parseFloat(e.target.value) || 0 });
              setShowWarning(true);
            }}
            onFocus={() => setShowWarning(true)}
            className={`w-full bg-slate-900 border ${getShiftBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base`}
            title={shiftValidation.warning || '13C chemical shift (δ in ppm)'}
          />
        </div>
        <select
          value={peak.carbonType || ''}
          onChange={(e) => onUpdate(index, { ...peak, carbonType: e.target.value as any })}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        >
          <option value="">Tip</option>
          <option value="CH3">CH₃</option>
          <option value="CH2">CH₂</option>
          <option value="CH">CH</option>
          <option value="Cq">Cq</option>
        </select>
        <input
          type="number"
          step="1"
          placeholder="Intensity"
          value={peak.intensity || ''}
          onChange={(e) => onUpdate(index, { ...peak, intensity: parseFloat(e.target.value) || 100 })}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        />
      </div>

      {/* Warning messages */}
      {showWarning && shiftValidation.warning && (
        <div className={`text-[10px] @sm:text-xs p-1.5 rounded ${!shiftValidation.isValid ? 'bg-red-900/30 text-red-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
          {!shiftValidation.isValid && (
            <div>⚠️ {shiftValidation.warning}</div>
          )}
          {shiftValidation.isValid && shiftValidation.warning && (
            <div>💡 {shiftValidation.warning}</div>
          )}
          {shiftValidation.suggestion && (
            <div className="text-slate-400 mt-0.5">→ {shiftValidation.suggestion}</div>
          )}
        </div>
      )}

      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          placeholder="Assignment (örn: C-1, C=O)"
          value={peak.assignment || ''}
          onChange={(e) => onUpdate(index, { ...peak, assignment: e.target.value })}
          className="flex-1 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0"
        />

        <button
          onClick={() => onRemove(index)}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs @sm:text-sm @lg:text-base font-bold transition"
        >
          Sil
        </button>
      </div>
    </div>
  );
}
