#!/bin/bash
# Weekly Optimization Discovery Cron
# Runs every Tuesday at 06:23 UTC via Railway Cron Service
#
# Part of AINative's recursive optimization loop:
#   Measure → Discover → Validate → Implement → Measure again

set -euo pipefail

APP_URL="${APP_URL:-https://token-ops-production.up.railway.app}"
CRON_SECRET="${CRON_SECRET:-}"

echo "[$(date -u)] Starting weekly optimization discovery..."

# Call the discovery endpoint
RESPONSE=$(curl -sf \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/weekly-optimize" 2>&1) || {
  echo "[ERROR] Discovery endpoint failed: $RESPONSE"
  exit 1
}

echo "[$(date -u)] Discovery complete:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Extract key metrics
echo "$RESPONSE" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)['data']
  print(f'  Calls analyzed: {d[\"totalCalls\"]:,}')
  print(f'  Total cost: \${d[\"totalCost\"]:,.2f}')
  print(f'  Top savings: \${d[\"topSavings\"]:,.2f} ({d[\"topSavingsPct\"]:.1f}%)')
  print(f'  New patterns: {d[\"newPatterns\"]}')
  print(f'  Recommendations: {len(d[\"recommendations\"])}')
  for r in d['recommendations'][:5]:
    print(f'    → {r}')
except Exception as e:
  print(f'  Could not parse response: {e}')
" 2>/dev/null

echo "[$(date -u)] Done."
