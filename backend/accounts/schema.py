"""GraphQL schema for accounts domain."""
from __future__ import annotations

import strawberry
import strawberry_django
from django.contrib.auth import authenticate
from django.core.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from strawberry import auto

from .models import Department, User

@strawberry.type
class _TaskInfo:
    id: strawberry.ID
    code: str
    title: str
    status_code: str


@strawberry.type
class _ProjectInfo:
    id: strawberry.ID
    code: str | None = None
    name: str


@strawberry_django.type(User)
class UserType:
    id: auto
    email: auto
    first_name: auto
    last_name: auto
    patronymic: auto
    position: auto
    is_active: auto
    full_name: str
    department: DepartmentType | None

    @strawberry.field
    def roles(self) -> list[str]:
        return list(self.role_assignments.values_list("role__code", flat=True))

    @strawberry.field
    def projects(self) -> list[_ProjectInfo]:
        from projects.models import Project
        return [
            _ProjectInfo(id=strawberry.ID(str(p.id)), code=p.code, name=p.name)
            for p in Project.objects.filter(memberships__user=self).exclude(status=Project.CANCELLED)
        ]

    @strawberry.field
    def tasks(self) -> list[_TaskInfo]:
        from tasks.models import Task, TaskAssignment
        task_ids = list(TaskAssignment.objects.filter(user=self).values_list("task_id", flat=True))
        return [
            _TaskInfo(
                id=strawberry.ID(str(t.id)),
                code=t.code,
                title=t.title,
                status_code=t.status.code,
            )
            for t in Task.objects.filter(
                id__in=task_ids,
            ).exclude(
                status__is_done=True,
            ).exclude(
                status__is_cancelled=True,
            ).select_related("status").order_by("-created_at")
        ]


@strawberry_django.type(Department)
class DepartmentType:
    id: auto
    name: auto
    code: auto
    description: auto
    is_active: auto
    parent: DepartmentType | None


@strawberry.type
class TokenPair:
    access: str
    refresh: str


@strawberry.type
class AccountsQuery:
    @strawberry.field
    def me(self, info: strawberry.types.Info) -> UserType | None:
        user = info.context.request.user
        if user.is_anonymous:
            return None
        return user  # type: ignore[return-value]

    @strawberry_django.field
    def users(self) -> list[UserType]:
        return User.objects.filter(is_active=True).select_related("department")

    @strawberry_django.field
    def departments(self) -> list[DepartmentType]:
        return Department.objects.filter(is_active=True)


