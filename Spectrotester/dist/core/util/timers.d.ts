/**
 * Simple timers for timings_ms in report.
 */
export interface Timers {
    parse: number;
    generate: number;
    verify: number;
    [key: string]: number;
}
export declare function createTimers(): {
    timers: Timers;
    start: (key: string) => void;
    stop: (key: string) => void;
};
