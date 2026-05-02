#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RDKit 2D/3D Structure Analyzer

Generates 2D coordinates, 3D conformers, and molecular properties including:
- Point group symmetry
- 2D/3D coordinates
- Molecular descriptors
- Symmetry elements

Author: Spectromind Team
Version: 1.0
Dependencies: rdkit, rdkit.Chem
Python: 3.8+

Usage:
    python3 rdkit_structure_analyzer.py '<smiles_string>'

    Example:
        python3 rdkit_structure_analyzer.py 'c1ccccc1'

Output:
    JSON with structure:
    {
        "success": true,
        "smiles": "c1ccccc1",
        "molecular_formula": "C6H6",
        "molecular_weight": 78.11,
        "coords_2d": [...],
        "coords_3d": [...],
        "point_group": "D6h",
        "symmetry_elements": [...],
        "descriptors": {...}
    }

Exit Codes:
    0: Success
    1: Error (RDKit not available, invalid SMILES, etc.)
"""

import sys
import json
from typing import List, Dict, Optional, Tuple

# ============================================================================
# DEPENDENCIES CHECK
# ============================================================================

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
    from rdkit.Chem import rdDepictor
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print(json.dumps({
        'success': False,
        'error': 'RDKit not installed. Run: pip install rdkit-pypi'
    }))
    sys.exit(1)


# ============================================================================
# STRUCTURE ANALYZER
# ============================================================================

class StructureAnalyzer:
    """
    Analyze molecular structure from SMILES

    Capabilities:
        - 2D coordinate generation
        - 3D conformer generation (ETKDG)
        - Point group symmetry detection
        - Molecular descriptors
    """

    def __init__(self):
        pass

    def analyze(self, smiles: str) -> Dict:
        """
        Perform complete structure analysis

        Args:
            smiles: SMILES string of molecule

        Returns:
            Dictionary with 2D/3D coords, symmetry, descriptors
        """
        try:
            # Parse SMILES
            mol = Chem.MolFromSmiles(smiles)

            if mol is None:
                return {
                    'success': False,
                    'error': f'Invalid SMILES: {smiles}'
                }

            # Add hydrogens
            mol_h = Chem.AddHs(mol)

            # Generate 2D coordinates
            coords_2d = self._generate_2d_coords(mol)

            # Generate 3D conformer
            coords_3d_result = self._generate_3d_coords(mol_h)

            if not coords_3d_result['success']:
                return {
                    'success': False,
                    'error': '3D conformer generation failed'
                }

            coords_3d = coords_3d_result['coords']

            # Detect point group symmetry
            symmetry_result = self._detect_point_group(mol_h)

            # Calculate molecular descriptors
            descriptors = self._calculate_descriptors(mol)

            # Get molecular formula
            formula = rdMolDescriptors.CalcMolFormula(mol)

            return {
                'success': True,
                'smiles': smiles,
                'canonical_smiles': Chem.MolToSmiles(mol),
                'molecular_formula': formula,
                'molecular_weight': Descriptors.MolWt(mol),
                'coords_2d': coords_2d,
                'coords_3d': coords_3d,
                'point_group': symmetry_result.get('point_group', 'C1'),
                'symmetry_elements': symmetry_result.get('elements', []),
                'descriptors': descriptors
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Structure analysis failed: {str(e)}'
            }

    def _generate_2d_coords(self, mol: Chem.Mol) -> List[Dict]:
        """
        Generate 2D coordinates

        Args:
            mol: RDKit molecule

        Returns:
            List of {element, x, y} dicts
        """
        # Compute 2D coords
        rdDepictor.Compute2DCoords(mol)

        conformer = mol.GetConformer()
        coords = []

        for i, atom in enumerate(mol.GetAtoms()):
            pos = conformer.GetAtomPosition(i)
            coords.append({
                'element': atom.GetSymbol(),
                'x': pos.x,
                'y': pos.y
            })

        return coords

    def _generate_3d_coords(self, mol: Chem.Mol) -> Dict:
        """
        Generate 3D coordinates using ETKDG

        Args:
            mol: RDKit molecule (with Hs)

        Returns:
            Dictionary with success flag and coords
        """
        # Generate 3D conformer
        result = AllChem.EmbedMolecule(mol, randomSeed=42)

        if result != 0:
            return {
                'success': False,
                'coords': []
            }

        # Optimize with MMFF94
        try:
            AllChem.MMFFOptimizeMolecule(mol)
        except:
            # If MMFF fails, try UFF
            try:
                AllChem.UFFOptimizeMolecule(mol)
            except:
                pass  # Continue with unoptimized geometry

        conformer = mol.GetConformer()
        coords = []

        for i, atom in enumerate(mol.GetAtoms()):
            pos = conformer.GetAtomPosition(i)
            coords.append({
                'element': atom.GetSymbol(),
                'x': pos.x,
                'y': pos.y,
                'z': pos.z
            })

        return {
            'success': True,
            'coords': coords
        }

    def _detect_point_group(self, mol: Chem.Mol) -> Dict:
        """
        Detect point group symmetry

        This is a simplified detection. Full point group determination
        requires geometric analysis of symmetry operations.

        Args:
            mol: RDKit molecule

        Returns:
            Dictionary with point_group and symmetry_elements
        """
        # Check for linear molecules
        if mol.GetNumAtoms() <= 2:
            return {
                'point_group': 'D∞h' if mol.GetNumAtoms() == 2 else 'C∞v',
                'elements': ['E', 'C∞', 'σv'] if mol.GetNumAtoms() == 2 else ['E']
            }

        # Simplified heuristics for common point groups
        symmetry_elements = ['E']  # Identity always present

        # Check for aromatic rings (often D or C groups)
        aromatic_atoms = sum(1 for atom in mol.GetAtoms() if atom.GetIsAromatic())

        if aromatic_atoms >= 6:
            # Benzene-like: D6h or C6v
            if aromatic_atoms == 6:
                point_group = 'D6h'  # Simplified assumption
                symmetry_elements.extend(['C6', 'C2', 'σh', 'σv'])
            else:
                point_group = 'Cs'
                symmetry_elements.append('σ')
        else:
            # Default: C1 (no symmetry)
            point_group = 'C1'

        # TODO: Implement full geometric symmetry analysis
        # This would require:
        # 1. Rotation axis detection (C2, C3, etc.)
        # 2. Mirror plane detection (σh, σv, σd)
        # 3. Inversion center detection (i)
        # 4. Rotation-reflection axes (S4, S6, etc.)

        return {
            'point_group': point_group,
            'elements': symmetry_elements,
            'note': 'Simplified heuristic - full geometric analysis not yet implemented'
        }

    def _calculate_descriptors(self, mol: Chem.Mol) -> Dict:
        """
        Calculate molecular descriptors

        Args:
            mol: RDKit molecule

        Returns:
            Dictionary of descriptors
        """
        return {
            'num_atoms': mol.GetNumAtoms(),
            'num_heavy_atoms': mol.GetNumHeavyAtoms(),
            'num_aromatic_atoms': sum(1 for atom in mol.GetAtoms() if atom.GetIsAromatic()),
            'num_rotatable_bonds': Descriptors.NumRotatableBonds(mol),
            'num_h_donors': Descriptors.NumHDonors(mol),
            'num_h_acceptors': Descriptors.NumHAcceptors(mol),
            'logP': Descriptors.MolLogP(mol),
            'tpsa': Descriptors.TPSA(mol),
            'num_rings': Descriptors.RingCount(mol),
            'num_aromatic_rings': Descriptors.NumAromaticRings(mol)
        }


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """
    Main entry point

    Reads SMILES from command line, analyzes structure, outputs JSON
    """

    # Check arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python3 rdkit_structure_analyzer.py "<smiles>"'
        }))
        sys.exit(1)

    # Parse SMILES
    smiles = sys.argv[1]

    # Analyze structure
    analyzer = StructureAnalyzer()
    result = analyzer.analyze(smiles)

    # Output JSON
    print(json.dumps(result, indent=2))

    # Exit code
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
