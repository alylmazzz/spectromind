import type { NormalizedDataset } from './NormalizedDataset';
import type { EvidenceNode } from './EvidenceNode';
import type { AssignmentEdge } from './AssignmentEdge';
import type { AuditEvent } from '../audit/types';

export interface ReportPage {
  id: string;
  name: string;
  objects: PageObject[];
  order: number;
}

export type PageObjectKind = 'spectrum' | 'molecule' | 'table' | 'text' | 'annotation' | 'image';

export interface PageObject {
  id: string;
  kind: PageObjectKind;
  refId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

export interface AnalyticalDocument {
  id: string;
  title: string;
  sampleId?: string;
  datasets: NormalizedDataset[];
  moleculeIds: string[];
  reportPages: ReportPage[];
  evidenceGraph: EvidenceNode[];
  assignmentEdges: AssignmentEdge[];
  auditTrail: AuditEvent[];
  tags: string[];
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export function createDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDocument(title: string): AnalyticalDocument {
  const now = new Date().toISOString();
  return {
    id: createDocumentId(),
    title,
    datasets: [],
    moleculeIds: [],
    reportPages: [],
    evidenceGraph: [],
    assignmentEdges: [],
    auditTrail: [],
    tags: [],
    customFields: {},
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
