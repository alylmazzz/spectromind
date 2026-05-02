"""
SpectroMind v1.5 - NOESY Correlation Engine

Analyzes NOESY (Nuclear Overhauser Effect Spectroscopy) data.
Converts cross-peak intensities to spatial distances using r^-6 relationship.

@module engines/correlations/noesy
@version 1.5.0
"""

from typing import List, Dict
import math


class NOESYAnalyzer:
    """
    Analyze NOESY correlations and calculate spatial distances.

    NOE Intensity ∝ 1/r^6
    where r is the distance between protons in Angstroms
    """

    def __init__(self, config: Dict):
        """
        Initialize analyzer.

        Args:
            config: Configuration dict with NOESY parameters
        """
        noesy_config = config.get('correlations', {}).get('noesy', {})
        self.min_intensity = noesy_config.get('min_intensity', 0.1)
        self.max_distance = noesy_config.get('max_distance_angstrom', 5.0)
        self.r_power = noesy_config.get('r_power', -6)

        # Reference: Strong NOE at 2.5 Å corresponds to intensity ~0.8
        self.reference_distance = 2.5  # Angstrom
        self.reference_intensity = 0.8

    def analyze(self, correlations: List[Dict]) -> Dict:
        """
        Analyze NOESY correlations and calculate distances.

        Args:
            correlations: List of dicts with:
                - proton1: str (peak ID)
                - proton2: str (peak ID)
                - intensity: float (0-1 normalized)

        Returns:
            Dict with analyzed correlations and spatial constraints
        """
        analyzed = []
        constraints = []

        for corr in correlations:
            if corr.get('intensity', 0) < self.min_intensity:
                continue  # Too weak, ignore

            distance = self._intensity_to_distance(corr['intensity'])

            analyzed_corr = {
                'proton1': corr['proton1'],
                'proton2': corr['proton2'],
                'intensity': corr['intensity'],
                'distance_angstrom': round(distance, 2),
                'confidence': self._get_confidence(corr['intensity']),
            }

            analyzed.append(analyzed_corr)

            # Add spatial constraint
            if distance <= self.max_distance:
                constraints.append({
                    'type': 'spatial',
                    'atom1': corr['proton1'],
                    'atom2': corr['proton2'],
                    'max_distance': distance,
                    'source': 'NOESY'
                })

        return {
            'analyzed_correlations': analyzed,
            'spatial_constraints': constraints,
            'num_constraints': len(constraints)
        }

    def _intensity_to_distance(self, intensity: float) -> float:
        """
        Convert NOE intensity to distance using r^-6 relationship.

        Args:
            intensity: NOE intensity (0-1)

        Returns:
            Distance in Angstroms
        """
        if intensity <= 0:
            return self.max_distance

        # I1/I2 = (r2/r1)^6
        # r2 = r1 * (I1/I2)^(1/6)
        ratio = self.reference_intensity / intensity
        distance = self.reference_distance * (ratio ** (1.0 / abs(self.r_power)))

        # Cap at max distance
        return min(distance, self.max_distance)

    def _get_confidence(self, intensity: float) -> str:
        """
        Get confidence level based on intensity.

        Args:
            intensity: NOE intensity

        Returns:
            'high', 'medium', or 'low'
        """
        if intensity >= 0.6:
            return 'high'
        elif intensity >= 0.3:
            return 'medium'
        else:
            return 'low'


def analyze_noesy(correlations: List[Dict], config: Dict) -> Dict:
    """
    Convenience function for NOESY analysis.

    Args:
        correlations: List of NOESY correlations
        config: Configuration dict

    Returns:
        Analysis result
    """
    analyzer = NOESYAnalyzer(config)
    return analyzer.analyze(correlations)


if __name__ == '__main__':
    # Test
    config = {
        'correlations': {
            'noesy': {
                'min_intensity': 0.1,
                'max_distance_angstrom': 5.0,
                'r_power': -6
            }
        }
    }

    test_correlations = [
        {'proton1': 'H1', 'proton2': 'H2', 'intensity': 0.9},  # Strong, close
        {'proton1': 'H1', 'proton2': 'H3', 'intensity': 0.4},  # Medium
        {'proton1': 'H2', 'proton2': 'H4', 'intensity': 0.15}, # Weak
        {'proton1': 'H3', 'proton2': 'H5', 'intensity': 0.05}, # Too weak
    ]

    result = analyze_noesy(test_correlations, config)

    print("=== NOESY Analysis ===")
    print(f"Total constraints: {result['num_constraints']}\n")

    for corr in result['analyzed_correlations']:
        print(f"{corr['proton1']} ↔ {corr['proton2']}: "
              f"{corr['distance_angstrom']} Å "
              f"(intensity={corr['intensity']}, confidence={corr['confidence']})")
