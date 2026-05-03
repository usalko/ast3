#!/usr/bin/env bash
# ==============================================================
# generate-sbom.sh — Generate CycloneDX SBOM for backend + frontend
# Outputs: reports/sbom-backend.json, reports/sbom-frontend.json
# ==============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="${ROOT_DIR}/reports"
mkdir -p "$REPORT_DIR"

echo "==> Backend SBOM (CycloneDX)"
cd "${ROOT_DIR}/backend"
pip install cyclonedx-bom --quiet
cyclonedx-py poetry --output-format JSON > "${REPORT_DIR}/sbom-backend.json"
echo "    Written: reports/sbom-backend.json"

echo "==> Frontend SBOM (CycloneDX)"
cd "${ROOT_DIR}/client"
npx --yes @cyclonedx/cyclonedx-npm --output-format JSON --output-file "${REPORT_DIR}/sbom-frontend.json"
echo "    Written: reports/sbom-frontend.json"

echo "Done."
