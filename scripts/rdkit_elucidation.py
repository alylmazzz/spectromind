#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RDKit Structure Elucidation - De Novo Molecular Structure Determination

This module performs de novo structure elucidation from NMR spectroscopy data using
RDKit cheminformatics toolkit. It identifies molecular fragments from NMR peaks,
assembles candidate structures, and validates them against the target formula.

Architecture:
    1. FragmentDetector: Identifies chemical fragments from NMR peak patterns
    2. StructureAssembler: Generates candidate molecules from detected fragments
    3. MoleculeValidator: Validates candidates against formula and NMR data

Features:
    - 22 chemical fragment types (aldehydes, ketones, aromatics, amines, etc.)
    - 8 molecular assembly patterns
    - SMILES generation and validation
    - Formula matching
    - NMR compatibility scoring

Author: Spectromind Team
Version: 19.0 (Enhanced Edition)
Dependencies: rdkit, rdkit.Chem
Python: 3.8+

Usage:
    python3 rdkit_elucidation.py '<peaks_json>' '<formula>'

    Example:
        python3 rdkit_elucidation.py '[{"shift": 7.2, "integ": 5, "mult": "s"}]' 'C6H6'

Output:
    JSON with structure:
    {
        "success": true,
        "fragments": [...],
        "candidates": [...],
        "best": {...},
        "peak_count": int,
        "target_formula": str
    }

Exit Codes:
    0: Success
    1: RDKit not installed or execution error
