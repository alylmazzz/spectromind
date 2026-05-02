/**
 * SMILES Parser + Molecular Graph Builder
 * Uses RDKit for chemical structure parsing
 */

import { Atom, Bond, MolecularGraph } from '../core/types';

export async function parseSMILES(smiles: string): Promise<MolecularGraph> {
  // Determine base URL (server-side needs absolute URL)
  const baseUrl = typeof window === 'undefined'
    ? 'http://localhost:3000'
    : '';

  // Call Python RDKit service
  const response = await fetch(`${baseUrl}/api/rdkit/parse-smiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smiles })
  });

  if (!response.ok) {
    throw new Error(`SMILES parsing failed: ${smiles}`);
  }

  const data = await response.json();

  return {
    atoms: data.atoms.map((a: any, idx: number) => ({
      id: `atom_${idx}`,
      symbol: a.symbol,
      x: a.x || 0,
      y: a.y || 0,
      z: a.z || 0,
      formalCharge: a.formalCharge || 0,
      implicitHydrogens: a.implicitHydrogens || 0,
      aromaticity: a.isAromatic || false
    })),
    bonds: data.bonds.map((b: any, idx: number) => ({
      id: `bond_${idx}`,
      atom1Id: `atom_${b.beginAtomIdx}`,
      atom2Id: `atom_${b.endAtomIdx}`,
      order: b.bondType === 'AROMATIC' ? 1.5 : b.bondOrder,
      isAromatic: b.bondType === 'AROMATIC',
      conjugated: false // Will be calculated later
    })),
    formula: data.formula,
    smiles
  };
}

export function calculateMolecularFormula(graph: MolecularGraph): string {
  const counts: Record<string, number> = {};

  graph.atoms.forEach(atom => {
    counts[atom.symbol] = (counts[atom.symbol] || 0) + 1;
    if (atom.implicitHydrogens > 0) {
      counts['H'] = (counts['H'] || 0) + atom.implicitHydrogens;
    }
  });

  // Hill system: C, H, then alphabetical
  let formula = '';
  if (counts['C']) formula += `C${counts['C'] > 1 ? counts['C'] : ''}`;
  if (counts['H']) formula += `H${counts['H'] > 1 ? counts['H'] : ''}`;

  Object.keys(counts).sort().forEach(symbol => {
    if (symbol !== 'C' && symbol !== 'H') {
      formula += `${symbol}${counts[symbol] > 1 ? counts[symbol] : ''}`;
    }
  });

  return formula;
}
