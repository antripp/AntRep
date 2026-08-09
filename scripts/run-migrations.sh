#!/usr/bin/env bash
#
# Apply supabase/migrations/*.sql to the linked project, in order, via the
# Supabase Management API (the same endpoint the dashboard SQL editor uses).
#
# Reads SUPABASE_ACCESS_TOKEN from .env — a personal access token from
# https://supabase.com/dashboard/account/tokens. The token is never printed.
# Revoke it when you're done.
#
#   ./scripts/run-migrations.sh            # apply every migration, in order
#   ./scripts/run-migrations.sh 005 009    # only files starting 005 or 009
#
# Every migration is idempotent, so re-running an applied one is a no-op.
# Stops at the first failure and prints the SQL error.

set -euo pipefail
cd "$(dirname "$0")/.."

set -a; . ./.env; set +a

: "${SUPABASE_ACCESS_TOKEN:?Add SUPABASE_ACCESS_TOKEN=sbp_... to .env first}"
: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL missing from .env}"

# https://<ref>.supabase.co -> <ref>
REF=$(printf '%s' "$VITE_SUPABASE_URL" | sed -E 's#^https?://([^.]+)\..*#\1#')
API="https://api.supabase.com/v1/projects/$REF/database/query"
echo "Project: $REF"
echo

files=()
if [ $# -gt 0 ]; then
  for prefix in "$@"; do files+=(supabase/migrations/"$prefix"*.sql); done
else
  files=(supabase/migrations/*.sql)
fi

for file in "${files[@]}"; do
  name=$(basename "$file")
  printf '%-34s ' "$name"

  # Send the file as a JSON string; python does the escaping.
  body=$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$file")

  code=$(curl -sS -o /tmp/migrate-out.json -w '%{http_code}' -X POST "$API" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$body")

  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "ok"
  else
    echo "FAILED (HTTP $code)"
    echo
    python3 -c 'import json;d=json.load(open("/tmp/migrate-out.json"));print(d.get("message") or d)' \
      2>/dev/null || cat /tmp/migrate-out.json
    echo
    echo "Stopped at $name — nothing after it was applied."
    exit 1
  fi
done

echo
echo "All migrations applied."
