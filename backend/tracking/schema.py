"""GraphQL schema for time tracking."""
from __future__ import annotations

import asyncio
import datetime
from concurrent.futures import ThreadPoolExecutor

import strawberry
import strawberry_django
from django.utils import timezone
from strawberry import auto

from accounts.schema import UserType
from tasks.schema import TaskType

from .models import TimeEntry

_executor = ThreadPoolExecutor(max_workers=8)

def _run_sync(func, *args):
    return _executor.submit(func, *args).result()


@strawberry_django.type(TimeEntry)
class TimeEntryType:
    id: auto
    start_time: auto
    end_time: auto
    duration_minutes: auto
    source: auto
    description: auto
    is_locked: auto
    created_at: auto
    user: UserType
    task: TaskType

    @strawberry.field
    def duration_hours(self, root: TimeEntry) -> float | None:
        return float(root.duration_minutes) / 60 if root.duration_minutes is not None else None


@strawberry.type
class TrackingQuery:
    @strawberry_django.field
    def my_time_entries(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID | None = None,
    ) -> list[TimeEntryType]:
        qs = TimeEntry.objects.filter(user=info.context.request.user)
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs.select_related("task", "user", "user__department")

    @strawberry_django.field
    def active_timer(self, info: strawberry.types.Info) -> TimeEntryType | None:
        return TimeEntry.objects.filter(
            user=info.context.request.user,
            end_time__isnull=True,
        ).select_related("task", "user", "user__department").first()

    @strawberry_django.field
    def time_entries(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID | None = None,
        project_id: strawberry.ID | None = None,
        user_id: strawberry.ID | None = None,
        include_all: bool = False,
    ) -> list[TimeEntryType]:
        qs = TimeEntry.objects.select_related(
            "task",
            "task__project",
            "task__status",
            "user",
            "user__department",
        ).order_by("-start_time")
        if task_id:
            qs = qs.filter(task_id=task_id)
        if project_id:
            qs = qs.filter(task__project_id=project_id)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if not include_all and task_id is None and project_id is None and user_id is None:
            qs = qs.filter(user=info.context.request.user)
        return qs


@strawberry.type
class TrackingMutation:
    @strawberry.mutation
    def start_timer(self, info: strawberry.types.Info, task_id: strawberry.ID) -> TimeEntryType:
        return _run_sync(_start_timer_sync, info, task_id)

    @strawberry.mutation
    def stop_timer(self, info: strawberry.types.Info) -> TimeEntryType:
        return _run_sync(_stop_timer_sync, info)

    @strawberry.mutation
    def create_manual_entry(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID,
        start_time: datetime.datetime,
        end_time: datetime.datetime,
        description: str = "",
    ) -> TimeEntryType:
        return _run_sync(
            _create_manual_entry_sync,
            info,
            task_id,
            start_time,
            end_time,
            description,
        )


def _start_timer_sync(info: strawberry.types.Info, task_id: strawberry.ID) -> TimeEntryType:
    user = info.context.request.user
    if TimeEntry.objects.filter(user=user, end_time__isnull=True).exists():
        raise ValueError("You already have an active timer. Stop it first.")
    return TimeEntry.objects.create(
        user=user,
        task_id=task_id,
        start_time=timezone.now(),
        source=TimeEntry.TIMER,
    )  # type: ignore[return-value]


def _stop_timer_sync(info: strawberry.types.Info) -> TimeEntryType:
    user = info.context.request.user
    try:
        entry = TimeEntry.objects.get(user=user, end_time__isnull=True)
    except TimeEntry.DoesNotExist as exc:
        raise ValueError("No active timer found") from exc
    entry.stop()
    return entry  # type: ignore[return-value]


def _create_manual_entry_sync(
    info: strawberry.types.Info,
    task_id: strawberry.ID,
    start_time: datetime.datetime,
    end_time: datetime.datetime,
    description: str,
) -> TimeEntryType:
    if end_time <= start_time:
        raise ValueError("end_time must be after start_time")
    user = info.context.request.user
    delta = end_time - start_time
    return TimeEntry.objects.create(
        user=user,
        task_id=task_id,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=max(1, round(delta.total_seconds() / 60)),
        source=TimeEntry.MANUAL,
        description=description,
    )  # type: ignore[return-value]

