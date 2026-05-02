"""
SpectroMind v2.0 - Vektör Tabanlı Benzerlik Arama (RAG) Modülü
Morgan Fingerprints, Spectrum Binning ve Semantic Text Embedding içerir.
"""

import sys
import os
import json
import numpy as np
from typing import Dict, List, Optional, Tuple, Any

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, DataStructs
except ImportError:
    print("ERROR: RDKit not installed. Please install RDKit first.")
    sys.exit(1)

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("WARNING: sentence-transformers not installed. Text embedding will be disabled.")
    SentenceTransformer = None

try:
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("WARNING: scikit-learn not installed. Using numpy-based cosine similarity.")
    # Fallback cosine similarity implementation
    def cosine_similarity(a, b):
        a_norm = np.linalg.norm(a, axis=1, keepdims=True)
        b_norm = np.linalg.norm(b, axis=1, keepdims=True)
        return np.dot(a, b.T) / (a_norm * b_norm.T)


class VectorSearchEngine:
    """
    Vektör tabanlı benzerlik arama motoru.
    
    Özellikler:
    - Yapısal Embedding (Morgan Fingerprints)
    - Spektral Embedding (Spectrum Binning)
    - Metin Embedding (Semantic Text)
    - Hybrid Search (Ağırlıklandırılmış arama)
    """
    
    def __init__(self):
        """Motor başlatma"""
        print("⚡ Vector Search Engine Başlatılıyor: Modeller Yükleniyor...")
        
        # 1. Metin Modeli (HuggingFace - SciBERT alternatifi hızlı model)
        if SentenceTransformer:
            try:
                self.text_model = SentenceTransformer('all-MiniLM-L6-v2')
                print("✅ Text model yüklendi: all-MiniLM-L6-v2")
            except Exception as e:
                print(f"⚠️ Text model yüklenemedi: {e}")
                self.text_model = None
        else:
            self.text_model = None
        
        # 2. Mock Veritabanı (Production'da burası PostgreSQL/pgvector olur)
        self.database = {
            "structures": [],  # SMILES -> Morgan Fingerprint Vectors
            "spectra": [],     # NMR Peaks -> Binned Vectors
            "texts": [],       # Abstracts -> Semantic Vectors
            "metadata": []     # {name, id, smiles, etc.}
        }
        
        # Spektrum Ayarları (0-12 ppm arası, 1024 bin)
        self.spectral_bins = 1024
        self.ppm_range = (0.0, 12.0)
        
        print("✅ Vector Search Engine hazır")
    
    # --- VEKTÖRLEŞTİRME (EMBEDDING) FONKSİYONLARI ---
    
    def embed_structure(self, smiles: str) -> Optional[np.ndarray]:
        """
        SMILES -> Morgan Fingerprint (2048 bit vector)
        Yapısal benzerlik için.
        
        Args:
            smiles: SMILES string
            
        Returns:
            Morgan fingerprint vektörü veya None
        """
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            return None
        
        # ECFP4 (Radius=2), 2048 bit
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)
        
        # RDKit vektörünü Numpy array'e çevir
        arr = np.zeros((1,))
        DataStructs.ConvertToNumpyArray(fp, arr)
        return arr
    
    def embed_spectrum(self, peak_list: List[Tuple[float, float]]) -> np.ndarray:
        """
        Peak List -> Binned Vector (Intensity Histogram)
        Spektral "Shazam" benzerliği için.
        
        Args:
            peak_list: [(ppm, intensity), ...] listesi
            
        Returns:
            Binned vektör (1024 uzunluğunda)
        """
        vector = np.zeros(self.spectral_bins)
        min_ppm, max_ppm = self.ppm_range
        step = (max_ppm - min_ppm) / self.spectral_bins
        
        for ppm, intensity in peak_list:
            if min_ppm <= ppm <= max_ppm:
                # Hangi kutuya (bin) denk geldiğini bul
                bin_idx = int((ppm - min_ppm) / step)
                if bin_idx < self.spectral_bins:
                    # Basit Gaussian yayılımı (piklerin biraz kaymasını tolere etmek için)
                    vector[bin_idx] = max(vector[bin_idx], intensity)
                    # Yan komşulara da biraz etki ver (Fuzziness)
                    if bin_idx > 0:
                        vector[bin_idx - 1] = max(vector[bin_idx - 1], intensity * 0.5)
                    if bin_idx < self.spectral_bins - 1:
                        vector[bin_idx + 1] = max(vector[bin_idx + 1], intensity * 0.5)
        
        # Normalize (0-1 aralığına)
        max_val = np.max(vector)
        if max_val > 0:
            vector = vector / max_val
        
        return vector
    
    def embed_text(self, text: str) -> Optional[np.ndarray]:
        """
        Text -> Semantic Vector (384 float)
        Kavramsal arama için.
        
        Args:
            text: Metin string
            
        Returns:
            Semantic vektör veya None
        """
        if not self.text_model:
            return None
        
        try:
            return self.text_model.encode(text)
        except Exception as e:
            print(f"Text embedding hatası: {e}")
            return None
    
    # --- VERİTABANI İŞLEMLERİ ---
    
    def add_item(self, doc_id: int, name: str, smiles: str, abstract: str, nmr_peaks: List[Tuple[float, float]]):
        """
        Bir kaydı (Molekül + Makale + Spektrum) veritabanına ekler.
        
        Args:
            doc_id: Doküman ID
            name: Molekül adı
            smiles: SMILES string
            abstract: Makale özeti veya açıklama
            nmr_peaks: NMR pik listesi [(ppm, intensity), ...]
        """
        # 1. Yapısal Vektör
        struct_vec = self.embed_structure(smiles)
        
        # 2. Spektral Vektör
        spec_vec = self.embed_spectrum(nmr_peaks)
        
        # 3. Metin Vektörü
        text_vec = self.embed_text(abstract) if abstract else None
        
        if struct_vec is not None:
            self.database["structures"].append(struct_vec)
            self.database["spectra"].append(spec_vec)
            self.database["texts"].append(text_vec if text_vec is not None else np.zeros(384))
            self.database["metadata"].append({
                "id": doc_id,
                "name": name,
                "smiles": smiles,
                "abstract_snippet": abstract[:100] + "..." if abstract else ""
            })
            print(f"✅ Eklendi: {name}")
    
    # --- ARAMA MOTORU ---
    
    def search_hybrid(
        self,
        query_obj: Dict[str, Any],
        weights: Dict[str, float] = None,
        top_k: int = 5,
        threshold: float = 0.0
    ) -> List[Dict]:
        """
        Melez Arama: Text + Yapı + Spektrum benzerliklerini ağırlıklandırarak arar.
        
        Args:
            query_obj: Sorgu objesi {'text': str, 'smiles': str, 'peaks': [(ppm, intensity), ...]}
            weights: Ağırlıklar {'text': 0.3, 'struct': 0.4, 'spec': 0.3}
            top_k: Döndürülecek sonuç sayısı
            threshold: Minimum benzerlik eşiği
            
        Returns:
            Sonuç listesi
        """
        if weights is None:
            weights = {"text": 0.3, "struct": 0.4, "spec": 0.3}
        
        if len(self.database["metadata"]) == 0:
            return []
        
        scores = np.zeros(len(self.database["metadata"]))
        
        # 1. Metin Araması (Varsa)
        if "text" in query_obj and query_obj["text"] and self.text_model:
            query_vec = self.embed_text(query_obj["text"])
            if query_vec is not None:
                query_vec = query_vec.reshape(1, -1)
                db_vecs = np.array(self.database["texts"])
                if len(db_vecs) > 0 and db_vecs[0].shape[0] == query_vec.shape[1]:
                    sims = cosine_similarity(query_vec, db_vecs)[0]
                    scores += sims * weights.get("text", 0.3)
        
        # 2. Yapı Araması (Varsa)
        if "smiles" in query_obj and query_obj["smiles"]:
            query_vec = self.embed_structure(query_obj["smiles"])
            if query_vec is not None:
                query_vec = query_vec.reshape(1, -1)
                db_vecs = np.array(self.database["structures"])
                if len(db_vecs) > 0:
                    sims = cosine_similarity(query_vec, db_vecs)[0]
                    scores += sims * weights.get("struct", 0.4)
        
        # 3. Spektrum Araması (Varsa)
        if "peaks" in query_obj and query_obj["peaks"]:
            query_vec = self.embed_spectrum(query_obj["peaks"])
            query_vec = query_vec.reshape(1, -1)
            db_vecs = np.array(self.database["spectra"])
            if len(db_vecs) > 0:
                sims = cosine_similarity(query_vec, db_vecs)[0]
                scores += sims * weights.get("spec", 0.3)
        
        # Sıralama
        top_indices = np.argsort(scores)[::-1]  # Büyükten küçüğe
        
        results = []
        for idx in top_indices[:top_k]:
            if scores[idx] > threshold:
                meta = self.database["metadata"][idx]
                results.append({
                    "name": meta["name"],
                    "smiles": meta["smiles"],
                    "score": round(float(scores[idx]), 4),
                    "reason": "Hybrid Match",
                    "id": meta["id"],
                    "abstract": meta.get("abstract_snippet", "")
                })
        
        return results
    
    def search_by_structure(self, smiles: str, top_k: int = 5, threshold: float = 0.5) -> List[Dict]:
        """Sadece yapısal arama"""
        return self.search_hybrid(
            {"smiles": smiles},
            weights={"text": 0.0, "struct": 1.0, "spec": 0.0},
            top_k=top_k,
            threshold=threshold
        )
    
    def search_by_spectrum(self, peaks: List[Tuple[float, float]], top_k: int = 5, threshold: float = 0.5) -> List[Dict]:
        """Sadece spektral arama"""
        return self.search_hybrid(
            {"peaks": peaks},
            weights={"text": 0.0, "struct": 0.0, "spec": 1.0},
            top_k=top_k,
            threshold=threshold
        )
    
    def search_by_text(self, text: str, top_k: int = 5, threshold: float = 0.5) -> List[Dict]:
        """Sadece metin arama"""
        return self.search_hybrid(
            {"text": text},
            weights={"text": 1.0, "struct": 0.0, "spec": 0.0},
            top_k=top_k,
            threshold=threshold
        )
    
    def get_database_stats(self) -> Dict:
        """Veritabanı istatistiklerini döndürür"""
        return {
            "total_items": len(self.database["metadata"]),
            "text_model_loaded": self.text_model is not None,
            "spectral_bins": self.spectral_bins,
            "ppm_range": self.ppm_range
        }


