"""Domain models: User, Department, Role, RoleAssignment."""
from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from tree_queries.models import TreeNode

from .managers import UserManager


class Department(TreeNode):
    """Hierarchical organisational unit (ltree-style via django-tree-queries)."""

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Department"
        verbose_name_plural = "Departments"

    def __str__(self) -> str:
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user model — email is the login identifier."""

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True)
    department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
    )
    position = models.CharField(max_length=255, blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    mfa_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects: UserManager = UserManager()

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return f"{self.first_name} <{self.email}>"

    @property
    def full_name(self) -> str:
        return self.first_name


class Role(models.Model):
    """System-wide role definition."""

    GLOBAL = "global"
    DEPARTMENT = "department"
    PROJECT = "project"
    SCOPE_CHOICES = [(GLOBAL, "Global"), (DEPARTMENT, "Department"), (PROJECT, "Project")]

    name = models.CharField(max_length=64, unique=True)
    code = models.SlugField(max_length=64, unique=True)
    scope = models.CharField(max_length=16, choices=SCOPE_CHOICES, default=GLOBAL)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class RoleAssignment(models.Model):
    """Assigns a Role to a User, optionally scoped to department or project."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="role_assignments")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="assignments")
    department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    # project FK added via projects app to avoid circular import
    project_id = models.BigIntegerField(null=True, blank=True)
    granted_by = models.ForeignKey(
        User,
        null=True,
        on_delete=models.SET_NULL,
        related_name="granted_role_assignments",
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("user", "role", "department", "project_id")]

    def __str__(self) -> str:
        return f"{self.user} → {self.role} (dept={self.department_id}, proj={self.project_id})"
