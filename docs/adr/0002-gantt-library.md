# ADR-0002 — Gantt chart library: gantt-task-react

| Field    | Value          |
|----------|----------------|
| Date     | 2024-07-01     |
| Status   | Accepted       |
| Deciders | Architecture team, Frontend lead |

## Context

The product requires a Gantt chart view for project timeline planning (Ф2).
Key constraints:
- **MIT license only** (FSTEC / AGPL restrictions).
- Must render task bars, dependencies (FS/SS/FF links), drag-to-resize, and progress overlays.
- Must work with React 18 and be tree-shakeable.

Candidates evaluated:

| Library | License | React 18 | Dependencies | Size (min+gz) |
|---------|---------|----------|--------------|---------------|
| `gantt-task-react` | MIT | ✓ | 0 (pure React) | ~40 KB |
| `dhtmlx-gantt` | GPL v2 / commercial | ✓ | proprietary | N/A |
| `frappe-gantt` | MIT | Needs wrapper | 0 | ~30 KB |
| `@syncfusion/ej2-gantt` | Commercial | ✓ | large | N/A |

## Decision

Use **`gantt-task-react`** (MIT, zero external deps, pure React).

For features not in `gantt-task-react` (e.g., dependency arrows overlay) we will implement
a lightweight SVG overlay component on top of the library's rendered output.

## Consequences

### Positive
- Zero dependency risk; MIT license passes the allowlist check.
- Small bundle size; tree-shakeable.
- Pure React component — easy to integrate with Refine state.

### Negative / Trade-offs
- Limited built-in styling; custom CSS required for branding.
- Dependency arrows require custom SVG rendering — estimated 2–3 days extra work in Ф2.
- Not actively developed; may need forking if blocking bugs arise.

### Risks
- If the library is abandoned, we maintain a fork internally. The codebase is small (~3 KLOC).
