# Musa & Abdullah Acquisition Workspace

Next.js 16 CRM with Prisma ORM and PostgreSQL. The app requires a private account to view or edit the shared workspace.

## Run locally

1. Install packages with `npm install` (generates Prisma Client).
2. Set the server-only `DATABASE_URL` in `.env`, using `.env.example` as a guide. Existing process environment variables take precedence over `.env`. Next.js and the database scripts load this file automatically.
3. For a hosted database requiring a CA certificate, set `POSTGRES_CA_CERT` to its PEM file. The existing connection uses `prisma/certs/postgres-ca.crt`; Prisma verifies TLS using that certificate. For other PostgreSQL providers, supply their CA or configure TLS parameters directly in `DATABASE_URL`.
4. Run `npm run db:migrate` to initialize or upgrade the database.
5. Run `npm run dev`, then open http://localhost:3000.

The app uses private accounts stored in PostgreSQL. There is no public signup. Create accounts from the server with `npm run user:create`; reset a password with `npm run user:reset` (both commands prompt for passwords without echoing them). For a batch, pipe a JSON array of account objects (`name`, `email`, `password`) to `npm run user:seed`; existing accounts are updated and their sessions revoked. Keep that JSON in a secure runtime input, never in the repository. Passwords must be 8–128 characters. Each account shares the same CRM data and pipeline settings. Database credentials and password hashes stay on the server.

Write requests are checked against the request protocol and validated `Host` header, so the site address is detected automatically. The session cookie is HttpOnly, SameSite=Lax, and Secure in production.

## Features

- `/`: workspace home.
- `/crm`: Kanban/table views, pipeline and stage management, leads, search/platform filters, notes, stage history, follow-up tracking, and outreach playbook.
- `/warmup`: Facebook/Instagram daily warm-up quotas and a shared start date.

While `/crm` is open, each account sees its own in-app reminder when a lead stays in any one stage for more than 24 hours. The reminder repeats every 6 hours until the lead moves; reminders dismissed for one cycle return in the next cycle. Due reminders appear when you return to CRM. These are in-app only; there are no email or push notifications or background scheduler.

The browser calls Next.js `/api/*` routes, which query PostgreSQL through Prisma Client. Writes and history are transactional, and composite foreign keys prevent assigning a lead to a stage in another pipeline. Shared data refreshes every ten seconds while a tab is visible, on focus, and on reconnection. Leads require a valid email or Facebook/Instagram profile URL; canonical duplicate identities are rejected across every pipeline, including concurrent adds.

## Database migrations

`prisma/schema.prisma` is the application schema. `prisma/migrations/202610280001_postgresql/migration.sql` is the generated PostgreSQL baseline with additional domain constraints. `202610280002_auth_lead_identity/migration.sql` adds private accounts, sessions, lead attribution, and unique identity keys. `npm run db:migrate` applies unapplied versions in one transaction, records each checksum in `_crm_migrations`, and safely skips versions already applied. It backfills canonical lead identities and aborts without changes if existing records collide. Do not run `prisma db push` against the old schema.

When upgrading the previous workspace schema, the migration temporarily copies business tables, replaces them with the plain PostgreSQL schema, and restores all pipelines, stages, leads, and activity records with their IDs intact. It checks record counts before commit. It removes the application-owned workspace/invitation/membership tables and old functions, triggers, and row policies. Unknown dependencies abort the transaction. If multiple warm-up settings exist, the earliest start date becomes the single shared schedule. Provider-managed infrastructure schemas are left alone.

New databases receive the default eight-stage acquisition pipeline and a schedule starting today. These are seeded only during the initial migration, so deleting a pipeline does not cause it to reappear on refresh. The old `prisma/dev.db` SQLite file is preserved as an unused historical artifact; its records are not automatically imported.

## Main files

- `app/api/*`: validated Prisma-backed CRM and schedule endpoints.
- `lib/prisma.ts`, `lib/database-url.mjs`: shared Prisma Client and optional strict TLS configuration.
- `lib/lead-fields.ts`, `lib/api.ts`: input validation and consistent HTTP errors.
- `lib/use-sync-refresh.ts`: polling while visible.
- `lib/warmup-schedule.ts`: daily schedule content.
- `scripts/database-migration.mjs`, `scripts/migrate.mjs`: transactional database setup/upgrade.
- `prisma/certs/postgres-ca.crt`: public CA trust certificate for the current PostgreSQL host.

## Verification

- `npm test`: isolated PostgreSQL migration, preservation, constraints, and rollback tests; no live database required.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build` (generates Prisma Client if its schema changed).
- With the app running, set `TEST_BASE_URL=http://localhost:3000` and run `npm run test:api` for live CRUD/history checks. The suite creates temporary pipelines and removes them in cleanup.
- Run `npm run test:reminders` for the focused live reminder lifecycle check. It creates and removes only temporary accounts and a temporary pipeline.

Use `npm run db:generate` after editing the Prisma schema. On Windows, stop the dev server before regenerating a changed client because it can hold the engine DLL open. Builds skip generation when the client already matches the schema. Build generation does not migrate or query the database.
