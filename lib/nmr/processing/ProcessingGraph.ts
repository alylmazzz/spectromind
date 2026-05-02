import type { ProcessingStep } from '@/lib/core/models/NormalizedDataset';
import { AuditService } from '@/lib/core/audit/AuditService';
import { normalizeProcessingParams } from './paramSchema';

export interface SpectrumBuffer {
  real: Float64Array;
  imag?: Float64Array;
  size: number;
  domain: 'time' | 'frequency';
  referenceFreqHz?: number;
  spectralWidthHz?: number;
}

export interface ProcessingState {
  originalFid: SpectrumBuffer;
  processedFid?: SpectrumBuffer;
  afterFt?: SpectrumBuffer;
  finalSpectrum?: SpectrumBuffer;
  currentStep: number;
  history: ProcessingStep[];
}

export type StepExecutor = (
  input: SpectrumBuffer,
  params: Record<string, unknown>
) => SpectrumBuffer;

const stepRegistry = new Map<string, StepExecutor>();

export function registerStep(kind: string, executor: StepExecutor): void {
  stepRegistry.set(kind, executor);
}

export function getRegisteredSteps(): string[] {
  return Array.from(stepRegistry.keys());
}

export class ProcessingGraph {
  private steps: ProcessingStep[] = [];
  private state: ProcessingState | null = null;

  constructor(initialSteps?: ProcessingStep[]) {
    if (initialSteps) {
      this.steps = [...initialSteps];
    }
  }

  addStep(step: ProcessingStep): void {
    this.steps.push(step);
  }

  insertStep(index: number, step: ProcessingStep): void {
    this.steps.splice(index, 0, step);
  }

  removeStep(index: number): ProcessingStep | undefined {
    return this.steps.splice(index, 1)[0];
  }

  moveStep(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.steps.length) return;
    if (toIndex < 0 || toIndex >= this.steps.length) return;
    const [step] = this.steps.splice(fromIndex, 1);
    this.steps.splice(toIndex, 0, step);
  }

  toggleStep(index: number): void {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index] = {
        ...this.steps[index],
        enabled: !this.steps[index].enabled,
      };
    }
  }

  updateStepParams(index: number, params: Record<string, unknown>): void {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index] = {
        ...this.steps[index],
        params: { ...this.steps[index].params, ...params },
      };
    }
  }

  getSteps(): readonly ProcessingStep[] {
    return this.steps;
  }

  getEnabledSteps(): ProcessingStep[] {
    return this.steps.filter(s => s.enabled);
  }

  execute(inputFid: SpectrumBuffer): ProcessingState {
    const state: ProcessingState = {
      originalFid: inputFid,
      currentStep: 0,
      history: [...this.steps],
    };

    let current = inputFid;
    const enabledSteps = this.getEnabledSteps();

    for (let i = 0; i < enabledSteps.length; i++) {
      const step = enabledSteps[i];
      const executor = stepRegistry.get(step.kind);

      if (!executor) {
        console.warn(`[ProcessingGraph] No executor for step "${step.kind}", skipping`);
        continue;
      }

      const startTime = performance.now();
      const normalizedParams = normalizeProcessingParams(step.kind, step.params);
      current = executor(current, normalizedParams);
      const durationMs = Math.round(performance.now() - startTime);

      AuditService.log('processing.apply_step', 'nmr.processing', {
        step: step.kind,
        params: normalizedParams,
        stepIndex: i,
        durationMs,
      });

      state.currentStep = i + 1;

      if (step.kind === 'ft' && !state.afterFt) {
        state.afterFt = { ...current, real: new Float64Array(current.real) };
        if (current.imag) {
          state.afterFt.imag = new Float64Array(current.imag);
        }
      }
    }

    state.processedFid = state.afterFt ? undefined : current;
    state.finalSpectrum = current;

    this.state = state;
    return state;
  }

  getState(): ProcessingState | null {
    return this.state;
  }

  toTemplate(): ProcessingTemplate {
    return {
      id: `tmpl_${Date.now()}`,
      name: 'Untitled Template',
      steps: this.steps.map(s => ({ ...s })),
      createdAt: new Date().toISOString(),
    };
  }

  static fromTemplate(template: ProcessingTemplate): ProcessingGraph {
    return new ProcessingGraph(template.steps);
  }

  toJSON(): ProcessingStep[] {
    return this.steps.map(s => ({ ...s }));
  }

  static fromJSON(json: ProcessingStep[]): ProcessingGraph {
    return new ProcessingGraph(json);
  }
}

export interface ProcessingTemplate {
  id: string;
  name: string;
  description?: string;
  steps: ProcessingStep[];
  forModality?: string;
  forNucleus?: string;
  createdAt: string;
}
