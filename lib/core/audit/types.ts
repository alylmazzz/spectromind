export type AuditAction =
  | 'document.create'
  | 'document.open'
  | 'document.save'
  | 'document.close'
  | 'dataset.import'
  | 'dataset.process'
  | 'dataset.delete'
  | 'molecule.register'
  | 'molecule.update'
  | 'molecule.delete'
  | 'processing.apply_step'
  | 'processing.apply_template'
  | 'processing.undo'
  | 'analysis.peak_pick'
  | 'analysis.integrate'
  | 'analysis.multiplet'
  | 'analysis.assign'
  | 'analysis.reference'
  | 'prediction.run'
  | 'prediction.compare'
  | 'verification.run'
  | 'verification.batch'
  | 'elucidation.run'
  | 'report.add_page'
  | 'report.add_object'
  | 'report.export_pdf'
  | 'script.execute'
  | 'db.save'
  | 'db.search'
  | 'plugin.register'
  | 'plugin.execute';

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: AuditAction;
  module: string;
  userId?: string;
  inputsHash?: string;
  outputsHash?: string;
  parameters: Record<string, unknown>;
  softwareVersion: string;
  durationMs?: number;
  success: boolean;
  error?: string;
}
