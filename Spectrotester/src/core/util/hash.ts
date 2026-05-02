/**
 * Deterministic artifact hashes for run traceability.
 * Same input + config => same hash (no RNG in hash).
 */

export function simpleHash(str: string): string {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = ((h << 5) - h) + c;
    h = h & h;
  }
  return Math.abs(h).toString(36);
}

export function artifactHashes(payload: {
  inputSmiles?: string;
  configSnapshot?: Record<string, unknown>;
  rulesetVersion?: string;
  libraryVersion?: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (payload.inputSmiles != null) out.input_smiles = simpleHash(payload.inputSmiles.trim());
  if (payload.configSnapshot) out.config = simpleHash(JSON.stringify(payload.configSnapshot));
  if (payload.rulesetVersion) out.ruleset = simpleHash(payload.rulesetVersion);
  if (payload.libraryVersion) out.library = simpleHash(payload.libraryVersion);
  return out;
}
