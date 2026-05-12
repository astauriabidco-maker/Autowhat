#!/bin/sh
set -e

if [ -n "$PRISMA_RESOLVE_APPLIED_MIGRATION" ]; then
  echo "🛠️ [Startup] Resolving Prisma migration as applied: $PRISMA_RESOLVE_APPLIED_MIGRATION"
  RESOLVE_LOG="/tmp/prisma-migrate-resolve.log"
  if npx prisma migrate resolve --applied "$PRISMA_RESOLVE_APPLIED_MIGRATION" > "$RESOLVE_LOG" 2>&1; then
    cat "$RESOLVE_LOG"
  elif grep -Eq "P3008|already recorded as applied" "$RESOLVE_LOG"; then
    cat "$RESOLVE_LOG"
    echo "ℹ️ [Startup] Migration already recorded as applied; continuing."
  else
    cat "$RESOLVE_LOG"
    exit 1
  fi
fi

echo "🚀 [Startup] Applying database migrations..."
npx prisma migrate deploy

if [ -n "$SUPER_ADMIN_EMAIL" ] && [ -n "$SUPER_ADMIN_PASSWORD" ]; then
  echo "🔐 [Startup] Ensuring configured SuperAdmin exists..."
  node scripts/seed-superadmin.js
else
  echo "ℹ️ [Startup] SUPER_ADMIN_EMAIL/PASSWORD not set; skipping SuperAdmin seed."
fi

echo "🚀 [Startup] Starting application..."
node dist/app.js
