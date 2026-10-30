# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog begins with the localization + infrastructure roadmap. Changes
before it are not itemized here; see the git history and the
[implementation plan](https://github.com/abinauv/dental-erp).

## [Unreleased]

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
- Structured JSON logging (pino) to stdout, replacing ad-hoc `console.*` in
  server code.
- Dependabot (npm + GitHub Actions) and a CodeQL analysis workflow.
- Community health files: Code of Conduct, this changelog, and `CODEOWNERS`.

### Changed

- Authentication migrated from next-auth to Better Auth. Existing passwords are
  preserved (bcrypt); the mobile Bearer-token and patient-OTP paths are
  unchanged.

### Security

- Brute-force throttling on staff login and the mobile-token endpoint.

## [1.0.0]

- Initial feature-complete release: patient management, appointments, billing
  and GST invoicing, treatments, inventory, lab, CRM, communications, the
  patient portal, tele-dentistry, AI features, self-hosting (Docker, storage
  drivers, backups), and health/readiness probes.
