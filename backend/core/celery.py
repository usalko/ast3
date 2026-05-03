"""Celery application for AST3."""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.prod")

app = Celery("ast3")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
