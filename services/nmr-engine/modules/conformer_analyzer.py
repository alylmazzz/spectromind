"""
Conformer Ensemble Analyzer
ETKDGv3 + Boltzmann Weighting
"""

from rdkit import Chem
from rdkit.Chem import AllChem
from typing import List, Dict, Any
import logging
import math

logger = logging.getLogger(__name__)

# Constants
R = 8.314  # J/(mol·K)
DEFAULT_TEMPERATURE = 298.15  # K

def generate_ensemble(
    smiles: str,
    num_conformers: int = 50,
    optimize: bool = True,
    boltzmann_weighting: bool = True,
    temperature: float = DEFAULT_TEMPERATURE
) -> Dict[str, Any]:
    """
    Generate conformer ensemble with Boltzmann weighting
    
    Returns:
        {
            "conformers": List of conformer data,
            "lowest_energy": float,
            "boltzmann_weights": List of weights
        }
    """
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError("Invalid SMILES string")
    
    mol = Chem.AddHs(mol)
    
    # Generate conformers using ETKDGv3
    conformer_ids = AllChem.EmbedMultipleConfs(
        mol,
        numConfs=num_conformers,
        useExpTorsionAnglePrefs=True,
        useBasicKnowledge=True,
        randomSeed=42
    )
    
    if len(conformer_ids) == 0:
        raise ValueError("Failed to generate conformers")
    
    conformers = []
    energies = []
    
    # Optimize and calculate energy for each conformer
    for conf_id in conformer_ids:
        if optimize:
            # MMFF94 optimization
            try:
                AllChem.MMFFOptimizeMolecule(mol, confId=conf_id)
            except:
                logger.warning(f"MMFF optimization failed for conformer {conf_id}")
        
        # Calculate energy (MMFF94)
        try:
            mp = AllChem.MMFFGetMoleculeProperties(mol)
            ff = AllChem.MMFFGetMoleculeForceField(mol, mp, confId=conf_id)
            energy = ff.CalcEnergy()  # kcal/mol
        except:
            energy = 1000.0  # High energy if calculation fails
        
        # Get coordinates
        conformer = mol.GetConformer(conf_id)
        coords = []
        for i in range(mol.GetNumAtoms()):
            pos = conformer.GetAtomPosition(i)
            coords.append({
                "x": pos.x,
                "y": pos.y,
                "z": pos.z
            })
        
        conformers.append({
            "id": int(conf_id),
            "energy": energy,
            "coordinates": coords
        })
        
        energies.append(energy)
    
    # Find lowest energy
    lowest_energy = min(energies)
    
    # Calculate Boltzmann weights
    boltzmann_weights = []
    if boltzmann_weighting:
        # Convert kcal/mol to J/mol
        energies_J = [e * 4184 for e in energies]
        E_min = min(energies_J)
        
        # Calculate relative energies
        relative_energies = [E - E_min for E in energies_J]
        
        # Calculate Boltzmann factors
        boltzmann_factors = [
            math.exp(-deltaE / (R * temperature))
            for deltaE in relative_energies
        ]
        
        # Normalize
        partition = sum(boltzmann_factors)
        boltzmann_weights = [f / partition for f in boltzmann_factors]
    else:
        # Equal weights
        boltzmann_weights = [1.0 / len(conformers)] * len(conformers)
    
    # Add weights to conformers
    for i, conf in enumerate(conformers):
        conf["boltzmann_weight"] = boltzmann_weights[i]
    
    return {
        "conformers": conformers,
        "lowest_energy": lowest_energy,
        "boltzmann_weights": boltzmann_weights
    }

def calculate_boltzmann_weighted_shift(
    conformer_shifts: List[float],
    boltzmann_weights: List[float]
) -> float:
    """
    Calculate Boltzmann-weighted average chemical shift
    """
    if len(conformer_shifts) != len(boltzmann_weights):
        raise ValueError("Shifts and weights must have same length")
    
    weighted_sum = sum(shift * weight for shift, weight in zip(conformer_shifts, boltzmann_weights))
    return weighted_sum

