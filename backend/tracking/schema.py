"""GraphQL schema for time tracking."""
from __future__ import annotations

import strawberry
import strawberry_django
from django.utils import timezone
from strawberry import auto

from .models import TimeEntry


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


@strawberry.type
class TrackingQuery:
    @strawberry_django.field
    def my_time_entries(self, info: strawberry.types.Info, task_id: strawberry.ID | None = None) -> list[TimeEntryType]:
        qs = TimeEntry.objects.filter(user=info.context.request.user)
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs


@strawberry.type
class TrackingMutation:
    @strawberry.mutation
    def start_timer(self, info: strawberry.types.Info, task_id: strawberry.ID) -> TimeEntryType:
        user = info.context.request.user
        # Invariant: only one active timer per user
        if TimeEntry.objects.filter(user=user, end_time__isnull=True).exists():
            raise ValueError("You already have an active timer. Stop it first.")
        entry = TimeEntry.objects.create(
            user=user,
            task_id=task_id,
            start_time=timezone.now(),
            source=TimeEntry.TIMER,
        )
        return entry  # type: ignore[return-value]

    @strawberry.mutation
    def stop_timer(self, info: strawberry.types.Info) -> TimeEntryType:
        user = info.context.request.user
        try:
            entry = TimeEntry.objects.get(user=user, end_time__isnull=True)
        except TimeEntry.DoesNotExist as exc:
            raise ValueError("No active timer found") from exc
        entry.stop()
        return entry  # type: ignore[return-value]

    @strawberry.mutation
    def create_manual_entry(
        self,
        info: strawberry.types.Info,
        task_id: strawberry.ID,
        start_time: strawberry.scalars.DateTime,
        end_time: strawberry.scalars.DateTime,
        description: str = "",
    ) -> TimeEntryType:
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
        return entry  # type: ignore[return-value]
