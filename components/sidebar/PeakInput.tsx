'use client';

import { NMRPeak } from '@/lib/types';
import { validateProtonShift, validateIntegration, validateMultiplicityIntegration, validateCouplingConstant, determineCouplingContext, formatJValue } from '@/lib/utils/peakValidation';
import { predictCompoundTypes } from '@/lib/data/spectralAnalysisBoxes';
import { useState } from 'react';

interface PeakInputProps {
  peak: NMRPeak;
  index: number;
  onUpdate: (index: number, peak: NMRPeak) => void;
  onRemove: (index: number) => void;
}

export default function PeakInput({ peak, index, onUpdate, onRemove }: PeakInputProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [showSpectralInfo, setShowSpectralInfo] = useState(false);

  // Validate chemical shift
  const shiftValidation = validateProtonShift(peak.shift);
  const integValidation = validateIntegration(peak.integ);
  const multValidation = validateMultiplicityIntegration(peak.mult, peak.integ);

  // Validate coupling constant
  const couplingContext = determineCouplingContext(peak.shift);
  const couplingValidation = validateCouplingConstant(peak.coupling, peak.mult, couplingContext);

  // Determine border color based on validation
  const getShiftBorderClass = () => {
    if (!shiftValidation.isValid) return 'border-red-500';
    if (shiftValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  const getIntegBorderClass = () => {
    if (!integValidation.isValid) return 'border-red-500';
    if (integValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  const getMultBorderClass = () => {
    if (!multValidation.isValid) return 'border-red-500';
    if (multValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  const getCouplingBorderClass = () => {
    if (!couplingValidation.isValid) return 'border-red-500';
    if (couplingValidation.warning) return 'border-yellow-500';
    return 'border-slate-600';
  };

  // Get possible compound types based on chemical shift
  const possibleCompounds = peak.shift > 0 ? predictCompoundTypes(peak.shift) : [];

  return (
    <div className="bg-slate-700 p-2 rounded space-y-1.5">
      <div className="flex gap-1.5">
        <div className="flex-1 min-w-0">
          <input
            type="number"
            step="0.01"
            placeholder="δ"
            value={peak.shift || ''}
            onChange={(e) => {
              onUpdate(index, { ...peak, shift: parseFloat(e.target.value) });
              setShowWarning(true);
            }}
            onFocus={() => setShowWarning(true)}
            className={`w-full bg-slate-900 border ${getShiftBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base`}
            title={shiftValidation.warning || 'Chemical shift (δ in ppm)'}
          />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="number"
            step="0.1"
            placeholder="Int"
            value={peak.integ || ''}
            onChange={(e) => onUpdate(index, { ...peak, integ: parseFloat(e.target.value) })}
            className={`w-full bg-slate-900 border ${getIntegBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base`}
            title={integValidation.warning || 'Integration value'}
          />
        </div>

        <select
          value={peak.mult || 's'}
          onChange={(e) => {
            onUpdate(index, { ...peak, mult: e.target.value });
            setShowWarning(true);
          }}
          className={`flex-1 bg-slate-900 border ${getMultBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base min-w-0`}
          title={multValidation.warning || 'Multiplicity'}
        >
          <optgroup label="Basit Multiplisiteler">
            <option value="s">s (singlet)</option>
            <option value="d">d (doublet)</option>
            <option value="t">t (triplet)</option>
            <option value="q">q (quartet)</option>
            <option value="quint">quint (quintet)</option>
            <option value="sext">sext (sextet)</option>
            <option value="sept">sept (septet)</option>
            <option value="oct">oct (octet)</option>
            <option value="non">non (nonet)</option>
          </optgroup>
          <optgroup label="İkili Kombinasyonlar">
            <option value="dd">dd (doublet of doublets)</option>
            <option value="dt">dt (doublet of triplets)</option>
            <option value="td">td (triplet of doublets)</option>
            <option value="dq">dq (doublet of quartets)</option>
            <option value="qd">qd (quartet of doublets)</option>
            <option value="tt">tt (triplet of triplets)</option>
            <option value="tq">tq (triplet of quartets)</option>
            <option value="qt">qt (quartet of triplets)</option>
            <option value="qq">qq (quartet of quartets)</option>
          </optgroup>
          <optgroup label="Üçlü Kombinasyonlar">
            <option value="ddd">ddd (doublet of doublet of doublets)</option>
            <option value="ddt">ddt (doublet of doublet of triplets)</option>
            <option value="dtd">dtd (doublet of triplet of doublets)</option>
            <option value="tdd">tdd (triplet of doublet of doublets)</option>
            <option value="dtt">dtt (doublet of triplet of triplets)</option>
            <option value="tdt">tdt (triplet of doublet of triplets)</option>
            <option value="ttd">ttd (triplet of triplet of doublets)</option>
            <option value="ttt">ttt (triplet of triplet of triplets)</option>
            <option value="ddq">ddq (doublet of doublet of quartets)</option>
            <option value="dqd">dqd (doublet of quartet of doublets)</option>
            <option value="qdd">qdd (quartet of doublet of doublets)</option>
          </optgroup>
          <optgroup label="Dörtlü Kombinasyonlar">
            <option value="dddd">dddd (doublet of doublet of doublet of doublets)</option>
            <option value="dddt">dddt (doublet of doublet of doublet of triplets)</option>
            <option value="ddtd">ddtd (doublet of doublet of triplet of doublets)</option>
            <option value="dtdd">dtdd (doublet of triplet of doublet of doublets)</option>
            <option value="tddd">tddd (triplet of doublet of doublet of doublets)</option>
          </optgroup>
          <optgroup label="Broad (Geniş) Pikler">
            <option value="br">br (broad)</option>
            <option value="br s">br s (broad singlet)</option>
            <option value="br d">br d (broad doublet)</option>
            <option value="br t">br t (broad triplet)</option>
            <option value="br q">br q (broad quartet)</option>
            <option value="br m">br m (broad multiplet)</option>
          </optgroup>
          <optgroup label="Diğer">
            <option value="m">m (multiplet)</option>
            <option value="app t">app t (apparent triplet)</option>
            <option value="app q">app q (apparent quartet)</option>
            <option value="app d">app d (apparent doublet)</option>
          </optgroup>
        </select>
      </div>

      {/* Coupling constant (J value) row */}
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          placeholder="J (Hz) - virgülle ayırın: 8.9, 2.4"
          value={
            Array.isArray(peak.coupling)
              ? peak.coupling.map(v => v.toFixed(1)).join(', ')
              : peak.coupling
              ? peak.coupling.toString()
              : ''
          }
          onChange={(e) => {
            const inputValue = e.target.value.trim();
            if (!inputValue) {
              onUpdate(index, { ...peak, coupling: undefined });
              setShowWarning(true);
              return;
            }
            
            // Parse comma-separated values
            const values = inputValue
              .split(',')
              .map(v => parseFloat(v.trim()))
              .filter(v => !isNaN(v) && v > 0);
            
            if (values.length === 0) {
              onUpdate(index, { ...peak, coupling: undefined });
            } else if (values.length === 1) {
              onUpdate(index, { ...peak, coupling: values[0] });
            } else {
              onUpdate(index, { ...peak, coupling: values });
            }
            setShowWarning(true);
          }}
          className={`flex-1 bg-slate-900 border ${getCouplingBorderClass()} text-white px-2 py-1 rounded text-xs @sm:text-sm @lg:text-base`}
          title={couplingValidation.warning || 'Coupling constant J (Hz). Çoklu yarılmalar için virgülle ayırın: 8.9, 2.4'}
        />
        <span className="text-xs @sm:text-sm text-slate-400 min-w-[60px]">
          {formatJValue(peak.coupling)}
        </span>
      </div>

      {/* Warning messages */}
      {showWarning && (shiftValidation.warning || integValidation.warning || multValidation.warning || couplingValidation.warning) && (
        <div className={`text-[10px] @sm:text-xs p-1.5 rounded ${!shiftValidation.isValid || !integValidation.isValid || !multValidation.isValid || !couplingValidation.isValid ? 'bg-red-900/30 text-red-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
          {!shiftValidation.isValid && (
            <div>⚠️ {shiftValidation.warning}</div>
          )}
          {shiftValidation.isValid && shiftValidation.warning && (
            <div>💡 {shiftValidation.warning}</div>
          )}
          {!integValidation.isValid && (
            <div>⚠️ {integValidation.warning}</div>
          )}
          {!multValidation.isValid && (
            <div>⚠️ {multValidation.warning}</div>
          )}
          {multValidation.isValid && multValidation.warning && (
            <div>💡 {multValidation.warning}</div>
          )}
          {!couplingValidation.isValid && (
            <div>⚠️ {couplingValidation.warning}</div>
          )}
          {couplingValidation.isValid && couplingValidation.warning && (
            <div>💡 {couplingValidation.warning}</div>
          )}
          {shiftValidation.suggestion && (
            <div className="text-slate-400 mt-0.5">→ {shiftValidation.suggestion}</div>
          )}
          {multValidation.suggestion && (
            <div className="text-slate-400 mt-0.5">→ {multValidation.suggestion}</div>
          )}
          {couplingValidation.suggestion && (
            <div className="text-slate-400 mt-0.5">→ {couplingValidation.suggestion}</div>
          )}
          {couplingValidation.expectedCouplings && couplingValidation.expectedCouplings > 1 && (
            <div className="text-blue-300 mt-0.5">ℹ️ This multiplicity expects {couplingValidation.expectedCouplings} J values (currently supports 1)</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-xs @sm:text-sm @lg:text-base text-slate-300" title="Broad peak">
          <input
            type="checkbox"
            checked={peak.isBroad || false}
            onChange={(e) => onUpdate(index, { ...peak, isBroad: e.target.checked })}
            className="w-3 h-3"
          />
          <span>Broad</span>
        </label>

        <div className="flex gap-1">
          {possibleCompounds.length > 0 && (
            <button
              onClick={() => setShowSpectralInfo(!showSpectralInfo)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs @sm:text-sm @lg:text-base font-bold transition"
              title="Show possible compound types for this chemical shift"
            >
              {showSpectralInfo ? '▼' : 'ℹ️'}
            </button>
          )}
          <button
            onClick={() => onRemove(index)}
            className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-xs @sm:text-sm @lg:text-base font-bold transition"
          >
            Sil
          </button>
        </div>
      </div>

      {/* Spectral Analysis Info */}
      {showSpectralInfo && possibleCompounds.length > 0 && (
        <div className="bg-slate-900 border border-blue-500 rounded p-2 space-y-2 text-[10px] @sm:text-xs">
          <div className="font-bold text-blue-300">📚 Possible Compound Types (δ {peak.shift.toFixed(2)} ppm):</div>
          {possibleCompounds.map((box, idx) => {
            const matchingShifts = box.chemicalShifts.filter(
              cs => peak.shift >= cs.range[0] && peak.shift <= cs.range[1]
            );
            return (
              <div key={idx} className="bg-slate-800 p-1.5 rounded space-y-1">
                <div className="font-bold text-sky-300">{box.compoundType}</div>
                {matchingShifts.map((cs, csIdx) => (
                  <div key={csIdx} className="text-slate-300">
                    <div className="font-semibold text-yellow-300">{cs.group}: {cs.range[0]}-{cs.range[1]} ppm</div>
                    <div className="text-slate-400">→ {cs.description}</div>
                    {cs.typicalMultiplicity && (
                      <div className="text-slate-400">Typical: {cs.typicalMultiplicity.join(', ')}</div>
                    )}
                  </div>
                ))}
                {box.couplingConstants.length > 0 && (
                  <div className="text-slate-400 mt-1">
                    <div className="font-semibold">Coupling:</div>
                    {box.couplingConstants.map((coup, cIdx) => (
                      <div key={cIdx}>• {coup.type}: {coup.range[0]}-{coup.range[1]} Hz - {coup.description}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
