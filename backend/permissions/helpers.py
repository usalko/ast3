"""permissions — centralised permission helpers."""
from __future__ import annotations

import strawberry
from django.core.exceptions import PermissionDenied


def _get_user(info: strawberry.types.Info):
    user = info.context.request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required")
    return user


def require_role(info: strawberry.types.Info, role_code: str) -> None:
    """Raise PermissionDenied if the user does not hold the specified global role."""
    user = _get_user(info)
    has_role = user.role_assignments.filter(
        role__code=role_code,
        department__isnull=True,
        project_id__isnull=True,
    ).exists()
    if not has_role and not user.is_superuser:
        raise PermissionDenied(f"Role '{role_code}' required")


def require_project_member(info: strawberry.types.Info, project_id: str | int) -> None:
    """Raise PermissionDenied if the user is not a member of the project."""
    user = _get_user(info)
    if user.is_superuser:
        return
    from projects.models import ProjectMembership

    if not ProjectMembership.objects.filter(project_id=project_id, user=user).exists():
        raise PermissionDenied("You are not a member of this project")


def require_project_access(
    info: strawberry.types.Info,
    project,
    min_role: str = "developer",
) -> None:
    """Raise PermissionDenied if the user's project role is below min_role."""
    user = _get_user(info)
    if user.is_superuser:
        return
    role_order = {"viewer": 0, "developer": 1, "manager": 2, "owner": 3}
    from projects.models import ProjectMembership

    membership = ProjectMembership.objects.filter(project=project, user=user).first()
    if not membership:
        raise PermissionDenied("You are not a member of this project")
    if role_order.get(membership.role, -1) < role_order.get(min_role, 0):
        raise PermissionDenied(f"Project role '{min_role}' or higher required")
