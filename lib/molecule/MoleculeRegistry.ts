/**
 * Molecule Registry Service
 *
 * Central service for managing MoleculeRecord entities.
 * Serves as the single source of truth for all molecular data in SpectroMind.
 *
 * Responsibilities:
 *   - Register, update, and delete molecules
 *   - Search by SMILES, InChIKey, name, or formula
 *   - Link molecules to datasets, predictions, and assignments
 *   - Provide compound table data
 *   - Audit all mutations
 */

import type { MoleculeRecord } from '@/lib/core/models/MoleculeRecord';
import { createMoleculeRecord } from '@/lib/core/models/MoleculeRecord';
import { AuditService } from '@/lib/core/audit/AuditService';
import { EventBus } from '@/lib/core/events/EventBus';

export interface MoleculeSearchQuery {
  smiles?: string;
  inchiKey?: string;
  name?: string;
  formula?: string;
  minMass?: number;
  maxMass?: number;
  tags?: string[];
}

export interface CompoundsTableRow {
  id: string;
  name: string;
  formula: string;
  exactMass: number;
  smiles: string;
  linkedDatasets: number;
  linkedPredictions: number;
  linkedAssignments: number;
  createdAt: string;
}

export class MoleculeRegistry {
  private molecules: Map<string, MoleculeRecord> = new Map();

  register(input: {
    smiles: string;
    name?: string;
    molfile?: string;
    inchiKey?: string;
    formula?: string;
    exactMass?: number;
    dbe?: number;
  }): MoleculeRecord {
    const mol = createMoleculeRecord(input.smiles, input.molfile || '', {
      name: input.name,
      formula: input.formula || '',
      exactMass: input.exactMass || 0,
      molecularWeight: 0,
      dbe: input.dbe ?? 0,
    });

    this.molecules.set(mol.id, mol);

    AuditService.log('molecule.register' as any, 'molecule.registry' as any, {
      moleculeId: mol.id,
      smiles: mol.smiles,
      name: mol.name,
    });

    EventBus.emit('molecule:registered', { id: mol.id, smiles: mol.smiles }, 'molecule.registry');

    return mol;
  }

  update(id: string, updates: Partial<MoleculeRecord>): MoleculeRecord | null {
    const existing = this.molecules.get(id);
    if (!existing) return null;

    const updated: MoleculeRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    this.molecules.set(id, updated);

    AuditService.log('molecule.update' as any, 'molecule.registry' as any, {
      moleculeId: id,
      fields: Object.keys(updates),
    });

    EventBus.emit('molecule:updated', { id }, 'molecule.registry');

    return updated;
  }

  delete(id: string): boolean {
    const existed = this.molecules.delete(id);
    if (existed) {
      AuditService.log('molecule.delete' as any, 'molecule.registry' as any, { moleculeId: id });
      EventBus.emit('molecule:deleted', { id }, 'molecule.registry');
    }
    return existed;
  }

  get(id: string): MoleculeRecord | undefined {
    return this.molecules.get(id);
  }

  getAll(): MoleculeRecord[] {
    return Array.from(this.molecules.values());
  }

  search(query: MoleculeSearchQuery): MoleculeRecord[] {
    return this.getAll().filter(mol => {
      if (query.smiles && !mol.smiles.includes(query.smiles)) return false;
      if (query.inchiKey && mol.inchiKey !== query.inchiKey) return false;
      if (query.name && !mol.name?.toLowerCase().includes(query.name.toLowerCase())) return false;
      if (query.formula && mol.formula !== query.formula) return false;
      if (query.minMass !== undefined && mol.exactMass < query.minMass) return false;
      if (query.maxMass !== undefined && mol.exactMass > query.maxMass) return false;
      if (query.tags && query.tags.length > 0) {
        if (!query.tags.some(t => mol.customFields[t] !== undefined)) return false;
      }
      return true;
    });
  }

  findBySmiles(smiles: string): MoleculeRecord | undefined {
    return this.getAll().find(mol => mol.smiles === smiles);
  }

  findByInchiKey(inchiKey: string): MoleculeRecord | undefined {
    return this.getAll().find(mol => mol.inchiKey === inchiKey);
  }

  linkDataset(moleculeId: string, datasetId: string): void {
    const mol = this.molecules.get(moleculeId);
    if (mol && !mol.linkedDatasetIds.includes(datasetId)) {
      mol.linkedDatasetIds.push(datasetId);
      mol.updatedAt = new Date().toISOString();
      AuditService.log('molecule.link_dataset' as any, 'molecule.registry' as any, { moleculeId, datasetId });
    }
  }

  linkPrediction(moleculeId: string, predictionId: string): void {
    const mol = this.molecules.get(moleculeId);
    if (mol && !mol.linkedPredictionIds.includes(predictionId)) {
      mol.linkedPredictionIds.push(predictionId);
      mol.updatedAt = new Date().toISOString();
    }
  }

  linkAssignment(moleculeId: string, assignmentId: string): void {
    const mol = this.molecules.get(moleculeId);
    if (mol && !mol.linkedAssignmentIds.includes(assignmentId)) {
      mol.linkedAssignmentIds.push(assignmentId);
      mol.updatedAt = new Date().toISOString();
    }
  }

  toCompoundsTable(): CompoundsTableRow[] {
    return this.getAll().map(mol => ({
      id: mol.id,
      name: mol.name ?? '',
      formula: mol.formula,
      exactMass: mol.exactMass,
      smiles: mol.smiles,
      linkedDatasets: mol.linkedDatasetIds.length,
      linkedPredictions: mol.linkedPredictionIds.length,
      linkedAssignments: mol.linkedAssignmentIds.length,
      createdAt: mol.createdAt,
    }));
  }

  get size(): number {
    return this.molecules.size;
  }

  clear(): void {
    this.molecules.clear();
  }
}
