/**
 * Schema validation for library and report. Uses minimal checks (no Ajv dependency)
 * so core stays lightweight; optional Ajv can be added later for full JSON Schema.
 */
export declare function validateRuleShape(rule: unknown): {
    ok: boolean;
    error?: string;
};
export declare function validateRuleset(data: unknown): {
    ok: boolean;
    error?: string;
};
export declare function validateReportShape(report: unknown): {
    ok: boolean;
    error?: string;
};
