"""
AST3 Backend — WSGI entry point (for compatibility only; prefer ASGI).
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.prod")

application = get_wsgi_application()
