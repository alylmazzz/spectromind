"""
SpectroMind v1.5 - HMBC Correlation Engine

Analyzes HMBC (Heteronuclear Multiple Bond Correlation) data.
Shows 1H-13C connectivity over 2-3 bonds (2J, 3J couplings).

@module engines/correlations/hmbc
@version 1.5.0
"""

from typing import List, Dict


class HMBCAnalyzer:
    """
    Analyze HMBC correlations to determine molecular connectivity.

    HMBC shows which protons couple with which carbons through
    2 or 3 bonds. This provides crucial connectivity information.
    """

    def __init__(self, config: Dict):
        """
        Initialize analyzer.

        Args:
            config: Configuration dict with HMBC parameters
        """
        hmbc_config = config.get('correlations', {}).get('hmbc', {})
        self.min_intensity = hmbc_config.get('min_intensity', 0.1)
        self.max_bonds = hmbc_config.get('max_bonds', 3)

    def analyze(self, correlations: List[Dict]) -> Dict:
        """
        Analyze HMBC correlations.

        Args:
            correlations: List of dicts with:
                - proton: str (proton peak ID)
                - carbon: str (carbon peak ID)
                - intensity: float (0-1 normalized)
                - bonds: int (optional, 2 or 3)

        Returns:
            Dict with connectivity constraints
        """
        analyzed = []
        connectivity_map = {}

        for corr in correlations:
            if corr.get('intensity', 0) < self.min_intensity:
                continue

            proton = corr['proton']
            carbon = corr['carbon']
            intensity = corr['intensity']
            bonds = corr.get('bonds', 3)  # Assume 3J if not specified

            analyzed_corr = {
                'proton': proton,
                'carbon': carbon,
                'intensity': intensity,
                'bonds': bonds,
                'confidence': self._get_confidence(intensity),
            }

            analyzed.append(analyzed_corr)

            # Build connectivity map
            if proton not in connectivity_map:
                connectivity_map[proton] = []

            connectivity_map[proton].append({
                'carbon': carbon,
                'bonds': bonds,
                'intensity': intensity
            })

        return {
            'analyzed_correlations': analyzed,
            'connectivity_map': connectivity_map,
            'num_correlations': len(analyzed)
        }

    def _get_confidence(self, intensity: float) -> str:
        """
        Get confidence level based on intensity.

        Args:
            intensity: HMBC intensity

        Returns:
            'high', 'medium', or 'low'
        """
        if intensity >= 0.5:
            return 'high'
        elif intensity >= 0.25:
            return 'medium'
        else:
            return 'low'


def analyze_hmbc(correlations: List[Dict], config: Dict) -> Dict:
    """
    Convenience function for HMBC analysis.

    Args:
        correlations: List of HMBC correlations
        config: Configuration dict

    Returns:
        Analysis result
    """
    analyzer = HMBCAnalyzer(config)
    return analyzer.analyze(correlations)


if __name__ == '__main__':
    # Test
    config = {
        'correlations': {
            'hmbc': {
                'min_intensity': 0.1,
                'max_bonds': 3
            }
        }
    }

    test_correlations = [
        {'proton': 'H1', 'carbon': 'C2', 'intensity': 0.8, 'bonds': 3},
        {'proton': 'H1', 'carbon': 'C3', 'intensity': 0.6, 'bonds': 2},
        {'proton': 'H2', 'carbon': 'C1', 'intensity': 0.7, 'bonds': 3},
        {'proton': 'H2', 'carbon': 'C4', 'intensity': 0.3, 'bonds': 3},
    ]

    result = analyze_hmbc(test_correlations, config)

    print("=== HMBC Analysis ===")
    print(f"Total correlations: {result['num_correlations']}\n")

    for corr in result['analyzed_correlations']:
        print(f"{corr['proton']} → {corr['carbon']}: "
              f"{corr['bonds']}J coupling "
              f"(intensity={corr['intensity']}, confidence={corr['confidence']})")

    print("\n=== Connectivity Map ===")
    for proton, carbons in result['connectivity_map'].items():
        carbon_list = ', '.join([f"{c['carbon']} ({c['bonds']}J)" for c in carbons])
        print(f"{proton}: {carbon_list}")
