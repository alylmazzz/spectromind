import { create } from 'zustand';
import type { AnalyticalDocument } from '../models/AnalyticalDocument';
import { createDocument } from '../models/AnalyticalDocument';
import type { NormalizedDataset } from '../models/NormalizedDataset';
import type { MoleculeRecord } from '../models/MoleculeRecord';
import type { EvidenceNode } from '../models/EvidenceNode';
import type { AssignmentEdge } from '../models/AssignmentEdge';
import type { ProcessingStep } from '../models/NormalizedDataset';
import type { NMRPeak, Carbon13Peak, FTIRPeak, MSPeak, SpectrumType } from '@/lib/types';
import { AuditService } from '../audit/AuditService';
import { EventBus } from '../events/EventBus';

export type ActivePanel = 'nmr' | 'ms' | 'ir' | 'uv' | 'molecule' | 'verify' | 'report' | 'db' | 'settings';

export interface ObservedNmrOverlay {
  ppm: number[];
  intensity: number[];
  qcSummary?: string;
  yScaleMode?: string;
  advisedPresetApplied?: string;
  defaultXPpm?: [number, number];
  experimentType?: '1H' | '13C';
  sessionId?: string;
  autoPh0?: number;
  autoPh1?: number;
  autoRefOffset?: number;
  solventHint?: string;
  sourceFormat?: string;
  referenceMode?: string;
  sourcePackageComplete?: boolean;
  axisFallbackApplied?: boolean;
  axisFallbackReason?: string;
  qcRules?: Array<{ id: string; passed: boolean; severity: 'info' | 'warn' | 'fatal'; message: string }>;
  interpretationBlocked?: boolean;
}

export interface SpectroMindState {
  // --- Legacy spectroscopy session (bridges existing UI) ---
  peaks: NMRPeak[];
  carbon13Peaks: Carbon13Peak[];
  ftirPeaks: FTIRPeak[];
  msPeaks: MSPeak[];
  spectrumType: SpectrumType;
  solvent: string;
  frequency: number;
  formula: string;
  knownMolecule: unknown;
  observedNmrOverlay: ObservedNmrOverlay | null;
  observedNmrOverlayH1: ObservedNmrOverlay | null;
  observedNmrOverlayC13: ObservedNmrOverlay | null;
  fidSimulationPeaks: NMRPeak[] | null;

  setPeaks: (peaks: NMRPeak[]) => void;
  setCarbon13Peaks: (peaks: Carbon13Peak[]) => void;
  setFtirPeaks: (peaks: FTIRPeak[]) => void;
  setMsPeaks: (peaks: MSPeak[]) => void;
  setSpectrumType: (t: SpectrumType) => void;
  setSolvent: (s: string) => void;
  setFrequency: (f: number) => void;
  setFormula: (f: string) => void;
  setKnownMolecule: (m: unknown) => void;
  setObservedNmrOverlay: (o: ObservedNmrOverlay | null) => void;
  getActiveObservedNmrOverlay: () => ObservedNmrOverlay | null;
  setFidSimulationPeaks: (p: NMRPeak[] | null) => void;

  // --- Core domain ---
  activeDocument: AnalyticalDocument | null;
  openDocuments: AnalyticalDocument[];

  moleculeRegistry: Record<string, MoleculeRecord>;
  activeMoleculeId: string | null;

  datasets: Record<string, NormalizedDataset>;
  activeDatasetId: string | null;

  processingGraphs: Record<string, ProcessingStep[]>;

  evidenceGraph: EvidenceNode[];
  assignmentEdges: AssignmentEdge[];

  activePanel: ActivePanel;
  sidebarOpen: boolean;

  createNewDocument: (title: string) => AnalyticalDocument;
  setActiveDocument: (doc: AnalyticalDocument | null) => void;

  addDataset: (dataset: NormalizedDataset) => void;
  removeDataset: (datasetId: string) => void;
  setActiveDataset: (datasetId: string | null) => void;

  registerMolecule: (mol: MoleculeRecord) => void;
  updateMolecule: (id: string, updates: Partial<MoleculeRecord>) => void;
  removeMolecule: (id: string) => void;
  setActiveMolecule: (id: string | null) => void;

  addProcessingStep: (datasetId: string, step: ProcessingStep) => void;
  removeProcessingStep: (datasetId: string, stepIndex: number) => void;
  setProcessingSteps: (datasetId: string, steps: ProcessingStep[]) => void;

  addEvidenceNode: (node: EvidenceNode) => void;
  removeEvidenceNode: (nodeId: string) => void;

  addAssignment: (edge: AssignmentEdge) => void;
  removeAssignment: (edgeId: string) => void;

