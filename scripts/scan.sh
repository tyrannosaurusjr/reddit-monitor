#!/bin/bash
# Local scanner — runs from your Mac, writes to Turso
# Usage: bash scripts/scan.sh
# Or set up a cron: crontab -e → */30 * * * * cd /Users/mkultraman/Desktop/tyrannojr-github/reddit-monitor && bash scripts/scan.sh

cd "$(dirname "$0")/.."
source .env

echo "[$(date)] Starting scan..."
curl -s --max-time 120 -X POST "http://localhost:3002/api/posts/scan" \
  -H "Content-Type: application/json" \
  -d '{}' 2>&1

echo ""
echo "[$(date)] Scan complete"
