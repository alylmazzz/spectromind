"""
Self-Correction Loop (Agentic Workflow)
Generator -> Simulator -> Evaluator -> Critic
"""

from typing import Dict, Any, List, Optional
import logging
import math

logger = logging.getLogger(__name__)

# Import prediction modules
from services.nmr_engine.modules import hose_predictor, gnn_predictor, conformer_analyzer

# Maximum retries to prevent infinite loops
MAX_RETRIES = 5

class GeneratorAgent:
    """Generator Agent - Proposes molecular structure"""
    
    def __init__(self):
        self.llm_available = False  # Placeholder for LLM integration
    
    def propose_structure(
        self,
        peaks: List[Dict[str, Any]],
        formula: str,
        feedback: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Propose molecular structure based on spectral data
        
        In production, this would use:
        - LLM (GPT-4o) for initial proposal
        - RAG (Vector DB) for similar structures
        - Chemical rules (valency, DBE)
        """
        # Placeholder: In real implementation, call LLM
        proposed_smiles = "CCO"  # Placeholder
        
        return {
            "smiles": proposed_smiles,
            "confidence": 0.7,
            "reasoning": "Based on spectral pattern analysis"
        }

class SimulatorAgent:
    """Simulator Agent - Calculates theoretical spectrum"""
    
    def simulate_spectrum(
        self,
        smiles: str,
        spectrum_type: str = "1H"
    ) -> Dict[str, Any]:
        """
        Simulate theoretical spectrum for proposed structure
        
        Uses GNN or HOSE - NOT LLM (this is the physics engine)
        """
        from rdkit import Chem
        
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return {"success": False, "error": "Invalid SMILES"}
        
        mol = Chem.AddHs(mol)
        
        if spectrum_type == "1H":
            peaks = hose_predictor.predict_h1(mol)
        elif spectrum_type == "13C":
            peaks = hose_predictor.predict_c13(mol)
        else:
            peaks = []
        
        return {
            "success": True,
            "peaks": peaks,
            "method": "HOSE"
        }

class EvaluatorAgent:
    """Evaluator Agent - Compares real vs theoretical"""
    
    def evaluate(
        self,
        real_peaks: List[Dict[str, Any]],
        theoretical_peaks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Evaluate match between real and theoretical spectra
        
        Returns RMSD and other metrics
        """
        if not real_peaks or not theoretical_peaks:
            return {
                "rmsd": float('inf'),
                "jaccard": 0.0,
                "matched_peaks": 0,
                "total_peaks": len(real_peaks)
            }
        
        # Peak matching (Hungarian algorithm simplified)
        matched_pairs = []
        real_shifts = [p.get("shift", p.get("ppm", 0)) for p in real_peaks]
        theo_shifts = [p.get("shift", p.get("ppm", 0)) for p in theoretical_peaks]
        
        # Simple nearest neighbor matching
        matched_diffs = []
        used_theo = set()
        
        for real_shift in real_shifts:
            best_match = None
            best_diff = float('inf')
            
            for i, theo_shift in enumerate(theo_shifts):
                if i in used_theo:
                    continue
                
                diff = abs(real_shift - theo_shift)
                if diff < best_diff and diff < 0.5:  # 0.5 ppm threshold
                    best_diff = diff
                    best_match = i
            
            if best_match is not None:
                matched_pairs.append((real_shift, theo_shifts[best_match]))
                matched_diffs.append(best_diff)
                used_theo.add(best_match)
        
        # Calculate RMSD
        if matched_diffs:
            rmsd = math.sqrt(sum(d * d for d in matched_diffs) / len(matched_diffs))
        else:
            rmsd = float('inf')
        
        # Jaccard similarity (peak presence)
        real_set = set(real_shifts)
        theo_set = set(theo_shifts)
        intersection = len(real_set & theo_set)
        union = len(real_set | theo_set)
        jaccard = intersection / union if union > 0 else 0.0
        
        return {
            "rmsd": rmsd,
            "jaccard": jaccard,
            "matched_peaks": len(matched_pairs),
            "total_peaks": len(real_peaks),
            "matched_pairs": matched_pairs
        }

class CriticAgent:
    """Critic Agent - Decides if result is acceptable"""
    
    def judge(
        self,
        evaluation: Dict[str, Any],
        threshold_rmsd: float = 0.5
    ) -> Dict[str, Any]:
        """
        Judge if the match is acceptable
        
        Returns decision and feedback for Generator
        """
        rmsd = evaluation.get("rmsd", float('inf'))
        jaccard = evaluation.get("jaccard", 0.0)
        
        if rmsd < threshold_rmsd and jaccard > 0.7:
            # Success!
            return {
                "acceptable": True,
                "confidence": 1.0 - (rmsd / threshold_rmsd),
                "feedback": None
            }
        else:
            # Failure - generate feedback
            feedback = self._generate_feedback(evaluation)
            return {
                "acceptable": False,
                "confidence": 0.0,
                "feedback": feedback
            }
    
    def _generate_feedback(self, evaluation: Dict[str, Any]) -> str:
        """Generate structured feedback for Generator"""
        rmsd = evaluation.get("rmsd", float('inf'))
        matched_pairs = evaluation.get("matched_pairs", [])
        
        if rmsd > 1.0:
            return f"RMSD is too high ({rmsd:.2f} ppm). The proposed structure's theoretical spectrum does not match the experimental data. Please reconsider the functional groups and their positions."
        
        if len(matched_pairs) < evaluation.get("total_peaks", 0) * 0.5:
            return f"Only {len(matched_pairs)} out of {evaluation.get('total_peaks', 0)} peaks matched. The structure is missing key features present in the experimental spectrum."
        
        # Analyze specific mismatches
        feedback_parts = []
        for real_shift, theo_shift in matched_pairs[:3]:  # Top 3 mismatches
            diff = abs(real_shift - theo_shift)
            if diff > 0.3:
                feedback_parts.append(
                    f"Peak at {real_shift:.2f} ppm was predicted at {theo_shift:.2f} ppm "
                    f"(error: {diff:.2f} ppm). This suggests incorrect functional group assignment."
                )
        
        return " ".join(feedback_parts) if feedback_parts else "Structure needs refinement."

# ============================================================================
# MAIN SELF-CORRECTION LOOP
# ============================================================================

def self_correction_loop(
    real_peaks: List[Dict[str, Any]],
    formula: str,
    spectrum_type: str = "1H",
    max_retries: int = MAX_RETRIES
) -> Dict[str, Any]:
    """
    Main self-correction loop
    
    Returns final structure and confidence
    """
    generator = GeneratorAgent()
    simulator = SimulatorAgent()
    evaluator = EvaluatorAgent()
    critic = CriticAgent()
    
    iteration = 0
    best_result = None
    best_rmsd = float('inf')
    
    feedback = None
    
    while iteration < max_retries:
        iteration += 1
        logger.info(f"🔄 Self-Correction Loop - Iteration {iteration}/{max_retries}")
        
        # Step 1: Generator proposes structure
        proposal = generator.propose_structure(real_peaks, formula, feedback)
        proposed_smiles = proposal["smiles"]
        
        logger.info(f"  📝 Generator proposes: {proposed_smiles}")
        
        # Step 2: Simulator calculates theoretical spectrum
        simulation = simulator.simulate_spectrum(proposed_smiles, spectrum_type)
        
        if not simulation["success"]:
            logger.warning(f"  ⚠️ Simulation failed: {simulation.get('error')}")
            feedback = f"Simulation failed: {simulation.get('error')}"
            continue
        
        theoretical_peaks = simulation["peaks"]
        logger.info(f"  🧮 Simulator generated {len(theoretical_peaks)} theoretical peaks")
        
        # Step 3: Evaluator compares
        evaluation = evaluator.evaluate(real_peaks, theoretical_peaks)
        rmsd = evaluation["rmsd"]
        
        logger.info(f"  📊 Evaluator: RMSD = {rmsd:.3f} ppm, Jaccard = {evaluation['jaccard']:.3f}")
        
        # Step 4: Critic judges
        judgment = critic.judge(evaluation)
        
        if judgment["acceptable"]:
            logger.info(f"  ✅ Critic: ACCEPTABLE (Confidence: {judgment['confidence']:.2f})")
            return {
                "success": True,
                "smiles": proposed_smiles,
                "confidence": judgment["confidence"],
                "rmsd": rmsd,
                "iterations": iteration,
                "theoretical_peaks": theoretical_peaks
            }
        else:
            logger.info(f"  ❌ Critic: NOT ACCEPTABLE")
            logger.info(f"  💬 Feedback: {judgment['feedback']}")
            feedback = judgment["feedback"]
            
            # Keep track of best result so far
            if rmsd < best_rmsd:
                best_rmsd = rmsd
                best_result = {
                    "smiles": proposed_smiles,
                    "confidence": 0.5,  # Low confidence
                    "rmsd": rmsd,
                    "iterations": iteration,
                    "theoretical_peaks": theoretical_peaks
                }
    
    # Max retries reached - return best result
    logger.warning(f"  ⚠️ Max retries reached. Returning best result (RMSD: {best_rmsd:.3f})")
    
    if best_result:
        return {
            "success": True,
            **best_result,
            "note": "Max retries reached - best available result"
        }
    else:
        return {
            "success": False,
            "error": "Self-correction loop failed to find acceptable structure"
        }

