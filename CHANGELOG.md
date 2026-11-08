# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog begins with the localization + infrastructure roadmap. Changes
before it are not itemized here; see the git history and the
[implementation plan](https://github.com/abinauv/dental-erp).

## [Unreleased]

## [2.0.1] - 2026-11-08

### Fixed

- Clinics are no longer capped at 3 staff, 100 patients and 500 MB of
  storage. Clinic signup put every clinic on the hosted edition's FREE plan,
  whose caps a self-hosted install had no way to raise. New clinics are
  unlimited, and a migration lifts the caps on existing ones.

### Removed

- The public `/pricing` page, which listed hosted-edition plans that cannot be
  bought for a self-hosted install.

### Upgrading

- Apply the database migration `20261108120000_self_hosted_unlimited`
  (`npx prisma migrate deploy`; with Docker Compose, the `migrate` service runs
  it).

## [2.0.0] - 2026-11-08

### Added

- Internationalization across the client UI with `next-intl` and clinic-aware
  formatters; `en-IN`, `en-US`, and a full `de-DE` locale (German on core
  flows, English fallback elsewhere).
- Pluggable tax providers (`lib/tax`): India GST (CGST/SGST/IGST), EU VAT, and
  US sales tax, selected by country.
- Per-country seed data and geography (`prisma/seed-data/{IN,US,DE}`, region
  lists for address fields) and clinic-timezone-aware calendar sync.
- Staff Documents tab (uploads via the storage driver), an Add-Supplier form,
  billing-report Excel export, and an AI API-key status check.
- Outlook Calendar integration (Microsoft Graph), alongside Google Calendar.
- Background job queue (BullMQ) for email/SMS dispatch and communication
  triggers, with a zero-config inline fallback when `REDIS_URL` is unset.
- Single sign-on via OIDC, enabled by configuration (`OIDC_ISSUER`); no change
  to the credentials login when unset.
- Choice of AI provider via `AI_PROVIDER`: OpenRouter (default), Anthropic, or
  Amazon Bedrock.
- Structured JSON logging (pino) to stdout, replacing ad-hoc `console.*` in
  server code.
- Dependabot (npm + GitHub Actions) and a CodeQL analysis workflow.
- Community health files: Code of Conduct, this changelog, and `CODEOWNERS`.

### Changed

- **Node.js 24 LTS is now required to run the app** (the Docker image is built
  on `node:24-alpine`). Node 22.22.2+ still works for development.
- Authentication migrated from next-auth to Better Auth. Existing passwords are
  preserved (bcrypt); the mobile Bearer-token and patient-OTP paths are
  unchanged. Better Auth's own sign-up endpoints are disabled: accounts are
  only created by clinic signup, invitations, staff management and import.
- Dependency majors: date-fns 4, lucide-react 1, @hookform/resolvers 6, and
  (development) ESLint 10, TypeScript 7, Vite 8, Vitest 5, jsdom 30.

### Removed

- The subscription page. The self-hosted edition has no paid plans.

### Security

- Brute-force throttling on staff login and the mobile-token endpoint.
- Rate limiting on patient OTP send/verify, AI chat, public booking and the
  public payment endpoints; shared across instances via Redis when
  `REDIS_URL` is set.
- Payment gateway webhooks only settle successful payments; signed failure
  events (for example Razorpay `payment.failed`) are acknowledged and ignored.
- A gateway order can only settle the invoice it was created for, Razorpay
  payments must be captured or authorized, and gateway signatures are compared
  in constant time.
- Analytics report export (HTML) escapes all request and database text, and
  fetches its data in-process instead of from a host taken from the request.
- The video-room API only acts on the caller's own hospital's consultations.
- Staff Aadhaar/PAN numbers, salary, bank details, date of birth and home
  address are only returned to admins and to the staff member themselves.
- Deactivating a staff member, or resetting their password, ends their web
  sessions; mobile tokens stop working as soon as the user or their clinic is
  deactivated.
- Email address validation no longer backtracks quadratically on long input.
- nodemailer 10.1.4 (address-parser fixes).

### Upgrading

- Run on Node.js 24.
- Apply database migrations (`npx prisma migrate deploy`; with Docker Compose,
  the one-shot `migrate` service runs it): `20261027120000_add_invoice_tax_components`,
  `20261029120000_add_staff_document`, `20261029130000_add_better_auth` and
  `20261105120000_sync_credential_accounts`, in that order.
- No environment variable changes are required: Better Auth reuses
  `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.
- Web users are signed out once by the auth migration and sign in again with
  their existing password. Mobile app sessions are unaffected.

## [1.0.0]

- Initial feature-complete release: patient management, appointments, billing
  and GST invoicing, treatments, inventory, lab, CRM, communications, the
  patient portal, tele-dentistry, AI features, self-hosting (Docker, storage
  drivers, backups), and health/readiness probes.
