/**
 * Simple timers for timings_ms in report.
 */

export interface Timers {
  parse: number;
  generate: number;
  verify: number;
  [key: string]: number;
}

export function createTimers(): { timers: Timers; start: (key: string) => void; stop: (key: string) => void } {
  const timers: Timers = { parse: 0, generate: 0, verify: 0 };
  const started: Record<string, number> = {};
  return {
    timers,
    start(key: string) {
      started[key] = typeof performance !== 'undefined' ? performance.now() : Date.now();
    },
    stop(key: string) {
      if (started[key] != null) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        timers[key] = Math.round(now - started[key]);
        delete started[key];
      }
    },
  };
}
