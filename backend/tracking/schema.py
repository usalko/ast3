"""GraphQL schema for tracking domain."""
from __future__ import annotations

import datetime

import strawberry
import strawberry_django
from strawberry import auto

from .models import TimeEntry

_TimeZone = datetime.timezone.utc


@strawberry_django.type(TimeEntry)
class TimeEntryType:
    id: strawberry.ID
    start_time: datetime.datetime
    end_time: datetime.datetime | None
    duration_minutes: int | None
    duration_hours: float | None
    source: str
    description: str | None
    is_locked: bool
    task_id: strawberry.ID | None

    @strawberry.field
    def task(self, root) -> TaskInfo | None:
        if not root.task_id:
            return None
        from tasks.models import Task
        try:
            t = Task.objects.only("id", "code", "title").get(pk=root.task_id)
            return TaskInfo(
                id=strawberry.ID(str(t.id)),
                code=t.code,
                title=t.title,
            )
        except Task.DoesNotExist:
            return None


@strawberry.type
class TaskInfo:
    id: strawberry.ID
    code: str | None
    title: str


@strawberry.type
class ActiveTimerType:
    id: strawberry.ID
    start_time: datetime.datetime
    duration_hours: float | None
    task: TaskInfo | None


@strawberry.type
class TrackingQuery:
    @strawberry.field
    def time_entries(
        self,
        task_id: strawberry.ID | None = None,
        project_id: strawberry.ID | None = None,
        user_id: strawberry.ID | None = None,
        include_all: bool = False,
    ) -> list[TimeEntryType]:
        qs = TimeEntry.objects.all()
        if task_id is not None:
            qs = qs.filter(task_id=task_id)
        if project_id is not None:
            qs = qs.filter(task__project_id=project_id)
        if user_id is not None:
            qs = qs.filter(user_id=user_id)
        if not include_all:
            request = getattr(self, "_request", None)
            user = getattr(request, "user", None)
            if user and user.is_authenticated:
                qs = qs.filter(user=user)
        return list(qs)

    @strawberry.field
    def my_time_entries(
        self,
        info: strawberry.types.Info,
    ) -> list[TimeEntryType]:
        user = info.context.request.user
        if not user.is_authenticated:
            return []
        return list(TimeEntry.objects.filter(user=user))

    @strawberry.field
    def active_timer(self, info: strawberry.types.Info) -> ActiveTimerType | None:
        user = info.context.request.user
        if not user.is_authenticated:
            return None
        entry = TimeEntry.objects.filter(user=user, end_time__isnull=True).select_related("task").first()
        if not entry:
            return None
        return ActiveTimerType(
            id=strawberry.ID(str(entry.id)),
            start_time=entry.start_time,
            duration_hours=entry.duration_hours,
            task=TaskInfo(id=strawberry.ID(str(entry.task.id)), code=entry.task.code, title=entry.task.title) if entry.task_id and entry.task else None,
        )

    @strawberry.field
    def active_timers(self, info: strawberry.types.Info) -> list[ActiveTimerType]:
        user = info.context.request.user
        if not user.is_authenticated:
            return []
        entries = TimeEntry.objects.filter(user=user, end_time__isnull=True).select_related("task").order_by("-start_time")
        return [
            ActiveTimerType(
                id=strawberry.ID(str(entry.id)),
                start_time=entry.start_time,
                duration_hours=entry.duration_hours,
                task=TaskInfo(id=strawberry.ID(str(entry.task.id)), code=entry.task.code, title=entry.task.title) if entry.task_id and entry.task else None,
            )
            for entry in entries
        ]


@strawberry.type
class TrackingMutation:
    @strawberry.mutation
    def start_timer(self, info: strawberry.types.Info, task_id: strawberry.ID) -> ActiveTimerType:
        return _run_sync(_start_timer_sync, info, task_id)

    @strawberry.mutation
    def stop_timer(self, info: strawberry.types.Info, id: strawberry.ID | None = None) -> TimeEntryType:
        return _run_sync(_stop_timer_sync, info, id)

    @strawberry.mutation
    def create_manual_entry(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID,
        start_time: datetime.datetime,
        end_time: datetime.datetime,
        description: str = "",
    ) -> TimeEntryType:
        return _run_sync(_create_manual_entry_sync, info, task_id, start_time, end_time, description)


_executor = __import__("concurrent.futures").futures.ThreadPoolExecutor(max_workers=8)


