from django.apps import AppConfig
from django.db.backends.signals import connection_created
import logging

logger = logging.getLogger(__name__)


def configure_sqlite(sender, connection, **kwargs):
    """
    Configures SQLite for maximum concurrency, zero 502/504 lockouts, and reliability:
    - WAL Mode (Write-Ahead Logging): Readers do not block writers, writers do not block readers.
    - busy_timeout: 30000ms (30 seconds): Waits for locks to clear instead of crashing immediately.
    - synchronous = NORMAL: Safe and much faster writes under WAL mode.
    - cache_size = -64000: 64MB RAM page cache.
    - temp_store = MEMORY: Fast in-memory temporary tables.
    """
    if connection.vendor == "sqlite":
        try:
            cursor = connection.cursor()
            cursor.execute("PRAGMA journal_mode = WAL;")
            cursor.execute("PRAGMA busy_timeout = 30000;")
            cursor.execute("PRAGMA synchronous = NORMAL;")
            cursor.execute("PRAGMA cache_size = -64000;")
            cursor.execute("PRAGMA temp_store = MEMORY;")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS app_proposedallocation (
                    id integer PRIMARY KEY AUTOINCREMENT,
                    matched_preference integer NOT NULL DEFAULT 1,
                    match_score real NOT NULL DEFAULT 0.0,
                    is_overridden bool NOT NULL DEFAULT 0,
                    override_reason varchar(255) NULL,
                    created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    batch_id bigint NOT NULL,
                    student_id bigint NOT NULL,
                    supervisor_id bigint NOT NULL
                );
            """)
            cursor.close()
        except Exception as e:
            logger.warning(f"Failed to set SQLite PRAGMA: {e}")


class MyAppConfig(AppConfig):  # NoQa
    default_auto_field = "django.db.models.BigAutoField"
    name = "app"

    def ready(self):
        connection_created.connect(configure_sqlite)
