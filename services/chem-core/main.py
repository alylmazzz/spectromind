"""
SpectroMind Chem Core - FastAPI
Single authority for SMILES parsing, standardization, and molecule features (RDKit).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import logging

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SpectroMind Chem Core",
    description="Single authority for molecule parsing and features (RDKit)",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request/Response models ----------
class StandardizationPolicy(BaseModel):
    kekulize: bool = True
    aromatize: bool = True
    tautomer: str = "none"
    protomer: str = "none"


class ParseRequest(BaseModel):
    smiles: str = Field(..., min_length=1)
    policy: Optional[StandardizationPolicy] = None


class AtomOut(BaseModel):
    index: int
    symbol: str
    aromatic: bool
    implicit_h: Optional[int] = None
    charge: Optional[int] = None


class BondOut(BaseModel):
    from_: int = Field(..., alias="from")
    to: int
    order: int
    aromatic: Optional[bool] = None

    class Config:
        populate_by_name = True


class MoleculeGraphOut(BaseModel):
    canonical_smiles: str
    inchi: Optional[str] = None
    inchikey: Optional[str] = None
    formula: str
    exact_mass: float
    atoms: List[AtomOut]
    bonds: List[BondOut]
    aromatic_flags: Optional[List[bool]] = None
    stereo: Optional[str] = None
    charge: Optional[int] = None


class MoleculeFeaturesOut(BaseModel):
    nC_total: int = 0
    nH_total: int = 0
    DBE: float = 0.0
    nC_aromatic: int = 0
    nH_aromatic: int = 0
    nC_carbonyl: int = 0
    nC_protonated: int = 0
    nH_exchangeable: int = 0
    symmetry_classes: int = 0


def _mol_to_graph(mol) -> Dict[str, Any]:
    """Build MoleculeGraph from RDKit Mol."""
    if mol is None:
        return None
    canonical = Chem.MolToSmiles(mol, canonical=True)
    formula = rdMolDescriptors.CalcMolFormula(mol)
    exact_mass = Descriptors.ExactMolWt(mol)
    inchi = Chem.MolToInchi(mol)
    inchikey = Chem.MolToInchiKey(mol) if inchi else None

    atoms = []
    aromatic_flags = []
    for i, a in enumerate(mol.GetAtoms()):
        atoms.append(AtomOut(
            index=a.GetIdx(),
            symbol=a.GetSymbol(),
            aromatic=a.GetIsAromatic(),
            implicit_h=a.GetTotalNumHs(),
            charge=a.GetFormalCharge()
        ))
        aromatic_flags.append(a.GetIsAromatic())

    bonds = []
    for b in mol.GetBonds():
        bonds.append(BondOut(from_=b.GetBeginAtomIdx(), to=b.GetEndAtomIdx(), order=int(b.GetBondTypeAsDouble()), aromatic=b.GetIsAromatic()))

    return MoleculeGraphOut(
        canonical_smiles=canonical,
        inchi=inchi,
        inchikey=inchikey,
        formula=formula,
        exact_mass=round(exact_mass, 6),
        atoms=atoms,
        bonds=bonds,
        aromatic_flags=aromatic_flags,
        charge=Chem.rdmolops.GetFormalCharge(mol)
    )


def _atom_counts_from_mol(mol) -> Dict[str, int]:
    """Compute atom counts from RDKit mol, including implicit H on heavy atoms.
    This mirrors the TS kernel: lib/chem/formula.ts computeAtomCountsFromRDKitAtoms."""
    counts: Dict[str, int] = {}
    for a in mol.GetAtoms():
        sym = a.GetSymbol()
        counts[sym] = counts.get(sym, 0) + 1
        implicit_h = a.GetTotalNumHs(includeNeighbors=False)
        if implicit_h > 0:
            counts["H"] = counts.get("H", 0) + implicit_h
    return counts


def _compute_dbe(atom_counts: Dict[str, int], formal_charge: int = 0) -> float:
    """DBE = C - H/2 - X/2 + (N+P)/2 + charge/2 + 1
    MUST match TS kernel: lib/chem/formula.ts computeDBEDetailed.
    Uses float division — half-integer DBE is meaningful."""
    nC = atom_counts.get("C", 0)
    nH = atom_counts.get("H", 0)
    nN = atom_counts.get("N", 0)
    nP = atom_counts.get("P", 0)
    nX = (atom_counts.get("F", 0) + atom_counts.get("Cl", 0)
          + atom_counts.get("Br", 0) + atom_counts.get("I", 0))
    return nC - nH / 2.0 - nX / 2.0 + (nN + nP) / 2.0 + formal_charge / 2.0 + 1


def _symmetry_class_count(mol) -> int:
    """Canonical symmetry classes via RDKit Morgan invariants."""
    try:
        sym_classes = Chem.CanonicalRankAtoms(mol, breakTies=False)
        return len(set(sym_classes))
    except Exception:
        return 0


def _mol_to_features(mol) -> MoleculeFeaturesOut:
    """Compute expected features for verification (graph-based, deterministic).
    All counts derived from _atom_counts_from_mol to match TS kernel."""
    if mol is None:
        return MoleculeFeaturesOut()

    atom_counts = _atom_counts_from_mol(mol)
    formal_charge = Chem.rdmolops.GetFormalCharge(mol)
    dbe = _compute_dbe(atom_counts, formal_charge)

    nC_aromatic = sum(1 for a in mol.GetAtoms() if a.GetSymbol() == "C" and a.GetIsAromatic())
    nH_aromatic = sum(
        a.GetTotalNumHs() for a in mol.GetAtoms()
        if a.GetSymbol() == "C" and a.GetIsAromatic()
    )
    carbonyl = Chem.MolFromSmarts("[#6]=[#8]")
    nC_carbonyl = len(mol.GetSubstructMatches(carbonyl)) if carbonyl else 0
    nC_protonated = sum(1 for a in mol.GetAtoms() if a.GetSymbol() == "C" and a.GetTotalNumHs() >= 1)
    nH_exchangeable = Descriptors.NumHDonors(mol)
    sym_classes = _symmetry_class_count(mol)

    return MoleculeFeaturesOut(
        nC_total=atom_counts.get("C", 0),
        nH_total=atom_counts.get("H", 0),
        DBE=round(dbe, 4),
        nC_aromatic=nC_aromatic,
        nH_aromatic=nH_aromatic,
        nC_carbonyl=nC_carbonyl,
        nC_protonated=nC_protonated,
        nH_exchangeable=nH_exchangeable,
        symmetry_classes=sym_classes,
    )


@app.post("/parse-standardize", response_model=dict)
def parse_standardize(req: ParseRequest):
    """Parse SMILES and return MoleculeGraph + MoleculeFeatures. Single authority for chemistry."""
    if not RDKIT_AVAILABLE:
        raise HTTPException(status_code=503, detail="RDKit not available")
    policy = req.policy or StandardizationPolicy()
    try:
        mol = Chem.MolFromSmiles(req.smiles.strip())
        if mol is None:
            raise HTTPException(status_code=400, detail="Invalid SMILES")
        if policy.aromatize:
            try:
                Chem.SanitizeMol(mol)
                mol = Chem.AddHs(mol)
            except Exception:
                pass
        graph = _mol_to_graph(mol)
        features = _mol_to_features(mol)
        atom_counts = _atom_counts_from_mol(mol)
        formal_charge = Chem.rdmolops.GetFormalCharge(mol)
        return {
            "graph": graph.model_dump(by_alias=True),
            "features": features.model_dump(),
            "atomCounts": atom_counts,
            "formalCharge": formal_charge,
            "dbe": features.DBE,
            "kernelVersion": "2.0.0",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("parse_standardize failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "rdkit": RDKIT_AVAILABLE}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
