"""Domain models for projects."""
from __future__ import annotations

from django.conf import settings
from django.db import models


class Project(models.Model):
    SOFTWARE = "software"
    HARDWARE = "hardware"
    RESEARCH = "research"
    TYPE_CHOICES = [
        (SOFTWARE, "Software"),
        (HARDWARE, "Hardware / Manufacturing"),
        (RESEARCH, "Research"),
    ]

    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (ACTIVE, "Active"),
        (ON_HOLD, "On Hold"),
        (COMPLETED, "Completed"),
        (CANCELLED, "Cancelled"),
    ]

    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default=SOFTWARE)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=ACTIVE)
    department = models.ForeignKey(
        "accounts.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="projects",
    )
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="led_projects",
    )
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)
    budget_hours = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.code}] {self.name}"

    @property
    def progress(self) -> int:
        """Average progress of all non-cancelled tasks."""
        qs = self.tasks.exclude(status__code="cancelled").values_list("progress", flat=True)
        values = list(qs)
        if not values:
            return 0
        return round(sum(values) / len(values))


class ProjectMembership(models.Model):
    OWNER = "owner"
    MANAGER = "manager"
    DEVELOPER = "developer"
    VIEWER = "viewer"
    ROLE_CHOICES = [
        (OWNER, "Owner"),
        (MANAGER, "Manager"),
        (DEVELOPER, "Developer"),
        (VIEWER, "Viewer"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=DEVELOPER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("project", "user")]

    def __str__(self) -> str:
        return f"{self.user} → {self.project} ({self.role})"
