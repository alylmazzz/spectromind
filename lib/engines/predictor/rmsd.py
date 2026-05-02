"""
SpectroMind v1.5 - Dynamic RMSD Calculator

Calculates Root Mean Square Deviation with molecule-class-specific tolerances.
Different chemical environments require different error thresholds.

@module engines/predictor/rmsd
@version 1.5.0
"""

from typing import List, Dict, Tuple
import math


class DynamicRMSD:
    """
    Calculate RMSD with dynamic tolerances based on molecule class.

    Tolerances (ppm):
    - Aromatic: ±1.5 (rigid, well-defined shifts)
    - Aliphatic: ±2.5 (flexible, variable shifts)
    - Heterocyclic: ±3.0 (electronic effects, tautomers)
    - Carbonyl: ±2.0 (well-defined but solvent-dependent)
    """

    def __init__(self, config: Dict):
        """
        Initialize with RMSD tolerances.

        Args:
            config: Dict with 'rmsd_tolerances' key
        """
        tolerances = config.get('rmsd_tolerances', {})
        self.aromatic_tol = tolerances.get('aromatic', 1.5)
        self.aliphatic_tol = tolerances.get('aliphatic', 2.5)
        self.heterocyclic_tol = tolerances.get('heterocyclic', 3.0)
        self.carbonyl_tol = tolerances.get('carbonyl', 2.0)
        self.default_tol = tolerances.get('default', 2.5)

    def calculate(
        self,
        observed: List[float],
        predicted: List[float]
    ) -> Tuple[float, bool]:
        """
        Calculate RMSD between observed and predicted shifts.

        Args:
            observed: List of observed chemical shifts (ppm)
            predicted: List of predicted chemical shifts (ppm)

        Returns:
            (rmsd_value, passes_threshold)
        """
        if len(observed) != len(predicted):
            raise ValueError(f"Length mismatch: {len(observed)} != {len(predicted)}")

        if len(observed) == 0:
            return (0.0, True)

        # Calculate RMSD
        squared_diffs = [(obs - pred) ** 2 for obs, pred in zip(observed, predicted)]
        rmsd = math.sqrt(sum(squared_diffs) / len(squared_diffs))

        # For now, use default tolerance (will be refined with molecule class)
        passes = rmsd <= self.default_tol

        return (rmsd, passes)

    def calculate_with_class(
        self,
        observed: List[float],
        predicted: List[float],
        molecule_class: str
    ) -> Dict:
        """
        Calculate RMSD with molecule-class-specific threshold.

        Args:
            observed: Observed shifts
            predicted: Predicted shifts
            molecule_class: 'aromatic', 'aliphatic', 'heterocyclic', 'carbonyl'

        Returns:
            Dict with rmsd, threshold, passes, score
        """
        rmsd, _ = self.calculate(observed, predicted)

        # Get threshold based on class
        threshold_map = {
            'aromatic': self.aromatic_tol,
            'aliphatic': self.aliphatic_tol,
            'heterocyclic': self.heterocyclic_tol,
            'carbonyl': self.carbonyl_tol,
        }
        threshold = threshold_map.get(molecule_class, self.default_tol)

        # Check if passes
        passes = rmsd <= threshold

        # Calculate score (0-100)
        # Score = 100 when RMSD = 0, Score = 0 when RMSD = 2*threshold
        if rmsd == 0:
            score = 100.0
        else:
            # Linear decay
            score = max(0.0, 100.0 * (1 - rmsd / (2 * threshold)))

        return {
            'rmsd': round(rmsd, 2),
            'threshold': threshold,
            'passes': passes,
            'score': round(score, 1),
            'molecule_class': molecule_class
        }

    def classify_molecule(self, smiles: str) -> str:
        """
        Classify molecule type from SMILES for RMSD threshold selection.

        Args:
            smiles: SMILES string

        Returns:
            'aromatic', 'aliphatic', 'heterocyclic', or 'carbonyl'
        """
        # Simple heuristic classification
        has_aromatic = 'c' in smiles.lower() or any(ring in smiles for ring in ['benzene', 'phenyl'])
        has_hetero = any(atom in smiles for atom in ['N', 'O', 'S']) and ('c' in smiles or 'C' in smiles)
        has_carbonyl = '=O' in smiles or 'C(=O)' in smiles

        if has_hetero and (has_aromatic or any(c in smiles for c in ['(', '['])):
            return 'heterocyclic'
        elif has_carbonyl:
            return 'carbonyl'
        elif has_aromatic:
            return 'aromatic'
        else:
            return 'aliphatic'


def calculate_rmsd(
    observed: List[float],
    predicted: List[float],
    molecule_class: str,
    config: Dict
) -> Dict:
    """
    Convenience function for RMSD calculation.

    Args:
        observed: Observed shifts
        predicted: Predicted shifts
        molecule_class: Molecule class
        config: Configuration dict

    Returns:
        RMSD result dict
    """
    calculator = DynamicRMSD(config)
    return calculator.calculate_with_class(observed, predicted, molecule_class)


if __name__ == '__main__':
    # Test
    config = {
        'rmsd_tolerances': {
            'aromatic': 1.5,
            'aliphatic': 2.5,
            'heterocyclic': 3.0,
            'carbonyl': 2.0,
            'default': 2.5
        }
    }

    # Test 1: Aromatic (strict)
    observed = [7.2, 7.3, 7.4]
    predicted = [7.0, 7.2, 7.5]
    result = calculate_rmsd(observed, predicted, 'aromatic', config)
    print(f"Aromatic RMSD: {result}")

    # Test 2: Heterocyclic (lenient)
    observed = [8.5, 7.8, 6.2]
    predicted = [8.0, 8.2, 6.5]
    result = calculate_rmsd(observed, predicted, 'heterocyclic', config)
    print(f"Heterocyclic RMSD: {result}")
