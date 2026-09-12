# Integration Tests With A Real Database

The default `npm test` suite stays unit/API-smoke only and does not touch a
database. The real database integration suite is opt-in because it truncates a
dedicated test database before each test.

## Local Setup

Create a local Postgres test database. One simple option:

```bash
docker run --name whatspoint-postgres-test \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=secret_test \
  -e POSTGRES_DB=whatsapp_hub_test \
  -p 55436:5432 \
  -d postgres:15-alpine
```

Create `.env.test` from `.env.test.example`, then run migrations against the
test database:

```bash
cp .env.test.example .env.test
DATABASE_URL="postgresql://admin:secret_test@localhost:55436/whatsapp_hub_test?schema=public" npx prisma migrate deploy
```

Run the suite:

```bash
npm run test:integration
```

## Current Coverage

- Manager auth login against Postgres and authenticated `/api/users/me`.
- Invalid manager credentials.
- Expired JWT and non-manager dashboard access rejection.
- Tenant isolation for employees and sites through API routes.
- Employee phone normalization, duplicate rejection, quota enforcement, and cross-tenant site assignment rejection.
- Site GPS update audit events.
- Attendance/GPS service behavior for strict sedentary check-in.
- Checkout rejection while GPS proof is pending.
- Manager attendance verdict decisions and decision-event audit trail.
- WhatsApp `/webhook` attendance flows with Meta signature verification, raw body handling, first activation, first interactive check-in, strict GPS proof, warning GPS proof, and checkout after approved GPS.
- Stripe webhook handler persistence for checkout, subscription, and invoice events.
- Stripe `/api/webhooks/stripe` route coverage with raw body handling, signature verification, and invalid-signature no-mutation behavior.

## CI

GitHub Actions runs the same suite on pushes to `main`, `master`, and
`develop`, and on every pull request. The backend job starts a Postgres
`15-alpine` service container, exports `DATABASE_URL_TEST`, applies migrations
with `npx prisma migrate deploy`, then runs:

```bash
npm run env:check
npm run typecheck
npm run prisma:validate
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

The frontend job runs `npm ci`, `npm run lint`, and `npm run build` from the
`client` directory.

## Safety Guard

The tests require `DATABASE_URL_TEST`. During setup, `DATABASE_URL_TEST` is
copied to `DATABASE_URL` before Prisma is imported. The helper refuses to reset
the database unless both variables match, which prevents accidental truncation
of the development or production database.
