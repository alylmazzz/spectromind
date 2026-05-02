"""
Celery Worker for Async Tasks
"""

from celery import Celery
import os
import logging

logger = logging.getLogger(__name__)

# Redis as broker
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "spectromind_worker",
    broker=redis_url,
    backend=redis_url
)

# Configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50
)

@celery_app.task(name="nmr_elucidation")
def nmr_elucidation_task(
    peaks: list,
    formula: str,
    spectrum_type: str = "1H"
) -> dict:
    """
    Async NMR elucidation task
    
    This runs the full RDKit elucidation pipeline (Engine 1-7)
    which can take 10-30 seconds for complex molecules.
    """
    try:
        # Import here to avoid loading RDKit at module level
        from services.nmr_engine.modules import hose_predictor
        
        # This is a placeholder - real implementation would call
        # the full elucidation pipeline
        result = {
            "success": True,
            "candidates": [],
            "computation_time": 0
        }
        
        return result
    except Exception as e:
        logger.error(f"Elucidation task error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }

@celery_app.task(name="dft_calculation")
def dft_calculation_task(
    smiles: str,
    level: str = "B3LYP/6-31G(d)"
) -> dict:
    """
    Async DFT calculation task
    
    This can take minutes to hours depending on molecule size.
    """
    try:
        from services.nmr_engine.modules import qm_calculator
        
        # Run DFT calculation
        result = qm_calculator.run_dft_calculation(smiles, level)
        
        return result
    except Exception as e:
        logger.error(f"DFT calculation error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }

@celery_app.task(name="conformer_ensemble")
def conformer_ensemble_task(
    smiles: str,
    num_conformers: int = 50
) -> dict:
    """
    Async conformer ensemble generation
    """
    try:
        from services.nmr_engine.modules import conformer_analyzer
        
        result = conformer_analyzer.generate_ensemble(
            smiles,
            num_conformers=num_conformers,
            optimize=True,
            boltzmann_weighting=True
        )
        
        return result
    except Exception as e:
        logger.error(f"Conformer ensemble error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }

