# ADR-0001 — GraphQL library: Strawberry over Graphene

| Field    | Value          |
|----------|----------------|
| Date     | 2024-07-01     |
| Status   | Accepted       |
| Deciders | Architecture team |

## Context

The project requires a GraphQL API for a Django backend. Two mature Python GraphQL libraries
exist for Django: **Graphene-Django** (older, maintained by community) and
**Strawberry** (newer, code-first, type-annotated, actively developed).

Requirements:
- Full type safety via Python type hints / mypy
- Async support (Django 5 ASGI, Celery)
- Active maintenance and MIT-compatible license
- Integration with strawberry-graphql-django for automatic type generation from Django models
- Extensions API for security controls (complexity/alias limits)

## Decision

Use **Strawberry** (`strawberry-graphql[django]` + `strawberry-graphql-django`).

Rationale:
1. **Type safety**: Strawberry uses Python's native `typing` module — mypy integration is first-class.
   Graphene requires verbose custom scalar/type wrappers.
2. **Async**: Strawberry supports async resolvers and ships `AsyncGraphQLView` natively.
3. **Extensions API**: `strawberry.extensions` provides `MaxAliasesExtension` and
   `MaxTokensExtension` for DoS protection without monkey-patching.
4. **License**: MIT. Graphene is also MIT, but strawberry-graphql-django is MIT as well — no
   AGPL / LGPL concerns.
5. **DX**: Code-first schema with `@strawberry.type` is cleaner than Graphene's class meta pattern.

Graphene-Django was ruled out primarily because of slower async support and the need for
additional boilerplate to achieve the same level of type safety.

## Consequences

### Positive
- Leaner schema code; mypy can type-check resolvers end-to-end.
- Built-in security extensions reduce custom middleware.
- `strawberry-graphql-django` auto-generates types from Django models, reducing drift.

### Negative / Trade-offs
- Strawberry's query optimization (prefetch helpers) is less mature than graphene-django's
  `DjangoObjectType` select-related auto-detection. We must manually annotate `select_related`
  and `prefetch_related` in resolvers.
- Smaller community than Graphene for now (though growing).

### Risks
- Minor: Strawberry releases breaking API changes across minor versions. Pin exact versions and
  review release notes on each upgrade.
