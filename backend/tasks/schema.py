"""GraphQL schema for tasks domain."""
from __future__ import annotations

import asyncio
import datetime
from concurrent.futures import ThreadPoolExecutor

import strawberry
import strawberry_django
from strawberry import auto

from accounts.schema import UserType

from .models import Task, TaskDependency, TaskStatus

_executor = ThreadPoolExecutor(max_workers=8)

def _run_sync(func, *args):
    return _executor.submit(func, *args).result()


@strawberry_django.type(TaskStatus)
class TaskStatusType:
    id: auto
    name: auto
    code: auto
    color: auto
    order: auto
    is_done: auto
    is_cancelled: auto


@strawberry_django.type(TaskDependency)
class TaskDependencyType:
    id: auto
    type: auto
    lag_hours: auto
    predecessor: "TaskType"
    successor: "TaskType"


@strawberry_django.type(Task)
class TaskType:
    id: auto
    code: auto
    title: auto
    description: auto
    type: auto
    priority: auto
    progress: auto
    risk_level: auto
    planned_start: auto
    planned_end: auto
    actual_start: auto
    actual_end: auto
    estimated_hours: auto
    board_order: auto
    created_at: auto
    updated_at: auto
    status: TaskStatusType
    assignee: UserType | None
    reporter: UserType | None

    @strawberry.field
    def project_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.project_id))

    @strawberry.field
    def status_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.status_id))

    @strawberry.field
    def dependencies(self, root: Task) -> list[TaskDependencyType]:
        return list(
            TaskDependency.objects.filter(successor=root)
            .select_related("predecessor", "successor")
            .order_by("id")
        )


@strawberry.input
class CreateTaskInput:
    project_id: strawberry.ID
    title: str
    description: str = ""
    type: str = "software"
    status_id: strawberry.ID
    priority: int = 1
    assignee_id: strawberry.ID | None = None
    planned_start: datetime.datetime | None = None
    planned_end: datetime.datetime | None = None
    estimated_hours: float | None = None


@strawberry.input
class UpdateTaskInput:
    title: str | None = None
    description: str | None = None
    status_id: strawberry.ID | None = None
    priority: int | None = None
    assignee_id: strawberry.ID | None = None
    progress: int | None = None
    planned_start: datetime.datetime | None = None
    planned_end: datetime.datetime | None = None
    estimated_hours: float | None = None


@strawberry.type
class TasksQuery:
    @strawberry_django.field
    def tasks(self, project_id: strawberry.ID) -> list[TaskType]:
        return (
            Task.objects.filter(project_id=project_id)
            .select_related("status", "assignee", "assignee__department", "reporter", "reporter__department")
        )

    @strawberry_django.field
    def task(self, id: strawberry.ID) -> TaskType | None:
        return (
            Task.objects.filter(pk=id)
            .select_related("status", "assignee", "assignee__department", "reporter", "reporter__department")
            .first()
        )

    @strawberry_django.field
    def gantt_data(self, project_id: strawberry.ID) -> list[TaskType]:
        return (
            Task.objects.filter(project_id=project_id)
            .exclude(status__is_cancelled=True)
            .select_related("status", "assignee", "assignee__department")
            .prefetch_related("dependencies__predecessor", "dependencies__successor")
        )


@strawberry.type
class TasksMutation:
    @strawberry.mutation
    def create_task(self, info: strawberry.types.Info, input: CreateTaskInput) -> TaskType:
        return _run_sync(_create_task_sync, info, input)

    @strawberry.mutation
    def update_task(
        self, info: strawberry.types.Info, id: strawberry.ID, input: UpdateTaskInput
    ) -> TaskType:
        return _run_sync(_update_task_sync, info, id, input)

    @strawberry.mutation
    def move_task(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID,
        status_id: strawberry.ID,
        board_order: float,
    ) -> TaskType:
        return _run_sync(_move_task_sync, info, task_id, status_id, board_order)

    @strawberry.type
    class DeleteTaskPayload:
        success: bool

    @strawberry.mutation
    def delete_task(
        self,
        info: strawberry.types.Info,
        id: strawberry.ID,
    ) -> TasksMutation.DeleteTaskPayload:
        return _run_sync(_delete_task_sync, info, id)


def _create_task_sync(info: strawberry.types.Info, input: CreateTaskInput) -> TaskType:
    from permissions.helpers import require_project_member

    require_project_member(info, project_id=input.project_id)
    task = Task(
        project_id=input.project_id,
        title=input.title,
        description=input.description,
        type=input.type,
        status_id=input.status_id,
        priority=input.priority,
        assignee_id=input.assignee_id,
        planned_start=input.planned_start,
        planned_end=input.planned_end,
        estimated_hours=input.estimated_hours,
        reporter=info.context.request.user,
    )
    task.code = task.generate_code()
    task.save()
    return task  # type: ignore[return-value]


def _update_task_sync(
    info: strawberry.types.Info, id: strawberry.ID, input: UpdateTaskInput
) -> TaskType:
    from permissions.helpers import require_project_member

    task = Task.objects.select_related("project").get(pk=id)
    require_project_member(info, project_id=str(task.project_id))
    for field, value in strawberry.asdict(input).items():
        if value is not None:
            setattr(task, field, value)
    task.save()
    return task  # type: ignore[return-value]


def _move_task_sync(
    info: strawberry.types.Info,
    task_id: strawberry.ID,
    status_id: strawberry.ID,
    board_order: float,
) -> TaskType:
    from permissions.helpers import require_project_member

    task = Task.objects.select_related("project").get(pk=task_id)
    require_project_member(info, project_id=str(task.project_id))
    task.status_id = status_id
    task.board_order = board_order
    task.save(update_fields=["status_id", "board_order", "updated_at"])
    return task  # type: ignore[return-value]


def _delete_task_sync(
    info: strawberry.types.Info,
    id: strawberry.ID,
) -> TasksMutation.DeleteTaskPayload:
    from permissions.helpers import require_project_member

    task = Task.objects.select_related("project").get(pk=id)
    require_project_member(info, project_id=str(task.project_id))

    cancelled_status = TaskStatus.objects.filter(
        project_id=task.project_id,
        code="cancelled",
    ).first()
    if cancelled_status:
        task.status = cancelled_status
        task.save(update_fields=["status_id", "updated_at"])
    else:
        task.delete()

    return TasksMutation.DeleteTaskPayload(success=True)

