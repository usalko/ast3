"""GraphQL schema for tasks domain."""
from __future__ import annotations

import datetime

import strawberry
import strawberry_django
from asgiref.sync import sync_to_async
from strawberry import auto
from django.db.models import Prefetch, Case, When, Value, IntegerField, BooleanField, Q, ExpressionWrapper

from accounts.schema import UserType
from projects.models import Project

from .models import Task, TaskDependency, TaskStatus, TaskAssignment, Comment


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


@strawberry.type
class ProjectInfo:
    id: strawberry.ID
    code: str
    name: str


@strawberry_django.type(Comment)
class CommentType:
    id: auto
    task_id: auto
    author_name: auto
    body: auto
    number: int
    created_at: auto


@strawberry_django.type(Task)
class TaskType:
    id: auto
    code: auto
    title: auto
    description: auto
    type: auto
    priority: auto
    progress: auto
    comment: auto
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
    def project(self) -> "ProjectInfo":
        return ProjectInfo(
            id=strawberry.ID(str(self.project.id)),
            code=self.project.code,
            name=self.project.name,
        )

    @strawberry.field
    def assignees(self, root: Task) -> list[UserType]:
        assignments = getattr(root, "_assignments_prefetch", None)
        if assignments is None:
            assignments = TaskAssignment.objects.filter(task=root).select_related("user")
        return [a.user for a in assignments]

    @strawberry.field
    def assignee_ids(self, root: Task) -> list[str]:
        assignments = getattr(root, "_assignments_prefetch", None)
        if assignments is None:
            return list(TaskAssignment.objects.filter(task=root).values_list("user_id", flat=True))
        return [str(a.user_id) for a in assignments]

    @strawberry.field
    def project_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.project_id))

    @strawberry.field
    def status_id(self) -> strawberry.ID:
        return strawberry.ID(str(self.status_id))

    @strawberry.field
    def risk_level(self) -> int:
        # Проверяем аннотированное значение, если есть, иначе вычисляем в Python
        annotated = getattr(self, "_risk_level_annotated", None)
        if annotated is not None:
            return annotated
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
        annotated = getattr(self, "_is_overdue_annotated", None)
        if annotated is not None:
            return annotated
        if self.status_id is None or self.status_id == 0:
            return False
        if self.status.code in {"done", "cancelled"}:
            return False
        return bool(self.planned_end and self.planned_end < datetime.datetime.now(tz=datetime.timezone.utc))

    @strawberry.field
    def dependencies(self, root: Task) -> list[TaskDependencyType]:
        deps = getattr(root, "_dependencies_prefetch", None)
        if deps is None:
            deps = TaskDependency.objects.filter(successor=root)
        return list(deps.select_related("predecessor", "successor").order_by("id"))

@strawberry.input
class CreateCommentInput:
    task_id: strawberry.ID
    body: str


@strawberry.input
class UpdateCommentInput:
    id: strawberry.ID
    body: str


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
    comment: str = ""


@strawberry.input
class UpdateTaskInput:
    title: str | None = None
    description: str | None = None
    project_id: strawberry.ID | None = None
    status_id: strawberry.ID | None = None
    priority: int | None = None
    assignee_id: strawberry.ID | None = None
    progress: int | None = None
    type: str | None = None
    planned_start: datetime.datetime | None = None
    planned_end: datetime.datetime | None = None
    estimated_hours: float | None = None
    comment: str | None = None


@strawberry.type
class BacklogTaskProjectInfo:
    id: strawberry.ID
    code: str | None = None
    name: str


@strawberry.type
class BacklogTaskItem:
    id: strawberry.ID
    code: str | None = None
    title: str
    project: BacklogTaskProjectInfo
    created_at: datetime.datetime | None = None


def _annotate_task_queryset(qs):
    """Add Prefetch for assignments/dependencies and annotate computed fields."""
    from django.db.models.functions import Now
    return qs.select_related("status", "assignee", "assignee__department", "reporter", "reporter__department").prefetch_related(
        Prefetch(
            "taskassignment_set",
            queryset=TaskAssignment.objects.select_related("user"),
            to_attr="_assignments_prefetch",
        ),
        Prefetch(
            "successors",
            queryset=TaskDependency.objects.select_related("predecessor", "successor"),
            to_attr="_dependencies_prefetch",
        ),
    ).annotate(
        _is_overdue_annotated=Case(
            When(
                Q(status__code__in=["done", "cancelled"])
                | Q(planned_end__isnull=True)
                | Q(status_id__isnull=True)
                | Q(status_id=0),
                then=Value(False),
            ),
            default=ExpressionWrapper(Q(planned_end__lt=Now()), output_field=BooleanField()),
            output_field=BooleanField(),
        ),
    )


