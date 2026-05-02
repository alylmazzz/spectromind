"""
FTIR Engine with Anharmonic Correction
"""

from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
from typing import List, Dict, Any, Optional
import logging
import math

logger = logging.getLogger(__name__)

# Anharmonic scaling factors (from literature)
SCALING_FACTORS = {
    "B3LYP/6-31G*": 0.961,
    "B3LYP/6-311+G(2d,p)": 0.967,
    "mPW1PW91/6-31G*": 0.958,
    "default": 0.961
}

def predict_ftir(
    smiles: str,
    anharmonic_correction: bool = True,
    scaling_factor: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Predict FTIR spectrum with anharmonic correction
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError("Invalid SMILES string")
    
    peaks = []
    
    # Detect functional groups and predict peaks
    # O-H stretch
    for atom in mol.GetAtoms():
        if atom.GetSymbol() == 'O':
            has_h = any(n.GetSymbol() == 'H' for n in atom.GetNeighbors())
            if has_h:
                frequency = 3300.0
                if anharmonic_correction:
                    frequency = apply_anharmonic_correction(frequency, scaling_factor)
                
                peaks.append({
                    "wavenumber": round(frequency, 1),
                    "intensity": 80,
                    "assignment": "O-H stretch",
                    "type": "broad"
                })
    
    # C=O stretch
    for bond in mol.GetBonds():
        if bond.GetBondType() == Chem.BondType.DOUBLE:
            atom1 = bond.GetBeginAtom()
            atom2 = bond.GetEndAtom()
            if (atom1.GetSymbol() == 'C' and atom2.GetSymbol() == 'O') or \
               (atom1.GetSymbol() == 'O' and atom2.GetSymbol() == 'C'):
                frequency = 1715.0
                if anharmonic_correction:
                    frequency = apply_anharmonic_correction(frequency, scaling_factor)
                
                peaks.append({
                    "wavenumber": round(frequency, 1),
                    "intensity": 100,
                    "assignment": "C=O stretch",
                    "type": "strong"
                })
    
    # Aromatic C=C
    aromatic_rings = mol.GetRingInfo().NumRings()
    if aromatic_rings > 0:
        frequency = 1600.0
        if anharmonic_correction:
            frequency = apply_anharmonic_correction(frequency, scaling_factor)
        
        peaks.append({
            "wavenumber": round(frequency, 1),
            "intensity": 60,
            "assignment": "Aromatic C=C",
            "type": "medium"
        })
    
    # C-H stretches
    sp3_ch = False
    sp2_ch = False
    for atom in mol.GetAtoms():
        if atom.GetSymbol() == 'C':
            hyb = atom.GetHybridization()
            has_h = any(n.GetSymbol() == 'H' for n in atom.GetNeighbors())
            if has_h:
                if hyb == Chem.HybridizationType.SP3:
                    sp3_ch = True
                elif hyb == Chem.HybridizationType.SP2:
                    sp2_ch = True
    
    if sp3_ch:
        frequency = 2900.0
        if anharmonic_correction:
            frequency = apply_anharmonic_correction(frequency, scaling_factor)
        
        peaks.append({
            "wavenumber": round(frequency, 1),
            "intensity": 50,
            "assignment": "sp3 C-H stretch",
            "type": "medium"
        })
    
    if sp2_ch:
        frequency = 3050.0
        if anharmonic_correction:
            frequency = apply_anharmonic_correction(frequency, scaling_factor)
        
        peaks.append({
            "wavenumber": round(frequency, 1),
            "intensity": 40,
            "assignment": "sp2 C-H stretch",
            "type": "weak"
        })
    
    return peaks

def apply_anharmonic_correction(
    frequency: float,
    scaling_factor: Optional[float] = None
) -> float:
    """
    Apply anharmonic scaling factor to harmonic frequency
    
    Formula: ν_anharmonic = scaling_factor × ν_harmonic
    """
    if scaling_factor is None:
        scaling_factor = SCALING_FACTORS["default"]
    
    return frequency * scaling_factor

def calculate_hooke_frequency(
    force_constant: float,  # mdyn/Å
    reduced_mass: float     # amu
) -> float:
    """
    Hooke's Law: ν = (1 / 2πc) * √(k / μ)
    """
    c = 2.998e10  # cm/s (speed of light)
    k = force_constant * 1e5  # Convert to dyn/cm
    mu = reduced_mass * 1.660539e-27  # Convert to kg
    
    frequency = (1 / (2 * math.pi * c)) * math.sqrt(k / mu)
    return frequency

