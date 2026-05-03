#!/usr/bin/env bash
# ==============================================================
# backup.sh — PostgreSQL base backup
# Usage: ./scripts/backup.sh [output_dir]
# ==============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
ENV_FILE="${ROOT_DIR}/infra/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

BACKUP_DIR="${1:-${BACKUP_DIR:-/backups/ast3}}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="backup-${TIMESTAMP}.tar.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"
DUMP_FILE="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date -Is)] $*" | tee -a "$LOG_FILE"; }

log "Starting backup → ${DUMP_FILE}"

# Dump via pg_dump (logical backup; works with Postgres Pro)
PGPASSWORD="${POSTGRES_PASSWORD:-ast3dev}" pg_dump \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ast3}" \
  "${POSTGRES_DB:-ast3}" \
  | gzip > "${DUMP_FILE}"

# Checksum
sha256sum "${DUMP_FILE}" > "${DUMP_FILE}.sha256"

log "Backup complete: ${DUMP_FILE} ($(du -sh "${DUMP_FILE}" | cut -f1))"

# Retention: keep last 7 daily + 4 weekly (simple implementation)
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +7 | while read -r old; do
  log "Removing old backup: $old"
  rm -f "$old" "$old.sha256"
done

log "Done."
