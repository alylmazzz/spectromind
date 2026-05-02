/**
 * Simple timers for timings_ms in report.
 */
export function createTimers() {
    const timers = { parse: 0, generate: 0, verify: 0 };
    const started = {};
    return {
        timers,
        start(key) {
            started[key] = typeof performance !== 'undefined' ? performance.now() : Date.now();
        },
        stop(key) {
            if (started[key] != null) {
                const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                timers[key] = Math.round(now - started[key]);
                delete started[key];
            }
        },
    };
}
