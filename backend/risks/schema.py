"""GraphQL schema for risks."""
from __future__ import annotations

import strawberry
import strawberry_django
from strawberry import auto

from .models import Risk


@strawberry_django.type(Risk)
class RiskType:
    id: auto
    title: auto
    description: auto
    source: auto
    level: auto
    probability: auto
    impact: auto
    status: auto
    mitigation: auto
    created_at: auto
    updated_at: auto


@strawberry.type
class RisksQuery:
    @strawberry_django.field
    def risks(self, project_id: strawberry.ID | None = None) -> list[RiskType]:
        qs = Risk.objects.select_related("owner", "project", "task")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs
