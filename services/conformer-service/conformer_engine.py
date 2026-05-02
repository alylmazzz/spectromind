"""
SpectroMind v2.0 - 3D Konformer Üretimi ve Boltzmann Ağırlıklandırma Modülü
Gelişmiş ETKDGv3 algoritması, MMFF94 optimizasyonu ve vicinal proton analizi içerir.
"""

import sys
import math
import json
from typing import Dict, List, Optional, Tuple

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, rdMolDescriptors
    from rdkit.Chem import rdMolTransforms
except ImportError:
    print("ERROR: RDKit not installed. Please install RDKit first.")
    sys.exit(1)


class ConformerEngine:
    """
    Gelişmiş 3D konformer üretimi ve analiz modülü.
    
    Özellikler:
    - ETKDGv3 ile konformer üretimi
    - MMFF94/UFF enerji minimizasyonu
    - Boltzmann ağırlıklandırma
    - Vicinal proton analizi (H-C-C-H)
    - Karplus eşitliği ile J-coupling tahmini
    """
    
    def __init__(self, n_confs: int = 50, rmsd_threshold: float = 0.5):
        """
        Args:
            n_confs: Üretilecek konformer sayısı
            rmsd_threshold: Benzerlik eşiği (Å)
        """
        self.n_confs = n_confs
        self.rmsd_threshold = rmsd_threshold
        self.temperature = 298.15  # Kelvin (25°C)
        self.gas_constant = 0.001987  # kcal/(mol·K)
    
    def generate_ensemble(self, smiles: str) -> Dict:
        """
        SMILES'tan 3D konformer topluluğu (ensemble) üretir ve analiz eder.
        
        Args:
            smiles: SMILES string
            
        Returns:
            Konformer analiz sonuçları
        """
        # 1. Molekülü Hazırla
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            return {"error": "Invalid SMILES"}
        
        # Hidrojenler 3D yapı ve NMR için ZORUNLUDUR
        mol = Chem.AddHs(mol)
        
        # 2. Konformer Üretimi (ETKDGv3)
        params = AllChem.ETKDGv3()
        params.useSmallRingTorsions = True  # Küçük halkalar için iyileştirme
        params.pruneRmsThresh = self.rmsd_threshold  # Benzerleri baştan ele
        params.randomSeed = 42  # Tekrarlanabilirlik için
        
        cids = AllChem.EmbedMultipleConfs(mol, numConfs=self.n_confs, params=params)
        
        if not cids:
            return {"error": "Conformer generation failed"}
        
        # 3. Enerji Minimizasyonu ve Hesaplama (MMFF94)
        ensemble_data = []
        
        # MMFF özelliklerini yükle
        props = AllChem.MMFFGetMoleculeProperties(mol, mmffVariant='MMFF94')
        if not props:
            # Fallback: UFF (Universal Force Field) eğer MMFF başarısız olursa
            print("Warning: MMFF failed, falling back to UFF")
            return self._fallback_uff(mol, cids)
        
        for cid in cids:
            try:
                ff = AllChem.MMFFGetMoleculeForceField(mol, props, confId=cid)
                ff.Minimize()  # Geometriyi optimize et
                energy = ff.CalcEnergy()
                
                # Konformer koordinatlarını al
                conf = mol.GetConformer(cid)
                coordinates = []
                for i in range(mol.GetNumAtoms()):
                    pos = conf.GetAtomPosition(i)
                    atom = mol.GetAtomWithIdx(i)
                    coordinates.append({
                        "atomIndex": i,
                        "element": atom.GetSymbol(),
                        "x": round(pos.x, 4),
                        "y": round(pos.y, 4),
                        "z": round(pos.z, 4)
                    })
                
                ensemble_data.append({
                    "id": int(cid),
                    "energy": round(energy, 4),
                    "coordinates": coordinates
                })
            except Exception as e:
                print(f"Warning: Failed to optimize conformer {cid}: {e}")
                continue
        
        if not ensemble_data:
            return {"error": "No conformers could be optimized"}
        
        # 4. Boltzmann Ağırlıklandırma
        # En düşük enerjiyi bul (Referans noktası)
        min_energy = min(d["energy"] for d in ensemble_data)
        
        total_partition_function = 0.0
        
        for conf in ensemble_data:
            delta_E = conf["energy"] - min_energy
            # Boltzmann Faktörü: exp(-ΔE / RT)
            prob_factor = math.exp(-delta_E / (self.gas_constant * self.temperature))
            conf["boltzmann_factor"] = prob_factor
            total_partition_function += prob_factor
        
        # Olasılıkları (Yüzdeleri) Ata
        for conf in ensemble_data:
            conf["probability"] = (conf["boltzmann_factor"] / total_partition_function) * 100
            conf["weight"] = conf["boltzmann_factor"] / total_partition_function
        
        # Düşük olasılıklı (<%1) konformerleri filtrele (Gürültü temizliği)
        significant_confs = [c for c in ensemble_data if c["probability"] > 1.0]
        # Olasılığa göre sırala (En kararlı en üstte)
        significant_confs.sort(key=lambda x: x["probability"], reverse=True)
        
        # 5. Dihedral Açı Analizi (Karplus Hazırlığı)
        # Vicinal protonları (H-C-C-H) bul ve açılarını ölç
        vicinal_couplings = self._analyze_vicinal_protons(mol, significant_confs)
        
        # 6. Top konformerin MolBlock formatını al
        top_conformer_molblock = ""
        if significant_confs:
            try:
                top_conformer_molblock = Chem.MolToMolBlock(mol, confId=significant_confs[0]["id"])
            except:
                pass
        
        return {
            "smiles": smiles,
            "total_confs_generated": len(cids),
            "significant_confs": len(significant_confs),
            "global_min_energy": round(min_energy, 2),
            "vicinal_couplings": vicinal_couplings,
            "top_conformer_molblock": top_conformer_molblock,
            "ensemble_summary": [
                {
                    "id": c["id"],
                    "energy": round(c["energy"], 2),
                    "probability": round(c["probability"], 1),
                    "weight": round(c["weight"], 4)
                }
                for c in significant_confs
            ],
            "conformers": [
                {
                    "id": c["id"],
                    "energy": c["energy"],
                    "weight": c["weight"],
                    "coordinates": c["coordinates"]
                }
                for c in significant_confs
            ]
        }
    
    def _analyze_vicinal_protons(self, mol: Chem.Mol, conformers: List[Dict]) -> List[Dict]:
        """
        Moleküldeki tüm H-C-C-H sistemlerini bulur ve
        her konformer için dihedral açıyı hesaplayıp ağırlıklı ortalamayı alır.
        
        Args:
            mol: RDKit Molecule objesi
            conformers: Konformer verileri listesi
            
        Returns:
            Vicinal coupling analiz sonuçları
        """
        results = []
        
        # H-C bağlarını bul
        h_c_bonds = []
        for bond in mol.GetBonds():
            a1 = bond.GetBeginAtom()
            a2 = bond.GetEndAtom()
            if a1.GetSymbol() == 'H' and a2.GetSymbol() == 'C':
                h_c_bonds.append((a1.GetIdx(), a2.GetIdx()))
            elif a2.GetSymbol() == 'H' and a1.GetSymbol() == 'C':
                h_c_bonds.append((a2.GetIdx(), a1.GetIdx()))
        
        # Vicinal Eşleşme (H1-C1-C2-H2)
        processed_pairs = set()
        
        for h1_idx, c1_idx in h_c_bonds:
            c1_atom = mol.GetAtomWithIdx(c1_idx)
            for neighbor in c1_atom.GetNeighbors():
                c2_idx = neighbor.GetIdx()
                if c2_idx == c1_idx:
                    continue  # Kendisi
                if neighbor.GetSymbol() != 'C':
                    continue  # Karbon değil
                
                # C2'ye bağlı H'leri bul
                for neighbor_of_c2 in neighbor.GetNeighbors():
                    if neighbor_of_c2.GetSymbol() == 'H':
                        h2_idx = neighbor_of_c2.GetIdx()
                        
                        # Çifti kaydet (Sıralı set ile dublikasyonu önle)
                        pair_key = tuple(sorted((h1_idx, h2_idx)))
                        if pair_key in processed_pairs:
                            continue
                        processed_pairs.add(pair_key)
                        
                        # Ağırlıklı Ortalama Açı Hesabı
                        weighted_angle = 0.0
                        angles_by_conformer = []
                        
                        for conf_data in conformers:
                            try:
                                conf = mol.GetConformer(conf_data["id"])
                                # GetDihedralRad: Atom indeksleri (H1, C1, C2, H2)
                                angle_rad = rdMolTransforms.GetDihedralRad(conf, h1_idx, c1_idx, c2_idx, h2_idx)
                                angle_deg = math.degrees(angle_rad)
                                
                                # Açı 0-180 aralığına normalize et (Mutlak değer)
                                # Karplus için cos(angle) önemlidir.
                                abs_angle = abs(angle_deg)
                                if abs_angle > 180:
                                    abs_angle = 360 - abs_angle
                                
                                weight = conf_data["weight"]
                                weighted_angle += abs_angle * weight
                                angles_by_conformer.append({
                                    "conformer_id": conf_data["id"],
                                    "angle": round(abs_angle, 1),
                                    "weight": weight
                                })
                            except Exception as e:
                                print(f"Warning: Failed to calculate dihedral for conformer {conf_data['id']}: {e}")
                                continue
                        
                        if not angles_by_conformer:
                            continue
                        
                        # Karplus Tahmini (Basitleştirilmiş Bothner-By denklemi)
                        # J = 7 - 1.0 cos(phi) + 5.0 cos(2phi)
                        phi_rad = math.radians(weighted_angle)
                        j_coupling = 7 - 1.0 * math.cos(phi_rad) + 5.0 * math.cos(2 * phi_rad)
                        
                        # Atom etiketlerini al
                        h1_symbol = f"H{h1_idx}"
                        h2_symbol = f"H{h2_idx}"
                        c1_symbol = f"C{c1_idx}"
                        c2_symbol = f"C{c2_idx}"
                        
                        results.append({
                            "atoms": f"{h1_symbol}-{c1_symbol}-{c2_symbol}-{h2_symbol}",
                            "atom_indices": [h1_idx, c1_idx, c2_idx, h2_idx],
                            "avg_dihedral_angle": round(weighted_angle, 1),
                            "predicted_J_Hz": round(j_coupling, 2),
                            "angles_by_conformer": angles_by_conformer[:5]  # İlk 5 konformer
                        })
        
        return results
    
    def _fallback_uff(self, mol: Chem.Mol, cids: List[int]) -> Dict:
        """
        MMFF başarısız olursa UFF kullan (Yedek Plan)
        
        Args:
            mol: RDKit Molecule objesi
            cids: Konformer ID'leri
            
        Returns:
            Konformer analiz sonuçları
        """
        ensemble_data = []
        
        for cid in cids:
            try:
                # UFF optimizasyonu
                AllChem.UFFOptimizeMolecule(mol, confId=cid)
                
                # UFF enerji hesaplama
                ff = AllChem.UFFGetMoleculeForceField(mol, confId=cid)
                energy = ff.CalcEnergy()
                
                # Konformer koordinatlarını al
                conf = mol.GetConformer(cid)
                coordinates = []
                for i in range(mol.GetNumAtoms()):
                    pos = conf.GetAtomPosition(i)
                    atom = mol.GetAtomWithIdx(i)
                    coordinates.append({
                        "atomIndex": i,
                        "element": atom.GetSymbol(),
                        "x": round(pos.x, 4),
                        "y": round(pos.y, 4),
                        "z": round(pos.z, 4)
                    })
                
                ensemble_data.append({
                    "id": int(cid),
                    "energy": round(energy, 4),
                    "coordinates": coordinates
                })
            except Exception as e:
                print(f"Warning: Failed to optimize conformer {cid} with UFF: {e}")
                continue
        
        if not ensemble_data:
            return {"error": "UFF optimization also failed"}
        
        # Boltzmann ağırlıklandırma (aynı mantık)
        min_energy = min(d["energy"] for d in ensemble_data)
        total_partition_function = 0.0
        
        for conf in ensemble_data:
            delta_E = conf["energy"] - min_energy
            prob_factor = math.exp(-delta_E / (self.gas_constant * self.temperature))
            conf["boltzmann_factor"] = prob_factor
            total_partition_function += prob_factor
        
        for conf in ensemble_data:
            conf["probability"] = (conf["boltzmann_factor"] / total_partition_function) * 100
            conf["weight"] = conf["boltzmann_factor"] / total_partition_function
        
        significant_confs = [c for c in ensemble_data if c["probability"] > 1.0]
        significant_confs.sort(key=lambda x: x["probability"], reverse=True)
        
        vicinal_couplings = self._analyze_vicinal_protons(mol, significant_confs)
        
        return {
            "smiles": Chem.MolToSmiles(mol),
            "total_confs_generated": len(cids),
            "significant_confs": len(significant_confs),
            "global_min_energy": round(min_energy, 2),
            "vicinal_couplings": vicinal_couplings,
            "top_conformer_molblock": "",
            "ensemble_summary": [
                {
                    "id": c["id"],
                    "energy": round(c["energy"], 2),
                    "probability": round(c["probability"], 1),
                    "weight": round(c["weight"], 4)
                }
                for c in significant_confs
            ],
            "conformers": [
                {
                    "id": c["id"],
                    "energy": c["energy"],
                    "weight": c["weight"],
                    "coordinates": c["coordinates"]
                }
                for c in significant_confs
            ],
            "warning": "UFF force field used (MMFF failed)"
        }


