"""Management command: create a daily PostgreSQL backup via pg_dump."""
from __future__ import annotations

import gzip
import hashlib
import os
import re
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import structlog
from django.core.management.base import BaseCommand

log = structlog.get_logger(__name__)

RETENTION_DAYS = 60


class Command(BaseCommand):
    help = "Create a gzipped pg_dump of the database with SHA256 checksum."

    def add_arguments(self, parser):  # type: ignore[override]
        parser.add_argument(
            "--backup-dir",
            default=os.environ.get("BACKUP_DIR", "/backups/ast3"),
            help="Directory to store backup files",
        )
        parser.add_argument(
            "--db-url",
            default=os.environ.get("DATABASE_URL", ""),
            help="Override database URL (postgres://user:pass@host:port/db)",
        )
        parser.add_argument(
            "--retention",
            type=int,
            default=None,
            help=f"Keep backups for N days (default: {RETENTION_DAYS})",
        )

    def handle(self, **options) -> None:  # type: ignore[override]
        backup_dir = Path(options["backup_dir"])
        retention = options["retention"] or RETENTION_DAYS
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        filename = f"backup-{timestamp}.tar.gz"
        dump_path = backup_dir / filename

        db_host, db_port, db_name, db_user, db_password = self._parse_db_url(
            options.get("db_url") or ""
        )

        env = os.environ.copy()
        if db_password:
            env["PGPASSWORD"] = db_password

        log.info("backup_started", path=str(dump_path))

        raw_sql = self._run_pg_dump(
            host=db_host,
            port=str(db_port),
            dbname=db_name,
            username=db_user,
            env=env,
        )

        compressed = gzip.compress(raw_sql.encode("utf-8"))
        dump_path.write_bytes(compressed)

        sha256 = hashlib.sha256(compressed).hexdigest()
        (backup_dir / f"{filename}.sha256").write_text(f"{sha256}  {filename}\n")

        size_mb = len(compressed) / (1024 * 1024)
        log.info("backup_completed", path=str(dump_path), size_mb=round(size_mb, 2), sha256=sha256)

        self._cleanup_old(backup_dir, retention)

    def _parse_db_url(self, override_url: str) -> tuple[str, int, str, str, str]:
        from django.conf import settings

        if override_url:
            url = override_url
        else:
            url = os.environ.get("DATABASE_URL", "")
            if not url and hasattr(settings, "DATABASES"):
                db_conf = settings.DATABASES.get("default", {})
                if db_conf:
                    return (
                        db_conf.get("HOST", "localhost"),
                        int(db_conf.get("PORT", 5432)),
                        db_conf.get("NAME", "ast3"),
                        db_conf.get("USER", "ast3"),
                        db_conf.get("PASSWORD", ""),
                    )

        match = re.match(
            r"postgres(?:ql)?://([^:]*):([^@]*)@([^:/]+):?(\d+)?/(.*)",
            url,
        )
        if match:
            return (
                match.group(3),
                int(match.group(4) or 5432),
                match.group(5),
                match.group(1),
                match.group(2),
            )
        return "localhost", 5432, "ast3", "ast3", ""

    def _run_pg_dump(
        self,
        host: str,
        port: str,
        dbname: str,
        username: str,
        env: dict,
    ) -> str:
        with tempfile.TemporaryFile(mode="w+") as stderr_file:
            proc = subprocess.run(
                [
                    "pg_dump",
                    "-h", host,
                    "-p", port,
                    "-U", username,
                    "-d", dbname,
                    "--no-owner",
                    "--no-acl",
                ],
                env=env,
                capture_output=True,
                text=True,
                timeout=600,
            )
            if proc.returncode != 0:
                err_msg = proc.stderr.strip() or "Unknown pg_dump error"
                log.error("pg_dump_failed", stderr=err_msg, returncode=proc.returncode)
                raise RuntimeError(f"pg_dump failed: {err_msg}")

        return proc.stdout

    def _cleanup_old(self, backup_dir: Path, retention_days: int) -> None:
        cutoff = datetime.now(UTC).timestamp() - (retention_days * 86400)
        for f in backup_dir.glob("backup-*.tar.gz"):
            if f.stat().st_mtime < cutoff:
                sha_file = backup_dir / f"{f.name}.sha256"
                f.unlink(missing_ok=True)
                sha_file.unlink(missing_ok=True)
                log.info("backup_removed", file=f.name)

        log.info("backup_cleanup_done", retention_days=retention_days)
