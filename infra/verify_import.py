import sys
import os
sys.path.insert(0, "/app")
os.chdir("/app")
try:
    from accounts import migrations as acc_mig
    print("accounts.migrations import OK")
    from projects import migrations as proj_mig
    print("projects.migrations import OK")
    from tasks import migrations as task_mig
    print("tasks.migrations import OK")
    from tracking import migrations as track_mig
    print("tracking.migrations import OK")
    from risks import migrations as risk_mig
    print("risks.migrations import OK")
    from audit import migrations as audit_mig
    print("audit.migrations import OK")
    from integrations import migrations as int_mig
    print("integrations.migrations import OK")
except Exception as exc:
    print(f"FAIL: {exc}")
    sys.exit(1)
