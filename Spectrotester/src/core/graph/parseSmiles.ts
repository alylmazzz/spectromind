/**
 * SMILES → graph. Prefer RDKit/API; accept precomputed MoleculeGraph for tests/CLI.
 * GLOBAL_PARSE_CANONICAL_SMILES_REQUIRED: parse fail => do not proceed (FATAL).
 */

import type { MoleculeGraph } from './features.js';

export interface ParseSmilesOptions {
  /** Base URL for parse_and_standardize API (optional) */
  apiBase?: string;
  /** Precomputed graph (e.g. from test or CLI that already called API) */
  precomputedGraph?: MoleculeGraph;
}

export interface ParseSmilesResult {
  success: boolean;
  canonicalSmiles?: string;
  moleculeGraph?: MoleculeGraph;
  rootCause?: string;
  message?: string;
}

/**
 * Parse SMILES to molecule graph. If precomputedGraph given, validate and return.
 * Otherwise in Node/browser you would call parse_and_standardize API; here we only
 * support precomputed for core-only runs (HTML or SpectroMind supplies graph).
 */
export async function parseSmiles(
  smiles: string,
  options: ParseSmilesOptions = {}
): Promise<ParseSmilesResult> {
  const trimmed = (smiles || '').trim();
  if (!trimmed) {
    return { success: false, rootCause: 'PARSER_FAIL:EMPTY_SMILES', message: 'SMILES boş.' };
  }

  if (options.precomputedGraph) {
    const g = options.precomputedGraph;
    if (g.canonicalSmiles && g.atoms && Array.isArray(g.atoms) && g.atomCounts) {
      return {
        success: true,
        canonicalSmiles: g.canonicalSmiles,
        moleculeGraph: g,
      };
    }
    return {
      success: false,
      rootCause: 'PARSER_FAIL:INVALID_PRECOMPUTED',
      message: 'Precomputed graph eksik veya geçersiz.',
    };
  }

  if (options.apiBase) {
    try {
      const res = await fetch(`${options.apiBase.replace(/\/$/, '')}/api/parse_and_standardize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles: trimmed }),
      });
      const data = await res.json();
      if (data.success && data.moleculeGraph) {
        return {
          success: true,
          canonicalSmiles: data.canonicalSmiles ?? data.moleculeGraph.canonicalSmiles,
          moleculeGraph: data.moleculeGraph as MoleculeGraph,
        };
      }
      return {
        success: false,
        rootCause: data.rootCause ?? 'PARSER_FAIL:API_ERROR',
        message: data.message ?? 'Parse API hata döndü.',
      };
    } catch (e) {
      return {
        success: false,
        rootCause: 'PARSER_FAIL:NETWORK',
        message: e instanceof Error ? e.message : 'Parse API çağrısı başarısız.',
      };
    }
  }

  return {
    success: false,
    rootCause: 'PARSER_FAIL:NO_PARSER',
    message: 'Graph almak için apiBase veya precomputedGraph gerekli.',
  };
}
