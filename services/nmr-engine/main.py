"""
SpectroMind NMR Engine - FastAPI Microservice
Persistent Python service for RDKit-based NMR analysis

Bu servis, Next.js'ten bağımsız olarak sürekli ayakta durur ve
RDKit kütüphanelerini RAM'de hazır tutar.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn
import logging
from datetime import datetime
import asyncio

# RDKit imports (loaded once at startup)
try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, AllChem, rdMolDescriptors
    from rdkit.Chem.rdMolDescriptors import CalcNumRotatableBonds
    RDKIT_AVAILABLE = True
except ImportError:
    RDKIT_AVAILABLE = False
    logging.warning("RDKit not available - install rdkit-pypi")

# Import analysis modules
from modules import (
    hose_predictor,
    gnn_predictor,
    conformer_analyzer,
    ftir_engine,
    ms_predictor,
    qm_calculator
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="SpectroMind NMR Engine",
    description="Persistent RDKit-based NMR analysis microservice",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state (loaded once at startup)
class EngineState:
    def __init__(self):
        self.initialized = False
        self.rdkit_loaded = False
        self.gnn_model = None
        self.cache = {}  # Simple in-memory cache
        
    def initialize(self):
        """Initialize RDKit and load models"""
        if not RDKIT_AVAILABLE:
            logger.error("RDKit not available - cannot initialize")
            return False
        
        try:
            # Load GNN model (if available)
            try:
                self.gnn_model = gnn_predictor.load_model()
                logger.info("✅ GNN model loaded")
            except Exception as e:
                logger.warning(f"GNN model not available: {e}")
            
            self.rdkit_loaded = True
            self.initialized = True
            logger.info("✅ NMR Engine initialized successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Initialization failed: {e}")
            return False

# Global state instance
engine_state = EngineState()

@app.on_event("startup")
async def startup_event():
    """Initialize engine on startup"""
    logger.info("🚀 Starting SpectroMind NMR Engine...")
    success = engine_state.initialize()
    if not success:
        logger.error("⚠️ Engine initialization failed - some features may not work")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down NMR Engine...")

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class NMRPredictionRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string")
    spectrum_type: str = Field("1H", description="1H, 13C, or both")
    method: str = Field("hybrid", description="hose, gnn, or hybrid")
    solvent: Optional[str] = Field("CDCl3", description="Solvent")
    temperature: Optional[float] = Field(298.15, description="Temperature in K")
    frequency: Optional[float] = Field(400.0, description="NMR frequency in MHz")

class NMRPeak(BaseModel):
    shift: float
    integration: int
    multiplicity: str
    assignment: str
    coupling: Optional[Dict[str, float]] = None

class NMRPredictionResponse(BaseModel):
    success: bool
    h1_peaks: Optional[List[NMRPeak]] = None
    c13_peaks: Optional[List[Dict[str, Any]]] = None
    method_used: str
    confidence: float
    warnings: List[str] = []
    computation_time_ms: float

class ConformerRequest(BaseModel):
    smiles: str
    num_conformers: int = Field(50, ge=1, le=200)
    optimize: bool = True
    boltzmann_weighting: bool = True

class ConformerResponse(BaseModel):
    success: bool
    conformers: List[Dict[str, Any]]
    lowest_energy: float
    boltzmann_weights: List[float]
    computation_time_ms: float

class FTIRRequest(BaseModel):
    smiles: str
    anharmonic_correction: bool = True
    scaling_factor: Optional[float] = None

class FTIRResponse(BaseModel):
    success: bool
    peaks: List[Dict[str, Any]]
    computation_time_ms: float

class MSRequest(BaseModel):
    smiles: str
    ionization_mode: str = Field("ESI", description="ESI, EI, or APCI")
    collision_energy: Optional[float] = None

class MSResponse(BaseModel):
    success: bool
    molecular_ion: Dict[str, Any]
    fragments: List[Dict[str, Any]]
    isotope_pattern: Dict[str, Any]
    computation_time_ms: float

class QMRequest(BaseModel):
    smiles: str
    method: str = Field("xtb", description="xtb, dft, or both")
    level: Optional[str] = Field("GFN2-xTB", description="xTB level or DFT functional")

class QMResponse(BaseModel):
    success: bool
    method: str
    shifts: Dict[str, float]
    geometry_optimized: bool
    computation_time_ms: float
    job_id: Optional[str] = None  # For async DFT jobs

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if engine_state.initialized else "degraded",
        "rdkit_loaded": engine_state.rdkit_loaded,
        "gnn_available": engine_state.gnn_model is not None,
        "timestamp": datetime.now().isoformat()
    }

# ============================================================================
# NMR PREDICTION ENDPOINTS
# ============================================================================

@app.post("/predict/nmr", response_model=NMRPredictionResponse)
async def predict_nmr(request: NMRPredictionRequest):
    """
    Predict NMR spectrum using HOSE, GNN, or hybrid method
    """
    import time
    start_time = time.time()
    
    if not engine_state.initialized:
        raise HTTPException(status_code=503, detail="Engine not initialized")
    
    try:
        # Parse molecule
        mol = Chem.MolFromSmiles(request.smiles)
        if mol is None:
            raise HTTPException(status_code=400, detail="Invalid SMILES string")
        
        mol = Chem.AddHs(mol)  # Add explicit hydrogens
        
        warnings = []
        h1_peaks = None
        c13_peaks = None
        method_used = request.method
        confidence = 0.0
        
        # Predict based on method
        if request.spectrum_type in ["1H", "both"]:
            if request.method == "hose":
                h1_peaks = hose_predictor.predict_h1(mol, request.solvent)
                method_used = "HOSE"
                confidence = 0.85
            elif request.method == "gnn" and engine_state.gnn_model:
                h1_peaks = gnn_predictor.predict_h1(mol, engine_state.gnn_model)
                method_used = "GNN"
                confidence = 0.90
            elif request.method == "hybrid":
                # Try GNN first, fallback to HOSE
                if engine_state.gnn_model:
                    try:
                        h1_peaks = gnn_predictor.predict_h1(mol, engine_state.gnn_model)
                        method_used = "GNN (hybrid)"
                        confidence = 0.90
                    except:
                        h1_peaks = hose_predictor.predict_h1(mol, request.solvent)
                        method_used = "HOSE (hybrid fallback)"
                        confidence = 0.85
                        warnings.append("GNN prediction failed, using HOSE")
                else:
                    h1_peaks = hose_predictor.predict_h1(mol, request.solvent)
                    method_used = "HOSE (GNN not available)"
                    confidence = 0.85
        
        if request.spectrum_type in ["13C", "both"]:
            if request.method == "hose":
                c13_peaks = hose_predictor.predict_c13(mol)
                method_used = "HOSE"
            elif request.method == "gnn" and engine_state.gnn_model:
                c13_peaks = gnn_predictor.predict_c13(mol, engine_state.gnn_model)
                method_used = "GNN"
            elif request.method == "hybrid":
                if engine_state.gnn_model:
                    try:
                        c13_peaks = gnn_predictor.predict_c13(mol, engine_state.gnn_model)
                        method_used = "GNN (hybrid)"
                    except:
                        c13_peaks = hose_predictor.predict_c13(mol)
                        method_used = "HOSE (hybrid fallback)"
                        warnings.append("GNN prediction failed, using HOSE")
                else:
                    c13_peaks = hose_predictor.predict_c13(mol)
                    method_used = "HOSE (GNN not available)"
        
        computation_time = (time.time() - start_time) * 1000  # ms
        
        return NMRPredictionResponse(
            success=True,
            h1_peaks=h1_peaks,
            c13_peaks=c13_peaks,
            method_used=method_used,
            confidence=confidence,
            warnings=warnings,
            computation_time_ms=computation_time
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"NMR prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# ============================================================================
# CONFORMER ANALYSIS
# ============================================================================

@app.post("/analyze/conformers", response_model=ConformerResponse)
async def analyze_conformers(request: ConformerRequest):
    """
    Generate conformer ensemble with Boltzmann weighting
    """
    import time
    start_time = time.time()
    
    if not engine_state.initialized:
        raise HTTPException(status_code=503, detail="Engine not initialized")
    
    try:
        result = conformer_analyzer.generate_ensemble(
            request.smiles,
            num_conformers=request.num_conformers,
            optimize=request.optimize,
            boltzmann_weighting=request.boltzmann_weighting
        )
        
        computation_time = (time.time() - start_time) * 1000
        
        return ConformerResponse(
            success=True,
            conformers=result["conformers"],
            lowest_energy=result["lowest_energy"],
            boltzmann_weights=result["boltzmann_weights"],
            computation_time_ms=computation_time
        )
    
    except Exception as e:
        logger.error(f"Conformer analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# ============================================================================
# FTIR PREDICTION
# ============================================================================

@app.post("/predict/ftir", response_model=FTIRResponse)
async def predict_ftir(request: FTIRRequest):
    """
    Predict FTIR spectrum with anharmonic correction
    """
    import time
    start_time = time.time()
    
    if not engine_state.initialized:
        raise HTTPException(status_code=503, detail="Engine not initialized")
    
    try:
        peaks = ftir_engine.predict_ftir(
            request.smiles,
            anharmonic_correction=request.anharmonic_correction,
            scaling_factor=request.scaling_factor
        )
        
        computation_time = (time.time() - start_time) * 1000
        
        return FTIRResponse(
            success=True,
            peaks=peaks,
            computation_time_ms=computation_time
        )
    
    except Exception as e:
        logger.error(f"FTIR prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# ============================================================================
# MS PREDICTION
# ============================================================================

@app.post("/predict/ms", response_model=MSResponse)
async def predict_ms(request: MSRequest):
    """
    Predict Mass Spectrometry spectrum
    """
    import time
    start_time = time.time()
    
    if not engine_state.initialized:
        raise HTTPException(status_code=503, detail="Engine not initialized")
    
    try:
        result = ms_predictor.predict_ms(
            request.smiles,
            ionization_mode=request.ionization_mode,
            collision_energy=request.collision_energy
        )
        
        computation_time = (time.time() - start_time) * 1000
        
        return MSResponse(
            success=True,
            molecular_ion=result["molecular_ion"],
            fragments=result["fragments"],
            isotope_pattern=result["isotope_pattern"],
            computation_time_ms=computation_time
        )
    
    except Exception as e:
        logger.error(f"MS prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# ============================================================================
# QM CALCULATION
# ============================================================================

@app.post("/calculate/qm", response_model=QMResponse)
async def calculate_qm(request: QMRequest, background_tasks: BackgroundTasks):
    """
    Quantum Mechanical calculation (xTB or DFT)
    For DFT, returns job_id and processes asynchronously
    """
    import time
    start_time = time.time()
    
    if not engine_state.initialized:
        raise HTTPException(status_code=503, detail="Engine not initialized")
    
    try:
        if request.method == "xtb":
            # Fast xTB calculation (synchronous)
            result = qm_calculator.calculate_xtb(
                request.smiles,
                level=request.level
            )
            
            computation_time = (time.time() - start_time) * 1000
            
            return QMResponse(
                success=True,
                method="GFN2-xTB",
                shifts=result["shifts"],
                geometry_optimized=result["geometry_optimized"],
                computation_time_ms=computation_time,
                job_id=None
            )
        
        elif request.method == "dft":
            # DFT is slow - queue it
            job_id = qm_calculator.queue_dft_job(
                request.smiles,
                level=request.level
            )
            
            return QMResponse(
                success=True,
                method="DFT",
                shifts={},
                geometry_optimized=False,
                computation_time_ms=0,
                job_id=job_id
            )
        
        else:
            raise HTTPException(status_code=400, detail="Invalid method")
    
    except Exception as e:
        logger.error(f"QM calculation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Calculation failed: {str(e)}")

@app.get("/qm/status/{job_id}")
async def get_qm_status(job_id: str):
    """Check status of async DFT job"""
    status = qm_calculator.get_job_status(job_id)
    return status

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Production: False
        workers=1  # Single worker for stateful service
    )

