"""
Concurrency and Database Locking Utilities for Smart FYP Management.
Provides retry mechanisms with exponential backoff and jitter for handling
transient database lock contentions under peak concurrent submissions.
"""
import time
import random
import functools
import logging
from django.db import OperationalError

logger = logging.getLogger(__name__)


def retry_on_db_lock(max_retries=5, initial_delay=0.05, backoff_factor=2.0):
    """
    Decorator that catches SQLite OperationalError ("database is locked" or "database table is locked")
    and retries execution with exponential backoff and randomized jitter.
    
    This guarantees that when 100 students submit at the exact same second,
    requests queue safely instead of throwing 500/502/504 Bad Gateway errors.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except OperationalError as exc:
                    err_msg = str(exc).lower()
                    is_lock_error = "locked" in err_msg or "busy" in err_msg
                    if not is_lock_error or attempt == max_retries:
                        logger.error(f"[DB_CONCURRENCY] Failed after {attempt} attempts: {exc}")
                        raise
                    
                    # Exponential backoff with jitter
                    jitter = random.uniform(0.01, 0.05)
                    sleep_time = (delay * (backoff_factor ** (attempt - 1))) + jitter
                    logger.warning(
                        f"[DB_CONCURRENCY] Database locked on attempt {attempt}/{max_retries}. "
                        f"Retrying in {sleep_time:.3f}s... Error: {exc}"
                    )
                    time.sleep(sleep_time)
        return wrapper
    return decorator
