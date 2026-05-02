'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ProcessingStepKind, ProcessingStep } from '@/lib/core/models/NormalizedDataset';
import { ProcessingGraph, getRegisteredSteps } from '@/lib/nmr/processing/ProcessingGraph';
import '@/lib/nmr/processing/steps';

interface StepDefinition {
  kind: ProcessingStepKind;
  label: string;
  description: string;
  defaultParams: Record<string, unknown>;
  paramSchema: ParamField[];
}

interface ParamField {
  key: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue: unknown;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    kind: 'apodization',
    label: 'Apodization',
    description: 'Window function applied to FID before FT to improve SNR or resolution',
    defaultParams: { window: 'exp', lbHz: 1.0, gbHz: 0.3 },
    paramSchema: [
      {
        key: 'window', label: 'Window', type: 'select',
        options: [
          { value: 'exp', label: 'Exponential' },
          { value: 'gauss', label: 'Gaussian' },
          { value: 'sine', label: 'Sine Bell' },
          { value: 'cosine', label: 'Cosine Bell' },
        ],
        defaultValue: 'exp',
      },
      { key: 'lbHz', label: 'Line Broadening (Hz)', type: 'number', min: 0, max: 50, step: 0.1, defaultValue: 1.0 },
      { key: 'gbHz', label: 'Gaussian Factor', type: 'number', min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
    ],
  },
  {
    kind: 'zero_fill',
    label: 'Zero Filling',
    description: 'Append zeros to FID to increase digital resolution (always power of 2)',
    defaultParams: { factor: 2 },
    paramSchema: [
      {
        key: 'factor', label: 'Factor', type: 'select',
        options: [
          { value: '1', label: '1x (next pow2)' },
          { value: '2', label: '2x' },
          { value: '4', label: '4x' },
          { value: '8', label: '8x' },
        ],
        defaultValue: '2',
      },
    ],
  },
  {
    kind: 'ft',
    label: 'Fourier Transform',
    description: 'Convert time-domain FID to frequency-domain spectrum',
    defaultParams: {},
    paramSchema: [],
  },
  {
    kind: 'phase',
    label: 'Phase Correction',
    description: 'Correct zero-order (ph0) and first-order (ph1) phase errors',
    defaultParams: { mode: 'auto_entropy', ph0: 0, ph1: 0 },
    paramSchema: [
      {
        key: 'mode', label: 'Mode', type: 'select',
        options: [
          { value: 'auto_entropy', label: 'Auto Entropy' },
          { value: 'regions_analysis', label: 'Regions Analysis' },
          { value: 'manual_ph0_ph1', label: 'Manual PH0/PH1' },
        ],
        defaultValue: 'auto_entropy',
      },
      { key: 'ph0', label: 'PH0 (degrees)', type: 'number', min: -360, max: 360, step: 0.5, defaultValue: 0 },
      { key: 'ph1', label: 'PH1 (degrees)', type: 'number', min: -360, max: 360, step: 0.5, defaultValue: 0 },
    ],
  },
  {
    kind: 'baseline',
    label: 'Baseline Correction',
    description: 'Remove baseline distortions using polynomial or Bernstein fit',
    defaultParams: { algorithm: 'xi_rocke_ps', degree: 5 },
    paramSchema: [
      {
        key: 'algorithm', label: 'Method', type: 'select',
        options: [
          { value: 'xi_rocke_ps', label: 'Xi-Rocke Penalized Smoothing' },
          { value: 'polynomial', label: 'Polynomial' },
          { value: 'bernstein', label: 'Bernstein' },
          { value: 'whittaker_smoother', label: 'Whittaker Smoother' },
        ],
        defaultValue: 'xi_rocke_ps',
      },
      { key: 'degree', label: 'Polynomial Degree', type: 'number', min: 1, max: 12, step: 1, defaultValue: 5 },
    ],
  },
  {
    kind: 'reference',
    label: 'Referencing',
    description: 'Set chemical shift reference using TMS, solvent, or manual point',
    defaultParams: {
      method: 'solvent',
      target_ppm: 0,
      solvent: 'CDCl3',
      nucleus: '1H',
      standard: 'solvent',
      confidence: 'high',
    },
    paramSchema: [
      {
        key: 'method', label: 'Method', type: 'select',
        options: [
          { value: 'manual', label: 'Manual' },
          { value: 'solvent', label: 'Solvent' },
          { value: 'tms', label: 'TMS' },
        ],
        defaultValue: 'solvent',
      },
      { key: 'target_ppm', label: 'Target PPM', type: 'number', min: -20, max: 250, step: 0.01, defaultValue: 0 },
      {
        key: 'solvent', label: 'Solvent', type: 'select',
        options: [
          { value: 'CDCl3', label: 'CDCl3' },
          { value: 'DMSO-d6', label: 'DMSO-d6' },
          { value: 'D2O', label: 'D2O' },
          { value: 'CD3OD', label: 'CD3OD' },
          { value: 'Acetone-d6', label: 'Acetone-d6' },
          { value: 'C6D6', label: 'C6D6' },
          { value: 'THF-d8', label: 'THF-d8' },
        ],
        defaultValue: 'CDCl3',
      },
      {
        key: 'nucleus', label: 'Nucleus', type: 'select',
        options: [
          { value: '1H', label: '1H' },
          { value: '13C', label: '13C' },
        ],
        defaultValue: '1H',
      },
      {
        key: 'standard', label: 'Standard', type: 'select',
        options: [
          { value: 'solvent', label: 'Solvent' },
          { value: 'TMS', label: 'TMS' },
          { value: 'manual', label: 'Manual' },
        ],
        defaultValue: 'solvent',
      },
      {
        key: 'confidence', label: 'Lock Confidence', type: 'select',
        options: [
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ],
        defaultValue: 'high',
      },
    ],
  },
];

