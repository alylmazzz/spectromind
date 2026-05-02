'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';

export interface ManualPhaseRefPanelProps {
  visible: boolean;
  currentPh0: number;
  currentPh1: number;
  phaseMode: 'auto' | 'manual';
  currentRefOffset: number;
  refMode: 'auto' | 'manual' | 'none';
  solventHint?: string;
  onPhaseChange: (ph0: number, ph1: number) => void;
  onPhaseReset: () => void;
  onPhaseApply: (ph0: number, ph1: number) => void;
  onRefOffsetChange: (offset: number) => void;
  onRefReset: () => void;
  onRefApply: (offset: number, solventPreset?: string) => void;
}

const SOLVENT_PRESETS: ReadonlyArray<{ id: string; label: string; ppm: number }> = [
  { id: 'CDCl3', label: 'CDCl₃ (7.26 ppm)', ppm: 7.26 },
  { id: 'DMSO-d6', label: 'DMSO-d₆ (2.50 ppm)', ppm: 2.5 },
  { id: 'D2O', label: 'D₂O (4.79 ppm)', ppm: 4.79 },
  { id: 'CD3OD', label: 'CD₃OD (3.31 ppm)', ppm: 3.31 },
  { id: 'Acetone-d6', label: 'Acetone-d₆ (2.05 ppm)', ppm: 2.05 },
  { id: 'CD2Cl2', label: 'CD₂Cl₂ (5.32 ppm)', ppm: 5.32 },
  { id: 'C6D6', label: 'C₆D₆ (7.16 ppm)', ppm: 7.16 },
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundStep(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function phaseProvenanceLabel(mode: 'auto' | 'manual'): string {
  return mode === 'auto' ? 'Otomatik' : 'Manuel';
}

function refProvenanceLabel(mode: 'auto' | 'manual' | 'none'): string {
  if (mode === 'none') return 'Bekleniyor';
  return mode === 'auto' ? 'Otomatik' : 'Manuel';
}

export default function ManualPhaseRefPanel({
  visible,
  currentPh0,
  currentPh1,
  phaseMode,
  currentRefOffset,
  refMode,
  solventHint,
  onPhaseChange,
  onPhaseReset,
  onPhaseApply,
  onRefOffsetChange,
  onRefReset,
  onRefApply,
}: ManualPhaseRefPanelProps) {
  const baseId = useId();
  const [ph0, setPh0] = useState(() => clamp(roundStep(currentPh0, 0.5), -180, 180));
  const [ph1, setPh1] = useState(() => clamp(roundStep(currentPh1, 1), -360, 360));
  const [refOffset, setRefOffset] = useState(() =>
    Number.isFinite(currentRefOffset) ? Math.round(currentRefOffset * 100) / 100 : 0
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  useEffect(() => {
    setPh0(clamp(roundStep(currentPh0, 0.5), -180, 180));
  }, [currentPh0]);

  useEffect(() => {
    setPh1(clamp(roundStep(currentPh1, 1), -360, 360));
  }, [currentPh1]);

  useEffect(() => {
    if (Number.isFinite(currentRefOffset)) {
      setRefOffset(Math.round(currentRefOffset * 100) / 100);
    }
  }, [currentRefOffset]);

  const emitPhase = useCallback(
    (nextPh0: number, nextPh1: number) => {
      const p0 = clamp(roundStep(nextPh0, 0.5), -180, 180);
      const p1 = clamp(roundStep(nextPh1, 1), -360, 360);
      onPhaseChange(p0, p1);
    },
    [onPhaseChange]
  );

  const handlePh0 = useCallback(
    (v: number) => {
      setPh0(v);
      emitPhase(v, ph1);
    },
    [emitPhase, ph1]
  );

  const handlePh1 = useCallback(
    (v: number) => {
      setPh1(v);
      emitPhase(ph0, v);
    },
    [emitPhase, ph0]
  );

  const handlePhaseApply = useCallback(() => {
    const p0 = clamp(roundStep(ph0, 0.5), -180, 180);
    const p1 = clamp(roundStep(ph1, 1), -360, 360);
    onPhaseApply(p0, p1);
  }, [onPhaseApply, ph0, ph1]);

  const handleRefInput = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw.replace(',', '.'));
      if (!Number.isFinite(parsed)) return;
      const stepped = Math.round(parsed * 100) / 100;
      setRefOffset(stepped);
      onRefOffsetChange(stepped);
    },
    [onRefOffsetChange]
  );

  const handlePresetChange = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId);
      const preset = SOLVENT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const ppm = Math.round(preset.ppm * 100) / 100;
      setRefOffset(ppm);
      onRefOffsetChange(ppm);
    },
    [onRefOffsetChange]
  );

  const handleRefApply = useCallback(() => {
    const preset =
      selectedPresetId && SOLVENT_PRESETS.some((p) => p.id === selectedPresetId)
        ? selectedPresetId
        : undefined;
    onRefApply(refOffset, preset);
  }, [onRefApply, refOffset, selectedPresetId]);

  const presetOptions = useMemo(
    () =>
      SOLVENT_PRESETS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      )),
    []
  );

  if (!visible) return null;

  const phaseBadge =
    phaseMode === 'auto'
      ? 'bg-slate-700 text-sky-300 ring-1 ring-sky-500/40'
      : 'bg-slate-700 text-orange-300 ring-1 ring-orange-500/40';

  const refBadgeClass =
    refMode === 'none'
      ? 'bg-slate-700 text-slate-400 ring-1 ring-slate-500/50'
      : refMode === 'auto'
        ? 'bg-slate-700 text-sky-300 ring-1 ring-sky-500/40'
        : 'bg-slate-700 text-orange-300 ring-1 ring-orange-500/40';

  return (
    <div
      className="rounded-lg border border-slate-600 bg-slate-800/95 p-3 text-slate-200 shadow-inner backdrop-blur-sm"
      role="region"
      aria-label="Manuel faz ve referans düzeltmesi"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-600/80 pb-2">
        <h3 className="text-sm font-semibold tracking-tight text-slate-100">
          Faz ve referans (manuel)
        </h3>
        {solventHint ? (
          <p className="max-w-[14rem] truncate text-[11px] text-slate-400" title={solventHint}>
            Çözücü ipucu: {solventHint}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Faz */}
        <section className="space-y-2" aria-labelledby={`${baseId}-phase-title`}>
          <div className="flex items-center justify-between gap-2">
            <h4 id={`${baseId}-phase-title`} className="text-xs font-medium uppercase text-slate-400">
              Faz düzeltmesi
            </h4>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${phaseBadge}`}
            >
              {phaseMode === 'auto' ? 'otomatik' : 'manuel'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <label htmlFor={`${baseId}-ph0`}>ph₀ (°)</label>
              <span className="font-mono text-sky-300 tabular-nums">{ph0.toFixed(1)}</span>
            </div>
            <input
              id={`${baseId}-ph0`}
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={ph0}
              onChange={(e) => handlePh0(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <label htmlFor={`${baseId}-ph1`}>ph₁ (°)</label>
              <span className="font-mono text-sky-300 tabular-nums">{ph1.toFixed(0)}</span>
            </div>
            <input
              id={`${baseId}-ph1`}
              type="range"
              min={-360}
              max={360}
              step={1}
              value={ph1}
              onChange={(e) => handlePh1(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-orange-400"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onPhaseReset}
              className="rounded-md border border-slate-500 bg-slate-700/80 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Otomatik faza dön
            </button>
            <button
              type="button"
              onClick={handlePhaseApply}
              className="rounded-md bg-sky-500/90 px-2.5 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Uygula
            </button>
          </div>

          <p className="text-[10px] leading-snug text-slate-500">
            Kaynak: <span className="text-slate-400">{phaseProvenanceLabel(phaseMode)}</span>
          </p>
        </section>

        {/* Referans */}
        <section className="space-y-2" aria-labelledby={`${baseId}-ref-title`}>
          <div className="flex items-center justify-between gap-2">
            <h4 id={`${baseId}-ref-title`} className="text-xs font-medium uppercase text-slate-400">
              Referans ofseti
            </h4>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${refBadgeClass}`}
            >
              {refMode === 'auto' ? 'otomatik' : refMode === 'manual' ? 'manuel' : 'bekleniyor'}
            </span>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${baseId}-ref-ppm`} className="text-[11px] text-slate-400">
              Ofset (ppm)
            </label>
            <input
              id={`${baseId}-ref-ppm`}
              type="number"
              step={0.01}
              value={Number.isFinite(refOffset) ? refOffset : 0}
              onChange={(e) => handleRefInput(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900/80 px-2 py-1 font-mono text-sm text-slate-100 tabular-nums focus:border-orange-400/70 focus:outline-none focus:ring-1 focus:ring-orange-400/50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${baseId}-solvent`} className="text-[11px] text-slate-400">
              Çözücü ön ayarı
            </label>
            <select
              id={`${baseId}-solvent`}
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 focus:border-orange-400/70 focus:outline-none focus:ring-1 focus:ring-orange-400/50"
            >
              <option value="">Seçin…</option>
              {presetOptions}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onRefReset}
              className="rounded-md border border-slate-500 bg-slate-700/80 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              Sıfırla
            </button>
            <button
              type="button"
              onClick={handleRefApply}
              className="rounded-md bg-orange-500/90 px-2.5 py-1 text-xs font-semibold text-slate-950 transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              Uygula
            </button>
          </div>

          <p className="text-[10px] leading-snug text-slate-500">
            Kaynak: <span className="text-slate-400">{refProvenanceLabel(refMode)}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
