#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   Run interactively:       ./secrets.sh
#   Pass values via env:     POSTGRES_USER=app POSTGRES_PASSWORD=secret ... ./secrets.sh
#
# The script is idempotent — safe to re-run to update any value.

prompt() {
  local var_name="$1"
  local description="$2"
  local default="${3:-}"

  if [ -n "${!var_name:-}" ]; then
    echo "  $var_name: (from environment)"
    return
  fi

  if [ -n "$default" ]; then
    read -rp "  $description [$default]: " input
    eval "$var_name=\"${input:-$default}\""
  else
    read -rsp "  $description: " input
    echo
    eval "$var_name=\"$input\""
  fi
}

echo "=== Kubernetes Secret: app-secrets ==="
echo ""
echo "Press Enter to keep the [default] value."
echo ""

prompt POSTGRES_USER     "Postgres username"          "app"
prompt POSTGRES_PASSWORD "Postgres password (hidden)"
prompt POSTGRES_DB       "Postgres database name"     "taxcalc"
prompt JWT_SECRET        "JWT signing secret (hidden)"
prompt GOOGLE_CLIENT_ID     "Google OAuth Client ID (leave blank to skip)" ""
prompt GOOGLE_CLIENT_SECRET "Google OAuth Client Secret (hidden, leave blank to skip)" ""

# Construct DATABASE_URL from postgres credentials
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable"
REDIS_URL="${REDIS_URL:-redis://redis:6379}"

echo ""
echo "Applying secret to cluster..."

kubectl create secret generic app-secrets \
  --from-literal=POSTGRES_USER="${POSTGRES_USER}" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=POSTGRES_DB="${POSTGRES_DB}" \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=REDIS_URL="${REDIS_URL}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
  --from-literal=GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "Secret 'app-secrets' applied successfully."