  setActivePanel: (panel: ActivePanel) => void;
  toggleSidebar: () => void;
}

const DEFAULT_FTIR_PEAKS: FTIRPeak[] = [
  { wavenumber: 3060, intensity: 60, type: 'medium', width: 52, assignment: 'Aromatic C-H' },
  { wavenumber: 2980, intensity: 60, type: 'medium', width: 52, assignment: 'Aliphatic C-H' },
  { wavenumber: 1680, intensity: 85, type: 'strong', width: 57, assignment: 'C=O (carbonyl)' },
  { wavenumber: 1600, intensity: 70, type: 'strong', width: 54, assignment: 'Aromatic C=C' },
  { wavenumber: 1450, intensity: 65, type: 'medium', width: 53, assignment: 'C-H bend' },
  { wavenumber: 1265, intensity: 75, type: 'strong', width: 55, assignment: 'C-O stretch' },
  { wavenumber: 760, intensity: 80, type: 'strong', width: 56, assignment: 'Aromatic C-H (out of plane)' },
  { wavenumber: 690, intensity: 75, type: 'strong', width: 55, assignment: 'Aromatic ring' },
];

export const useSpectroMindStore = create<SpectroMindState>((set, get) => ({
  // Legacy spectroscopy session state
  peaks: [],
  carbon13Peaks: [],
  ftirPeaks: DEFAULT_FTIR_PEAKS,
  msPeaks: [],
  spectrumType: 'nmr',
  solvent: 'DMSO',
  frequency: 300,
  formula: '',
  knownMolecule: null,
  observedNmrOverlay: null,
  observedNmrOverlayH1: null,
  observedNmrOverlayC13: null,
  fidSimulationPeaks: null,

  setPeaks: (peaks) => set({ peaks }),
  setCarbon13Peaks: (peaks) => set({ carbon13Peaks: peaks }),
  setFtirPeaks: (peaks) => set({ ftirPeaks: peaks }),
  setMsPeaks: (peaks) => set({ msPeaks: peaks }),
  setSpectrumType: (t) => {
    set({ spectrumType: t });
    if (t !== 'nmr' && t !== 'c13') {
      set({ observedNmrOverlay: null, fidSimulationPeaks: null });
      return;
    }
    const state = get();
    set({
      observedNmrOverlay: t === 'c13' ? state.observedNmrOverlayC13 : state.observedNmrOverlayH1,
    });
  },
  setSolvent: (s) => set({ solvent: s }),
  setFrequency: (f) => set({ frequency: f }),
  setFormula: (f) => set({ formula: f }),
  setKnownMolecule: (m) => set({ knownMolecule: m }),
  setObservedNmrOverlay: (o) =>
    set((state) => {
      if (!o) {
        return {
          observedNmrOverlay: null,
          observedNmrOverlayH1: state.spectrumType === 'nmr' ? null : state.observedNmrOverlayH1,
          observedNmrOverlayC13: state.spectrumType === 'c13' ? null : state.observedNmrOverlayC13,
        };
      }
      const experimentType = o.experimentType === '13C' ? '13C' : '1H';
      if (experimentType === '13C') {
        return {
          observedNmrOverlay: state.spectrumType === 'c13' ? o : state.observedNmrOverlay,
          observedNmrOverlayC13: o,
        };
      }
      return {
        observedNmrOverlay: state.spectrumType === 'nmr' ? o : state.observedNmrOverlay,
        observedNmrOverlayH1: o,
      };
    }),
  getActiveObservedNmrOverlay: () => {
    const state = get();
    return state.spectrumType === 'c13' ? state.observedNmrOverlayC13 : state.observedNmrOverlayH1;
  },
  setFidSimulationPeaks: (p) => set({ fidSimulationPeaks: p }),

  // Core domain state
  activeDocument: null,
  openDocuments: [],
  moleculeRegistry: {},
  activeMoleculeId: null,
  datasets: {},
  activeDatasetId: null,
  processingGraphs: {},
  evidenceGraph: [],
  assignmentEdges: [],
  activePanel: 'nmr',
  sidebarOpen: true,

  createNewDocument: (title: string) => {
    const doc = createDocument(title);
    AuditService.log('document.create', 'store', { title, docId: doc.id });
    set(state => ({
      activeDocument: doc,
      openDocuments: [...state.openDocuments, doc],
    }));
    EventBus.emit('document:created', { id: doc.id, title }, 'store');
    return doc;
  },

  setActiveDocument: (doc) => {
    set({ activeDocument: doc });
  },

  addDataset: (dataset) => {
    AuditService.log('dataset.import', 'store', {
      datasetId: dataset.id,
      modality: dataset.modality,
      vendor: dataset.vendor,
    });
    set(state => ({
      datasets: { ...state.datasets, [dataset.id]: dataset },
      activeDatasetId: dataset.id,
    }));
    EventBus.emit('dataset:imported', { id: dataset.id, modality: dataset.modality }, 'store');
  },

  removeDataset: (datasetId) => {
    AuditService.log('dataset.delete', 'store', { datasetId });
    set(state => {
      const { [datasetId]: _, ...rest } = state.datasets;
      return {
        datasets: rest,
        activeDatasetId: state.activeDatasetId === datasetId ? null : state.activeDatasetId,
      };
    });
    EventBus.emit('dataset:deleted', { id: datasetId }, 'store');
  },

  setActiveDataset: (datasetId) => {
    set({ activeDatasetId: datasetId });
  },

  registerMolecule: (mol) => {
    AuditService.log('molecule.register', 'store', {
      moleculeId: mol.id,
      smiles: mol.smiles,
      name: mol.name,
    });
    set(state => ({
      moleculeRegistry: { ...state.moleculeRegistry, [mol.id]: mol },
      activeMoleculeId: mol.id,
    }));
    EventBus.emit('molecule:registered', { id: mol.id, smiles: mol.smiles }, 'store');
  },

  updateMolecule: (id, updates) => {
    AuditService.log('molecule.update', 'store', { moleculeId: id, fields: Object.keys(updates) });
    set(state => {
      const existing = state.moleculeRegistry[id];
      if (!existing) return state;
      return {
        moleculeRegistry: {
          ...state.moleculeRegistry,
          [id]: { ...existing, ...updates, updatedAt: new Date().toISOString() },
        },
      };
    });
    EventBus.emit('molecule:updated', { id }, 'store');
  },

  removeMolecule: (id) => {
    AuditService.log('molecule.delete', 'store', { moleculeId: id });
    set(state => {
      const { [id]: _, ...rest } = state.moleculeRegistry;
      return {
        moleculeRegistry: rest,
        activeMoleculeId: state.activeMoleculeId === id ? null : state.activeMoleculeId,
      };
    });
    EventBus.emit('molecule:deleted', { id }, 'store');
  },

  setActiveMolecule: (id) => {
    set({ activeMoleculeId: id });
  },

  addProcessingStep: (datasetId, step) => {
    AuditService.log('processing.apply_step', 'store', {
      datasetId,
      step: step.kind,
      params: step.params,
    });
    set(state => {
      const existing = state.processingGraphs[datasetId] ?? [];
      return {
        processingGraphs: {
          ...state.processingGraphs,
          [datasetId]: [...existing, step],
        },
      };
    });
    EventBus.emit('processing:step_applied', { datasetId, step: step.kind }, 'store');
  },

  removeProcessingStep: (datasetId, stepIndex) => {
    set(state => {
      const existing = state.processingGraphs[datasetId] ?? [];
      return {
        processingGraphs: {
          ...state.processingGraphs,
          [datasetId]: existing.filter((_, i) => i !== stepIndex),
        },
      };
    });
  },

  setProcessingSteps: (datasetId, steps) => {
    set(state => ({
      processingGraphs: {
        ...state.processingGraphs,
        [datasetId]: steps,
      },
    }));
  },

  addEvidenceNode: (node) => {
    set(state => ({
      evidenceGraph: [...state.evidenceGraph, node],
    }));
    EventBus.emit('evidence:added', { id: node.id, modality: node.modality }, 'store');
  },

  removeEvidenceNode: (nodeId) => {
    set(state => ({
      evidenceGraph: state.evidenceGraph.filter(n => n.id !== nodeId),
    }));
    EventBus.emit('evidence:removed', { id: nodeId }, 'store');
  },

  addAssignment: (edge) => {
    AuditService.log('analysis.assign', 'store', {
      edgeId: edge.id,
      moleculeId: edge.targetMoleculeId,
      atomId: edge.targetAtomId,
      source: edge.source,
    });
    set(state => ({
      assignmentEdges: [...state.assignmentEdges, edge],
    }));
    EventBus.emit('assignment:created', { id: edge.id }, 'store');
  },

  removeAssignment: (edgeId) => {
    set(state => ({
      assignmentEdges: state.assignmentEdges.filter(e => e.id !== edgeId),
    }));
    EventBus.emit('assignment:deleted', { id: edgeId }, 'store');
  },

  setActivePanel: (panel) => {
    set({ activePanel: panel });
  },

  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }));
  },
}));
