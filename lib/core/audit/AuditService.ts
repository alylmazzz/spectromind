import type { AuditAction, AuditEvent } from './types';

const SOFTWARE_VERSION = '0.2.0-alpha';

let auditLog: AuditEvent[] = [];
let listeners: Array<(event: AuditEvent) => void> = [];

function createAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function simpleHash(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export const AuditService = {
  log(
    action: AuditAction,
    module: string,
    params: Record<string, unknown>,
    options?: {
      userId?: string;
      inputs?: Record<string, unknown>;
      outputs?: Record<string, unknown>;
      durationMs?: number;
      success?: boolean;
      error?: string;
    }
  ): AuditEvent {
    const event: AuditEvent = {
      id: createAuditId(),
      timestamp: new Date().toISOString(),
      action,
      module,
      userId: options?.userId,
      inputsHash: options?.inputs ? simpleHash(options.inputs) : undefined,
      outputsHash: options?.outputs ? simpleHash(options.outputs) : undefined,
      parameters: params,
      softwareVersion: SOFTWARE_VERSION,
      durationMs: options?.durationMs,
      success: options?.success ?? true,
      error: options?.error,
    };

    auditLog.push(event);
    listeners.forEach(fn => fn(event));
    return event;
  },

  getLog(): readonly AuditEvent[] {
    return auditLog;
  },

  getLogForModule(module: string): AuditEvent[] {
    return auditLog.filter(e => e.module === module);
  },

  getLogForAction(action: AuditAction): AuditEvent[] {
    return auditLog.filter(e => e.action === action);
  },

  subscribe(listener: (event: AuditEvent) => void): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(fn => fn !== listener);
    };
  },

  clear(): void {
    auditLog = [];
  },

  exportJson(): string {
    return JSON.stringify(auditLog, null, 2);
  },

  timed<T>(
    action: AuditAction,
    module: string,
    params: Record<string, unknown>,
    fn: () => T
  ): T {
    const start = performance.now();
    try {
      const result = fn();
      const durationMs = Math.round(performance.now() - start);
      this.log(action, module, params, { durationMs, success: true });
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      this.log(action, module, params, {
        durationMs,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },

  async timedAsync<T>(
    action: AuditAction,
    module: string,
    params: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - start);
      this.log(action, module, params, { durationMs, success: true });
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      this.log(action, module, params, {
        durationMs,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
};
