"""
Redis Service - Cache and Session Management
"""

import redis
import json
import os
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

# Redis client
_redis_client = None

def get_redis_client():
    """Get Redis client (singleton)"""
    global _redis_client
    
    if _redis_client is not None:
        return _redis_client
    
    try:
        _redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=0,
            decode_responses=True
        )
        # Test connection
        _redis_client.ping()
        logger.info("✅ Redis client initialized")
        return _redis_client
    except Exception as e:
        logger.error(f"❌ Failed to initialize Redis: {e}")
        return None

# ============================================================================
# CACHE OPERATIONS
# ============================================================================

def cache_get(key: str) -> Optional[Any]:
    """Get value from cache"""
    client = get_redis_client()
    if not client:
        return None
    
    try:
        value = client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        logger.error(f"Cache get error: {e}")
        return None

def cache_set(key: str, value: Any, ttl: int = 3600) -> bool:
    """Set value in cache with TTL (seconds)"""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.setex(key, ttl, json.dumps(value))
        return True
    except Exception as e:
        logger.error(f"Cache set error: {e}")
        return False

def cache_delete(key: str) -> bool:
    """Delete key from cache"""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.delete(key)
        return True
    except Exception as e:
        logger.error(f"Cache delete error: {e}")
        return False

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

def set_session(session_id: str, data: dict, ttl: int = 86400) -> bool:
    """Set session data (24 hours default)"""
    return cache_set(f"session:{session_id}", data, ttl)

def get_session(session_id: str) -> Optional[dict]:
    """Get session data"""
    return cache_get(f"session:{session_id}")

def delete_session(session_id: str) -> bool:
    """Delete session"""
    return cache_delete(f"session:{session_id}")

# ============================================================================
# RATE LIMITING
# ============================================================================

def check_rate_limit(key: str, max_requests: int = 100, window: int = 3600) -> tuple[bool, int]:
    """
    Check rate limit
    
    Returns:
        (allowed, remaining)
    """
    client = get_redis_client()
    if not client:
        return True, max_requests  # Allow if Redis unavailable
    
    try:
        current = client.incr(f"ratelimit:{key}")
        if current == 1:
            client.expire(f"ratelimit:{key}", window)
        
        remaining = max(0, max_requests - current)
        allowed = current <= max_requests
        
        return allowed, remaining
    except Exception as e:
        logger.error(f"Rate limit error: {e}")
        return True, max_requests  # Allow on error

# ============================================================================
# POPULAR MOLECULES CACHE
# ============================================================================

def get_popular_molecules(limit: int = 1000) -> list:
    """Get popular molecules from cache"""
    return cache_get("popular_molecules") or []

def update_popular_molecules(molecules: list) -> bool:
    """Update popular molecules cache"""
    return cache_set("popular_molecules", molecules, ttl=86400)  # 24 hours

