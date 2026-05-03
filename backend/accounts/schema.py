"""GraphQL schema for accounts domain."""
from __future__ import annotations

import strawberry
import strawberry_django
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
    department: "DepartmentType | None"


@strawberry_django.type(Department)
class DepartmentType:
    id: auto
    name: auto
    code: auto
    description: auto
    is_active: auto
    parent: "DepartmentType | None"


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
    def placeholder_accounts(self) -> bool:
        # Mutations: register, updateProfile, changePassword — implement per phase plan
        return True
