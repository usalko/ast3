"""Initial migration for tracking app."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("tasks", "0001_initial"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TimeEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_time", models.DateTimeField()),
                ("end_time", models.DateTimeField(blank=True, null=True)),
                ("duration_minutes", models.PositiveIntegerField(blank=True, null=True)),
                ("source", models.CharField(choices=[("timer", "Timer"), ("manual", "Manual")], default="timer", max_length=8)),
                ("description", models.CharField(blank=True, max_length=512)),
                ("is_locked", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="time_entries", to="tasks.task")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="time_entries", to="accounts.user")),
            ],
            options={
                "ordering": ["-start_time"],
            },
        ),
        migrations.AddConstraint(
            model_name="timeentry",
            constraint=models.UniqueConstraint(fields=("user",), condition=models.Q(end_time__isnull=True), name="unique_active_timer_per_user"),
        ),
    ]
