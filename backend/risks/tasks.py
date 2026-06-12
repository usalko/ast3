"""Celery task: auto-calculate risks for overdue / at-risk tasks."""
from __future__ import annotations

import structlog
from celery import shared_task
from django.utils import timezone

log = structlog.get_logger(__name__)
LOW_TIME_REMAINING_RATIO = 0.2
LOW_PROGRESS_THRESHOLD = 80


@shared_task(name="risks.calculate_auto_risks")
def calculate_auto_risks() -> dict:
    """Evaluate all active tasks and create/update auto Risk records."""
    from tasks.models import Task

    from .models import Risk

    now = timezone.now()
    updated = 0
    created = 0

    active_tasks = Task.objects.exclude(
        status__is_done=True
    ).exclude(
        status__is_cancelled=True
    ).select_related("status", "project").prefetch_related("time_entries")

    for task in active_tasks:
        level = Risk.LOW
        reason = ""

        if task.planned_end and task.planned_end < now:
            level = Risk.HIGH
            reason = "Task is overdue"
        elif task.planned_end:
            remaining = (task.planned_end - now).total_seconds()
            planned_duration = None
            if task.planned_start:
                planned_duration = (task.planned_end - task.planned_start).total_seconds()

            if planned_duration and planned_duration > 0:
                pct_left = remaining / planned_duration
                if pct_left < LOW_TIME_REMAINING_RATIO and task.progress < LOW_PROGRESS_THRESHOLD:
                    level = Risk.MEDIUM
                    reason = "Less than 20% time remaining but progress below 80%"

        # Over-budget check
        if task.estimated_hours:
            logged = sum(
                e.duration_minutes or 0 for e in task.time_entries.all()
            ) / 60
            if logged > float(task.estimated_hours) * 1.5:
                level = max(level, Risk.MEDIUM)
                reason = reason or "Logged time exceeds 150% of estimate"

        # Update task risk_level field
        if task.risk_level != level:
            Task.objects.filter(pk=task.pk).update(risk_level=level)

        if level > Risk.LOW:
            risk, is_new = Risk.objects.update_or_create(
                task=task,
                source=Risk.AUTO,
                defaults={
                    "title": reason,
                    "level": level,
                    "project": task.project,
                    "status": Risk.OPEN,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1

    log.info("auto_risks_calculated", created=created, updated=updated)
    return {"created": created, "updated": updated}
