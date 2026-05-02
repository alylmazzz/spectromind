"""
Mass Spectrometry Predictor
In-silico fragmentation and isotope pattern analysis
"""

from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors
from typing import List, Dict, Any, Optional
import logging
import math

logger = logging.getLogger(__name__)

def predict_ms(
    smiles: str,
    ionization_mode: str = "ESI",
    collision_energy: Optional[float] = None
) -> Dict[str, Any]:
    """
    Predict Mass Spectrometry spectrum
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError("Invalid SMILES string")
    
    # Calculate molecular weight
    mw = Descriptors.MolWt(mol)
    
    # Predict molecular ion (M+)
    molecular_ion = predict_molecular_ion(mol, ionization_mode, mw)
    
    # Predict fragments
    fragments = predict_fragments(mol, collision_energy)
    
    # Calculate isotope pattern
    isotope_pattern = calculate_isotope_pattern(mol, mw)
    
    return {
        "molecular_ion": molecular_ion,
        "fragments": fragments,
        "isotope_pattern": isotope_pattern
    }

def predict_molecular_ion(
    mol: Chem.Mol,
    ionization_mode: str,
    mw: float
) -> Dict[str, Any]:
    """
    Predict molecular ion (M+) and adducts
    """
    adducts = {
        "ESI": [
            {"adduct": "[M+H]+", "mass": 1.0078},
            {"adduct": "[M+Na]+", "mass": 22.9897},
            {"adduct": "[M+K]+", "mass": 38.9637},
        ],
        "EI": [
            {"adduct": "M+", "mass": 0.0}
        ],
        "APCI": [
            {"adduct": "[M+H]+", "mass": 1.0078}
        ]
    }
    
    adduct_list = adducts.get(ionization_mode, adducts["ESI"])
    
    molecular_ions = []
    for adduct in adduct_list:
        molecular_ions.append({
            "adduct": adduct["adduct"],
            "mz": round(mw + adduct["mass"], 4),
            "intensity": 100 if adduct["adduct"] == "[M+H]+" else 30
        })
    
    return {
        "molecular_weight": round(mw, 4),
        "ions": molecular_ions
    }

def predict_fragments(
    mol: Chem.Mol,
    collision_energy: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Predict fragmentation pattern (simplified)
    
    In production, this would use CFM-ID or similar tool
    """
    fragments = []
    
    # Simple bond breaking simulation
    for bond in mol.GetBonds():
        if bond.GetBondType() == Chem.BondType.SINGLE:
            # Try breaking this bond
            try:
                # Create two fragments
                frag1 = Chem.FragmentOnBonds(mol, [bond.GetIdx()], addDummies=False)
                # This is simplified - real implementation would be more complex
                
                # Calculate fragment mass
                frag_mw = Descriptors.MolWt(frag1)
                
                fragments.append({
                    "mz": round(frag_mw, 4),
                    "intensity": 20,  # Placeholder
                    "assignment": "Fragment"
                })
            except:
                continue
    
    # Limit to top 10 fragments
    fragments = sorted(fragments, key=lambda x: x["intensity"], reverse=True)[:10]
    
    return fragments

def calculate_isotope_pattern(
    mol: Chem.Mol,
    mw: float
) -> Dict[str, Any]:
    """
    Calculate isotope pattern (simplified)
    
    Uses binomial distribution for 13C, 15N, etc.
    """
    formula = rdMolDescriptors.CalcMolFormula(mol)
    
    # Parse formula to get element counts
    import re
    c_match = re.search(r'C(\d+)', formula)
    n_match = re.search(r'N(\d+)', formula)
    
    C_count = int(c_match.group(1)) if c_match else 0
    N_count = int(n_match.group(1)) if n_match else 0
    
    # Calculate 13C isotope pattern (M+1 peak)
    # P(M+1) ≈ C_count × 0.011 (1.1% natural abundance)
    m1_intensity = C_count * 0.011 * 100  # Percentage
    
    # M+2 peak (two 13C or one 15N)
    m2_intensity = (C_count * (C_count - 1) / 2) * (0.011 ** 2) * 100
    if N_count > 0:
        m2_intensity += N_count * 0.0037 * 100  # 15N contribution
    
    return {
        "M": {"mz": round(mw, 4), "intensity": 100.0},
        "M+1": {"mz": round(mw + 1.0034, 4), "intensity": round(m1_intensity, 2)},
        "M+2": {"mz": round(mw + 2.0067, 4), "intensity": round(m2_intensity, 2)}
    }

