#!/usr/bin/env python
"""Seed the database with demo projects, users, statuses, tasks and timers."""
from __future__ import annotations

import os
from datetime import timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.dev")
django.setup()

from django.utils import timezone  # noqa: E402

from accounts.models import Department, User, Role, RoleAssignment  # noqa: E402
from projects.models import Project, ProjectMembership  # noqa: E402
from tasks.models import Task, TaskStatus  # noqa: E402
from tracking.models import TimeEntry  # noqa: E402

admin, _ = User.objects.get_or_create(
    email="admin@test.local",
    defaults={
        "first_name": "Admin",
        "last_name": "User",
        "patronymic": "",
        "is_staff": True,
        "is_superuser": True,
        "is_active": True,
    },
)
admin.set_password("admin123")
admin.save()

departments = {
    "DEV": ("Разработка ПО", "Разработка веб, мобильных и сервисных продуктов."),
    "MFG": ("Производство", "Производство и сборка экспериментальных изделий."),
    "OPS": ("Инфраструктура", "Эксплуатация, мониторинг и инфраструктура."),
}
department_by_code: dict[str, Department] = {}
for code, (name, description) in departments.items():
    department, _ = Department.objects.get_or_create(
        code=code,
        defaults={"name": name, "description": description, "is_active": True},
    )
    department_by_code[code] = department

if admin.department_id is None:
    admin.department = department_by_code["DEV"]
    admin.position = "Руководитель проектов"
    admin.save(update_fields=["department", "position", "updated_at"])

user_defs = [
    ("dev1", "Иван", "Петров", department_by_code["DEV"]),
    ("dev2", "Мария", "Сидорова", department_by_code["DEV"]),
    ("mfg1", "Алексей", "Кузнецов", department_by_code["MFG"]),
    ("ops1", "Елена", "Смирнова", department_by_code["OPS"]),
]
users: dict[str, User] = {}
for key, first, last, dept in user_defs:
    u, created = User.objects.get_or_create(
        email=f"{key}@test.local",
        defaults={"first_name": first, "last_name": last, "patronymic": "", "department": dept},
    )
    u.set_password("admin123")
    u.save()
    users[key] = u
 
roles = {
    "project_manager": Role.objects.get_or_create(code="project_manager", defaults={"name": "Project Manager", "scope": Role.GLOBAL})[0],
    "security_officer": Role.objects.get_or_create(code="security_officer", defaults={"name": "Security Officer", "scope": Role.GLOBAL})[0],
    "developer": Role.objects.get_or_create(code="developer", defaults={"name": "Developer", "scope": Role.GLOBAL})[0],
    "viewer": Role.objects.get_or_create(code="viewer", defaults={"name": "Viewer", "scope": Role.GLOBAL})[0],
    "admin": Role.objects.get_or_create(code="admin", defaults={"name": "Administrator", "scope": Role.GLOBAL})[0],
}

RoleAssignment.objects.get_or_create(user=admin, role=roles["admin"], defaults={"department": None, "project_id": None, "granted_by": admin})
RoleAssignment.objects.get_or_create(user=admin, role=roles["project_manager"], defaults={"department": None, "project_id": None, "granted_by": admin})

for user in users.values():
    RoleAssignment.objects.get_or_create(user=user, role=roles["developer"], defaults={"department": None, "project_id": None, "granted_by": admin})

STATUS_TEMPLATE = [
    ("backlog", "Backlog", "#6B7280", 0, False, False),
    ("todo", "To Do", "#3B82F6", 1, False, False),
    ("in_progress", "In Progress", "#F59E0B", 2, False, False),
    ("done", "Done", "#10B981", 3, True, False),
    ("cancelled", "Cancelled", "#EF4444", 4, False, True),
]

