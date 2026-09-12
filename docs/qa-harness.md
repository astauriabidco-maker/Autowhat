# QA Harness

This project now has a minimal backend test harness and an API boot path that can be imported without starting the HTTP listener, cron jobs, or workers.

## Commands

- `npm run typecheck`: checks TypeScript without emitting files.
- `npm run prisma:validate`: validates `prisma/schema.prisma`.
- `npm test`: runs Vitest unit and API tests under `tests/**/*.test.ts`.
- `npm run verify`: runs typecheck, Prisma validation, tests, and the production TypeScript build.

## Current Scope

The first utility test covers signed upload URL helpers without requiring Postgres, Redis, cron workers, or external services.

The first Supertest API test covers `GET /api/health` through `createApp()`.

## Boot Shape

- `src/app.ts`: builds the Express app and exports `createApp()`.
- `src/server.ts`: starts jobs/workers, starts `app.listen()`, and handles shutdown signals.
- jobs/workers are skipped when `NODE_ENV=test` or `ENABLE_JOBS=false`.

## Next Step For API Tests

Add Supertest coverage for auth, tenant isolation, signed file access, and webhooks. Tests that touch Prisma should use a dedicated test database and seed minimal tenants.
