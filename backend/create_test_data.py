#!/usr/bin/env python
"""Create superuser and test data."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.dev')
django.setup()

from accounts.models import User
from projects.models import Project
from tasks.models import TaskStatus

# Создать суперпользователя
admin, created = User.objects.get_or_create(
    email='admin@test.local',
    defaults={
        'first_name': 'Admin',
        'last_name': 'User',
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
    }
)
if created:
admin.set_password('admin')
    admin.save()
    print('✓ Superuser admin@test.local/admin created')
    print('✓ Superuser already exists')

# Создать проект для тестирования
project, created = Project.objects.get_or_create(
    code='TEST',
    defaults={
        'name': 'Test Project',
        'description': 'Project for testing task creation',
        'lead': admin,
        'created_by': admin,
        'status': 'active',
    }
)
if created:
    print(f'✓ Project TEST created (id={project.id})')
else:
    print(f'✓ Project TEST already exists (id={project.id})')

# Создать статусы для проекта (если их нет)
statuses = [
    ('backlog', 'Backlog', 0),
    ('todo', 'To Do', 1),
    ('in_progress', 'In Progress', 2),
    ('done', 'Done', 3),
]
for code, name, order in statuses:
    status, created = TaskStatus.objects.get_or_create(
        project=project,
        code=code,
        defaults={'name': name, 'order': order, 'is_done': (code == 'done')}
    )
    if created:
        print(f'  ✓ Status {name} created (id={status.id})')

todo_status = TaskStatus.objects.get(project=project, code="todo")
print(f'\nReady to test! Use:')
print(f'  Email: admin@test.local')
print(f'  Password: admin')
print(f'  Project ID: {project.id}')
print(f'  Status ID (To Do): {todo_status.id}')
