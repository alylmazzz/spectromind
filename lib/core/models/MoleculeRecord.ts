export interface AtomLabel {
  atomIndex: number;
  label: string;
  element: string;
}

export interface ConformerRecord {
  id: string;
  coordinates: Array<{ atomIndex: number; x: number; y: number; z: number }>;
  energyKcalMol?: number;
  populationPct?: number;
  source: 'generated' | 'imported' | 'qm';
  isActive?: boolean;
}

export interface MoleculeRecord {
  id: string;
  molfile: string;
  smiles: string;
  inchiKey?: string;
  name?: string;
  iupacName?: string;
  formula: string;
  exactMass: number;
  molecularWeight: number;
  dbe: number;
  atomLabels: AtomLabel[];
  customFields: Record<string, unknown>;
  conformers: ConformerRecord[];
  linkedDatasetIds: string[];
  linkedPredictionIds: string[];
  linkedAssignmentIds: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export function createMoleculeId(): string {
  return `mol_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createMoleculeRecord(
  smiles: string,
  molfile: string,
  props: {
    name?: string;
    formula: string;
    exactMass: number;
    molecularWeight: number;
    dbe: number;
  }
): MoleculeRecord {
  return {
    id: createMoleculeId(),
    molfile,
    smiles,
    formula: props.formula,
    exactMass: props.exactMass,
    molecularWeight: props.molecularWeight,
    dbe: props.dbe,
    name: props.name,
    atomLabels: [],
    customFields: {},
    conformers: [],
    linkedDatasetIds: [],
    linkedPredictionIds: [],
    linkedAssignmentIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
