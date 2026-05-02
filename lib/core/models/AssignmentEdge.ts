import type { DataProvenance } from '@/lib/types/observed-data';

export type AssignmentFeatureKind = 'peak' | 'multiplet' | 'integral' | 'crossPeak' | 'region';
export type AssignmentSource = 'manual' | 'auto' | 'prediction_assisted' | 'transferred' | 'gsd';

export interface AssignmentEdge {
  id: string;
  sourceFeatureId: string;
  sourceFeatureKind: AssignmentFeatureKind;
  sourceDatasetId: string;
  targetAtomId: string;
  targetMoleculeId: string;
  modality: string;
  confidence: number;
  rationale: string;
  source: AssignmentSource;
  provenance: DataProvenance;
  createdAt: string;
}

export function createAssignmentId(): string {
  return `asg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