interface NMRProcessingPanelProps {
  graph: ProcessingGraph;
  onGraphChanged: () => void;
  onExecute: () => void;
  isProcessing?: boolean;
}

function StepParamEditor({
  step,
  definition,
  onParamChange,
}: {
  step: ProcessingStep;
  definition: StepDefinition;
  onParamChange: (key: string, value: unknown) => void;
}) {
  if (definition.paramSchema.length === 0) {
    return <p className="text-xs text-slate-500 italic">Parametre gerektirmez</p>;
  }

  return (
    <div className="space-y-2 mt-2">
      {definition.paramSchema.map((field) => {
        const value = step.params[field.key] ?? field.defaultValue;

        if (field.type === 'select') {
          return (
            <label key={field.key} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{field.label}</span>
              <select
                className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:border-sky-500 outline-none"
                value={String(value)}
                onChange={(e) => onParamChange(field.key, e.target.value)}
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          );
        }

        if (field.type === 'number') {
          return (
            <label key={field.key} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{field.label}</span>
              <input
                type="number"
                className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 w-24 border border-slate-600 focus:border-sky-500 outline-none"
                value={Number(value)}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={(e) => onParamChange(field.key, parseFloat(e.target.value) || 0)}
              />
            </label>
          );
        }

        if (field.type === 'boolean') {
          return (
            <label key={field.key} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{field.label}</span>
              <input
                type="checkbox"
                className="rounded"
                checked={Boolean(value)}
                onChange={(e) => onParamChange(field.key, e.target.checked)}
              />
            </label>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function NMRProcessingPanel({ graph, onGraphChanged, onExecute, isProcessing }: NMRProcessingPanelProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const steps = useMemo(() => [...graph.getSteps()], [graph, onGraphChanged]);

  const registeredKinds = useMemo(() => {
    const r = getRegisteredSteps();
    return r;
  }, []);

  const handleAddStep = useCallback((kind: ProcessingStepKind) => {
    const def = STEP_DEFINITIONS.find(d => d.kind === kind);
    const step: ProcessingStep = {
      kind,
      params: def ? { ...def.defaultParams } : {},
      enabled: true,
    };
    graph.addStep(step);
    setShowAddMenu(false);
    onGraphChanged();
  }, [graph, onGraphChanged]);

  const handleRemoveStep = useCallback((index: number) => {
    graph.removeStep(index);
    setExpandedStep(null);
    onGraphChanged();
  }, [graph, onGraphChanged]);

  const handleToggleStep = useCallback((index: number) => {
    graph.toggleStep(index);
    onGraphChanged();
  }, [graph, onGraphChanged]);

  const handleMoveStep = useCallback((from: number, to: number) => {
    graph.moveStep(from, to);
    onGraphChanged();
  }, [graph, onGraphChanged]);

  const handleParamChange = useCallback((index: number, key: string, value: unknown) => {
    graph.updateStepParams(index, { [key]: value });
    onGraphChanged();
  }, [graph, onGraphChanged]);

  const handleSaveTemplate = useCallback(() => {
    const template = graph.toTemplate();
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `processing_template_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graph]);

  const handleLoadTemplate = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const template = JSON.parse(text);
        if (template.steps && Array.isArray(template.steps)) {
          const newGraph = ProcessingGraph.fromTemplate(template);
          const newSteps = newGraph.getSteps();
          while (graph.getSteps().length > 0) graph.removeStep(0);
          for (const s of newSteps) graph.addStep(s);
          onGraphChanged();
        }
      } catch {
        console.error('Template parse error');
      }
    };
    input.click();
  }, [graph, onGraphChanged]);

  const availableSteps = STEP_DEFINITIONS.filter(d =>
    registeredKinds.includes(d.kind)
  );

  const warnings: string[] = [];
  const hasPhase = steps.some(s => s.kind === 'phase' && s.enabled);
  const hasFT = steps.some(s => s.kind === 'ft' && s.enabled);
  const hasBaseline = steps.some(s => s.kind === 'baseline' && s.enabled);
  if (hasBaseline && !hasPhase) {
    warnings.push('Baseline correction without phase correction may produce artifacts');
  }
  if (hasPhase && !hasFT) {
    warnings.push('Phase correction requires frequency-domain data (FT must precede)');
  }

  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200">NMR Processing</h3>
        <div className="flex gap-1">
          <button
            onClick={handleLoadTemplate}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            title="Load processing template"
          >
            Load
          </button>
          <button
            onClick={handleSaveTemplate}
            className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            title="Save as processing template"
          >
            Save
          </button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-700/50">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400">⚠ {w}</p>
          ))}
        </div>
      )}

      {/* Step list */}
      <div className="flex-1 overflow-y-auto">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
            <p>No processing steps</p>
            <p className="text-xs mt-1">Click + to add steps</p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-700/50">
            {steps.map((step, index) => {
              const def = STEP_DEFINITIONS.find(d => d.kind === step.kind);
              const isExpanded = expandedStep === index;

              return (
                <li key={`${step.kind}-${index}`} className={`px-3 py-2 ${!step.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    {/* Step number */}
                    <span className="text-xs text-slate-500 w-5 text-right">{index + 1}</span>

                    {/* Enable/disable */}
                    <button
                      onClick={() => handleToggleStep(index)}
                      className={`w-4 h-4 rounded border ${step.enabled ? 'bg-sky-500 border-sky-400' : 'bg-slate-700 border-slate-600'}`}
                      title={step.enabled ? 'Disable step' : 'Enable step'}
                    >
                      {step.enabled && (
                        <svg className="w-3 h-3 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Label */}
                    <button
                      onClick={() => setExpandedStep(isExpanded ? null : index)}
                      className="flex-1 text-left text-sm text-slate-200 hover:text-sky-400 transition-colors"
                    >
                      {def?.label ?? step.kind}
                    </button>

                    {/* Move buttons */}
                    <button
                      onClick={() => handleMoveStep(index, index - 1)}
                      disabled={index === 0}
                      className="text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveStep(index, index + 1)}
                      disabled={index === steps.length - 1}
                      className="text-slate-500 hover:text-slate-300 disabled:opacity-30 text-xs"
                      title="Move down"
                    >
                      ▼
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemoveStep(index)}
                      className="text-red-500/60 hover:text-red-400 text-xs"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Expanded params */}
                  {isExpanded && def && (
                    <div className="mt-2 ml-7 p-2 bg-slate-900/50 rounded border border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">{def.description}</p>
                      <StepParamEditor
                        step={step}
                        definition={def}
                        onParamChange={(key, value) => handleParamChange(index, key, value)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Add step menu */}
      <div className="relative border-t border-slate-700">
        {showAddMenu && (
          <div className="absolute bottom-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-t shadow-xl max-h-48 overflow-y-auto z-10">
            {availableSteps.map((def) => (
              <button
                key={def.kind}
                onClick={() => handleAddStep(def.kind)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors"
              >
                <span className="text-slate-200">{def.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{def.description}</p>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 p-3">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex-1 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
          >
            + Add Step
          </button>
          <button
            onClick={onExecute}
            disabled={isProcessing || steps.length === 0}
            className="flex-1 px-3 py-2 text-sm bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
