'use client';

import { useState } from 'react';
import NMRChart from '@/components/charts/NMRChart';
import type { NMRPeak } from '@/lib/types';
import type { UnifiedSpectrum } from '@/packages/schemas';

type Engine = 'spectromind' | 'spectrotester' | 'hybrid';

function spectrumToNMRPeaks(spectrum: UnifiedSpectrum): NMRPeak[] {
  if (!spectrum.nmr1h?.peaks?.length) return [];
  return spectrum.nmr1h.peaks.map((p) => ({
    shift: p.ppm_or_mz,
    integ: p.integ ?? 1,
    mult: p.mult ?? 's',
    label: p.label,
  }));
}

export default function SimulatePage() {
  const [smiles, setSmiles] = useState('');
  const [engine, setEngine] = useState<Engine>('spectromind');
  const [solvent, setSolvent] = useState('DMSO-d6');
  const [frequency, setFrequency] = useState(400);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spectrum, setSpectrum] = useState<UnifiedSpectrum | null>(null);

  const handleRun = async () => {
    if (!smiles.trim()) {
      setError('SMILES girin.');
      return;
    }
    setError(null);
    setSpectrum(null);
    setLoading(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smiles: smiles.trim(),
          engine,
          solvent,
          frequency_MHz: frequency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || res.statusText);
        return;
      }
      if (data.spectrum) setSpectrum(data.spectrum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İstek başarısız');
    } finally {
      setLoading(false);
    }
  };

  const nmrPeaks = spectrum ? spectrumToNMRPeaks(spectrum) : [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Spektrum Simülasyonu</h1>
        <p className="text-slate-400">
          SMILES girip motor seçin; 1H NMR simülasyonu üretilir. Chem Core açıksa parse/features da kullanılır.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">SMILES</label>
            <input
              type="text"
              value={smiles}
              onChange={(e) => setSmiles(e.target.value)}
              placeholder="örn. CCO"
              className="w-full rounded bg-slate-800 border border-slate-600 px-3 py-2 text-white placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Motor</label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as Engine)}
              className="w-full rounded bg-slate-800 border border-slate-600 px-3 py-2 text-white"
            >
              <option value="spectromind">SpectroMind Engine</option>
              <option value="spectrotester">Spectrotester Rule Engine</option>
              <option value="hybrid">Hybrid (ikisi)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Çözücü</label>
            <select
              value={solvent}
              onChange={(e) => setSolvent(e.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-600 px-3 py-2 text-white"
            >
              <option value="DMSO-d6">DMSO-d6</option>
              <option value="CDCl3">CDCl3</option>
              <option value="CD3OD">CD3OD</option>
              <option value="D2O">D2O</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Frekans (MHz)</label>
            <input
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value) || 400)}
              min={300}
              max={900}
              className="w-full rounded bg-slate-800 border border-slate-600 px-3 py-2 text-white"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRun}
            disabled={loading}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Hesaplanıyor…' : 'Simülasyonu Çalıştır'}
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 font-medium"
          >
            Ana sayfa
          </a>
        </div>

        {error && (
          <div className="rounded bg-red-900/30 border border-red-600 text-red-200 px-4 py-2">
            {error}
          </div>
        )}

        {spectrum?.nmr1h && (
          <div className="rounded border border-slate-700 overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 text-slate-300 text-sm">
              1H NMR simülasyonu ({spectrum.source_engine || 'spectromind'}) — {nmrPeaks.length} sinyal
            </div>
            <div className="p-4 bg-slate-900">
              <NMRChart
                peaks={nmrPeaks}
                solvent={solvent}
                frequency={frequency}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
