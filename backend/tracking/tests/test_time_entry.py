"""Tests for time tracking invariants."""
import pytest
from django.utils import timezone

from tracking.models import TimeEntry


@pytest.mark.django_db
class TestTimerInvariant:
    def _make_project_and_task(self, user):
        from projects.models import Project, ProjectMembership
        from tasks.models import Task, TaskStatus

        dept = user.department
        proj = Project.objects.create(
            code="TST", name="Test Project", created_by=user, department=dept
        )
        status = TaskStatus.objects.create(
            project=proj, name="In Progress", code="in_progress", order=1
        )
        task = Task.objects.create(
            code="TST-001",
            project=proj,
            title="Task 1",
            status=status,
            reporter=user,
        )
        ProjectMembership.objects.create(project=proj, user=user, role="developer")
        return task

    def test_start_timer(self, user):
        task = self._make_project_and_task(user)
        entry = TimeEntry.objects.create(
            user=user, task=task, start_time=timezone.now(), source=TimeEntry.TIMER
        )
        assert entry.end_time is None

    def test_stop_timer(self, user):
        task = self._make_project_and_task(user)
        entry = TimeEntry.objects.create(
            user=user, task=task, start_time=timezone.now(), source=TimeEntry.TIMER
        )
        entry.stop()
        assert entry.end_time is not None
        assert entry.duration_minutes >= 1

    def test_double_stop_raises(self, user):
        task = self._make_project_and_task(user)
        entry = TimeEntry.objects.create(
            user=user, task=task, start_time=timezone.now(), source=TimeEntry.TIMER
        )
        entry.stop()
        with pytest.raises(ValueError, match="already stopped"):
            entry.stop()
