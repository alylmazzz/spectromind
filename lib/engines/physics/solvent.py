"""
SpectroMind v1.5 - Solvent Physics Engine

Models solvent effects on NMR chemical shifts, especially for exchangeable protons (OH, NH).
Accounts for hydrogen bonding, polarity, and exchange dynamics.

@module engines/physics/solvent
@version 1.5.0
"""

from typing import Dict, List, Optional


class SolventPhysics:
    """
    Apply solvent-specific corrections to NMR chemical shifts.

    Solvent Effects:
    - DMSO-d6: Strong H-bonding acceptor → OH/NH downfield
    - CDCl3: Weak H-bonding → OH/NH upfield
    - D2O: Proton exchange → OH/NH peaks disappear or broaden
    - CD3OD: Exchange with methanol → OH peaks at ~4.9 ppm
    """

    def __init__(self, config: Dict):
        """
        Initialize with solvent database.

        Args:
            config: Configuration dict with 'solvent_database' key
        """
        self.solvent_db = config.get('solvent_database', {})
        self.default_solvent = config.get('default_solvent', 'DMSO-d6')

    def apply_corrections(
        self,
        peaks: List[Dict],
        solvent: str,
        ph: Optional[float] = None
    ) -> List[Dict]:
        """
        Apply solvent-specific corrections to peak list.

        Args:
            peaks: List of peak dicts (id, shift, multiplicity, assignment)
            solvent: Solvent name (e.g., 'DMSO-d6')
            ph: Optional pH value for acid/base shifts

        Returns:
            Corrected peak list with 'solvent_corrected' flag
        """
        if solvent not in self.solvent_db:
            print(f"⚠️  Solvent '{solvent}' not in database, using default: {self.default_solvent}")
            solvent = self.default_solvent

        solvent_data = self.solvent_db[solvent]
        corrected_peaks = []

        for peak in peaks:
            corrected_peak = peak.copy()
            assignment = peak.get('assignment', '').upper()

            # Check if exchangeable proton
            if any(x in assignment for x in ['OH', 'NH', 'NH2', 'COOH']):
                shift_corrections = solvent_data.get('exchangeable_shifts', {})

                # Apply correction based on proton type
                if 'OH' in assignment and 'OH' in shift_corrections:
                    expected_shift = shift_corrections['OH']
                    if expected_shift is not None:
                        corrected_peak['solvent_expected'] = expected_shift
                        corrected_peak['solvent_note'] = f"OH proton in {solvent}"
                    else:
                        corrected_peak['solvent_note'] = f"OH exchanges in {solvent}, may not be visible"
                        corrected_peak['exchange_warning'] = True

                elif 'NH2' in assignment and 'NH2' in shift_corrections:
                    expected_shift = shift_corrections['NH2']
                    if expected_shift is not None:
                        corrected_peak['solvent_expected'] = expected_shift
                        corrected_peak['solvent_note'] = f"NH2 proton in {solvent}"
                    else:
                        corrected_peak['solvent_note'] = f"NH2 exchanges in {solvent}, may not be visible"
                        corrected_peak['exchange_warning'] = True

                elif 'NH' in assignment and 'NH' in shift_corrections:
                    expected_shift = shift_corrections['NH']
                    if expected_shift is not None:
                        corrected_peak['solvent_expected'] = expected_shift
                        corrected_peak['solvent_note'] = f"NH proton in {solvent}"
                    else:
                        corrected_peak['solvent_note'] = f"NH exchanges in {solvent}, may not be visible"
                        corrected_peak['exchange_warning'] = True

            # pH corrections (if provided)
            if ph is not None:
                corrected_peak = self._apply_ph_correction(corrected_peak, ph)

            corrected_peak['solvent_corrected'] = True
            corrected_peaks.append(corrected_peak)

        return corrected_peaks

    def _apply_ph_correction(self, peak: Dict, ph: float) -> Dict:
        """
        Apply pH-dependent shift corrections.

        Args:
            peak: Peak dict
            ph: pH value

        Returns:
            Corrected peak dict
        """
        assignment = peak.get('assignment', '').upper()

        # Carboxylic acids: COOH (pH < 5) vs COO- (pH > 7)
        if 'COOH' in assignment:
            if ph > 7:
                peak['ph_note'] = "Deprotonated (COO-)"
                # COO- shifts upfield compared to COOH
                if 'solvent_expected' in peak:
                    peak['solvent_expected'] -= 1.5  # ~1.5 ppm upfield shift

        # Amines: NH3+ (pH < 7) vs NH2 (pH > 9)
        elif 'NH' in assignment:
            if ph < 7:
                peak['ph_note'] = "Protonated (NH3+)"
                # NH3+ shifts downfield
                if 'solvent_expected' in peak:
                    peak['solvent_expected'] += 1.0  # ~1.0 ppm downfield

        return peak

    def get_residual_peaks(self, solvent: str) -> Dict:
        """
        Get solvent residual peak positions.

        Args:
            solvent: Solvent name

        Returns:
            Dict with residual_peak and water_peak (ppm)
        """
        if solvent not in self.solvent_db:
            solvent = self.default_solvent

        solvent_data = self.solvent_db[solvent]
        return {
            'residual_peak': solvent_data.get('residual_peak'),
            'water_peak': solvent_data.get('water_peak')
        }


def apply_solvent_corrections(
    peaks: List[Dict],
    solvent: str,
    ph: Optional[float],
    config: Dict
) -> List[Dict]:
    """
    Convenience function for solvent corrections.

    Args:
        peaks: Peak list
        solvent: Solvent name
        ph: Optional pH
        config: Configuration dict

    Returns:
        Corrected peak list
    """
    engine = SolventPhysics(config)
    return engine.apply_corrections(peaks, solvent, ph)


if __name__ == '__main__':
    # Test
    config = {
        'solvent_database': {
            'DMSO-d6': {
                'residual_peak': 2.50,
                'water_peak': 3.33,
                'exchangeable_shifts': {
                    'OH': 4.5,
                    'NH': 7.5,
                    'NH2': 6.5
                }
            },
            'D2O': {
                'residual_peak': 4.79,
                'exchangeable_shifts': {
                    'OH': None,  # Exchanges
                    'NH': None,
                    'NH2': None
                }
            }
        },
        'default_solvent': 'DMSO-d6'
    }

    test_peaks = [
        {'id': 'H1', 'shift': 7.2, 'assignment': 'aromatic'},
        {'id': 'H2', 'shift': 4.8, 'assignment': 'OH'},
        {'id': 'H3', 'shift': 7.3, 'assignment': 'NH'},
    ]

    # Test in DMSO
    print("=== DMSO-d6 ===")
    corrected = apply_solvent_corrections(test_peaks, 'DMSO-d6', ph=7.0, config=config)
    for peak in corrected:
        print(f"{peak['id']}: {peak}")

    print("\n=== D2O ===")
    corrected = apply_solvent_corrections(test_peaks, 'D2O', ph=7.0, config=config)
    for peak in corrected:
        print(f"{peak['id']}: {peak}")
