#!/bin/sh
set -e

echo "🚀 [Startup] Synchronizing database schema (db push)..."
npx prisma db push --accept-data-loss

echo "🔐 [Startup] Seeding SuperAdmin..."
node scripts/seed-superadmin.js

echo "🚀 [Startup] Starting application..."
node dist/app.js
