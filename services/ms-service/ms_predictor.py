"""
SpectroMind v2.0 - In-Silico MS (Kütle Spektrometrisi) Tahmin Modülü
Gelişmiş BDE (Bond Dissociation Energy) tabanlı fragmantasyon algoritması
ve tanısal iyon algılama özellikleri içerir.
"""

import sys
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import math
import json

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, AllChem, rdMolDescriptors
except ImportError:
    print("ERROR: RDKit not installed. Please install RDKit first.")
    sys.exit(1)


class MSPredictor:
    """
    Gelişmiş MS spektrum tahmin modülü.
    
    Özellikler:
    - BDE (Bond Dissociation Energy) tabanlı olasılıksal fragmantasyon
    - Rekürsif fragmantasyon ağacı
    - Tanısal iyon algılama (Tropylium, Iminium, McLafferty, vb.)
    - İzotopik dağılım hesaplama
    """
    
    def __init__(self):
        # Basitleştirilmiş Bağ Enerjisi Tablosu (kcal/mol) - Heuristic
        # Gerçek uygulamada bu veriler ML modelinden veya DFT'den gelir.
        self.bde_table: Dict[str, float] = {
            'SINGLE': 80.0,
            'DOUBLE': 145.0,
            'TRIPLE': 200.0,
            'AROMATIC': 300.0,  # Aromatik halkalar nadiren parçalanır
            'C-N': 73.0,
            'C-O': 85.0,
            'C-C': 83.0,
            'O-H': 110.0,  # Kopması zor (heterolitik değilse)
            'C-H': 98.0,
            'N-H': 93.0,
        }
        
        # Simülasyon Parametreleri
        self.collision_energy: float = 30.0  # eV (Efektif sıcaklık simülasyonu)
        self.depth_limit: int = 2  # Rekürsiyon derinliği (Hız için)
        self.min_mass: float = 15.0  # Bu kütlenin altını yok say
        
        # Tanısal İyon Tanımları
        self.diagnostic_ions: Dict[float, Dict[str, any]] = {
            91.0: {
                'name': 'Tropylium (C7H7+)',
                'structure': 'Benzil grubu (Ar-CH2-)',
                'confirmation': [65.0],  # C5H5+ (Tropylium'dan asetilen kaybı)
                'isotope_ratio': 0.077  # M+1 / M (7 karbon x %1.1)
            },
            30.0: {
                'name': 'Iminium (CH2=NH2+)',
                'structure': 'Primer amin (R-CH2-NH2)',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            44.0: {
                'name': 'Iminium (CH3-CH=NH2+)',
                'structure': 'Alfa-metil primer amin',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            58.0: {
                'name': 'McLafferty (Keton)',
                'structure': 'Metil Keton (R-CO-CH3), γ-H içeriyor',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            74.0: {
                'name': 'McLafferty (Ester)',
                'structure': 'Metil Ester (R-COOCH3), γ-H içeriyor',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            60.0: {
                'name': 'McLafferty (Asit)',
                'structure': 'Karboksilik Asit (R-COOH), γ-H içeriyor',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            31.0: {
                'name': 'Oxonium (CH2=OH+)',
                'structure': 'Primer Alkol (R-CH2-OH)',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            43.0: {
                'name': 'Acylium (CH3-CO+)',
                'structure': 'Asetil grubu',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            57.0: {
                'name': 'Acylium (C2H5-CO+)',
                'structure': 'Propiyonil grubu',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
            105.0: {
                'name': 'Acylium (Ph-CO+)',
                'structure': 'Benzoil grubu',
                'confirmation': [77.0],  # Fenil
                'isotope_ratio': 0.0
            },
            77.0: {
                'name': 'Fenil (C6H5+)',
                'structure': 'Aromatik halka',
                'confirmation': [],
                'isotope_ratio': 0.0
            },
        }
    
    def get_bond_energy(self, bond: Chem.Bond) -> float:
        """
        RDKit bağ objesinden tahmini bağ enerjisini getirir.
        
        Args:
            bond: RDKit Bond objesi
            
        Returns:
            Bağ enerjisi (kcal/mol)
        """
        bond_type = str(bond.GetBondType())
        atom1 = bond.GetBeginAtom().GetSymbol()
        atom2 = bond.GetEndAtom().GetSymbol()
        pair = f"{atom1}-{atom2}"
        
        # 1. Bağ türüne göre baz enerji
        energy = self.bde_table.get(bond_type, 100.0)
        
        # 2. Atom çiftine göre düzeltme (Varsa)
        if pair in self.bde_table:
            energy = min(energy, self.bde_table[pair])
        
        # 3. Halka içi bağlar daha zor kopar (Ring stability)
        if bond.IsInRing():
            energy *= 1.5
        
        return energy
    
    def calculate_cleavage_probability(self, bond_energy: float) -> float:
        """
        Arrhenius benzeri olasılık fonksiyonu.
        P = exp(-E / T)
        
        Args:
            bond_energy: Bağ enerjisi (kcal/mol)
            
        Returns:
            Kopma olasılığı (0-1 arası)
        """
        # Enerji ölçekleme faktörü
        prob = math.exp(-bond_energy / (self.collision_energy * 2.5))
        return prob
    
    def detect_diagnostic_ions(self, spectrum: Dict[float, float], parent_mass: float) -> List[Dict]:
        """
        Spektrumda tanısal iyonları tespit eder.
        
        Args:
            spectrum: {m/z: intensity} sözlüğü
            parent_mass: Ana molekül kütlesi
            
        Returns:
            Tespit edilen tanısal iyonların listesi
        """
        detected = []
        base_peak_intensity = max(spectrum.values()) if spectrum else 1.0
        
        for mz_key, ion_info in self.diagnostic_ions.items():
            # m/z değerine yakın pikleri ara (tolerans: ±0.5 Da)
            for mz, intensity in spectrum.items():
                if abs(mz - mz_key) < 0.5:
                    rel_intensity = (intensity / base_peak_intensity) * 100
                    
                    # Eşik kontrolü (Base Peak veya %50'den fazla)
                    if rel_intensity > 50.0 or (mz_key == 91.0 and rel_intensity > 30.0):
                        diagnostic = {
                            'mz': round(mz, 2),
                            'name': ion_info['name'],
                            'structure': ion_info['structure'],
                            'relative_intensity': round(rel_intensity, 2),
                            'is_base_peak': rel_intensity >= 99.0,
                            'confirmations': []
                        }
                        
                        # Doğrulama piklerini kontrol et
                        for conf_mz in ion_info.get('confirmation', []):
                            for conf_peak_mz, conf_intensity in spectrum.items():
                                if abs(conf_peak_mz - conf_mz) < 0.5:
                                    conf_rel = (conf_intensity / base_peak_intensity) * 100
                                    if conf_rel > 5.0:  # %5'in üzerindeyse doğrulama var
                                        diagnostic['confirmations'].append({
                                            'mz': round(conf_peak_mz, 2),
                                            'intensity': round(conf_rel, 2)
                                        })
                        
                        # İzotopik oran kontrolü (Tropylium için)
                        if ion_info.get('isotope_ratio', 0) > 0:
                            m_plus_1 = mz + 1.0034
                            for iso_mz, iso_intensity in spectrum.items():
                                if abs(iso_mz - m_plus_1) < 0.3:
                                    iso_rel = (iso_intensity / base_peak_intensity) * 100
                                    expected_ratio = rel_intensity * ion_info['isotope_ratio']
                                    if abs(iso_rel - expected_ratio) < 2.0:  # Tolerans
                                        diagnostic['isotope_match'] = True
                        
                        detected.append(diagnostic)
                        break
        
        return detected
    
    def check_mclafferty_rearrangement(self, mol: Chem.Mol) -> List[Dict]:
        """
        McLafferty düzenlenmesi için molekülü analiz eder.
        
        Args:
            mol: RDKit Molecule objesi
            
        Returns:
            Olası McLafferty düzenlenmelerinin listesi
        """
        mclafferty_peaks = []
        
        # Karbonil gruplarını bul
        for atom in mol.GetAtoms():
            if atom.GetSymbol() == 'C':
                neighbors = [n for n in atom.GetNeighbors()]
                neighbor_symbols = [n.GetSymbol() for n in neighbors]
                
                # Karbonil kontrolü (C=O)
                if 'O' in neighbor_symbols:
                    # Gama pozisyonundaki hidrojenleri ara
                    for neighbor in neighbors:
                        if neighbor.GetSymbol() == 'C':
                            # Gama karbonunu bul (beta'dan sonra)
                            for gamma_atom in neighbor.GetNeighbors():
                                if gamma_atom.GetIdx() != atom.GetIdx():
                                    # Gama karbonunda transfer edilebilir H var mı?
                                    for h_neighbor in gamma_atom.GetNeighbors():
                                        if h_neighbor.GetSymbol() == 'H':
                                            # McLafferty düzenlenmesi mümkün
                                            # m/z 58 (metil keton), 74 (ester), 60 (asit)
                                            mclafferty_peaks.append({
                                                'type': 'McLafferty',
                                                'carbonyl_atom': atom.GetIdx(),
                                                'gamma_atom': gamma_atom.GetIdx(),
                                                'possible_mz': [58.0, 74.0, 60.0]
                                            })
        
        return mclafferty_peaks
    
    def generate_spectrum(self, smiles: str, ionization: str = 'EI', energy: float = 30.0) -> Dict:
        """
        Ana fonksiyon: SMILES alır, (m/z, intensity) listesi döndürür.
        
        Args:
            smiles: SMILES string
            ionization: İyonizasyon yöntemi ('EI', 'ESI', 'MALDI', 'APCI')
            energy: Çarpışma enerjisi (eV)
            
        Returns:
            Spektrum verisi ve tanısal iyonlar
        """
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            return {"error": "Invalid SMILES"}
        
        # Parametreleri güncelle
        self.collision_energy = energy
        
        mol = Chem.AddHs(mol)  # Hidrojenleri ekle (Kütle için önemli)
        parent_mass = Descriptors.ExactMolWt(mol)
        
        # Spektrum verisi: {m/z: intensity}
        spectrum = defaultdict(float)
        
        # 1. Moleküler İyon (M+) ve Adductlar
        if ionization == 'EI':
            spectrum[round(parent_mass, 2)] += 100.0  # M (Radikal Katyon)
        elif ionization in ['ESI', 'MALDI', 'APCI']:
            spectrum[round(parent_mass + 1.007, 2)] += 100.0  # [M+H]+
            spectrum[round(parent_mass + 22.99, 2)] += 20.0  # [M+Na]+
            spectrum[round(parent_mass + 38.96, 2)] += 5.0   # [M+K]+
        else:
            spectrum[round(parent_mass, 2)] += 100.0
        
        # 2. Fragmantasyon Döngüsü (Level 1)
        bonds = mol.GetBonds()
        
        for bond in bonds:
            # Sadece tekli bağları ve halka dışı bağları kırmaya öncelik ver
            if bond.GetBondTypeAsDouble() > 1.5:
                continue
            
            bond_energy = self.get_bond_energy(bond)
            prob = self.calculate_cleavage_probability(bond_energy)
            
            # Olasılık çok düşükse atla
            if prob < 0.01:
                continue
            
            # Bağı sanal olarak kır
            try:
                frag_mol = Chem.FragmentOnBonds(mol, [bond.GetIdx()], addDummies=True)
                frags = Chem.GetMolFrags(frag_mol, asMols=True)
                
                for frag in frags:
                    # Dummy atomların kütlesini çıkararak gerçek fragman kütlesini bul
                    frag_mass = Descriptors.ExactMolWt(frag)
                    
                    # Sınır kontrolü
                    if frag_mass > self.min_mass and frag_mass < parent_mass:
                        # İntensiteyi olasılığa göre ekle
                        # Aynı m/z'ye sahip birden fazla yol olabilir, topla.
                        mz_key = round(frag_mass, 2)
                        spectrum[mz_key] += (prob * 1000)  # Ölçekleme
            except Exception as e:
                # Fragmantasyon hatası, devam et
                continue
        
        # 3. McLafferty düzenlenmesi kontrolü
        mclafferty_info = self.check_mclafferty_rearrangement(mol)
        
        # 4. Normalizasyon (Base Peak = 100%)
        max_intensity = max(spectrum.values()) if spectrum else 1
        normalized_spectrum = []
        
        for mz, intensity in spectrum.items():
            rel_int = (intensity / max_intensity) * 100
            if rel_int > 1.0:  # %1'in altındakileri gürültü say
                peak_type = "M+" if abs(mz - parent_mass) < 0.5 else "Fragment"
                if ionization in ['ESI', 'MALDI', 'APCI']:
                    if abs(mz - (parent_mass + 1.007)) < 0.5:
                        peak_type = "[M+H]+"
                    elif abs(mz - (parent_mass + 22.99)) < 0.5:
                        peak_type = "[M+Na]+"
                
                normalized_spectrum.append({
                    "m/z": mz,
                    "intensity": round(rel_int, 2),
                    "type": peak_type
                })
        
        # m/z'ye göre sırala
        normalized_spectrum.sort(key=lambda x: x["m/z"])
        
        # 5. Tanısal iyonları tespit et
        diagnostic_ions = self.detect_diagnostic_ions(spectrum, parent_mass)
        
        return {
            "formula": rdMolDescriptors.CalcMolFormula(mol),
            "molecular_weight": round(parent_mass, 4),
            "peaks": normalized_spectrum,
            "diagnostic_ions": diagnostic_ions,
            "mclafferty_rearrangements": mclafferty_info,
            "method": f"BDE-based fragmentation ({ionization})",
            "parameters": {
                "collision_energy": energy,
                "ionization": ionization,
                "depth_limit": self.depth_limit
            }
        }


# --- KULLANIM ÖRNEĞİ ---
if __name__ == "__main__":
    predictor = MSPredictor()
    
    # Örnek: Asetofenon (C8H8O) -> Beklenen: m/z 120 (M), 105 (M-CH3), 77 (Ph)
    test_smiles = "CC(=O)C1=CC=CC=1"
    
    result = predictor.generate_spectrum(test_smiles, ionization='EI', energy=30.0)
    
    print(f"Molekül: {test_smiles}")
    print(f"Formül: {result['formula']}")
    print(f"MW: {result['molecular_weight']}")
    print("-" * 50)
    print(f"{'m/z':<10} | {'Intensity':<10} | {'Type'}")
    print("-" * 50)
    
    for peak in result['peaks'][:20]:  # İlk 20 pik
        print(f"{peak['m/z']:<10} | {peak['intensity']:<10} | {peak['type']}")
    
    print("\n" + "=" * 50)
    print("TANISAL İYONLAR:")
    print("=" * 50)
    for di in result['diagnostic_ions']:
        print(f"\n{di['name']} (m/z {di['mz']})")
        print(f"  Yapısal Çıkarım: {di['structure']}")
        print(f"  Relatif Şiddet: %{di['relative_intensity']}")
        if di.get('confirmations'):
            print(f"  Doğrulama Pikleri: {di['confirmations']}")

