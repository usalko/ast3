"""GraphQL schema for projects domain."""
from __future__ import annotations

import asyncio
import datetime
from concurrent.futures import ThreadPoolExecutor

import strawberry
import strawberry_django
from strawberry import auto

from accounts.schema import DepartmentType, UserType
from tasks.schema import TaskStatusType

from .models import Project, ProjectMembership

_executor = ThreadPoolExecutor(max_workers=8)

def _run_sync(func, *args):
    return _executor.submit(func, *args).result()

# Default workflow statuses created for every new project.
DEFAULT_STATUSES = [
    ("backlog", "Backlog", "#6B7280", 0, False, False),
    ("todo", "To Do", "#3B82F6", 1, False, False),
    ("in_progress", "In Progress", "#F59E0B", 2, False, False),
    ("done", "Done", "#10B981", 3, True, False),
    ("cancelled", "Cancelled", "#EF4444", 4, False, True),
]


def _create_default_statuses(project: Project) -> None:
    from tasks.models import TaskStatus

    TaskStatus.objects.bulk_create(
        [
            TaskStatus(
                project=project,
                code=code,
                name=name,
                color=color,
                order=order,
                is_done=is_done,
                is_cancelled=is_cancelled,
            )
            for code, name, color, order, is_done, is_cancelled in DEFAULT_STATUSES
        ]
    )


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
    statuses: list[TaskStatusType]

    @strawberry.field
    def lead(self, root: Project) -> UserType | None:
        return root.lead  # type: ignore[return-value]

    @strawberry.field
    def department(self, root: Project) -> DepartmentType | None:
        return root.department  # type: ignore[return-value]


@strawberry_django.type(ProjectMembership)
class ProjectMembershipType:
    id: auto
    user: UserType
    role: auto
    joined_at: auto


@strawberry.input
class CreateProjectInput:
    code: str
    name: str
    description: str = ""
    type: str = "software"
    planned_start: datetime.date | None = None
    planned_end: datetime.date | None = None
    lead_id: strawberry.ID | None = None
    department_id: strawberry.ID | None = None


@strawberry.input
class UpdateProjectInput:
    name: str | None = None
    description: str | None = None
    status: str | None = None
    planned_start: datetime.date | None = None
    planned_end: datetime.date | None = None
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
        return _run_sync(_create_project_sync, info, input)

    def _create_project_sync(info: strawberry.types.Info, input: CreateProjectInput) -> ProjectType:
        from permissions.helpers import require_role

        require_role(info, "project_manager")
        user = info.context.request.user
        project = Project.objects.create(
            code=input.code,
            name=input.name,
            description=input.description,
            type=input.type,
            planned_start=input.planned_start,
            planned_end=input.planned_end,
            lead_id=input.lead_id,
            department_id=input.department_id,
            created_by=user,
        )
        _create_default_statuses(project)
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.OWNER},
        )
        return project  # type: ignore[return-value]

    @strawberry.mutation
    def update_project(
        self, info: strawberry.types.Info, id: strawberry.ID, input: UpdateProjectInput
    ) -> ProjectType:
        return _run_sync(_update_project_sync, info, id, input)


def _create_project_sync(info: strawberry.types.Info, input: CreateProjectInput) -> ProjectType:
    from permissions.helpers import require_role

    require_role(info, "project_manager")
    user = info.context.request.user
    project = Project.objects.create(
        code=input.code,
        name=input.name,
        description=input.description,
        type=input.type,
        planned_start=input.planned_start,
        planned_end=input.planned_end,
        lead_id=input.lead_id,
        department_id=input.department_id,
        created_by=user,
    )
    _create_default_statuses(project)
    ProjectMembership.objects.get_or_create(
        project=project,
        user=user,
        defaults={"role": ProjectMembership.OWNER},
    )
    return project  # type: ignore[return-value]


def _update_project_sync(
    info: strawberry.types.Info, id: strawberry.ID, input: UpdateProjectInput
) -> ProjectType:
    from permissions.helpers import require_project_access

    project = Project.objects.get(pk=id)
    require_project_access(info, project, min_role="manager")
    for field, value in strawberry.asdict(input).items():
        if value is not None:
            setattr(project, field, value)
    project.save()
    return project  # type: ignore[return-value]

