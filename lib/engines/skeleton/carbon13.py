"""
SpectroMind v1.5 - 13C NMR Carbon Skeleton Builder

Builds molecular skeleton from 13C NMR data (primary source) with DEPT classification.
13C data is more reliable than 1H for skeleton construction.

@module engines/skeleton/carbon13
@version 1.5.0
"""

from typing import List, Dict, Tuple


class CarbonSkeletonBuilder:
    """
    Build molecular carbon skeleton from 13C NMR and DEPT data.

    Priority: 13C NMR > DEPT > HSQC > 1H NMR

    Carbon Types (DEPT):
    - CH3: Methyl (points down in DEPT-135)
    - CH2: Methylene (points down in DEPT-135)
    - CH: Methine (points up in DEPT-135, DEPT-90)
    - Cq: Quaternary (absent in DEPT)
    """

    def __init__(self, config: Dict):
        """
        Initialize builder.

        Args:
            config: Configuration dict with carbon13 settings
        """
        carbon_config = config.get('carbon13', {})
        self.silent_cq_penalty = carbon_config.get('silent_cq_penalty', 0.0)

        # Chemical shift ranges for carbon types
        self.carbon_ranges = {
            'aromatic': (110, 160),
            'carbonyl': (160, 220),
            'alkene': (100, 150),
            'sp3_carbon': (0, 100),
            'nitrile': (115, 125),
        }

    def build(self, carbon_peaks: List[Dict]) -> Dict:
        """
        Build carbon skeleton from 13C NMR peaks.

        Args:
            carbon_peaks: List of dicts with:
                - id: str (e.g., "C1")
                - shift: float (ppm)
                - type: str ('CH3', 'CH2', 'CH', 'Cq')
                - is_silent: bool (optional, for Cq)

        Returns:
            Dict with skeleton info, classified carbons
        """
        if not carbon_peaks or len(carbon_peaks) == 0:
            return {
                'success': False,
                'error': 'No carbon peaks provided'
            }

        # Classify carbons by type
        classified = {
            'CH3': [],
            'CH2': [],
            'CH': [],
            'Cq': [],
        }

        for peak in carbon_peaks:
            carbon_type = peak.get('type', 'Cq')
            classified[carbon_type].append(peak)

        # Classify carbons by chemical shift region
        regions = {
            'aromatic': [],
            'carbonyl': [],
            'alkene': [],
            'sp3': [],
        }

        for peak in carbon_peaks:
            shift = peak['shift']
            region = self._classify_region(shift)
            regions[region].append(peak)

        # Build skeleton summary
        skeleton = {
            'total_carbons': len(carbon_peaks),
            'by_type': {k: len(v) for k, v in classified.items()},
            'by_region': {k: len(v) for k, v in regions.items()},
            'classified_peaks': classified,
            'regions': regions,
        }

        # Detect silent Cq (quaternary carbons without HMBC)
        silent_cq = [p for p in classified['Cq'] if p.get('is_silent', False)]

        if silent_cq:
            skeleton['silent_cq_count'] = len(silent_cq)
            skeleton['silent_cq_note'] = "Silent Cq detected - no HMBC penalty applied"

        return {
            'success': True,
            'skeleton': skeleton
        }

    def _classify_region(self, shift: float) -> str:
        """
        Classify carbon by chemical shift region.

        Args:
            shift: Chemical shift (ppm)

        Returns:
            Region name
        """
        if self.carbon_ranges['carbonyl'][0] <= shift <= self.carbon_ranges['carbonyl'][1]:
            return 'carbonyl'
        elif self.carbon_ranges['aromatic'][0] <= shift <= self.carbon_ranges['aromatic'][1]:
            return 'aromatic'
        elif self.carbon_ranges['alkene'][0] <= shift <= self.carbon_ranges['alkene'][1]:
            return 'alkene'
        else:
            return 'sp3'


def build_carbon_skeleton(carbon_peaks: List[Dict], config: Dict) -> Dict:
    """
    Convenience function for carbon skeleton building.

    Args:
        carbon_peaks: List of 13C NMR peaks
        config: Configuration dict

    Returns:
        Skeleton build result
    """
    builder = CarbonSkeletonBuilder(config)
    return builder.build(carbon_peaks)


if __name__ == '__main__':
    # Test
    config = {
        'carbon13': {
            'silent_cq_penalty': 0.0
        }
    }

    # Test case: Acetophenone (C8H8O)
    # Phenyl ring (4 aromatic C) + CO + CH3
    test_peaks = [
        {'id': 'C1', 'shift': 137.0, 'type': 'Cq'},      # Aromatic Cq (ipso)
        {'id': 'C2', 'shift': 128.5, 'type': 'CH'},      # Aromatic CH
        {'id': 'C3', 'shift': 128.2, 'type': 'CH'},      # Aromatic CH
        {'id': 'C4', 'shift': 133.0, 'type': 'CH'},      # Aromatic CH
        {'id': 'C5', 'shift': 197.5, 'type': 'Cq', 'is_silent': True},  # Carbonyl C=O
        {'id': 'C6', 'shift': 26.8, 'type': 'CH3'},      # Methyl CH3
    ]

    result = build_carbon_skeleton(test_peaks, config)

    if result['success']:
        skeleton = result['skeleton']
        print("=== Carbon Skeleton ===")
        print(f"Total carbons: {skeleton['total_carbons']}")
        print(f"\nBy type:")
        for ctype, count in skeleton['by_type'].items():
            print(f"  {ctype}: {count}")

        print(f"\nBy region:")
        for region, count in skeleton['by_region'].items():
            if count > 0:
                print(f"  {region}: {count}")

        if 'silent_cq_note' in skeleton:
            print(f"\n⚠️  {skeleton['silent_cq_note']}")
