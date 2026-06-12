"""conftest.py — shared pytest fixtures."""
import pytest
from django.test import RequestFactory

from accounts.models import Department, Role, User


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def department(db):
    _ = db
    return Department.objects.create(name="Engineering", code="ENG")


@pytest.fixture
def user(db, department):
    _ = db
    return User.objects.create_user(
        email="dev@ast3.internal",
        password="TestPass123!",
        first_name="Test",
        last_name="User",
        department=department,
    )


@pytest.fixture
def admin_user(db):
    _ = db
    return User.objects.create_superuser(
        email="admin@ast3.internal",
        password="AdminPass123!",
        first_name="Admin",
        last_name="User",
    )


@pytest.fixture
def project_manager_role(db):
    _ = db
    return Role.objects.create(name="Project Manager", code="project_manager", scope=Role.GLOBAL)


@pytest.fixture
def security_officer_role(db):
    _ = db
    return Role.objects.create(name="Security Officer", code="security_officer", scope=Role.GLOBAL)
