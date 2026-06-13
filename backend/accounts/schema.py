"""GraphQL schema for accounts domain."""
from __future__ import annotations

import strawberry
import strawberry_django
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from strawberry import auto

from .models import Department, User


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
        token = RefreshToken(refresh)
        return TokenPair(access=str(token.access_token), refresh=str(token))

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
    def change_password(self, info: strawberry.types.Info, old_password: str, new_password: str) -> bool:
        from audit.models import AuditLog

        user = info.context.request.user
        if user.is_anonymous:
            raise Exception("Not authenticated")
        if not user.check_password(old_password):
            raise Exception("Invalid old password")
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        AuditLog.log(
            actor=user,
            action="auth.change_password",
            resource_type="user",
            resource_id=str(user.id),
            payload={},
            request=info.context.request,
        )
        return True