@strawberry.type
class TasksQuery:
    @strawberry_django.field
    def tasks(self, project_id: strawberry.ID) -> list[TaskType]:
        return _annotate_task_queryset(Task.objects.filter(project_id=project_id))

    @strawberry_django.field
    def task(self, id: strawberry.ID) -> TaskType | None:
        return _annotate_task_queryset(Task.objects.filter(pk=id)).first()

    @strawberry_django.field
    def gantt_data(self, project_id: strawberry.ID) -> list[TaskType]:
        return (
            Task.objects.filter(project_id=project_id)
            .exclude(status__is_cancelled=True)
            .select_related("status", "assignee", "assignee__department")
            .prefetch_related(
                Prefetch(
                    "taskassignment_set",
                    queryset=TaskAssignment.objects.select_related("user"),
                    to_attr="_assignments_prefetch",
                ),
                "dependencies__predecessor",
                "dependencies__successor",
            )
            .distinct()
        )

    @strawberry_django.field
    def tasks_all(self) -> list[TaskType]:
        return Task.objects.all().select_related("status", "project", "assignee")

    @strawberry.field
    def backlog_tasks(self) -> list[BacklogTaskItem]:
        tasks = (
            Task.objects.filter(status__code="backlog")
            .select_related("project")
            .order_by("-created_at")
        )
        result = []
        for t in tasks:
            result.append(BacklogTaskItem(
                id=strawberry.ID(str(t.id)),
                code=t.code,
                title=t.title,
                project=BacklogTaskProjectInfo(
                    id=strawberry.ID(str(t.project.id)),
                    code=t.project.code,
                    name=t.project.name,
                ),
                created_at=t.created_at,
            ))
        return result

    @strawberry_django.field
    def task_comments(self, task_id: strawberry.ID) -> list[CommentType]:
        return Comment.objects.filter(task_id=task_id, is_deleted=False).order_by("number")

    @strawberry.field
    def task_comments_bulk(self, task_ids: list[str]) -> list[CommentType]:
        ids = [int(tid) for tid in task_ids]
        if not ids:
            return []
        return list(
            Comment.objects.filter(task_id__in=ids, is_deleted=False)
            .order_by("task_id", "number")
        )


