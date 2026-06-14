"""Domain models for tasks."""
from __future__ import annotations

from django.conf import settings
from django.db import models


class TaskStatus(models.Model):
    """Configurable workflow status per project."""

    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="statuses"
    )
    name = models.CharField(max_length=64)
    code = models.SlugField(max_length=64)
    color = models.CharField(max_length=7, default="#6B7280")  # hex
    order = models.PositiveSmallIntegerField(default=0)
    is_done = models.BooleanField(default=False)  # marks task as completed
    is_cancelled = models.BooleanField(default=False)

    class Meta:
        unique_together = [("project", "code")]
        ordering = ["order"]

    def __str__(self) -> str:
        return f"{self.project.code} / {self.name}"


class Task(models.Model):
    SOFTWARE = "software"
    HARDWARE = "hardware"
    RESEARCH = "research"
    BUG = "bug"
    TYPE_CHOICES = [
        (SOFTWARE, "Software"),
        (HARDWARE, "Hardware"),
        (RESEARCH, "Research"),
        (BUG, "Bug"),
    ]

    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3
    PRIORITY_CHOICES = [
        (LOW, "Low"),
        (MEDIUM, "Medium"),
        (HIGH, "High"),
        (CRITICAL, "Critical"),
    ]

    code = models.CharField(max_length=32, unique=True)
    project = models.ForeignKey(
        "projects.Project", on_delete=models.PROTECT, related_name="tasks"
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="subtasks"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default=SOFTWARE)
    status = models.ForeignKey(
        TaskStatus, on_delete=models.PROTECT, related_name="tasks"
    )
    priority = models.SmallIntegerField(choices=PRIORITY_CHOICES, default=MEDIUM)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_tasks",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reported_tasks",
    )
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    estimated_hours = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    progress = models.SmallIntegerField(default=0)  # 0..100
    risk_level = models.SmallIntegerField(default=0)  # computed by risks app
    board_order = models.FloatField(default=0.0)  # position within status column
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["board_order", "-created_at"]

    def __str__(self) -> str:
        return f"[{self.code}] {self.title}"

    def generate_code(self) -> str:
        """Generate sequential code like PRJ-001."""
        count = Task.objects.filter(project=self.project).count()
        return f"{self.project.code}-{count + 1:03d}"


class TaskDependency(models.Model):
    """Gantt dependency between tasks."""

    FS = "FS"  # Finish-to-Start (most common)
    SS = "SS"
    FF = "FF"
    SF = "SF"
    TYPE_CHOICES = [
        (FS, "Finish→Start"),
        (SS, "Start→Start"),
        (FF, "Finish→Finish"),
        (SF, "Start→Finish"),
    ]

    predecessor = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="successors")
    successor = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="predecessors")
    type = models.CharField(max_length=2, choices=TYPE_CHOICES, default=FS)
    lag_hours = models.SmallIntegerField(default=0)

    class Meta:
        unique_together = [("predecessor", "successor")]

    def __str__(self) -> str:
        return f"{self.predecessor.code} →{self.type}→ {self.successor.code}"


class Comment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]


class Attachment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to="attachments/%Y/%m/")
    mime_type = models.CharField(max_length=128)
    size_bytes = models.PositiveBigIntegerField()
    is_scanned = models.BooleanField(default=False)
    is_clean = models.BooleanField(null=True)  # None = not yet scanned
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]


class TaskAssignment(models.Model):
    """Many-to-many assignee relationship for a task."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="assignments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="task_assignments",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("task", "user")]

    def __str__(self) -> str:
        return f"{self.user} → {self.task.code}"