PROJECTS = [
    {
        "code": "WEB",
        "name": "Корпоративный веб-портал",
        "description": "Разработка корпоративного портала с личным кабинетом и отчётами.",
        "type": Project.SOFTWARE,
        "department": department_by_code["DEV"],
        "tasks": [
            ("Согласовать ТЗ", "Собрать требования и согласовать техническое задание.", "done", 100, 0, 8, "dev1"),
            ("Дизайн главной страницы", "Макеты в Figma для главной и личного кабинета.", "done", 100, 2, 16, "dev1"),
            ("Вёрстка лендинга", "Адаптивная вёрстка по утверждённым макетам.", "in_progress", 60, 1, 24, "dev1"),
            ("Авторизация по JWT", "Реализовать вход и обновление токенов.", "in_progress", 40, 3, 20, "dev1"),
            ("Настроить CI/CD", "Сборка, тесты и деплой через пайплайн.", "todo", 0, 7, 12, "ops1"),
            ("Страница отчётов", "Графики и выгрузка в Excel.", "backlog", 0, 14, 30, "dev2"),
        ],
    },
    {
        "code": "MOB",
        "name": "Мобильное приложение",
        "description": "Кроссплатформенное приложение для сотрудников на смене.",
        "type": Project.SOFTWARE,
        "department": department_by_code["DEV"],
        "tasks": [
            ("Исследование рынка", "Анализ конкурентов и пользовательских сценариев.", "done", 100, 0, 10, "dev1"),
            ("Прототип навигации", "Кликабельный прототип основных экранов.", "in_progress", 50, 2, 18, "dev2"),
            ("Push-уведомления", "Интеграция с сервисом уведомлений.", "todo", 0, 5, 14, "dev1"),
            ("Оффлайн-режим", "Кэширование данных и синхронизация.", "backlog", 0, 12, 26, "dev2"),
        ],
    },
    {
        "code": "INFRA",
        "name": "Модернизация инфраструктуры",
        "description": "Перенос сервисов в контейнеры и настройка мониторинга.",
        "type": Project.SOFTWARE,
        "department": department_by_code["OPS"],
        "tasks": [
            ("Аудит серверов", "Инвентаризация и оценка нагрузки.", "done", 100, 0, 12, "ops1"),
            ("Контейнеризация сервисов", "Docker-образы для всех сервисов.", "in_progress", 70, 1, 20, "ops1"),
            ("Настроить Prometheus/Grafana", "Метрики и дашборды.", "in_progress", 30, 4, 16, "ops1"),
            ("Резервное копирование", "Регулярные бэкапы и проверка восстановления.", "todo", 0, 9, 10, "ops1"),
            ("Документация по эксплуатации", "Runbook и инструкции дежурной смены.", "backlog", 0, 16, 8, "ops1"),
        ],
    },
    {
        "code": "EXP",
        "name": "Производство экспериментального изделия",
        "description": "Подготовка, сборка и испытания экспериментального аппаратного изделия.",
        "type": Project.HARDWARE,
        "department": department_by_code["MFG"],
        "tasks": [
            ("Закупить комплектующие", "Проверить спецификацию и оформить закупку.", "done", 100, 0, 6, "mfg1"),
            ("Изготовить корпус", "Подготовить корпус по утверждённым чертежам.", "in_progress", 65, 2, 18, "mfg1"),
            ("Собрать макет", "Собрать первый рабочий макет изделия.", "todo", 0, 6, 24, "mfg1"),
            ("Провести испытания", "Проверить механику, питание и базовые функции.", "todo", 0, 10, 16, "mfg1"),
            ("Подготовить отчёт", "Оформить результаты испытаний и замечания.", "backlog", 0, 14, 10, "mfg1"),
        ],
    },
]

created_projects = 0
created_tasks = 0
created_entries = 0

for spec in PROJECTS:
    project, was_created = Project.objects.get_or_create(
        code=spec["code"],
        defaults={
            "name": spec["name"],
            "description": spec["description"],
            "type": spec["type"],
            "status": Project.ACTIVE,
            "department": spec["department"],
            "lead": admin,
            "created_by": admin,
            "planned_start": (timezone.now() - timedelta(days=10)).date(),
            "planned_end": (timezone.now() + timedelta(days=45)).date(),
        },
    )
    if was_created:
        created_projects += 1

    ProjectMembership.objects.get_or_create(
        project=project,
        user=admin,
        defaults={"role": ProjectMembership.OWNER},
    )

    statuses: dict[str, TaskStatus] = {}
    for code, name, color, order, is_done, is_cancelled in STATUS_TEMPLATE:
        status, _ = TaskStatus.objects.get_or_create(
            project=project,
            code=code,
            defaults={
                "name": name,
                "color": color,
                "order": order,
                "is_done": is_done,
                "is_cancelled": is_cancelled,
            },
        )
        statuses[code] = status

    for user in [admin, *users.values()]:
        ProjectMembership.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": ProjectMembership.DEVELOPER},
        )

    if not project.tasks.exists():
        for idx, (title, description, status_code, progress, start_offset, duration, user_key) in enumerate(spec["tasks"], start=1):
            status = statuses[status_code]
            assignee = users[user_key]
            planned_start = timezone.now() + timedelta(days=start_offset)
            planned_end = planned_start + timedelta(days=duration)
            task = Task(
                project=project,
                title=title,
                description=description,
                type=Task.HARDWARE if project.type == Project.HARDWARE else Task.SOFTWARE,
                status=status,
                priority=(idx % 4),
                reporter=admin,
                assignee=assignee,
                planned_start=planned_start,
                planned_end=planned_end,
                estimated_hours=duration,
                progress=progress,
                board_order=float(idx),
            )
            task.code = f"{project.code}-{idx:03d}"
            task.save()
            created_tasks += 1

    for task in project.tasks.all().order_by("id"):
        if task.time_entries.exists():
            continue
        logged_hours = max(1, round((task.progress / 100) * float(task.estimated_hours or 1)))
        TimeEntry.objects.create(
            user=task.assignee or admin,
            task=task,
            start_time=timezone.now() - timedelta(hours=logged_hours + 2),
            end_time=timezone.now() - timedelta(hours=2),
            duration_minutes=logged_hours * 60,
            source=TimeEntry.MANUAL,
            description="Демо-учёт времени",
        )
        created_entries += 1
    print(f"+ Project {project.code}: tasks={project.tasks.count()} progress={project.progress}%")

print(f"\nDone. Created {created_projects} new project(s), {created_tasks} task(s), {created_entries} time entry/entries.")