@strawberry.type
class TasksMutation:
    @strawberry.mutation
    async def create_task(self, info: strawberry.types.Info, input: CreateTaskInput) -> TaskType:
        return await sync_to_async(_create_task_sync, thread_sensitive=True)(info, input)

    @strawberry.mutation
    async def update_task(
        self, info: strawberry.types.Info, id: strawberry.ID, input: UpdateTaskInput
    ) -> TaskType:
        return await sync_to_async(_update_task_sync, thread_sensitive=True)(info, id, input)

    @strawberry.mutation
    async def move_task(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID,
        status_id: strawberry.ID,
        board_order: float,
    ) -> TaskType:
        return await sync_to_async(_move_task_sync, thread_sensitive=True)(info, task_id, status_id, board_order)

    @strawberry.mutation
    async def delete_task(
        self,
        info: strawberry.types.Info,
        id: strawberry.ID,
    ) -> bool:
        return await sync_to_async(_delete_task_sync, thread_sensitive=True)(info, id)

    @strawberry.mutation
    async def add_task_assignee(self, info: strawberry.types.Info, task_id: strawberry.ID, user_id: strawberry.ID) -> bool:
        return await sync_to_async(_add_assignee_sync, thread_sensitive=True)(info, task_id, user_id)

    @strawberry.mutation
    async def remove_task_assignee(self, info: strawberry.types.Info, task_id: strawberry.ID, user_id: strawberry.ID) -> bool:
        return await sync_to_async(_remove_assignee_sync, thread_sensitive=True)(info, task_id, user_id)

    @strawberry.mutation
    async def set_task_assignees(self, info: strawberry.types.Info, task_id: strawberry.ID, user_ids: list[strawberry.ID]) -> bool:
        return await sync_to_async(_set_assignees_sync, thread_sensitive=True)(info, task_id, user_ids)

    @strawberry.mutation
    async def create_comment(self, info: strawberry.types.Info, input: CreateCommentInput) -> CommentType:
        return await sync_to_async(_create_comment_sync, thread_sensitive=True)(info, input)

    @strawberry.mutation
    async def update_comment(self, info: strawberry.types.Info, input: UpdateCommentInput) -> CommentType:
        return await sync_to_async(_update_comment_sync, thread_sensitive=True)(info, input)

    @strawberry.mutation
    async def delete_comment(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        return await sync_to_async(_delete_comment_sync, thread_sensitive=True)(info, id)


def _create_task_sync(info: strawberry.types.Info, input: CreateTaskInput) -> TaskType:
    from django.db import transaction, IntegrityError
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    require_project_member(info, project_id=input.project_id)

    with transaction.atomic():
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
        # Retry loop to handle race conditions on code generation
        for _ in range(10):
            task.code = task.generate_code()
            try:
                task.save()
                break
            except IntegrityError as e:
                if "unique constraint" in str(e).lower() and "code" in str(e).lower():
                    # Code collision — retry with next available code
                    continue
                raise
        else:
            raise Exception("Не удалось сгенерировать уникальный код задачи. Попробуйте ещё раз.")

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
    changes = {}
    for field in strawberry.fields(UpdateTaskInput):
        value = getattr(input, field.name)
        if value is not strawberry.UNSET:
            changes[field.name] = value
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

    task_id_str = str(task.id)
    task_code = task.code
    project_id_str = str(task.project_id)
    task.delete()

    AuditLog.log(
        actor=info.context.request.user,
        action="task.delete",
        resource_type="task",
        resource_id=task_id_str,
        payload={"code": task_code, "project_id": project_id_str},
        request=info.context.request,
    )
    return True


def _add_assignee_sync(info: strawberry.types.Info, task_id: strawberry.ID, user_id: strawberry.ID) -> bool:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    task = Task.objects.select_related("project").get(pk=task_id)
    require_project_member(info, project_id=str(task.project_id))
    user = info.context.request.user
    TaskAssignment.objects.get_or_create(task=task, user_id=user_id)
    AuditLog.log(actor=user, action="task.add_assignee", resource_type="task", resource_id=str(task_id), payload={"user_id": str(user_id)}, request=info.context.request)
    return True


def _remove_assignee_sync(info: strawberry.types.Info, task_id: strawberry.ID, user_id: strawberry.ID) -> bool:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    task = Task.objects.select_related("project").get(pk=task_id)
    require_project_member(info, project_id=str(task.project_id))
    deleted, _ = TaskAssignment.objects.filter(task_id=task_id, user_id=user_id).delete()
    if deleted:
        AuditLog.log(actor=info.context.request.user, action="task.remove_assignee", resource_type="task", resource_id=str(task_id), payload={"user_id": str(user_id)}, request=info.context.request)
    return deleted > 0


def _set_assignees_sync(info: strawberry.types.Info, task_id: strawberry.ID, user_ids: list[strawberry.ID]) -> bool:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    task = Task.objects.select_related("project").get(pk=task_id)
    require_project_member(info, project_id=str(task.project_id))
    TaskAssignment.objects.filter(task=task).delete()
    for uid in user_ids:
        TaskAssignment.objects.create(task=task, user_id=uid)
    AuditLog.log(actor=info.context.request.user, action="task.set_assignees", resource_type="task", resource_id=str(task_id), payload={"user_ids": [str(u) for u in user_ids]}, request=info.context.request)
    return True


def _create_comment_sync(info: strawberry.types.Info, input: CreateCommentInput) -> CommentType:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    task = Task.objects.select_related("project").get(pk=input.task_id)
    require_project_member(info, project_id=str(task.project_id))
    comment = Comment(
        task=task,
        author=info.context.request.user,
        body=input.body,
    )
    comment.save()
    AuditLog.log(
        actor=info.context.request.user,
        action="comment.create",
        resource_type="comment",
        resource_id=str(comment.id),
        payload={"task_id": str(input.task_id), "number": comment.number},
        request=info.context.request,
    )
    return comment  # type: ignore[return-value]


def _delete_comment_sync(info: strawberry.types.Info, comment_id: strawberry.ID) -> bool:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    comment = Comment.objects.select_related("task__project").get(pk=comment_id)
    require_project_member(info, project_id=str(comment.task.project_id))
    task_id = str(comment.task_id)
    number = comment.number
    comment.delete()
    AuditLog.log(
        actor=info.context.request.user,
        action="comment.delete",
        resource_type="comment",
        resource_id=str(comment_id),
        payload={"task_id": task_id, "number": number},
        request=info.context.request,
    )
    return True


def _update_comment_sync(info: strawberry.types.Info, input: UpdateCommentInput) -> CommentType:
    from permissions.helpers import require_project_member
    from audit.models import AuditLog

    comment = Comment.objects.select_related("task__project").get(pk=input.id)
    require_project_member(info, project_id=str(comment.task.project_id))
    comment.body = input.body
    comment.save(update_fields=["body", "updated_at"])
    AuditLog.log(
        actor=info.context.request.user,
        action="comment.update",
        resource_type="comment",
        resource_id=str(comment.id),
        payload={"task_id": str(comment.task_id), "number": comment.number},
        request=info.context.request,
    )
    return comment  # type: ignore[return-value]