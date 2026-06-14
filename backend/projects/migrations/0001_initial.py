"""Initial migration for projects app."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=16, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("type", models.CharField(choices=[("software", "Software"), ("hardware", "Hardware / Manufacturing"), ("research", "Research")], default="software", max_length=16)),
                ("status", models.CharField(choices=[("active", "Active"), ("on_hold", "On Hold"), ("completed", "Completed"), ("cancelled", "Cancelled")], default="active", max_length=16)),
                ("planned_start", models.DateField(blank=True, null=True)),
                ("planned_end", models.DateField(blank=True, null=True)),
                ("actual_start", models.DateField(blank=True, null=True)),
                ("actual_end", models.DateField(blank=True, null=True)),
                ("budget_hours", models.DecimalField(blank=True, decimal_places=2, max_digits=9, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_projects", to="accounts.user")),
                ("department", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="projects", to="accounts.department")),
                ("lead", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="led_projects", to="accounts.user")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ProjectMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("owner", "Owner"), ("manager", "Manager"), ("developer", "Developer"), ("viewer", "Viewer")], default="developer", max_length=16)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="projects.project")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="project_memberships", to="accounts.user")),
            ],
            options={
                "unique_together": {("project", "user")},
            },
        ),
    ]
