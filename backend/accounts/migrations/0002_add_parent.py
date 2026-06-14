"""Add parent field to Department for tree_queries."""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="parent",
            field=models.ForeignKey(
                to="accounts.department",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="children",
                blank=True,
                null=True,
            ),
        ),
    ]
