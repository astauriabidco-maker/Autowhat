#!/bin/sh
set -e

echo "🚀 [Startup] Synchronizing database schema (db push)..."
npx prisma db push --accept-data-loss

echo "🔐 [Startup] Seeding SuperAdmin..."
node scripts/seed-superadmin.js

echo "🧪 [Startup] Seeding Test Data (Acme Corp)..."
node scripts/seed-test-data.js

echo "🚀 [Startup] Starting application..."
node dist/app.js
