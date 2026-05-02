"""
HOSE Code Predictor
Hierarchical Organization of Spherical Environments
"""

from rdkit import Chem
from rdkit.Chem import Descriptors
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

def predict_h1(mol: Chem.Mol, solvent: str = "CDCl3") -> List[Dict[str, Any]]:
    """
    Predict 1H NMR spectrum using HOSE codes
    """
    peaks = []
    
    # Add explicit hydrogens
    mol = Chem.AddHs(mol)
    
    # Group equivalent hydrogens
    equivalent_groups = _find_equivalent_hydrogens(mol)
    
    for group in equivalent_groups:
        atom_idx = group[0]
        atom = mol.GetAtomWithIdx(atom_idx)
        
        # Calculate shift using HOSE-like approach
        shift = _calculate_h1_shift(mol, atom_idx, solvent)
        
        # Determine multiplicity
        multiplicity = _determine_multiplicity(mol, atom_idx)
        
        # Calculate integration
        integration = len(group)
        
        peaks.append({
            "shift": round(shift, 2),
            "integration": integration,
            "multiplicity": multiplicity,
            "assignment": f"H{atom_idx + 1}"
        })
    
    return peaks

def predict_c13(mol: Chem.Mol) -> List[Dict[str, Any]]:
    """
    Predict 13C NMR spectrum using HOSE codes
    """
    peaks = []
    
    # Find all carbons
    for atom in mol.GetAtoms():
        if atom.GetSymbol() == 'C':
            shift = _calculate_c13_shift(mol, atom.GetIdx())
            
            # Determine carbon type
            h_count = sum(1 for n in atom.GetNeighbors() if n.GetSymbol() == 'H')
            carbon_type = 'Cq' if h_count == 0 else f'CH{h_count}'
            
            peaks.append({
                "shift": round(shift, 2),
                "intensity": 1.0,
                "assignment": f"{carbon_type} (C{atom.GetIdx() + 1})",
                "carbon_type": carbon_type
            })
    
    return peaks

def _calculate_h1_shift(mol: Chem.Mol, h_atom_idx: int, solvent: str) -> float:
    """Calculate 1H chemical shift"""
    atom = mol.GetAtomWithIdx(h_atom_idx)
    
    # Find attached carbon
    carbon = None
    for neighbor in atom.GetNeighbors():
        if neighbor.GetSymbol() == 'C':
            carbon = neighbor
            break
    
    if not carbon:
        return 0.9  # Default methyl
    
    # Base shift based on carbon type
    hyb = carbon.GetHybridization()
    if hyb == Chem.HybridizationType.SP3:
        base_shift = 1.2
    elif hyb == Chem.HybridizationType.SP2:
        base_shift = 5.25  # Olefinic
    else:
        base_shift = 2.5  # sp
    
    # Check if aromatic
    if carbon.GetIsAromatic():
        base_shift = 7.27  # Aromatic base
    
    # Apply substituent effects (simplified)
    shift = base_shift + _get_substituent_effect(mol, carbon)
    
    # Solvent correction
    shift += _get_solvent_correction(solvent)
    
    return shift

def _calculate_c13_shift(mol: Chem.Mol, carbon_idx: int) -> float:
    """Calculate 13C chemical shift using Grant-Paul approach"""
    carbon = mol.GetAtomWithIdx(carbon_idx)
    
    # Base shift
    hyb = carbon.GetHybridization()
    if hyb == Chem.HybridizationType.SP3:
        base_shift = -2.3  # Grant-Paul base
    elif hyb == Chem.HybridizationType.SP2:
        if carbon.GetIsAromatic():
            base_shift = 128.5  # Aromatic
        else:
            base_shift = 123.3  # Olefinic
    else:
        base_shift = 75.0  # Alkyne
    
    # Count neighbors (alpha, beta effects)
    alpha_count = sum(1 for n in carbon.GetNeighbors() if n.GetSymbol() == 'C')
    
    # Grant-Paul formula (simplified)
    if hyb == Chem.HybridizationType.SP3:
        shift = base_shift + 9.1 * alpha_count
    else:
        shift = base_shift
    
    # Functional group corrections
    shift = _apply_functional_group_correction(mol, carbon_idx, shift)
    
    return shift

def _get_substituent_effect(mol: Chem.Mol, carbon: Chem.Atom) -> float:
    """Get substituent effect on shift"""
    effect = 0.0
    
    for neighbor in carbon.GetNeighbors():
        symbol = neighbor.GetSymbol()
        if symbol == 'O':
            effect += 2.5  # Oxygen effect
        elif symbol == 'N':
            effect += 1.5  # Nitrogen effect
        elif symbol == 'Cl':
            effect += 2.5  # Chlorine effect
        elif symbol == 'Br':
            effect += 2.3  # Bromine effect
    
    return effect

def _apply_functional_group_correction(mol: Chem.Mol, carbon_idx: int, base_shift: float) -> float:
    """Apply functional group corrections"""
    carbon = mol.GetAtomWithIdx(carbon_idx)
    
    # Check for carbonyl
    for bond in carbon.GetBonds():
        if bond.GetBondType() == Chem.BondType.DOUBLE:
            neighbor = bond.GetOtherAtom(carbon)
            if neighbor.GetSymbol() == 'O':
                return 195.0  # Keton
    
    return base_shift

def _get_solvent_correction(solvent: str) -> float:
    """Get solvent correction factor"""
    corrections = {
        "CDCl3": 0.0,
        "DMSO-d6": 0.2,
        "D2O": 0.1,
        "MeOD": 0.15
    }
    return corrections.get(solvent, 0.0)

def _find_equivalent_hydrogens(mol: Chem.Mol) -> List[List[int]]:
    """Find equivalent hydrogens (simplified symmetry detection)"""
    equivalent_groups = []
    processed = set()
    
    for atom in mol.GetAtoms():
        if atom.GetSymbol() == 'H' and atom.GetIdx() not in processed:
            # Find equivalent atoms (simplified)
            group = [atom.GetIdx()]
            processed.add(atom.GetIdx())
            equivalent_groups.append(group)
    
    return equivalent_groups

def _determine_multiplicity(mol: Chem.Mol, h_atom_idx: int) -> str:
    """Determine multiplicity (n+1 rule)"""
    atom = mol.GetAtomWithIdx(h_atom_idx)
    
    # Find attached carbon
    carbon = None
    for neighbor in atom.GetNeighbors():
        if neighbor.GetSymbol() == 'C':
            carbon = neighbor
            break
    
    if not carbon:
        return 's'  # Singlet
    
    # Count equivalent neighboring hydrogens
    neighbor_h_count = 0
    for neighbor in carbon.GetNeighbors():
        if neighbor.GetSymbol() == 'H' and neighbor.GetIdx() != h_atom_idx:
            neighbor_h_count += 1
    
    mult_map = {
        0: 's', 1: 'd', 2: 't', 3: 'q', 4: 'p', 5: 'sextet', 6: 'septet'
    }
    
    return mult_map.get(neighbor_h_count, 'm')

