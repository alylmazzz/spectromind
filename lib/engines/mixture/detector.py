"""
SpectroMind v1.5 - Mixture Detection Engine

Detects impurities and separates major/minor components in NMR spectra.
Uses integration-based analysis to identify orphan peaks.

@module engines/mixture/detector
@version 1.5.0
@author SpectroMind Team
"""

from typing import List, Dict, Tuple, Optional
import json


class MixtureDetector:
    """
    Analyzes NMR peak integrations to separate major component from impurities.

    Algorithm:
    1. Normalize all integrations to sum = 100%
    2. Find peaks below impurity_threshold (default 10%)
    3. Check if remaining peaks form stoichiometric pattern
    4. Classify peaks as 'major', 'minor', or 'impurity'
    """

    def __init__(self, config: Dict):
        """
        Initialize detector with configuration.

        Args:
            config: Configuration dict with:
                - impurity_threshold: float (default 0.10)
                - min_major_component: float (default 0.70)
                - allow_mixtures: bool (default True)
        """
        self.impurity_threshold = config.get('impurity_threshold', 0.10)
        self.min_major_component = config.get('min_major_component', 0.70)
        self.allow_mixtures = config.get('allow_mixtures', True)

    def analyze(self, peaks: List[Dict]) -> Dict:
        """
        Analyze peaks and detect mixture components.

        Args:
            peaks: List of dicts with keys: id, shift, integration, multiplicity

        Returns:
            Dict with keys:
                - detected: bool (mixture detected?)
                - components: List[Dict] (major/minor components)
                - impurities: List[str] (peak IDs of impurities)
                - clean_peaks: List[Dict] (peaks after impurity removal)
        """
        if not peaks or len(peaks) == 0:
            return {
                'detected': False,
                'components': [],
                'impurities': [],
                'clean_peaks': []
            }

        # Step 1: Normalize integrations
        normalized_peaks = self._normalize_integrations(peaks)

        # Step 2: Classify peaks
        major_peaks, minor_peaks, impurity_peaks = self._classify_peaks(normalized_peaks)

        # Step 3: Calculate component percentages
        major_percentage = sum(p['normalized_integ'] for p in major_peaks)
        minor_percentage = sum(p['normalized_integ'] for p in minor_peaks)

        # Step 4: Build result
        components = []

        if major_peaks:
            components.append({
                'type': 'major',
                'percentage': round(major_percentage * 100, 1),
                'peaks': [p['id'] for p in major_peaks]
            })

        if minor_peaks and self.allow_mixtures:
            components.append({
                'type': 'minor',
                'percentage': round(minor_percentage * 100, 1),
                'peaks': [p['id'] for p in minor_peaks]
            })

        mixture_detected = len(components) > 1 or len(impurity_peaks) > 0

        return {
            'detected': mixture_detected,
            'components': components,
            'impurities': [p['id'] for p in impurity_peaks],
            'clean_peaks': major_peaks if not self.allow_mixtures else major_peaks + minor_peaks
        }

    def _normalize_integrations(self, peaks: List[Dict]) -> List[Dict]:
        """Normalize integrations to sum = 1.0"""
        total = sum(p.get('integration', p.get('integ', 1.0)) for p in peaks)

        if total == 0:
            total = 1.0

        normalized = []
        for peak in peaks:
            integ = peak.get('integration', peak.get('integ', 1.0))
            norm_peak = peak.copy()
            norm_peak['normalized_integ'] = integ / total
            normalized.append(norm_peak)

        return normalized

    def _classify_peaks(self, peaks: List[Dict]) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Classify peaks into major, minor, and impurity groups.

        Returns:
            (major_peaks, minor_peaks, impurity_peaks)
        """
        # Sort by integration (descending)
        sorted_peaks = sorted(peaks, key=lambda p: p['normalized_integ'], reverse=True)

        impurity_peaks = []
        candidate_peaks = []

        # Step 1: Remove clear impurities (below threshold)
        for peak in sorted_peaks:
            if peak['normalized_integ'] < self.impurity_threshold:
                impurity_peaks.append(peak)
            else:
                candidate_peaks.append(peak)

        if not candidate_peaks:
            return ([], [], impurity_peaks)

        # Step 2: Check if we have enough for major component
        total_candidate = sum(p['normalized_integ'] for p in candidate_peaks)

        if total_candidate >= self.min_major_component:
            # All candidates are major component
            return (candidate_peaks, [], impurity_peaks)
        else:
            # Try to separate major and minor
            cumulative = 0.0
            major_peaks = []
            minor_peaks = []

            for peak in candidate_peaks:
                if cumulative < self.min_major_component:
                    major_peaks.append(peak)
                    cumulative += peak['normalized_integ']
                else:
                    minor_peaks.append(peak)

            # If we still don't have enough major, move all to major
            if cumulative < self.min_major_component:
                major_peaks = candidate_peaks
                minor_peaks = []

            return (major_peaks, minor_peaks, impurity_peaks)


def detect_mixture(peaks: List[Dict], config: Dict) -> Dict:
    """
    Convenience function for mixture detection.

    Args:
        peaks: List of peak dicts
        config: Configuration dict

    Returns:
        Mixture analysis result
    """
    detector = MixtureDetector(config)
    return detector.analyze(peaks)


if __name__ == '__main__':
    # Test
    test_peaks = [
        {'id': 'H1', 'shift': 7.2, 'integration': 5.0, 'multiplicity': 's'},
        {'id': 'H2', 'shift': 3.5, 'integration': 2.0, 'multiplicity': 'q'},
        {'id': 'H3', 'shift': 1.2, 'integration': 3.0, 'multiplicity': 't'},
        {'id': 'H4', 'shift': 5.8, 'integration': 0.3, 'multiplicity': 's'},  # Impurity
    ]

    config = {
        'impurity_threshold': 0.10,
        'min_major_component': 0.70,
        'allow_mixtures': True
    }

    result = detect_mixture(test_peaks, config)
    print(json.dumps(result, indent=2))
