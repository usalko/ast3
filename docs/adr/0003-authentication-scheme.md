# ADR-0003 — Authentication: JWT via djangorestframework-simplejwt

| Field    | Value          |
|----------|----------------|
| Date     | 2024-07-01     |
| Status   | Accepted       |
| Deciders | Architecture team, Security team |

## Context

The system requires stateless authentication for the GraphQL API consumed by a React SPA.
Alternatives considered:

| Approach | Pros | Cons |
|----------|------|------|
| Session cookies + CSRF | Native Django; CSRF protection built-in | Stateful; harder to scale; CSRF complexity with SPA |
| JWT (simplejwt) | Stateless; standard; rotation+blacklist available | Access token cannot be revoked mid-validity without blocklist |
| OAuth2 / OIDC (django-oauth-toolkit) | Delegated; standard | Overkill for internal app; adds AGPL-adjacent deps risk |
| django-allauth | Social login support | Not needed in Ф0-Ф1; LGPL components |

Security requirements:
- Access token lifetime ≤ 15 minutes (FSTEC session timeout guidance).
- Refresh token rotation: each use issues a new refresh token.
- Refresh token blacklisting on logout and rotation.
- `django-axes` brute-force lockout at the authentication endpoint level.

## Decision

Use **`djangorestframework-simplejwt`** with:
- `ACCESS_TOKEN_LIFETIME = timedelta(minutes=15)`
- `REFRESH_TOKEN_LIFETIME = timedelta(days=7)`
- `ROTATE_REFRESH_TOKENS = True`
- `BLACKLIST_AFTER_ROTATION = True` (requires `rest_framework_simplejwt.token_blacklist`)
- Tokens stored in `localStorage` on the client (SPA; HttpOnly cookie not feasible with
  a separate Vite dev server; to be revisited in Ф4 with `__Secure-` prefix sameSite=Strict cookies).
- `JWTAuthentication` as the only DRF authentication class; Strawberry uses request.user populated by DRF middleware.

`django-axes` is configured to count failures on the `/api/token/` endpoint and lock for 30 minutes after 5 attempts.

## Consequences

### Positive
- Simple integration with Strawberry GraphQL (request.user populated automatically).
- Short-lived access tokens limit exposure window if a token leaks.
- Refresh rotation means stolen refresh tokens are detected on next legitimate use.
- simplejwt is MIT licensed; passes allowlist.

### Negative / Trade-offs
- Access tokens stored in `localStorage` are vulnerable to XSS. Mitigated by strict CSP headers
  (`script-src 'self'`) and `eslint-plugin-security` in CI.
- Token blacklist table grows over time; requires periodic cleanup task (Celery beat, weekly).
- FSTEC Level 2 may require session-level (not token-level) audit trail — supplemented by AuditLog.

### Risks
- If XSS is found, tokens in localStorage are compromised. Plan in Ф4: migrate to HttpOnly
  cookies with `SameSite=Strict` and a dedicated `/api/token/refresh/` endpoint.
