#!/usr/bin/env bash
# Deploy the GoSee dashboard to Vercel.
#
#   1. Run this ONCE after `npx vercel login` (it links + sets env vars + deploys).
#   2. Re-run any time to ship new changes.
#
# Reads the Supabase keys from dashboard/.env.local and uploads them to Vercel's
# Production environment, then builds and deploys.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../dashboard" && pwd)"
cd "$HERE"
echo "==> Dashboard folder: $HERE"

if [ ! -f .env.local ]; then
  echo "ERROR: dashboard/.env.local not found." >&2
  exit 1
fi

echo "==> Linking Vercel project (uses defaults, non-interactive)…"
npx vercel link --yes --project gosee-dashboard >/dev/null

# Push each key from .env.local to Vercel Production (idempotent).
push_env() {
  local name="$1" value="$2"
  [ -z "$value" ] && return 0
  # Remove any existing value first so re-runs update cleanly.
  npx vercel env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$name" production >/dev/null 2>&1 || true
  echo "    set $name"
}

echo "==> Uploading environment variables to Vercel…"
while IFS= read -r line; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  key="${line%%=*}"
  val="${line#*=}"
  case "$key" in
    NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)
      push_env "$key" "$val" ;;
  esac
done < .env.local

echo "==> Building and deploying to production…"
npx vercel --prod

echo ""
echo "==> Done. The https URL printed above is your live dashboard."