# --- KULLANIM ÖRNEĞİ ---
if __name__ == "__main__":
    engine = VectorSearchEngine()
    print("-" * 50)
    
    # 1. Veri Tabanını Doldur (Indexing)
    # Aspirin
    engine.add_item(
        doc_id=1,
        name="Aspirin",
        smiles="CC(=O)Oc1ccccc1C(=O)O",
        abstract="Aspirin is a salicylate used to treat pain, fever, and inflammation.",
        nmr_peaks=[(2.35, 3.0), (7.1, 1.0), (7.6, 1.0), (8.1, 1.0)]
    )
    
    # Parasetamol (Yapısal olarak biraz benzer, spektrum farklı)
    engine.add_item(
        doc_id=2,
        name="Paracetamol",
        smiles="CC(=O)Nc1ccc(O)cc1",
        abstract="Paracetamol is a medication used to treat fever and mild to moderate pain.",
        nmr_peaks=[(2.1, 3.0), (6.7, 2.0), (7.3, 2.0)]
    )
    
    # Taxol (Tamamen alakasız)
    engine.add_item(
        doc_id=3,
        name="Paclitaxel",
        smiles="CC1=C2C(C(=O)C3(C(CC4C(C3C(C(C2(C)C)(CC1OC(=O)C(C(C5=CC=CC=C5)NC(=O)C6=CC=CC=C6)O)O)OC(=O)C7=CC=CC=C7)(CO4)OC(=O)C)O)C)OC(=O)C",
        abstract="Paclitaxel is a chemotherapy medication used to treat a number of types of cancer.",
        nmr_peaks=[(1.1, 3.0), (1.6, 3.0), (2.3, 3.0), (7.5, 5.0), (8.1, 2.0)]
    )
    
    print("-" * 50)
    
    # SENARYO 1: Kullanıcı "Ağrı kesici" arıyor (Semantic Search)
    print("\n🔍 SORGU 1: Text='pain inflammation treatment'")
    results = engine.search_by_text("pain inflammation treatment", top_k=5)
    for r in results:
        print(f"   Bulundu: {r['name']} (Skor: {r['score']})")
    
    # SENARYO 2: Kullanıcı bilinmeyen bir spektrum yükledi (Spectral Search)
    print("\n🔍 SORGU 2: Unknown Spectrum Peaks=[(2.15, 3.0), (6.8, 2.0)]")
    results = engine.search_by_spectrum([(2.15, 3.0), (6.8, 2.0)], top_k=5)
    for r in results:
        print(f"   Bulundu: {r['name']} (Skor: {r['score']})")
    
    # SENARYO 3: Kullanıcı "Salisilik Asit" çizdi, Aspirin arıyor (Structural Search)
    print("\n🔍 SORGU 3: Substructure='Oc1ccccc1C(=O)O'")
    results = engine.search_by_structure("Oc1ccccc1C(=O)O", top_k=5)
    for r in results:
        print(f"   Bulundu: {r['name']} (Skor: {r['score']})")
    
    # SENARYO 4: Hybrid Search (Hepsi birlikte)
    print("\n🔍 SORGU 4: Hybrid Search (Text + Structure + Spectrum)")
    results = engine.search_hybrid({
        "text": "pain treatment",
        "smiles": "CC(=O)Oc1ccccc1",
        "peaks": [(2.3, 3.0), (7.1, 1.0)]
    }, weights={"text": 0.3, "struct": 0.4, "spec": 0.3}, top_k=5)
    for r in results:
        print(f"   Bulundu: {r['name']} (Skor: {r['score']})")

