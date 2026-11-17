# Developing DentalERP

How to run DentalERP from source, work on it and test it. To run it for a
clinic, use the published image instead: see [SELF_HOSTING.md](../SELF_HOSTING.md).

## Prerequisites

- **Node.js** 24 LTS (22.22.2 or later also works)
- **npm** 11
- **Docker** with Compose v2: recommended for the backing services, but
  [optional](#without-docker)

## Getting started

```bash
git clone https://github.com/abinauv/dental-erp.git
cd dental-erp
npm install
cp .env.example .env

# Start MySQL, Redis, MinIO and Mailpit
docker compose -f docker-compose.dev.yml up -d

# Set DATABASE_URL in .env to match the container:
#   DATABASE_URL="mysql://root:dental@localhost:3306/dental_erp"

npx prisma migrate deploy   # create the schema
npx prisma db seed          # demo clinic and data (optional)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the demo
account below.

You still need to fill in `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` and `CRON_SECRET`
in `.env`; the app will not start without them. Each one has a
`node -e "..."` command beside it in `.env.example` that prints a valid value.

**The app runs on your machine, not in Docker.** Compose brings up the backing
services only. Bind-mounting `node_modules` into a container is slow enough on
Windows and macOS to spoil the edit-reload loop, and native hot reload is
better. `docker-compose.dev.yml` is a convenience for contributors and is
**never** suitable for production: every credential in it is weak and public.

### Demo account (after seeding)

| Role  | Email                   | Password    |
| ----- | ----------------------- | ----------- |
| Admin | `admin@demo-dental.com` | `Admin@123` |

The seed also creates a doctor (`doctor@demo-dental.com` / `Doctor@123`) and a
receptionist. Never seed a production database.

## What Compose gives you

| Service | Port       | What it is for                                                      |
| ------- | ---------- | ------------------------------------------------------------------- |
| MySQL   | 3306       | The application database                                            |
| Redis   | 6379       | Optional: set `REDIS_URL` to back the job queue and rate limiter    |
| MinIO   | 9000, 9001 | S3-compatible storage for the `s3` storage driver. Console on 9001  |
| Mailpit | 1025, 8025 | Captures every outbound email. Read them at <http://localhost:8025> |

Mailpit is the useful one right away. Point the `SMTP_*` variables at it (the
values are commented into `.env.example`) and you can exercise password resets,
invitations and reminders with no credentials and no risk of emailing a real
person.

`createbuckets` runs once, creates the MinIO bucket and exits. Seeing it as
`Exited (0)` in `docker compose ps` is success, not a failure.

```bash
docker compose -f docker-compose.dev.yml logs -f      # tail the services
docker compose -f docker-compose.dev.yml down         # stop, keep the data
docker compose -f docker-compose.dev.yml down -v      # stop and wipe the data
```

**Port 3306 already in use?** You have MySQL installed locally. Either stop it,
or change the host port in `docker-compose.dev.yml` to `'3307:3306'` and update
`DATABASE_URL` to match.

<details>
<summary>Running this stack since before August 2026?</summary>

Its compose project was renamed from `dental-erp` to `dental-erp-dev`, so that
a production stack on the same machine cannot end up sharing volumes with it.
Your old containers and volumes are still there under the previous name; clean
them up once with:

```bash
docker compose -p dental-erp -f docker-compose.dev.yml down -v
```

</details>

### Without Docker

Docker is not a requirement. With MySQL 8.0+ installed locally:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS dental_erp"
```

Then set `DATABASE_URL` in `.env` to your own credentials and continue from
`npx prisma migrate deploy` above.

## The database

`prisma migrate deploy` is the recommended path: it is repeatable and safe to
re-run when you upgrade. `npx prisma db push` also works and is handy while
developing, but it applies the schema without recording it in
`_prisma_migrations`, so later `migrate deploy` runs fail against that database.

<details>
<summary>Upgrading a database that was created with <code>prisma db push</code></summary>

Tell Prisma the existing migrations are already reflected in your schema, then
deploy as normal from that point on:

```bash
npx prisma migrate resolve --applied 20260127152236_multi_tenancy
npx prisma migrate resolve --applied 20260728120000_sync_schema_with_models
npx prisma migrate resolve --applied 20260801150000_inventory_lab_prisma_models
npx prisma migrate deploy
```

</details>

## Scripts

```bash
npm run dev                # development server
npm run build              # production build
npm run start              # serve the production build
npm run lint               # ESLint
npm run typecheck          # TypeScript
npm run test               # unit, API and component tests (Vitest)
npm run test:watch         # the same, in watch mode
npm run test:coverage      # with a coverage report
npm run test:e2e           # end-to-end tests (Playwright, needs a running app)
npm run worker             # the background job worker (only with REDIS_URL)

npm run db:generate        # generate the Prisma client
npm run db:migrate         # create a migration from schema changes
npm run db:migrate:deploy  # apply pending migrations
npm run db:push            # push the schema without a migration (dev only)
npm run db:seed            # seed the demo clinic
npm run db:studio          # Prisma Studio
```

## Project layout

```
dental-erp/
├── app/
│   ├── (auth)/          # sign-in, sign-up, password reset, invitations
│   ├── (dashboard)/     # the staff app, one folder per module
│   ├── portal/          # the patient portal
│   ├── pay/             # public payment links
│   └── api/             # API routes
├── components/          # React components (ui/ is shadcn/ui)
├── lib/
│   ├── ai/              # AI providers and skills
│   ├── i18n/            # locales, formatting, API message translation
│   ├── services/        # email, SMS, the scheduled-message outbox
│   ├── payment-gateways/
│   ├── tax/             # India GST, EU VAT, US sales tax
│   └── queue/           # optional BullMQ job queue
├── messages/            # UI translations (messages/api/: API errors)
├── prisma/              # schema, migrations, seed and per-country seed data
├── tests/               # Vitest (unit, api, components, …) and Playwright (e2e)
└── docs/                # guides like this one
```

## Testing

- **Unit, API and component tests** run with Vitest and Testing Library; API
  route handlers run against a mocked Prisma client.
- **End-to-end tests** run with Playwright against a running app.
- **Accessibility tests** check pages with axe-core.

```bash
npm test                 # everything Vitest runs
npm run test:coverage
npm run test:e2e         # start the app first
```

On Windows, run Vitest from PowerShell or cmd: in Git Bash it fails to find
the test suites because of a path-casing quirk. The pre-push hook runs the
tests, so push from PowerShell too.

## Conventions

- [CONTRIBUTING.md](../CONTRIBUTING.md): branches, commits and pull requests.
- [docs/LOCALIZATION.md](LOCALIZATION.md): adding UI text and API messages in
  every language.
- [docs/STORAGE.md](STORAGE.md): the local and S3 storage drivers.
