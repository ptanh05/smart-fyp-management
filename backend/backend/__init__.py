# Import Celery application to ensure tasks are loaded
from .celery import app as celery_app

__all__ = ('celery_app',)
