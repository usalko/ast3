"""GraphQL schema for projects domain."""
from __future__ import annotations

import strawberry
import strawberry_django
from strawberry import auto

from .models import Project, ProjectMembership


@strawberry_django.type(Project)
class ProjectType:
    id: auto
    code: auto
    name: auto
    description: auto
    type: auto
    status: auto
    planned_start: auto
    planned_end: auto
    actual_start: auto
    actual_end: auto
    budget_hours: auto
    progress: int
    created_at: auto


@strawberry_django.type(ProjectMembership)
class ProjectMembershipType:
    id: auto
    user: "accounts.schema.UserType"  # type: ignore[name-defined]
    role: auto
    joined_at: auto


@strawberry.input
class CreateProjectInput:
    code: str
    name: str
    description: str = ""
    type: str = "software"
    planned_start: strawberry.scalars.Date | None = None
    planned_end: strawberry.scalars.Date | None = None
    lead_id: strawberry.ID | None = None
    department_id: strawberry.ID | None = None


@strawberry.input
class UpdateProjectInput:
    name: str | None = None
    description: str | None = None
    status: str | None = None
    planned_start: strawberry.scalars.Date | None = None
    planned_end: strawberry.scalars.Date | None = None
    lead_id: strawberry.ID | None = None


@strawberry.type
class ProjectsQuery:
    @strawberry_django.field
    def projects(self) -> list[ProjectType]:
        return Project.objects.select_related("lead", "department").all()

    @strawberry_django.field
    def project(self, id: strawberry.ID) -> ProjectType | None:
        return Project.objects.filter(pk=id).select_related("lead", "department").first()


@strawberry.type
class ProjectsMutation:
    @strawberry.mutation
    def create_project(self, info: strawberry.types.Info, input: CreateProjectInput) -> ProjectType:
        from permissions.helpers import require_role

        require_role(info, "project_manager")
        project = Project.objects.create(
            code=input.code,
            name=input.name,
            description=input.description,
            type=input.type,
            planned_start=input.planned_start,
            planned_end=input.planned_end,
            lead_id=input.lead_id,
            department_id=input.department_id,
            created_by=info.context.request.user,
        )
        return project  # type: ignore[return-value]

    @strawberry.mutation
    def update_project(
        self, info: strawberry.types.Info, id: strawberry.ID, input: UpdateProjectInput
    ) -> ProjectType:
        from permissions.helpers import require_project_access

        project = Project.objects.get(pk=id)
        require_project_access(info, project, min_role="manager")
        for field, value in strawberry.asdict(input).items():
            if value is not None:
                setattr(project, field, value)
        project.save()
        return project  # type: ignore[return-value]
