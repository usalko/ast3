# Contributing to AST3

## Prerequisites
- Read `SECURITY.md` before writing any code.
- Ensure you understand the [ROADMAP](docs/ROADMAP.md) and the phase you are working on.

## Workflow
1. Branch from `main`: `feat/<domain>/<short-description>` or `fix/<domain>/<short-description>`.
2. Make changes — keep commits atomic and meaningful.
3. Ensure all CI checks pass locally before pushing (see below).
4. Open a Pull Request with a description referencing the task ID.
5. At least **2 approvals** required (tech lead + one peer); security-sensitive changes require security officer approval.
6. No `force-push` to `main`.

## Local checks before pushing
```bash
# Backend
cd backend
poetry run ruff check .
poetry run mypy .
poetry run pytest -x -q
poetry run bandit -r . -ll

# Frontend
cd client
npm run lint
npm run typecheck
npm test -- --run
```

## License compliance
All new dependencies must be approved in the allowlist at `docs/security/license-allowlist.md`.
Permitted: MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, PSF, ISC, Python-2.0.
**Forbidden**: AGPL, GPL, LGPL (without explicit waiver), SSPL, Commons Clause.

## Architecture decisions
Significant decisions must be documented as an ADR in `docs/adr/`. Use the template at `docs/adr/0000-template.md`.

## Commit message format
```
<type>(<scope>): <summary>

[optional body]

[optional footer: refs #issue]
```
Types: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`, `security`.
