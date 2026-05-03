"""Time tracking models."""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeEntry(models.Model):
    TIMER = "timer"
    MANUAL = "manual"
    SOURCE_CHOICES = [(TIMER, "Timer"), (MANUAL, "Manual")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="time_entries"
    )
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.CASCADE, related_name="time_entries"
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    # duration in minutes; null = timer still running
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    source = models.CharField(max_length=8, choices=SOURCE_CHOICES, default=TIMER)
    description = models.CharField(max_length=512, blank=True)
    is_locked = models.BooleanField(default=False)  # locked after period closes
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_time"]

    def stop(self) -> None:
        """Stop the running timer and compute duration."""
        if self.end_time is not None:
            raise ValueError("Timer already stopped")
        self.end_time = timezone.now()
        delta = self.end_time - self.start_time
        self.duration_minutes = max(1, round(delta.total_seconds() / 60))
        self.save(update_fields=["end_time", "duration_minutes", "updated_at"])

    @property
    def duration_hours(self) -> Decimal | None:
        if self.duration_minutes is None:
            return None
        return Decimal(self.duration_minutes) / Decimal(60)

    def __str__(self) -> str:
        return f"{self.user} / {self.task.code} [{self.start_time:%Y-%m-%d}]"