@strawberry.type
class AccountsMutation:
    @strawberry.mutation
    def token_obtain_pair(self, email: str, password: str) -> TokenPair:
        user = authenticate(username=email, password=password)
        if not user:
            raise Exception("Invalid credentials")
        refresh = RefreshToken.for_user(user)
        return TokenPair(access=str(refresh.access_token), refresh=str(refresh))

    @strawberry.mutation
    def refresh_access_token(self, refresh: str) -> TokenPair:
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer

        serializer = TokenRefreshSerializer()
        data = serializer.validate({"refresh": refresh})
        return TokenPair(access=data["access"], refresh=data["refresh"])

    @strawberry.mutation
    def register(self, email: str, password: str, first_name: str, last_name: str, patronymic: str = "") -> UserType:
        from .models import Role, RoleAssignment
        from audit.models import AuditLog

        if User.objects.filter(email=email).exists():
            raise Exception("User with this email already exists")
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            is_active=True,
        )
        developer_role, _ = Role.objects.get_or_create(code="developer", defaults={"name": "Developer", "scope": Role.GLOBAL})
        RoleAssignment.objects.create(user=user, role=developer_role, department=None, project_id=None)
        AuditLog.log(
            actor=user,
            action="auth.register",
            resource_type="user",
            resource_id=str(user.id),
            payload={"email": user.email},
        )
        return user  # type: ignore[return-value]

    @strawberry.mutation
    def update_profile(self, info: strawberry.types.Info, first_name: str | None = None, last_name: str | None = None, patronymic: str | None = None, position: str | None = None) -> UserType:
        from audit.models import AuditLog

        user = info.context.request.user
        if user.is_anonymous:
            raise Exception("Not authenticated")
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        if patronymic is not None:
            user.patronymic = patronymic
        if position is not None:
            user.position = position
        user.save(update_fields=["first_name", "last_name", "patronymic", "position", "updated_at"])
        AuditLog.log(
            actor=user,
            action="auth.update_profile",
            resource_type="user",
            resource_id=str(user.id),
            payload={},
            request=info.context.request,
        )
        return user  # type: ignore[return-value]

    @strawberry.mutation
    def delete_user(self, info: strawberry.types.Info, user_id: strawberry.ID) -> bool:
        from audit.models import AuditLog
        from projects.models import Project
        from tasks.models import Task, Comment, Attachment
        from django.db import transaction

        caller = info.context.request.user
        if caller.is_anonymous:
            raise Exception("Not authenticated")
        if not caller.is_staff and str(caller.id) != str(user_id):
            raise Exception("Forbidden")
        user = User.objects.get(pk=user_id)

        with transaction.atomic():
            # Delete all tasks in projects created by user first (to allow project deletion)
            created_project_ids = list(Project.objects.filter(created_by=user).values_list("id", flat=True))
            Task.objects.filter(project_id__in=created_project_ids).delete()

            # Delete tasks where user is reporter (those not in user's projects)
            Task.objects.filter(reporter=user).delete()

            # Delete projects created by user
            Project.objects.filter(created_by=user).delete()

            # Delete comments and attachments authored/uploaded by user
            Comment.objects.filter(author=user).delete()
            Attachment.objects.filter(uploaded_by=user).delete()

            user.delete()

        AuditLog.log(
            actor=caller,
            action="auth.delete_user",
            resource_type="user",
            resource_id=str(user_id),
            payload={"email": user.email},
            request=info.context.request,
        )
        return True

    @strawberry.mutation
    def add_employee(self, info: strawberry.types.Info, first_name: str, last_name: str, email: str) -> UserType:
        from audit.models import AuditLog
        from .models import Role, RoleAssignment

        caller = info.context.request.user
        if caller.is_anonymous or not caller.is_staff:
            raise Exception("Forbidden")
        if User.objects.filter(email=email).exists():
            raise Exception("User with this email already exists")
        user = User.objects.create_user(
            email=email,
            password="ChangeMe123!",
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        developer_role, _ = Role.objects.get_or_create(code="developer", defaults={"name": "Developer", "scope": Role.GLOBAL})
        RoleAssignment.objects.create(user=user, role=developer_role, department=None, project_id=None)
        AuditLog.log(
            actor=caller,
            action="auth.add_employee",
            resource_type="user",
            resource_id=str(user.id),
            payload={"email": user.email, "first_name": first_name, "last_name": last_name},
            request=info.context.request,
        )
        return user  # type: ignore[return-value]

    @strawberry.mutation
    def update_employee(self, info: strawberry.types.Info, user_id: strawberry.ID, first_name: str, last_name: str | None = None) -> UserType:
        from audit.models import AuditLog

        caller = info.context.request.user
        if caller.is_anonymous or not caller.is_staff:
            raise Exception("Forbidden")
        user = User.objects.get(pk=user_id)
        user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        user.save(update_fields=["first_name", "updated_at"])
        AuditLog.log(
            actor=caller,
            action="auth.update_employee",
            resource_type="user",
            resource_id=str(user_id),
            payload={"first_name": first_name},
            request=info.context.request,
        )
        return user  # type: ignore[return-value]

    @strawberry.mutation
    def update_user(
        self,
        info: strawberry.types.Info,
        user_id: strawberry.ID,
        email: str | None = None,
        password: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        patronymic: str | None = None,
        department_id: strawberry.ID | None = None,
        position: str | None = None,
        is_active: bool | None = None,
        is_staff: bool | None = None,
        is_superuser: bool | None = None,
        role_codes: list[str] | None = None,
    ) -> UserType:
        from audit.models import AuditLog
        from .models import Department, Role, RoleAssignment

        caller = info.context.request.user
        if caller.is_anonymous or not caller.is_superuser:
            raise PermissionDenied("Superuser required")

        user = User.objects.get(pk=user_id)
        changed = []

        if email is not None and email != user.email:
            if User.objects.filter(email=email).exclude(pk=user_id).exists():
                raise Exception("Email already in use")
            user.email = email
            changed.append("email")
        if password is not None:
            user.set_password(password)
            changed.append("password")
        if first_name is not None:
            user.first_name = first_name
            changed.append("first_name")
        if last_name is not None and last_name != "":
            user.last_name = last_name
            changed.append("last_name")
        if patronymic is not None:
            user.patronymic = patronymic
            changed.append("patronymic")
        if position is not None:
            user.position = position
            changed.append("position")
        if is_active is not None:
            user.is_active = is_active
            changed.append("is_active")
        if is_staff is not None:
            user.is_staff = is_staff
            changed.append("is_staff")
        if is_superuser is not None:
            user.is_superuser = is_superuser
            changed.append("is_superuser")
        if department_id is not None:
            if department_id == "":
                user.department = None
            else:
                user.department = Department.objects.get(pk=department_id)
            changed.append("department")

        user.save()

        if role_codes is not None:
            RoleAssignment.objects.filter(user=user, department__isnull=True, project_id__isnull=True).delete()
            for code in role_codes:
                role = Role.objects.get(code=code)
                RoleAssignment.objects.create(user=user, role=role)
            changed.append("roles")

        AuditLog.log(
            actor=caller,
            action="auth.update_user",
            resource_type="user",
            resource_id=str(user_id),
            payload={"changed": changed},
            request=info.context.request,
        )
        return user  # type: ignore[return-value]