def _run_sync(func, *args):
    return _executor.submit(func, *args).result()


def _start_timer_sync(info: strawberry.types.Info, task_id: strawberry.ID) -> ActiveTimerType:
    from audit.models import AuditLog
    from django.db import IntegrityError
    from django.utils import timezone

    user = info.context.request.user
    existing = TimeEntry.objects.filter(user=user, end_time__isnull=True, task_id=task_id).first()
    if existing:
        task = existing.task
        AuditLog.log(
            actor=user,
            action="tracking.start_timer",
            resource_type="time_entry",
            resource_id=str(existing.id),
            payload={"task_id": str(task_id)},
            request=info.context.request,
        )
        return ActiveTimerType(
            id=strawberry.ID(str(existing.id)),
            start_time=existing.start_time,
            duration_hours=existing.duration_hours,
            task=TaskInfo(id=strawberry.ID(str(task.id)), code=task.code, title=task.title) if task else None,
        )
    try:
        entry = TimeEntry.objects.create(
            user=user,
            task_id=task_id,
            start_time=timezone.now(),
            source=TimeEntry.TIMER,
        )
    except IntegrityError:
        entry = TimeEntry.objects.filter(user=user, end_time__isnull=True, task_id=task_id).first()
        if not entry:
            raise
    entry = TimeEntry.objects.select_related("task").get(pk=entry.id)
    AuditLog.log(
        actor=user,
        action="tracking.start_timer",
        resource_type="time_entry",
        resource_id=str(entry.id),
        payload={"task_id": str(task_id)},
        request=info.context.request,
    )
    return ActiveTimerType(
        id=strawberry.ID(str(entry.id)),
        start_time=entry.start_time,
        duration_hours=entry.duration_hours,
        task=TaskInfo(id=strawberry.ID(str(entry.task.id)), code=entry.task.code, title=entry.task.title) if entry.task_id and entry.task else None,
    )


def _stop_timer_sync(info: strawberry.types.Info, timer_id: strawberry.ID | None = None) -> TimeEntryType:
    from audit.models import AuditLog

    user = info.context.request.user
    qs = TimeEntry.objects.filter(user=user, end_time__isnull=True)
    if timer_id is not None:
        qs = qs.filter(pk=timer_id)
    try:
        entry = qs.get()
    except TimeEntry.DoesNotExist as exc:
        raise ValueError("No active timer found") from exc
    entry.stop()
    AuditLog.log(
        actor=user,
        action="tracking.stop_timer",
        resource_type="time_entry",
        resource_id=str(entry.id),
        payload={"duration_minutes": entry.duration_minutes},
        request=info.context.request,
    )
    return TimeEntryType(
        id=strawberry.ID(str(entry.id)),
        start_time=entry.start_time,
        end_time=entry.end_time,
        duration_minutes=entry.duration_minutes,
        duration_hours=entry.duration_hours,
        source=entry.source,
        description=entry.description,
        is_locked=entry.is_locked,
        task_id=strawberry.ID(str(entry.task_id)) if entry.task_id else None,
    )


def _create_manual_entry_sync(
    info: strawberry.types.Info,
    task_id: strawberry.ID,
    start_time: datetime.datetime,
    end_time: datetime.datetime,
    description: str,
) -> TimeEntryType:
    from audit.models import AuditLog

    if end_time <= start_time:
        raise ValueError("end_time must be after start_time")
    user = info.context.request.user
    delta = end_time - start_time
    entry = TimeEntry.objects.create(
        user=user,
        task_id=task_id,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=max(1, round(delta.total_seconds() / 60)),
        source=TimeEntry.MANUAL,
        description=description,
    )
    AuditLog.log(
        actor=user,
        action="tracking.create_manual",
        resource_type="time_entry",
        resource_id=str(entry.id),
        payload={"task_id": str(task_id), "start_time": str(start_time), "end_time": str(end_time)},
        request=info.context.request,
    )
    return TimeEntryType(
        id=strawberry.ID(str(entry.id)),
        start_time=entry.start_time,
        end_time=entry.end_time,
        duration_minutes=entry.duration_minutes,
        duration_hours=entry.duration_hours,
        source=entry.source,
        description=entry.description,
        is_locked=entry.is_locked,
        task_id=strawberry.ID(str(entry.task_id)) if entry.task_id else None,
    )
