"""Initial migration for audit app."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(db_index=True, max_length=128)),
                ("resource_type", models.CharField(db_index=True, max_length=64)),
                ("resource_id", models.CharField(db_index=True, max_length=64)),
                ("payload", models.JSONField(default=dict)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.CharField(blank=True, max_length=512)),
                ("timestamp", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("previous_hash", models.CharField(blank=True, max_length=64)),
                ("entry_hash", models.CharField(blank=True, max_length=64)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="audit_logs", to="accounts.user")),
            ],
            options={
                "ordering": ["timestamp"],
            },
        ),
    ]
