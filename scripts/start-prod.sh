#!/bin/sh
set -e

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
