"""Initial migration for risks app."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("projects", "0001_initial"),
        ("tasks", "0001_initial"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Risk",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("source", models.CharField(choices=[("auto", "Auto-calculated"), ("manual", "Manual")], default="manual", max_length=8)),
                ("level", models.SmallIntegerField(choices=[(0, "Low"), (1, "Medium"), (2, "High"), (3, "Critical")], default=0)),
                ("probability", models.SmallIntegerField(default=0)),
                ("impact", models.SmallIntegerField(default=0)),
                ("status", models.CharField(choices=[("open", "Open"), ("mitigated", "Mitigated"), ("accepted", "Accepted"), ("closed", "Closed")], default="open", max_length=16)),
                ("mitigation", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="owned_risks", to="accounts.user")),
                ("project", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="risks", to="projects.project")),
                ("task", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="risks", to="tasks.task")),
            ],
            options={
                "ordering": ["-level", "-created_at"],
            },
        ),
    ]
