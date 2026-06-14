"""Initial migration for tasks app."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("projects", "0001_initial"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Task",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32, unique=True)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("type", models.CharField(choices=[("software", "Software"), ("hardware", "Hardware"), ("research", "Research"), ("bug", "Bug")], default="software", max_length=16)),
                ("priority", models.SmallIntegerField(choices=[(0, "Low"), (1, "Medium"), (2, "High"), (3, "Critical")], default=1)),
                ("progress", models.SmallIntegerField(default=0)),
                ("risk_level", models.SmallIntegerField(default=0)),
                ("board_order", models.FloatField(default=0.0)),
                ("planned_start", models.DateTimeField(blank=True, null=True)),
                ("planned_end", models.DateTimeField(blank=True, null=True)),
                ("actual_start", models.DateTimeField(blank=True, null=True)),
                ("actual_end", models.DateTimeField(blank=True, null=True)),
                ("estimated_hours", models.DecimalField(blank=True, decimal_places=2, max_digits=7, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assignee", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_tasks", to="accounts.user")),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subtasks", to="tasks.task")),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="tasks", to="projects.project")),
                ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="reported_tasks", to="accounts.user")),
            ],
            options={
                "ordering": ["board_order", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="TaskStatus",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=64)),
                ("code", models.SlugField(max_length=64)),
                ("color", models.CharField(default="#6B7280", max_length=7)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("is_done", models.BooleanField(default=False)),
                ("is_cancelled", models.BooleanField(default=False)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="statuses", to="projects.project")),
            ],
            options={
                "ordering": ["order"],
                "unique_together": {("project", "code")},
            },
        ),
        migrations.AddField(
            model_name="task",
            name="status",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="tasks", to="tasks.taskstatus"),
        ),
        migrations.CreateModel(
            name="TaskDependency",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("FS", "Finish->Start"), ("SS", "Start->Start"), ("FF", "Finish->Finish"), ("SF", "Start->Finish")], default="FS", max_length=2)),
                ("lag_hours", models.SmallIntegerField(default=0)),
                ("predecessor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="successors", to="tasks.task")),
                ("successor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="predecessors", to="tasks.task")),
            ],
            options={
                "unique_together": {("predecessor", "successor")},
            },
        ),
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="accounts.user")),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="tasks.task")),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.CreateModel(
            name="Attachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("original_name", models.CharField(max_length=255)),
                ("file", models.FileField(upload_to="attachments/%Y/%m/")),
                ("mime_type", models.CharField(max_length=128)),
                ("size_bytes", models.PositiveBigIntegerField()),
                ("is_scanned", models.BooleanField(default=False)),
                ("is_clean", models.BooleanField(blank=True, null=True)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="tasks.task")),
                ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="accounts.user")),
            ],
            options={
                "ordering": ["-uploaded_at"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="task",
            unique_together={("project", "code")},
        ),
    ]
