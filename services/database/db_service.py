"""
Database Service - PostgreSQL + pgvector
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from psycopg2.pool import ThreadedConnectionPool
from typing import List, Dict, Any, Optional
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Connection pool
_connection_pool = None

def initialize_pool():
    """Initialize PostgreSQL connection pool"""
    global _connection_pool
    
    if _connection_pool is not None:
        return _connection_pool
    
    try:
        _connection_pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", 5432)),
            database=os.getenv("POSTGRES_DB", "spectromind"),
            user=os.getenv("POSTGRES_USER", "spectromind"),
            password=os.getenv("POSTGRES_PASSWORD", "password")
        )
        logger.info("✅ PostgreSQL connection pool initialized")
        return _connection_pool
    except Exception as e:
        logger.error(f"❌ Failed to initialize connection pool: {e}")
        raise

@contextmanager
def get_connection():
    """Get connection from pool"""
    pool = initialize_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)

# ============================================================================
# ANALYSIS OPERATIONS
# ============================================================================

def save_analysis(
    user_id: Optional[str],
    smiles: str,
    spectrum_type: str,
    peaks: Dict[str, Any],
    predicted_structure: Optional[Dict[str, Any]] = None,
    confidence: float = 0.0,
    method_used: str = "unknown"
) -> str:
    """Save analysis to database"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO analyses (
                    user_id, smiles, spectrum_type, peaks, 
                    predicted_structure, confidence, method_used
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id, smiles, spectrum_type, Json(peaks),
                Json(predicted_structure) if predicted_structure else None,
                confidence, method_used
            ))
            result = cur.fetchone()
            return str(result['id'])

def get_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Get analysis by ID"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM analyses WHERE id = %s", (analysis_id,))
            result = cur.fetchone()
            return dict(result) if result else None

def search_analyses(
    smiles: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Search analyses"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = "SELECT * FROM analyses WHERE 1=1"
            params = []
            
            if smiles:
                query += " AND smiles = %s"
                params.append(smiles)
            
            if user_id:
                query += " AND user_id = %s"
                params.append(user_id)
            
            query += " ORDER BY created_at DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]

# ============================================================================
# ENHANCED LIBRARY OPERATIONS
# ============================================================================

def save_to_library(
    smiles: str,
    molecule_name: str,
    spectrum_data: Dict[str, Any],
    inchi_key: Optional[str] = None,
    formula: Optional[str] = None,
    molecular_weight: Optional[float] = None,
    literature_references: Optional[List[str]] = None
) -> str:
    """Save molecule to enhanced library"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO enhanced_library (
                    smiles, inchi_key, molecule_name, formula,
                    molecular_weight, spectrum_data, literature_references, verified
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
                ON CONFLICT (smiles) DO UPDATE SET
                    spectrum_data = EXCLUDED.spectrum_data,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """, (
                smiles, inchi_key, molecule_name, formula,
                molecular_weight, Json(spectrum_data),
                literature_references or []
            ))
            result = cur.fetchone()
            return str(result['id'])

def search_library(
    smiles: Optional[str] = None,
    inchi_key: Optional[str] = None,
    molecule_name: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Search enhanced library"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if smiles:
                cur.execute("SELECT * FROM enhanced_library WHERE smiles = %s", (smiles,))
            elif inchi_key:
                cur.execute("SELECT * FROM enhanced_library WHERE inchi_key = %s", (inchi_key,))
            elif molecule_name:
                cur.execute("SELECT * FROM enhanced_library WHERE molecule_name ILIKE %s", 
                           (f"%{molecule_name}%",))
            else:
                return None
            
            result = cur.fetchone()
            return dict(result) if result else None

# ============================================================================
# VECTOR SEARCH (RAG)
# ============================================================================

def save_spectrum_embedding(
    molecule_id: str,
    embedding_type: str,
    embedding: List[float],
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """Save spectrum embedding"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO spectrum_embeddings (
                    molecule_id, embedding_type, embedding, metadata
                ) VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (
                molecule_id, embedding_type, str(embedding), Json(metadata or {})
            ))
            result = cur.fetchone()
            return str(result['id'])

def vector_search(
    query_embedding: List[float],
    embedding_type: str = "spectral",
    limit: int = 10,
    threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """Vector similarity search"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    se.id,
                    se.molecule_id,
                    el.smiles,
                    el.molecule_name,
                    1 - (se.embedding <=> %s::vector) as similarity
                FROM spectrum_embeddings se
                JOIN enhanced_library el ON se.molecule_id = el.id
                WHERE se.embedding_type = %s
                  AND 1 - (se.embedding <=> %s::vector) >= %s
                ORDER BY se.embedding <=> %s::vector
                LIMIT %s
            """, (
                str(query_embedding), embedding_type, str(query_embedding),
                threshold, str(query_embedding), limit
            ))
            return [dict(row) for row in cur.fetchall()]

def save_literature_embedding(
    title: str,
    abstract: str,
    content: str,
    embedding: List[float],
    source_url: Optional[str] = None,
    doi: Optional[str] = None
) -> str:
    """Save literature embedding"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO literature_embeddings (
                    title, abstract, content, embedding, source_url, doi
                ) VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                title, abstract, content, str(embedding), source_url, doi
            ))
            result = cur.fetchone()
            return str(result['id'])

def literature_vector_search(
    query_embedding: List[float],
    limit: int = 5,
    threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """Search literature using vector similarity"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    title,
                    abstract,
                    source_url,
                    doi,
                    1 - (embedding <=> %s::vector) as similarity
                FROM literature_embeddings
                WHERE 1 - (embedding <=> %s::vector) >= %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (
                str(query_embedding), str(query_embedding), threshold,
                str(query_embedding), limit
            ))
            return [dict(row) for row in cur.fetchall()]

# ============================================================================
# QM JOBS
# ============================================================================

def save_qm_job(
    job_id: str,
    smiles: str,
    method: str,
    level: str
) -> None:
    """Save QM job to database"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO qm_jobs (job_id, smiles, method, level, status)
                VALUES (%s, %s, %s, %s, 'queued')
            """, (job_id, smiles, method, level))

def update_qm_job(
    job_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None
) -> None:
    """Update QM job status"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if status == 'completed':
                cur.execute("""
                    UPDATE qm_jobs
                    SET status = %s, result = %s, completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (status, Json(result) if result else None, job_id))
            else:
                cur.execute("""
                    UPDATE qm_jobs
                    SET status = %s, error_message = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (status, error_message, job_id))

def get_qm_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get QM job by ID"""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM qm_jobs WHERE job_id = %s", (job_id,))
            result = cur.fetchone()
            return dict(result) if result else None

