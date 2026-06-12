"""Risk models."""
from __future__ import annotations

from django.conf import settings
from django.db import models


class Risk(models.Model):
    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3
    LEVEL_CHOICES = [(LOW, "Low"), (MEDIUM, "Medium"), (HIGH, "High"), (CRITICAL, "Critical")]

    AUTO = "auto"
    MANUAL = "manual"
    SOURCE_CHOICES = [(AUTO, "Auto-calculated"), (MANUAL, "Manual")]

    OPEN = "open"
    MITIGATED = "mitigated"
    ACCEPTED = "accepted"
    CLOSED = "closed"
    STATUS_CHOICES = [
        (OPEN, "Open"),
        (MITIGATED, "Mitigated"),
        (ACCEPTED, "Accepted"),
        (CLOSED, "Closed"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=8, choices=SOURCE_CHOICES, default=MANUAL)
    level = models.SmallIntegerField(choices=LEVEL_CHOICES, default=LOW)
    probability = models.SmallIntegerField(default=0)  # 0..100
    impact = models.SmallIntegerField(default=0)       # 0..100
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=OPEN)
    mitigation = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="owned_risks",
    )
    # Link to either project or task (at least one must be set)
    project = models.ForeignKey(
        "projects.Project", null=True, blank=True, on_delete=models.CASCADE, related_name="risks"
    )
    task = models.ForeignKey(
        "tasks.Task", null=True, blank=True, on_delete=models.CASCADE, related_name="risks"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-level", "-created_at"]

    def __str__(self) -> str:
        return f"[{self.get_level_display()}] {self.title}"
