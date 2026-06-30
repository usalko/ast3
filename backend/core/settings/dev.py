"""Development settings."""
from .base import *  # noqa: F403

DEBUG = True
GRAPHQL_INTROSPECTION = True

ALLOWED_HOSTS = ["localhost", "192.168.1.55", "backend", "*"]

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://192.168.1.55:5173',
    'http://192.168.1.55:8000',
    'http://localhost:8080',
    'http://nginx',
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://192.168.1.55",
    "http://localhost",
    "http://127.0.0.1",
]

# Disable brute-force lockout in dev
AXES_ENABLED = False

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
