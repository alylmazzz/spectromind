#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RDKit Conformer Energy Calculator

Calculates MMFF94 force field energies for molecular conformers.
Used for Boltzmann weighting in theoretical NMR spectrum enhancement.

Author: Spectromind Team
Version: 1.0
Dependencies: rdkit, rdkit.Chem
Python: 3.8+

Usage:
    python3 rdkit_energy_calculator.py '<smiles_string>'

    Example:
        python3 rdkit_energy_calculator.py 'CCCC=O'

Output:
    JSON with structure:
    {
        "success": true,
        "smiles": "CCCC=O",
        "conformers": [
            {
                "id": 0,
                "energy": 12.34,  // kcal/mol
                "boltzmann_weight": 0.45
            },
            ...
        ],
        "lowest_energy": 12.34,
        "temperature": 298.15
    }

Exit Codes:
    0: Success
    1: Error (RDKit not available, invalid SMILES, etc.)
"""

import sys
import json
from typing import List, Dict, Optional

# ============================================================================
# DEPENDENCIES CHECK
# ============================================================================

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print(json.dumps({
        'success': False,
        'error': 'RDKit not installed. Run: pip install rdkit-pypi'
    }))
    sys.exit(1)


# ============================================================================
# ENERGY CALCULATOR
# ============================================================================

class ConformerEnergyCalculator:
    """
    Calculate MMFF94 energies for molecular conformers

    Process:
        1. Parse SMILES to RDKit molecule
        2. Add hydrogens (explicit H atoms)
        3. Generate 3D conformers using ETKDG algorithm
        4. Optimize geometry with MMFF94 force field
        5. Calculate final energies
        6. Compute Boltzmann weights

    Constants:
        R = 0.001987 kcal/(mol·K) - Gas constant
        T = 298.15 K - Room temperature
        RT = 0.5922 kcal/mol - Thermal energy at 298K
    """

    # Gas constant in kcal/(mol·K)
    R = 0.001987

    # Default temperature (K)
    DEFAULT_TEMP = 298.15

    # Number of conformers to generate
    NUM_CONFORMERS = 10

    def __init__(self, temperature: float = DEFAULT_TEMP):
        """
        Initialize calculator

        Args:
            temperature: Temperature in Kelvin (default 298.15K)
        """
        self.temperature = temperature
        self.RT = self.R * self.temperature

    def calculate(self, smiles: str) -> Dict:
        """
        Calculate conformer energies and Boltzmann weights

        Args:
            smiles: SMILES string of molecule

        Returns:
            Dictionary with conformer energies and Boltzmann weights
        """
        try:
            # Parse SMILES
            mol = Chem.MolFromSmiles(smiles)

            if mol is None:
                return {
                    'success': False,
                    'error': f'Invalid SMILES: {smiles}'
                }

            # Add hydrogens (required for 3D)
            mol = Chem.AddHs(mol)

            # Generate 3D conformers
            conformer_ids = AllChem.EmbedMultipleConfs(
                mol,
                numConfs=self.NUM_CONFORMERS,
                randomSeed=42,
                useRandomCoords=True,
                maxAttempts=1000
            )

            if len(conformer_ids) == 0:
                return {
                    'success': False,
                    'error': 'Failed to generate 3D conformers'
                }

            # Optimize geometries and calculate energies
            conformer_energies = []

            for conf_id in conformer_ids:
                # Optimize with MMFF94
                props = AllChem.MMFFGetMoleculeProperties(mol)

                if props is None:
                    # MMFF94 failed, try UFF
                    AllChem.UFFOptimizeMolecule(mol, confId=conf_id)
                    # UFF doesn't return energy directly, skip this conformer
                    continue

                # MMFF94 optimization
                ff = AllChem.MMFFGetMoleculeForceField(mol, props, confId=conf_id)
                ff.Minimize()

                # Get final energy (kcal/mol)
                energy = ff.CalcEnergy()

                conformer_energies.append({
                    'id': conf_id,
                    'energy': energy
                })

            if len(conformer_energies) == 0:
                return {
                    'success': False,
                    'error': 'No valid conformer energies calculated'
                }

            # Find lowest energy
            lowest_energy = min(c['energy'] for c in conformer_energies)

            # Calculate Boltzmann weights
            # w_i = exp(-ΔE_i / RT) / Σ exp(-ΔE_j / RT)

            boltzmann_factors = []
            for conf in conformer_energies:
                delta_E = conf['energy'] - lowest_energy
                factor = self._exp_safe(-delta_E / self.RT)
                boltzmann_factors.append(factor)

            # Normalize to get weights (sum = 1.0)
            total = sum(boltzmann_factors)

            for i, conf in enumerate(conformer_energies):
                conf['boltzmann_weight'] = boltzmann_factors[i] / total

            # Sort by energy (lowest first)
            conformer_energies.sort(key=lambda x: x['energy'])

            return {
                'success': True,
                'smiles': smiles,
                'conformers': conformer_energies,
                'lowest_energy': lowest_energy,
                'temperature': self.temperature,
                'RT': self.RT,
                'method': 'MMFF94'
            }

        except Exception as e:
            return {
                'success': False,
                'error': f'Energy calculation failed: {str(e)}'
            }

    def _exp_safe(self, x: float) -> float:
        """
        Safe exponential to prevent overflow

        Args:
            x: Exponent value

        Returns:
            exp(x) with overflow protection
        """
        if x > 100:
            return 1e43  # Large number
        elif x < -100:
            return 0.0
        else:
            import math
            return math.exp(x)


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """
    Main entry point

    Reads SMILES from command line, calculates energies, outputs JSON
    """

    # Check arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python3 rdkit_energy_calculator.py "<smiles>"'
        }))
        sys.exit(1)

    # Parse SMILES
    smiles = sys.argv[1]

    # Optional temperature argument
    temperature = ConformerEnergyCalculator.DEFAULT_TEMP
    if len(sys.argv) >= 3:
        try:
            temperature = float(sys.argv[2])
        except ValueError:
            pass  # Use default

    # Calculate energies
    calculator = ConformerEnergyCalculator(temperature=temperature)
    result = calculator.calculate(smiles)

    # Output JSON
    print(json.dumps(result, indent=2))

    # Exit code
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
