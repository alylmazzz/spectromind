/**
 * Authoritative PubChem reference for Oleanolic Acid (structure-card / 2D / 3D parity).
 * CID 10494 — Canonical / isomeric SMILES from PubChem PUG REST.
 */

export const OLEANOLIC_ACID_PUBCHEM_CID = 10494;

/** Isomeric SMILES (PubChem "SMILES" property for CID 10494). */
export const OLEANOLIC_ACID_ISOMERIC_SMILES =
  'C[C@]12CC[C@@H](C([C@@H]1CC[C@@]3([C@@H]2CC=C4[C@]3(CC[C@@]5([C@H]4CC(CC5)(C)C)C(=O)O)C)C)(C)C)O';

/** PubChem / triterpenoid literatürü ile hizalı kanonik sistematik ad (yapı kartı + SSOT). */
export const OLEANOLIC_ACID_CANONICAL_IUPAC = '3beta-Hydroxy-olean-12-en-28-oic acid';

export const OLEANOLIC_ACID_MOLECULAR_FORMULA = 'C30H48O3';

export function isOleanolicAcidIdentity(name: string | undefined | null): boolean {
  return /^oleanolic acid$/i.test(String(name || '').trim());
}
