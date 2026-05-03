"""GraphQL schema for audit log (read-only, admin/security-officer only)."""
from __future__ import annotations

import strawberry
import strawberry_django
from strawberry import auto

from .models import AuditLog


@strawberry_django.type(AuditLog)
class AuditLogType:
    id: auto
    action: auto
    resource_type: auto
    resource_id: auto
    payload: strawberry.scalars.JSON
    ip_address: auto
    timestamp: auto
    entry_hash: auto
    previous_hash: auto


@strawberry.type
class AuditQuery:
    @strawberry_django.field
    def audit_log(
        self,
        info: strawberry.types.Info,
        resource_type: str | None = None,
        resource_id: str | None = None,
        limit: int = 50,
    ) -> list[AuditLogType]:
        from permissions.helpers import require_role

        require_role(info, "security_officer")
        qs = AuditLog.objects.select_related("actor").order_by("-timestamp")
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if resource_id:
            qs = qs.filter(resource_id=resource_id)
        return qs[:limit]
