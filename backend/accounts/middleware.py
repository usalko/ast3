"""Authentication middleware that resolves JWT bearer tokens to request.user.

Django's default ``AuthenticationMiddleware`` only handles session auth. The
GraphQL API is stateless and authenticates via ``Authorization: Bearer <jwt>``
tokens issued by the ``tokenObtainPair`` mutation. This middleware validates the
token (using djangorestframework-simplejwt) and attaches the resolved user to
``request.user`` so that permission helpers and resolvers see an authenticated
user.
"""
from __future__ import annotations

from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class JWTAuthMiddleware:
    """Populate ``request.user`` from a JWT bearer token when present."""

    def __init__(self, get_response):
        self.get_response = get_response
        self._jwt = JWTAuthentication()

    def __call__(self, request):
        self._authenticate(request)
        return self.get_response(request)

    def _authenticate(self, request) -> None:
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return

        raw_token = header.split(" ", 1)[1].strip()
        if not raw_token:
            return

        try:
            validated_token = self._jwt.get_validated_token(raw_token)
            user = self._jwt.get_user(validated_token)
        except (InvalidToken, TokenError, Exception):
            # Leave request.user as whatever AuthenticationMiddleware set
            # (typically AnonymousUser) when the token is invalid.
            return

        if user is not None:
            request.user = user
        else:  # pragma: no cover - defensive
            request.user = AnonymousUser()
