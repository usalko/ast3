#!/usr/bin/env bash
# ==============================================================
# restore.sh — Restore PostgreSQL from backup
# Usage: ./scripts/restore.sh <path/to/backup-YYYYMMDD-HHMMSS.tar.gz>
# ==============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_FILE="${1:?Usage: $0 <backup_file.tar.gz>}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

# Verify checksum
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ -f "$CHECKSUM_FILE" ]]; then
  echo "Verifying checksum..."
  sha256sum -c "$CHECKSUM_FILE"
else
  echo "WARNING: No checksum file found. Proceeding without verification." >&2
fi

# Load env
ENV_FILE="${ROOT_DIR}/infra/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

echo "Restoring from: $BACKUP_FILE"
echo "Target: ${POSTGRES_USER:-ast3}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-ast3}"
echo ""
read -rp "This will OVERWRITE the database. Continue? [y/N] " confirm
[[ "$confirm" == [yY] ]] || { echo "Aborted."; exit 1; }

# Drop and recreate
PGPASSWORD="${POSTGRES_PASSWORD:-ast3dev}" psql \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ast3}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB:-ast3}\"; CREATE DATABASE \"${POSTGRES_DB:-ast3}\" OWNER \"${POSTGRES_USER:-ast3}\";"

# Restore
zcat "$BACKUP_FILE" | PGPASSWORD="${POSTGRES_PASSWORD:-ast3dev}" psql \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ast3}" \
  "${POSTGRES_DB:-ast3}"

echo "Restore complete."
