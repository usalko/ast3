"""Initial migration for integrations app."""
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
            name="IntegrationEndpoint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("type", models.CharField(choices=[("inbox_dir", "Inbox Directory"), ("outbox_dir", "Outbox Directory"), ("sftp", "SFTP")], default="inbox_dir", max_length=16)),
                ("path", models.CharField(max_length=1024)),
                ("schedule", models.CharField(blank=True, max_length=64)),
                ("mapping", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="integration_endpoints", to="accounts.user")),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="IntegrationJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("direction", models.CharField(choices=[("inbound", "Inbound"), ("outbound", "Outbound")], default="inbound", max_length=16)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("running", "Running"), ("success", "Success"), ("error", "Error")], default="pending", max_length=16)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("processed_files", models.PositiveIntegerField(default=0)),
                ("errors", models.JSONField(blank=True, default=list)),
                ("message", models.CharField(blank=True, max_length=512)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("endpoint", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="jobs", to="integrations.IntegrationEndpoint")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ScannedFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("original_name", models.CharField(max_length=255)),
                ("file", models.FileField(upload_to="scanned/%Y/%m/")),
                ("mime_type", models.CharField(max_length=128)),
                ("size_bytes", models.PositiveBigIntegerField()),
                ("is_scanned", models.BooleanField(default=False)),
                ("is_clean", models.BooleanField(blank=True, null=True)),
                ("scan_result", models.JSONField(blank=True, default=dict)),
                ("quarantined_at", models.DateTimeField(blank=True, null=True)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("uploaded_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="scanned_files", to="accounts.user")),
            ],
            options={
                "ordering": ["-uploaded_at"],
            },
        ),
    ]
