"""Development settings."""
from .base import *  # noqa: F401, F403

DEBUG = True
GRAPHQL_INTROSPECTION = True

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]

# Disable brute-force lockout in dev
AXES_ENABLED = False

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
