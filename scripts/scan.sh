#!/bin/bash
# Local scanner — runs from your Mac, writes to Turso
# Usage: bash scripts/scan.sh
# Or set up a cron: crontab -e → */30 * * * * cd /absolute/path/to/reddit-monitor && bash scripts/scan.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"
source .env

BASE_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}"

echo "[$(date)] Starting scan..."
curl -s --max-time 120 -X POST "${BASE_URL%/}/api/cron/poll" \
  -H "Authorization: Bearer ${CRON_SECRET}" 2>&1

echo ""
echo "[$(date)] Scan complete"
