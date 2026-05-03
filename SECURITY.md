# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues to the security officer via the internal secure channel (see internal runbook `docs/runbooks/incident-response.md`).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgement within **24 hours** and a status update within **72 hours**.

## Security Standards

This project targets compliance with:
- OWASP ASVS Level 2
- ФСТЭК requirements (target class КС1/КС2 — clarify in ADR-0004)
- Internal SDLC security policy

## Security Controls

| Control | Implementation |
|---|---|
| Authentication | JWT with short-lived access tokens + refresh rotation |
| Authorization | RBAC + object-level permission checks (IDOR prevention) |
| Input validation | Django forms/serializers + GraphQL scalar validation |
| SQL injection | Django ORM (parameterised queries only) |
| XSS | React DOM escaping + CSP headers |
| CSRF | Django CSRF middleware + SameSite cookies |
| Secrets | Environment variables only; never committed to VCS |
| Dependencies | pip-audit + osv-scanner + npm audit in CI |
| SAST | Bandit + Semgrep (backend), eslint-plugin-security (frontend) |
| DAST | OWASP ZAP nightly against staging |
| Audit log | Append-only with hash-chain (tamper-evident) |
| File uploads | ClamAV scan before making available; quarantine zone |

## Dependency License Policy

Only permissive licenses are allowed. See `CONTRIBUTING.md` for the full list.
