"""
SpectroMind v1.5 - HOSE-based NMR Predictor

Forward prediction: Given a molecular structure (SMILES), predict NMR spectrum.
Uses simplified HOSE code approach for fast prediction without DFT.

@module engines/predictor/hose
@version 1.5.0
"""

from typing import List, Dict, Optional, Tuple
import json
try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, AllChem
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print("⚠️  RDKit not available for HOSE predictor")


class HOSEPredictor:
    """
    Predict 1H NMR chemical shifts using simplified HOSE-like approach.

    This is a fast heuristic predictor, not a full HOSE database implementation.
    Uses atom type, hybridization, and local environment to estimate shifts.
    """

    def __init__(self, config: Dict):
        """
        Initialize predictor.

        Args:
            config: Configuration dict
        """
        if not RDKIT_AVAILABLE:
            raise ImportError("RDKit required for HOSE predictor")

        self.config = config

        # Simplified shift ranges by atom type and environment
        self.shift_ranges = {
            # Aromatic CH
            'aromatic_CH': (6.5, 8.5),
            'aromatic_benzene': (7.2, 7.4),

            # Alkene
            'alkene_CH': (4.5, 6.5),

            # Carbonyl adjacent
            'alpha_carbonyl': (2.0, 2.5),

            # Ether/Alcohol
            'ether_OCH': (3.0, 4.0),
            'alcohol_OH': (2.0, 5.0),

            # Amine
            'amine_NCH': (2.0, 3.0),

            # Alkyl
            'methyl_CH3': (0.8, 1.2),
            'methylene_CH2': (1.2, 1.8),
            'methine_CH': (1.5, 2.5),

            # Aldehyde
            'aldehyde_CHO': (9.0, 10.0),

            # Default
            'default': (1.0, 2.0),
        }

    def predict(self, smiles: str) -> Dict:
        """
        Predict 1H NMR spectrum from SMILES.

        Args:
            smiles: SMILES string

        Returns:
            Dict with predicted_shifts, confidence, molecule_class
        """
        try:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                return {
                    'success': False,
                    'error': 'Invalid SMILES'
                }

            # Add hydrogens for accurate prediction
            mol = Chem.AddHs(mol)

            # Predict shifts for each hydrogen
            predicted_shifts = []

            for atom in mol.GetAtoms():
                if atom.GetSymbol() == 'H':
                    # Get heavy atom bonded to H
                    heavy_atom = atom.GetNeighbors()[0]
                    shift = self._predict_hydrogen_shift(mol, atom, heavy_atom)
                    predicted_shifts.append(shift)

            # Sort shifts (descending order, like NMR spectrum)
            predicted_shifts.sort(reverse=True)

            # Classify molecule for RMSD tolerance
            molecule_class = self._classify_molecule(mol)

            return {
                'success': True,
                'predicted_shifts': predicted_shifts,
                'num_protons': len(predicted_shifts),
                'molecule_class': molecule_class,
                'smiles': smiles,
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _predict_hydrogen_shift(self, mol: 'Chem.Mol', h_atom: 'Chem.Atom', heavy_atom: 'Chem.Atom') -> float:
        """
        Predict chemical shift for a single hydrogen.

        Args:
            mol: RDKit molecule
            h_atom: Hydrogen atom
            heavy_atom: Heavy atom bonded to H

        Returns:
            Predicted shift (ppm)
        """
        # Check heavy atom type
        symbol = heavy_atom.GetSymbol()
        hybridization = heavy_atom.GetHybridization()
        aromatic = heavy_atom.GetIsAromatic()

        # Aromatic CH
        if aromatic and symbol == 'C':
            return self._random_in_range('aromatic_benzene')

        # Aldehyde CHO
        if self._is_aldehyde(mol, heavy_atom):
            return self._random_in_range('aldehyde_CHO')

        # Alkene CH
        if hybridization == Chem.HybridizationType.SP2 and symbol == 'C' and not aromatic:
            return self._random_in_range('alkene_CH')

        # Ether/Alcohol OCH
        if symbol == 'O':
            return self._random_in_range('alcohol_OH')

        if symbol == 'C':
            # Check if alpha to carbonyl
            if self._is_alpha_to_carbonyl(mol, heavy_atom):
                return self._random_in_range('alpha_carbonyl')

            # Check if bonded to oxygen
            if self._is_bonded_to_oxygen(heavy_atom):
                return self._random_in_range('ether_OCH')

            # Check if bonded to nitrogen
            if self._is_bonded_to_nitrogen(heavy_atom):
                return self._random_in_range('amine_NCH')

            # Alkyl CH3/CH2/CH
            num_hydrogens = heavy_atom.GetTotalNumHs()
            if num_hydrogens == 3:
                return self._random_in_range('methyl_CH3')
            elif num_hydrogens == 2:
                return self._random_in_range('methylene_CH2')
            else:
                return self._random_in_range('methine_CH')

        # Default
        return self._random_in_range('default')

    def _random_in_range(self, key: str) -> float:
        """Get midpoint of shift range"""
        range_tuple = self.shift_ranges.get(key, self.shift_ranges['default'])
        return (range_tuple[0] + range_tuple[1]) / 2.0

    def _is_aldehyde(self, mol: 'Chem.Mol', atom: 'Chem.Atom') -> bool:
        """Check if carbon is aldehyde"""
        if atom.GetSymbol() != 'C':
            return False

        for neighbor in atom.GetNeighbors():
            if neighbor.GetSymbol() == 'O':
                bond = mol.GetBondBetweenAtoms(atom.GetIdx(), neighbor.GetIdx())
                if bond.GetBondType() == Chem.BondType.DOUBLE:
                    return True
        return False

    def _is_alpha_to_carbonyl(self, mol: 'Chem.Mol', atom: 'Chem.Atom') -> bool:
        """Check if carbon is alpha to carbonyl"""
        for neighbor in atom.GetNeighbors():
            if neighbor.GetSymbol() == 'C':
                for n2 in neighbor.GetNeighbors():
                    if n2.GetSymbol() == 'O':
                        bond = mol.GetBondBetweenAtoms(neighbor.GetIdx(), n2.GetIdx())
                        if bond.GetBondType() == Chem.BondType.DOUBLE:
                            return True
        return False

    def _is_bonded_to_oxygen(self, atom: 'Chem.Atom') -> bool:
        """Check if atom is bonded to oxygen"""
        return any(n.GetSymbol() == 'O' for n in atom.GetNeighbors())

    def _is_bonded_to_nitrogen(self, atom: 'Chem.Atom') -> bool:
        """Check if atom is bonded to nitrogen"""
        return any(n.GetSymbol() == 'N' for n in atom.GetNeighbors())

    def _classify_molecule(self, mol: 'Chem.Mol') -> str:
        """
        Classify molecule for RMSD tolerance.

        Returns:
            'aromatic', 'aliphatic', 'heterocyclic', or 'carbonyl'
        """
        has_aromatic = any(atom.GetIsAromatic() for atom in mol.GetAtoms())
        has_hetero = any(atom.GetSymbol() in ['N', 'O', 'S'] for atom in mol.GetAtoms())
        has_carbonyl = any(
            bond.GetBondType() == Chem.BondType.DOUBLE
            and any(a.GetSymbol() == 'O' for a in [bond.GetBeginAtom(), bond.GetEndAtom()])
            for bond in mol.GetBonds()
        )

        if has_hetero and has_aromatic:
            return 'heterocyclic'
        elif has_carbonyl:
            return 'carbonyl'
        elif has_aromatic:
            return 'aromatic'
        else:
            return 'aliphatic'


def predict_nmr(smiles: str, config: Dict) -> Dict:
    """
    Convenience function for NMR prediction.

    Args:
        smiles: SMILES string
        config: Configuration dict

    Returns:
        Prediction result
    """
    predictor = HOSEPredictor(config)
    return predictor.predict(smiles)


# ============================================================================
# CLI INTERFACE
# ============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python3 hose.py <SMILES>'
        }))
        sys.exit(1)
    
    smiles_input = sys.argv[1]
    config = {}  # Empty config for default behavior
    
    predictor = HOSEPredictor(config)
    result = predictor.predict(smiles_input)
    
    # Output JSON
    print(json.dumps(result, indent=2))
