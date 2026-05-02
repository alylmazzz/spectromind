import type { DataProvenance } from '@/lib/types/observed-data';

export type EvidenceModality =
  | '1H' | '13C' | 'HSQC' | 'COSY' | 'HMBC' | 'NOESY' | 'TOCSY'
  | 'MS' | 'IR' | 'UV'
  | 'formula' | 'dbe' | 'elemental_composition';

export type EvidenceCategory =
  | 'shift_agreement'
  | 'multiplicity_agreement'
  | 'integration_agreement'
  | 'coupling_agreement'
  | 'correlation_presence'
  | 'correlation_absence'
  | 'functional_group_presence'
  | 'functional_group_absence'
  | 'formula_match'
  | 'formula_mismatch'
  | 'mass_match'
  | 'isotope_pattern_match'
  | 'fragmentation_support'
  | 'ir_band_match'
  | 'ir_band_absence'
  | 'uv_chromophore'
  | 'uv_no_chromophore'
  | 'dbe_consistent'
  | 'cross_modal_contradiction';

export interface EvidenceNode {
  id: string;
  modality: EvidenceModality;
  category: EvidenceCategory;
  observationType: string;
  rawSourceRef: string;
  interpretedMeaning: string;
  supportsHypothesisIds: string[];
  contradictsHypothesisIds: string[];
  confidence: number;
  quality: number;
  weight: number;
  provenance: DataProvenance;
}

export function createEvidenceId(): string {
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