"""

import sys
import json
from typing import List, Dict, Optional, Tuple

# ============================================================================
# DEPENDENCIES CHECK
# ============================================================================

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, AllChem, rdMolDescriptors
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    print(json.dumps({
        'success': False,
        'error': 'RDKit not installed. Run: pip install rdkit-pypi'
    }))
    sys.exit(1)


# ============================================================================
# FRAGMENT DETECTION
# ============================================================================

class FragmentDetector:
    """
    Fragment Detection from NMR Peaks

    Analyzes 1H NMR peak patterns to identify molecular fragments such as
    aldehydes, ketones, aromatic rings, ethers, amines, etc.

    Detection Strategy:
        - Chemical shift ranges (ppm) → Fragment type
        - Integration values → Number of protons
        - Multiplicity patterns → Connectivity information

    Supported Fragments (22 types):
        - Functional groups: COOH, CHO, C=O, C=C, C≡C
        - Aromatics: Benzene rings (mono/disubstituted)
        - Heteroatom groups: Ethers, alcohols, amines
        - Alkyl groups: CH3, CH2, CH patterns
        - Halides: C-Cl, C-Br, C-I

    Methods:
        detect_fragments: Main detection pipeline
    """

    @staticmethod
    def detect_fragments(peaks: List[Dict]) -> List[Dict]:
        """
        Detect molecular fragments from NMR peak data

        Analyzes chemical shifts, integration values, and multiplicities to
        identify likely molecular fragments present in the structure.

        Args:
            peaks: List of NMR peaks with structure:
                [
                    {
                        'shift': float,      # Chemical shift in ppm
                        'integ': int,        # Integration (number of H)
                        'mult': str,         # Multiplicity (s/d/t/q/m)
                        'coupling': float?   # J-coupling constant (Hz)
                    },
                    ...
                ]

        Returns:
            List of detected fragments sorted by priority:
                [
                    {
                        'type': str,         # Fragment name
                        'smarts': str,       # SMARTS pattern
                        'priority': int,     # Detection confidence (1-10)
                        'peak_index': int,   # Source peak index
                        'reasoning': str     # Detection explanation
                    },
                    ...
                ]

        Example:
            >>> peaks = [{'shift': 9.8, 'integ': 1, 'mult': 's'}]
            >>> fragments = FragmentDetector.detect_fragments(peaks)
            >>> fragments[0]['type']
            'Aldehyde -CHO'
        """
        fragments = []

        for idx, peak in enumerate(peaks):
            shift = peak.get('shift', 0)
            integ = peak.get('integ', 1)
            mult = peak.get('mult', 's').lower()

            # CARBOXYLIC ACID (-COOH)
            if 10.5 <= shift <= 13.0 and integ == 1:
                fragments.append({
                    'type': 'Carboxylic acid -COOH',
                    'smarts': 'C(=O)O',
                    'priority': 10,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, 1H broad → Carboxylic acid proton'
                })

            # ALDEHYDE GROUP (-CHO)
            elif 9.5 <= shift <= 10.5 and integ == 1:
                fragments.append({
                    'type': 'Aldehyde -CHO',
                    'smarts': '[CH]=O',
                    'priority': 10,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, 1H singlet → Aldehyde proton'
                })

            # ALKENE (C=C) PROTONS
            elif 4.5 <= shift <= 6.5:
                fragments.append({
                    'type': 'Alkene =CH-',
                    'smarts': 'C=C',
                    'priority': 8,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, {integ}H → Vinyl proton (C=C)'
                })

            # AROMATIC PROTONS
            elif 7.0 <= shift <= 8.5:
                if integ == 5:
                    fragments.append({
                        'type': 'Monosubstituted Benzene C6H5-',
                        'smarts': 'c1ccccc1',
                        'priority': 9,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, 5H → Monosubstituted aromatic ring'
                    })
                elif integ == 4:
                    fragments.append({
                        'type': 'Disubstituted Benzene',
                        'smarts': 'c1ccc(*)cc1',
                        'priority': 8,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, 4H → para-Disubstituted benzene'
                    })
                else:
                    fragments.append({
                        'type': 'Aromatic protons',
                        'smarts': 'c',
                        'priority': 7,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, {integ}H → Aromatic protons'
                    })

            # HALIDES (-CH2-Cl, -CH2-Br, -CH-I)
            elif 3.0 <= shift <= 4.5 and mult in ['s', 'd', 't', 'q', 'singlet', 'doublet', 'triplet', 'quartet']:
                # Check if this could be a halide (overlaps with ether range)
                # We'll add this as lower priority than ether
                fragments.append({
                    'type': 'Halide -CH-X (X=Cl/Br/I)',
                    'smarts': '[CH2][Cl,Br,I]',
                    'priority': 6,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm → Possible halogen-bound carbon'
                })

            # ETHER/ALCOHOL O-CH
            if 3.3 <= shift <= 4.2:
                if mult in ['q', 'quartet']:
                    fragments.append({
                        'type': 'Ether -O-CH2- (quartet)',
                        'smarts': '[O][CH2]',
                        'priority': 8,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, {integ}H quartet → -O-CH2-CH3'
                    })
                elif mult in ['t', 'triplet']:
                    fragments.append({
                        'type': 'Ether -O-CH2- (triplet)',
                        'smarts': '[O][CH2]',
                        'priority': 8,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, {integ}H triplet → -O-CH2-CH2-'
                    })
                elif mult in ['s', 'singlet'] and integ == 3:
                    fragments.append({
                        'type': 'Methoxy -O-CH3',
                        'smarts': '[O][CH3]',
                        'priority': 7,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, 3H singlet → -O-CH3'
                    })
                else:
                    fragments.append({
                        'type': 'Oxygen-bound CH',
                        'smarts': '[O][CH]',
                        'priority': 6,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm → O-CH group'
                    })

            # KETONE METHYL (CH3-C=O)
            elif 2.0 <= shift <= 2.5 and mult in ['s', 'singlet'] and integ >= 3:
                fragments.append({
                    'type': 'Ketone methyl CH3-C=O',
                    'smarts': '[CH3]C=O',
                    'priority': 9,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, {integ}H singlet → Methyl ketone (possibly acetone if 6H)'
                })

            # ESTER ALPHA-H (CH3-COO- or CH2-COO-)
            elif 2.0 <= shift <= 2.5 and mult in ['q', 't', 'quartet', 'triplet']:
                fragments.append({
                    'type': 'Ester alpha-H -CH2-COO-',
                    'smarts': '[CH2]C(=O)O',
                    'priority': 8,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, {mult} → CH next to ester carbonyl'
                })

            # ALPHA CARBONYL (CH2 next to C=O) - Generic
            elif 2.0 <= shift <= 2.8:
                fragments.append({
                    'type': 'Alpha-carbonyl CH2',
                    'smarts': '[CH2][C]=O',
                    'priority': 7,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm → CH2 next to carbonyl'
                })

            # ALIPHATIC METHYLENE (-CH2-)
            elif 1.2 <= shift <= 1.8:
                if mult in ['q', 'quartet'] or mult in ['p', 'pentet', 'm', 'multiplet']:
                    fragments.append({
                        'type': 'Methylene -CH2-',
                        'smarts': '[CH2]',
                        'priority': 5,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, {integ}H {mult} → Aliphatic -CH2-'
                    })

            # TERMINAL METHYL (-CH3)
            elif 0.7 <= shift <= 1.5:
                if mult in ['t', 'triplet'] and integ == 3:
                    fragments.append({
                        'type': 'Terminal methyl -CH2-CH3',
                        'smarts': '[CH2][CH3]',
                        'priority': 8,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, 3H triplet → -CH2-CH3 (ethyl end)'
                    })
                elif mult in ['d', 'doublet'] and integ == 3:
                    fragments.append({
                        'type': 'Methyl doublet -CH(CH3)',
                        'smarts': '[CH]([CH3])',
                        'priority': 7,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, 3H doublet → -CH(CH3)-'
                    })
                elif mult in ['s', 'singlet'] and integ == 3:
                    fragments.append({
                        'type': 'Isolated methyl -CH3',
                        'smarts': '[CH3]',
                        'priority': 6,
                        'peak_index': idx,
                        'reasoning': f'{shift} ppm, 3H singlet → Isolated -CH3'
                    })

            # AMINE (-NH2, -NH-)
            elif 0.5 <= shift <= 5.0 and peak.get('isBroad', False):
                # Amine protons are typically broad
                fragments.append({
                    'type': 'Amine -NH2/-NH-',
                    'smarts': '[NH2]',
                    'priority': 7,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, broad peak → Amine proton'
                })

            # ALKYNE (Terminal ≡C-H)
            elif 2.0 <= shift <= 3.0 and mult in ['s', 'singlet'] and integ == 1:
                fragments.append({
                    'type': 'Alkyne terminal ≡C-H',
                    'smarts': 'C#C',
                    'priority': 8,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, 1H singlet → Terminal alkyne'
                })

            # PHENOLIC/ALCOHOLIC -OH (broad, exchangeable)
            elif 4.0 <= shift <= 10.0 and peak.get('isBroad', False):
                fragments.append({
                    'type': 'Hydroxyl -OH',
                    'smarts': '[OH]',
                    'priority': 6,
                    'peak_index': idx,
                    'reasoning': f'{shift} ppm, broad → Hydroxyl proton (alcohol/phenol)'
                })

        # Priority sırasına göre sırala
        fragments.sort(key=lambda x: x['priority'], reverse=True)

        return fragments


# ============================================================================
# STRUCTURE ASSEMBLY
# ============================================================================

class StructureAssembler:
    """
    Structure Assembly from Detected Fragments

    Generates candidate molecular structures by combining detected fragments
    according to predefined chemical assembly patterns.

    Assembly Patterns (8 types):
        0. Pure Benzene (C6H6)
        1. Benzene + Ether/Alkyl substituents
        2. Aldehydes with alkyl chains
        3. Simple alcohols and ethers
        4. Ketones (methyl ketones, etc.)
        5. Carboxylic acids
        6. Esters
        7. Alkenes
        8. Amines

    Strategy:
        1. Identify fragment combination patterns
        2. Generate SMILES strings for candidates
        3. Assign initial confidence scores
        4. Return ranked candidate list

    Methods:
        generate_candidates: Main assembly pipeline
    """

    @staticmethod
    def generate_candidates(fragments: List[Dict], formula: Optional[str] = None) -> List[Dict]:
        """
        Generate candidate molecules from detected fragments

        Combines fragments according to chemical assembly rules to produce
        a list of candidate structures with SMILES representations.

        Args:
            fragments: List of detected fragments from FragmentDetector
            formula: Optional target molecular formula (e.g., "C8H10O")
                    If provided, only candidates matching this formula
                    will be validated later.

        Returns:
            List of candidate molecules:
                [
                    {
                        'smiles': str,       # SMILES notation
                        'name': str,         # Common/IUPAC name
                        'score': float,      # Initial confidence (0-100)
                        'reasoning': str     # Assembly explanation
                    },
                    ...
                ]

        Example:
            >>> fragments = [
            ...     {'type': 'Aldehyde -CHO', 'priority': 10},
            ...     {'type': 'Terminal methyl -CH2-CH3', 'priority': 8}
            ... ]
            >>> candidates = StructureAssembler.generate_candidates(fragments)
            >>> candidates[0]['name']
            'Butanal'
        """
        candidates = []

        # Fragment türlerini topla
        fragment_types = [f['type'] for f in fragments]

        # PATTERN 0: Pure Benzene (C6H6)
        if any('Benzene' in t for t in fragment_types):
            has_ether = any('Ether' in t or 'Methoxy' in t for t in fragment_types)
            has_ethyl = any('CH2-CH3' in t for t in fragment_types)

            # Sadece benzene var, başka grup yok
            if not has_ether and not has_ethyl and formula == 'C6H6':
                candidates.append({
                    'smiles': 'c1ccccc1',
                    'name': 'Benzene',
                    'score': 95,
                    'reasoning': 'Pure aromatic benzene ring detected'
                })
                return candidates  # Benzene bulundu, başka aday aramaya gerek yok

        # PATTERN 1: Benzene + Ether + Ethyl
        if any('Benzene' in t for t in fragment_types):
            has_ether = any('Ether' in t or 'Methoxy' in t for t in fragment_types)
            has_ethyl = any('CH2-CH3' in t for t in fragment_types)

            if has_ether and has_ethyl:
                candidates.extend([
                    {
                        'smiles': 'CCOc1ccccc1',
                        'name': 'Ethoxybenzene (Ethyl phenyl ether)',
                        'score': 90,
                        'reasoning': 'Benzene + Ethoxy group detected'
                    },
                    {
                        'smiles': 'COCc1ccccc1',
                        'name': 'Benzyl methyl ether',
                        'score': 75,
                        'reasoning': 'Benzene + Methoxy detected (alternative)'
                    }
                ])
            elif has_ether:
                candidates.append({
                    'smiles': 'COc1ccccc1',
                    'name': 'Anisole (Methoxybenzene)',
                    'score': 85,
                    'reasoning': 'Benzene + Methoxy group detected'
                })

        # PATTERN 2: Aldehyde + Alkyl chain
        if any('Aldehyde' in t for t in fragment_types):
            has_ch2ch3 = any('CH2-CH3' in t for t in fragment_types)

            if has_ch2ch3:
                candidates.extend([
                    {
                        'smiles': 'CCCC=O',
                        'name': 'Butanal',
                        'score': 85,
                        'reasoning': 'Aldehyde + ethyl chain'
                    },
                    {
                        'smiles': 'CC(C)C=O',
                        'name': 'Isobutanal',
                        'score': 75,
                        'reasoning': 'Aldehyde + branched chain (alternative)'
                    }
                ])

        # PATTERN 3: Simple alcohols/ethers
        has_och2 = any('O-CH2' in t for t in fragment_types)
        has_terminal_ch3 = any('Terminal' in t or 'CH2-CH3' in t for t in fragment_types)

        if has_och2 and has_terminal_ch3 and not any('Benzene' in t for t in fragment_types):
            candidates.extend([
                {
                    'smiles': 'CCOCC',
                    'name': 'Diethyl ether',
                    'score': 80,
                    'reasoning': 'Symmetric ether structure'
                },
                {
                    'smiles': 'CCO',
                    'name': 'Ethanol',
                    'score': 70,
                    'reasoning': 'Simple alcohol'
                }
            ])

        # PATTERN 4: Ketones (Ketone methyl detected)
        if any('Ketone methyl' in t for t in fragment_types):
            candidates.extend([
                {
                    'smiles': 'CC(=O)C',
                    'name': 'Acetone',
                    'score': 90,
                    'reasoning': 'Ketone methyl group detected'
                },
                {
                    'smiles': 'CC(=O)CC',
                    'name': 'Butanone (MEK)',
                    'score': 85,
                    'reasoning': 'Methyl ethyl ketone pattern'
                }
            ])

        # PATTERN 5: Carboxylic acids
        if any('Carboxylic acid' in t for t in fragment_types):
            has_ch3 = any('methyl' in t.lower() for t in fragment_types)

            if has_ch3:
                candidates.extend([
                    {
                        'smiles': 'CC(=O)O',
                        'name': 'Acetic acid',
                        'score': 90,
                        'reasoning': 'Carboxylic acid + methyl detected'
                    },
                    {
                        'smiles': 'CCC(=O)O',
                        'name': 'Propanoic acid',
                        'score': 80,
                        'reasoning': 'Carboxylic acid + alkyl chain'
                    }
                ])
            else:
                candidates.append({
                    'smiles': 'C(=O)O',
                    'name': 'Formic acid',
                    'score': 75,
                    'reasoning': 'Simple carboxylic acid'
                })

        # PATTERN 6: Esters (Ketone methyl + Ether suggests ester)
        has_ketone_methyl = any('Ketone methyl' in t for t in fragment_types)
        has_ether_och2 = any('Ether -O-CH2' in t for t in fragment_types)

        if (any('Ester' in t for t in fragment_types) or
            (has_ketone_methyl and has_ether_och2)):
            # Ketone methyl + Ether quartet = likely ester
            if has_ether_och2:
                candidates.extend([
                    {
                        'smiles': 'CC(=O)OCC',
                        'name': 'Ethyl acetate',
                        'score': 88,
                        'reasoning': 'Ester pattern: acetyl + ethoxy group'
                    },
                    {
                        'smiles': 'CCOC(=O)C',
                        'name': 'Methyl propanoate',
                        'score': 75,
                        'reasoning': 'Alternative ester structure'
                    }
                ])

        # PATTERN 7: Alkenes
        if any('Alkene' in t for t in fragment_types):
            candidates.extend([
                {
                    'smiles': 'C=C',
                    'name': 'Ethylene',
                    'score': 70,
                    'reasoning': 'Simple alkene detected'
                },
                {
                    'smiles': 'CC=C',
                    'name': 'Propene',
                    'score': 75,
                    'reasoning': 'Alkene with methyl group'
                }
            ])

        # PATTERN 8: Amines (if detected)
        if any('Amine' in t for t in fragment_types):
            candidates.extend([
                {
                    'smiles': 'CCN',
                    'name': 'Ethylamine',
                    'score': 75,
                    'reasoning': 'Primary amine detected'
                },
                {
                    'smiles': 'Nc1ccccc1',
                    'name': 'Aniline',
                    'score': 80,
                    'reasoning': 'Aromatic amine'
                }
            ])

        return candidates


# ============================================================================
# MOLECULE VALIDATION
# ============================================================================

class MoleculeValidator:
    """
    Molecule Validation and Scoring

    Validates candidate molecules against the target formula and NMR data,
    computing compatibility scores based on structural features.

    Validation Steps:
        1. Formula matching: SMILES → RDKit → Molecular formula
        2. NMR feature scoring: Aromatic rings, functional groups, etc.
        3. Combined scoring: Pattern match + NMR compatibility

    Scoring Factors:
        - Aromatic atoms vs aromatic peaks
        - Oxygen atoms vs ether/alcohol peaks
        - Aldehyde groups vs aldehyde peaks
        - Base score: 50/100

    Methods:
        validate_formula: Check if SMILES matches target formula
        calculate_nmr_score: Compute NMR compatibility score
    """

    @staticmethod
    def validate_formula(smiles: str, target_formula: Optional[str]) -> Tuple[bool, str]:
        """
        SMILES kodunun formülünü kontrol eder

        Returns:
            (is_valid, actual_formula)
        """
        try:
            mol = Chem.MolFromSmiles(smiles)
            if not mol:
                return False, "Invalid SMILES"

            actual_formula = rdMolDescriptors.CalcMolFormula(mol)

            if target_formula:
                # Formül stringlerini normalize et
                is_valid = actual_formula == target_formula
                return is_valid, actual_formula
            else:
                return True, actual_formula

        except Exception as e:
            return False, f"Error: {str(e)}"

    @staticmethod
    def calculate_nmr_score(smiles: str, user_peaks: List[Dict]) -> float:
        """
        Basit NMR uyum skoru hesaplar (geliştirilmeli)
        Gerçekte teorik NMR prediction yapılmalı
        """
        try:
            mol = Chem.MolFromSmiles(smiles)
            if not mol:
                return 0.0

            score = 50.0  # Base score

            # Aromatic atom kontrolü
            aromatic_atoms = [a for a in mol.GetAromaticAtoms()]
            has_aromatic_peak = any(7.0 <= p.get('shift', 0) <= 8.5 for p in user_peaks)

            if len(aromatic_atoms) > 0 and has_aromatic_peak:
                score += 25
            elif len(aromatic_atoms) == 0 and not has_aromatic_peak:
                score += 15

            # Ether/Alcohol kontrolü
            num_oxygens = sum(1 for a in mol.GetAtoms() if a.GetSymbol() == 'O')
            has_ether_peak = any(3.3 <= p.get('shift', 0) <= 4.2 for p in user_peaks)

            if num_oxygens > 0 and has_ether_peak:
                score += 20

            # Aldehyde kontrolü
            has_aldehyde = 'C=O' in smiles and 'CC=O' in smiles
            has_aldehyde_peak = any(9.5 <= p.get('shift', 0) <= 10.5 for p in user_peaks)

            if has_aldehyde and has_aldehyde_peak:
                score += 25

            return min(score, 100.0)

        except Exception:
            return 0.0


def main(peaks_json: str, formula: Optional[str] = None) -> Dict:
    """
    Ana pipeline: Peaks → Fragments → Candidates → Validation → Best Match
    """
    try:
        # Parse peaks
        peaks = json.loads(peaks_json)

        # ADIM 1: Fragment Detection
        detector = FragmentDetector()
        fragments = detector.detect_fragments(peaks)

        # ADIM 2: Structure Assembly
        assembler = StructureAssembler()
        candidates = assembler.generate_candidates(fragments, formula)

        # ADIM 3: Validation
        validator = MoleculeValidator()
        validated_candidates = []

        for candidate in candidates:
            smiles = candidate['smiles']

            # Formül kontrolü
            is_valid, actual_formula = validator.validate_formula(smiles, formula)

            if formula and not is_valid:
                continue  # Formül uyuşmazsa atla

            # NMR skor hesapla
            nmr_score = validator.calculate_nmr_score(smiles, peaks)

            # IUPAC isim al
            try:
                mol = Chem.MolFromSmiles(smiles)
                # RDKit'te MolToIUPACName bazen yoktur, o yüzden fallback
                try:
                    iupac_name = Chem.MolToIUPACName(mol)
                except AttributeError:
                    iupac_name = candidate['name']  # Fallback
            except:
                iupac_name = candidate['name']

            validated_candidates.append({
                'smiles': smiles,
                'name': candidate['name'],
                'iupac': iupac_name,
                'formula': actual_formula,
                'score': (candidate['score'] * 0.6 + nmr_score * 0.4),  # Weighted score
                'reasoning': candidate['reasoning']
            })

        # Skora göre sırala
        validated_candidates.sort(key=lambda x: x['score'], reverse=True)

        # ADIM 4: Sonuç
        return {
            'success': True,
            'fragments': [
                {
                    'type': f['type'],
                    'reasoning': f['reasoning'],
                    'priority': f['priority']
                }
                for f in fragments[:5]  # İlk 5 fragment
            ],
            'candidates': validated_candidates[:5],  # İlk 5 aday
            'best': validated_candidates[0] if validated_candidates else None,
            'peak_count': len(peaks),
            'target_formula': formula
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'traceback': str(e.__class__.__name__)
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python rdkit_elucidation.py <peaks_json> [formula]'
        }))
        sys.exit(1)

    peaks_json = sys.argv[1]
    formula = sys.argv[2] if len(sys.argv) > 2 else None

    result = main(peaks_json, formula)
    print(json.dumps(result, indent=2, ensure_ascii=False))
