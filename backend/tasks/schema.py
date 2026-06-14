"""GraphQL schema for tasks domain."""
from __future__ import annotations

import datetime
import typing
from concurrent.futures import ThreadPoolExecutor

import strawberry
import strawberry_django
from strawberry import auto

from accounts.schema import UserType

from .models import Task, TaskDependency, TaskStatus, TaskAssignment

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
    risk_level: int
    is_overdue: bool
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
    def assignees(self, root: Task) -> list[UserType]:
        return [a.user for a in TaskAssignment.objects.filter(task=root).select_related("user")]

    @strawberry.field
    def assignee_ids(self, root: Task) -> list[str]:
        return list(TaskAssignment.objects.filter(task=root).values_list("user_id", flat=True))

    @strawberry.field
    def project_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.project_id))

    @strawberry.field
    def status_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.status_id))

    @strawberry.field
    def risk_level(self) -> int:
        if self.status_id is None or self.status_id == 0:
            return 0
        if self.status.code in {"done", "cancelled"}:
            return 0
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        planned_end = self.planned_end
        if planned_end and planned_end < now:
            return 3
        if planned_end and (planned_end - now).total_seconds() <= 2 * 24 * 3600 and (self.progress or 0) < 50:
            return 2
        if self.planned_start and planned_end:
            total = max(1, (planned_end - self.planned_start).total_seconds())
            elapsed = max(0, (now - self.planned_start).total_seconds())
            expected_progress = min(100, round((elapsed / total) * 100))
            if expected_progress - (self.progress or 0) >= 35:
                return 2
            if expected_progress - (self.progress or 0) >= 20:
                return 1
        return 0

    @strawberry.field
    def is_overdue(self) -> bool:
        if self.status_id is None or self.status_id == 0:
            return False
        if self.status.code in {"done", "cancelled"}:
            return False
        return bool(self.planned_end and self.planned_end < datetime.datetime.now(tz=datetime.timezone.utc))

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

    @strawberry_django.field
    def tasks_all(self) -> list[TaskType]:
        return Task.objects.all().select_related("status", "project", "assignee")


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

    @strawberry.mutation
    def delete_task(
        self,
        info: strawberry.types.Info,
        id: strawberry.ID,
    ) -> bool:
        return _run_sync(_delete_task_sync, info, id)

    @strawberry.mutation
    def add_task_assignee(self, info: strawberry.types.Info, task_id: strawberry.ID, user_id: strawberry.ID) -> bool:
        from audit.models import AuditLog

        try:
            task = Task.objects.get(pk=task_id)
            user = info.context.request.user
            TaskAssignment.objects.get_or_create(task=task, user_id=user_id)
            AuditLog.log(actor=user, action="task.add_assignee", resource_type="task", resource_id=str(task_id), payload={"user_id": str(user_id)}, request=info.context.request)
            return True
        except Task.DoesNotExist:
            raise Exception("Task not found")

    @strawberry.mutation
    def remove_task_assignee(self, info: strawberry.types.Info, task_id: strawberry.ID, user_id: strawberry.ID) -> bool:
        from audit.models import AuditLog

        deleted, _ = TaskAssignment.objects.filter(task_id=task_id, user_id=user_id).delete()
        if deleted:
            AuditLog.log(actor=info.context.request.user, action="task.remove_assignee", resource_type="task", resource_id=str(task_id), payload={"user_id": str(user_id)}, request=info.context.request)
        return deleted > 0

    @strawberry.mutation
    def set_task_assignees(self, info: strawberry.types.Info, task_id: strawberry.ID, user_ids: list[strawberry.ID]) -> bool:
        from audit.models import AuditLog

        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            raise Exception("Task not found")
        TaskAssignment.objects.filter(task=task).delete()
        for uid in user_ids:
            TaskAssignment.objects.create(task=task, user_id=uid)
        AuditLog.log(actor=info.context.request.user, action="task.set_assignees", resource_type="task", resource_id=str(task_id), payload={"user_ids": [str(u) for u in user_ids]}, request=info.context.request)
        return True


def _create_task_sync(info: strawberry.types.Info, input: CreateTaskInput) -> TaskType:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

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
    AuditLog.log(
        actor=info.context.request.user,
        action="task.create",
        resource_type="task",
        resource_id=str(task.id),
        payload={"code": task.code, "project_id": input.project_id},
        request=info.context.request,
    )
    return task  # type: ignore[return-value]


def _update_task_sync(
    info: strawberry.types.Info, id: strawberry.ID, input: UpdateTaskInput
) -> TaskType:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    task = Task.objects.select_related("project").get(pk=id)
    require_project_member(info, project_id=str(task.project_id))
    changes = {k: v for k, v in strawberry.asdict(input).items() if v is not None}
    for field, value in changes.items():
        setattr(task, field, value)
    task.save()
    AuditLog.log(
        actor=info.context.request.user,
        action="task.update",
        resource_type="task",
        resource_id=str(task.id),
        payload={"changes": {k: str(v) for k, v in changes.items()}},
        request=info.context.request,
    )
    return task  # type: ignore[return-value]


def _move_task_sync(
    info: strawberry.types.Info,
    task_id: strawberry.ID,
    status_id: strawberry.ID,
    board_order: float,
) -> TaskType:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    task = Task.objects.select_related("project").get(pk=task_id)
    require_project_member(info, project_id=str(task.project_id))
    task.status_id = status_id
    task.board_order = board_order
    task.save(update_fields=["status_id", "board_order", "updated_at"])
    AuditLog.log(
        actor=info.context.request.user,
        action="task.move",
        resource_type="task",
        resource_id=str(task.id),
        payload={"status_id": str(status_id), "board_order": board_order},
        request=info.context.request,
    )
    return task  # type: ignore[return-value]


def _delete_task_sync(
    info: strawberry.types.Info,
    id: strawberry.ID,
) -> bool:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

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

    AuditLog.log(
        actor=info.context.request.user,
        action="task.delete",
        resource_type="task",
        resource_id=str(task.id),
        payload={"project_id": str(task.project_id)},
        request=info.context.request,
    )
    return True