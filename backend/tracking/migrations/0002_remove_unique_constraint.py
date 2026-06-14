"""Remove unique active timer constraint to allow parallel timers."""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tracking", "0001_initial"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="timeentry",
            name="unique_active_timer_per_user",
        ),
    ]