# --- KULLANIM ÖRNEĞİ ---
if __name__ == "__main__":
    engine = ConformerEngine(n_confs=50)
    
    # Test: 1,2-Dikloroetan (Gauche/Trans izomerizmi gösterir)
    test_smiles = "ClCCCl"
    
    print(f"Analiz Ediliyor: {test_smiles}")
    result = engine.generate_ensemble(test_smiles)
    
    if "error" in result:
        print(f"Hata: {result['error']}")
    else:
        print(f"\nGlobal Min Enerji: {result['global_min_energy']} kcal/mol")
        print(f"Kabul Edilen Konformer Sayısı: {result['significant_confs']}")
        print("\n--- Popülasyon Dağılımı (İlk 5) ---")
        for conf in result['ensemble_summary'][:5]:
            print(f"Conf ID: {conf['id']} | Prob: %{conf['probability']} | E: {conf['energy']} kcal/mol")
        
        print("\n--- Vicinal J-Coupling Tahminleri (Karplus) ---")
        for j in result['vicinal_couplings']:
            print(f"Atomlar: {j['atoms']}")
            print(f"  Ortalama Dihedral Açı: {j['avg_dihedral_angle']}°")
            print(f"  Tahmini J-Coupling: {j['predicted_J_Hz']} Hz")
            print()

