#!/bin/bash
# Reddit scanner cron wrapper
# Runs local-scan.ts from your Mac every 30 min via launchd
# Logs to logs/scan.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
NODE_BIN="/Users/mkultraman/.nvm/versions/node/v24.13.1/bin"

export PATH="$NODE_BIN:$PATH"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> "$LOG_DIR/scan.log"
npx tsx scripts/local-scan.ts >> "$LOG_DIR/scan.log" 2>&1
echo "" >> "$LOG_DIR/scan.log"
