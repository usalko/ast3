"""Security tests placeholder.

These tests verify security-critical invariants:
- Unauthenticated access returns 401/403
- IDOR checks (user cannot access other users' data)
- GraphQL introspection disabled in prod
- Audit log hash-chain integrity

To run against staging:
  pytest tests/security/ --base-url https://staging.ast3.internal
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")


def graphql(query: str, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(f"{BASE_URL}/graphql/", json={"query": query}, headers=headers, timeout=10)
    return resp.json()


class TestUnauthenticated:
    def test_graphql_requires_auth(self):
        data = graphql("{ me { id } }")
        # Should return error or null, not data
        assert "data" not in data or data["data"].get("me") is None

    def test_introspection_disabled_in_prod(self):
        """Introspection must be disabled outside DEBUG mode."""
        if os.environ.get("DJANGO_SETTINGS_MODULE", "").endswith("dev"):
            pytest.skip("Introspection allowed in dev")
        data = graphql("{ __schema { types { name } } }")
        errors = data.get("errors", [])
        assert any("introspection" in str(e).lower() or "disabled" in str(e).lower() for e in errors), \
            "Introspection must be disabled in production"

    def test_healthz(self):
        resp = requests.get(f"{BASE_URL}/healthz", timeout=5)
        assert resp.status_code == 200
