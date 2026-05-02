export type EventType =
  | 'dataset:imported'
  | 'dataset:processed'
  | 'dataset:deleted'
  | 'molecule:registered'
  | 'molecule:updated'
  | 'molecule:deleted'
  | 'assignment:created'
  | 'assignment:deleted'
  | 'evidence:added'
  | 'evidence:removed'
  | 'processing:step_applied'
  | 'processing:template_applied'
  | 'prediction:completed'
  | 'verification:completed'
  | 'document:created'
  | 'document:saved'
  | 'report:page_added'
  | 'report:exported';

export interface SpectroMindEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: string;
  source: string;
}
