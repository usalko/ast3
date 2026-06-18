from tasks.models import Task, TaskAssignment
from accounts.models import User
import random

all_tasks = list(Task.objects.filter(project_id__isnull=False))
random.shuffle(all_tasks)
for t in all_tasks[:6]:
    assigns = list(TaskAssignment.objects.filter(task=t).select_related("user"))
    info = []
    for a in assigns:
        u = a.user
        info.append((u.position or "", u.first_name, u.last_name, u.email))
    print(f"Task {t.id}: {t.title[:25]:25s} -> {len(assigns)} asgns: {info}")
