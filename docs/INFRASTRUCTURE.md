# Infrastructure Roadmap

How DentalERP is packaged, deployed and run — where it is today, and where it is going.

This document exists to be argued with. If you are self-hosting DentalERP, or want to contribute to the plumbing rather than the features, the shape of what follows should be useful to you before it is built rather than after. Comments and pull requests are welcome on any of it.

---

## The design principle

> **Every service we add must be optional, with a working default.**

A dental clinic self-hosting on a single 4 GB VPS should not have to run Redis, an object store and an identity provider just to see a patient list.

The open-source projects worth imitating get this right: Redis is a cache with an in-process fallback, S3 is a driver with a local-disk sibling, the identity provider is a configuration block rather than a bundled container. Making the whole stack mandatory would make DentalERP _harder_ to self-host, not more professional.

So every item on this roadmap is designed to degrade gracefully when its service is absent:

| Unset         | Behaviour                                                    |
| ------------- | ------------------------------------------------------------ |
| `REDIS_URL`   | In-memory cache and rate limiter; background jobs run inline |
| `S3_ENDPOINT` | Local disk driver, exactly as today                          |
| `OIDC_ISSUER` | Credentials login only, with no change to the UI             |

The development Docker Compose stack is a convenience for contributors. It is never a requirement for running DentalERP.

---

## Where we are today

| Capability            | Today                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| Database              | MySQL 8 via Prisma, 81 models                                                   |
| Dev environment       | `docker compose -f docker-compose.dev.yml up -d` — MySQL, Redis, MinIO, Mailpit |
| File storage          | Local disk under `./uploads`, on a named volume                                 |
| Cache / rate limiting | None                                                                            |
| Background jobs       | Cron-style HTTP routes behind a shared secret, driven by an external scheduler  |
| Auth                  | NextAuth v5 (beta) credentials, plus a separate patient OTP session             |
| Observability         | `console.error`                                                                 |
| Container             | Production `Dockerfile` — multi-stage, standalone output, non-root user         |
| Observability probes  | `/api/health` (liveness) and `/api/ready` (readiness)                           |
| CI                    | Lint, type check, unit tests and build on every PR; Playwright E2E nightly      |

Two known infrastructure defects were listed here when this document was first published. Both are now fixed, and are kept below as the record:

- ~~**Uploads do not survive a redeploy.**~~ The `Dockerfile` created `uploads/` in the container's writable layer with no volume behind it, so any container replacement discarded every uploaded file. **Fixed in Phase 1** with a `VOLUME` declaration and a documented named volume; Phase 3 removes the problem entirely by moving uploads to object storage. **Anyone already running the image must copy their files out before mounting a volume over the path** — see the deployment notes in the README.
- ~~**The middleware matcher excludes `/api/health`, which does not exist.**~~ The exclusion was dead configuration with no endpoint behind it. **Fixed in Phase 1**, which added `/api/health` (liveness — touches nothing, so a database blip cannot get a healthy container killed) and `/api/ready` (readiness — checks the database and answers 503 rather than throwing).

---

## Roadmap

Phases ship **one per pull request**, in order, each branched from a freshly merged `main`.

| Phase | Goal                                                                  | Status  |
| ----- | --------------------------------------------------------------------- | ------- |
| 1     | Containerised dev environment + the two defects above                 | Shipped |
| 2     | Per-user and per-patient locale override                              | Shipped |
| 3     | Pluggable storage — local disk and S3-compatible                      | Planned |
| 4     | Production self-hosting bundle — published images, production compose | Planned |
| —     | _Reassessment point — everything below is drafted, not committed_     |         |
| 5     | Background job queue (BullMQ)                                         | Drafted |
| 6     | Auth migration and SSO                                                | Drafted |
| 7     | Structured logging, Dependabot, CodeQL, community files               | Drafted |

Phases 5–7 are deliberately **not committed**. They were sized before Phases 1–4 had taught us anything about real pace or real demand, and we would rather decide with evidence than up front. If one of them matters to you, saying so is the most useful thing you can do.

---

### Phase 1 — Containerised development environment

`git clone` to a running, seeded application in one command.

A `docker-compose.dev.yml` brings up MySQL, Redis, MinIO and Mailpit, each with a healthcheck and a named volume, plus a one-shot container to create the MinIO bucket. Adds `/api/health` and `/api/ready`, a `HEALTHCHECK` in the `Dockerfile`, and a volume for `uploads`.

**The app itself stays on the host**, run with `npm run dev`. Only the backing services are containerised. Bind-mounting `node_modules` into a container is slow enough on Windows and macOS to ruin the edit-reload loop, and native hot reload is significantly better. A fully-containerised `app` service can be added behind a Compose profile later for anyone who wants one.

The manual MySQL setup path stays documented as an alternative. Docker will not become a requirement for contributing.

---

### Phase 2 — Locale override

_Proposed by a contributor working on localization._

`Hospital.locale` already existed. This adds a per-person override on top of it, so a staff member or patient is not stuck with whatever their clinic chose. Staff set it under **Settings → My Profile**; patients under **My Preferences** in the portal.

**Resolution cascade — most specific wins:**

| Surface                   | Resolution                                                    |
| ------------------------- | ------------------------------------------------------------- |
| Staff UI                  | `User.locale` → `Hospital.locale` → default                   |
| Patient portal            | `Patient.locale` → `Hospital.locale` → default                |
| Public pages (no session) | `?lang=` → `Hospital.locale` → default, for that request only |

**The design decision worth reviewing: the column is nullable, with no default.**

```prisma
model User {
  // null means "inherit from the clinic" — deliberately NOT defaulted.
  locale String?
}
```

A default value would make "never expressed a preference" indistinguishable from "explicitly chose en-IN". A clinic that later switched its default would silently fail to propagate to every staff member who had never touched the setting. That costs nothing on day one and is expensive to unpick a year later.

Two consequences of that decision, both of which shipped and both of which have tests:

- **Clearing the picker writes `NULL`, not the clinic's current value.** Re-selecting what the clinic happens to use today would pin the user to it forever.
- **An override that is no longer supported falls through to the clinic**, rather than dropping to the global default. If a locale is retired, its users should land on their own clinic's setting — which is why resolution walks a list of candidates rather than doing `resolveLocale(user ?? clinic)`.

**`?lang=` is never persisted.** An anonymous visitor has no account to store a preference against, and writing a query string to the clinic record would let any shared link change what every other visitor sees.

**What this does and does not do.** The message catalogues hold 34 keys each and no component calls `useTranslations` yet — the i18n layer is scaffolding. A locale override therefore changes **number and date formatting only**, and how amounts are grouped and punctuated. It does not change which currency the clinic bills in, and it will not visibly switch the interface language until a genuinely different locale exists and the UI strings are extracted. That is not a reason to defer it; it is the foundation that work needs.

See [`docs/LOCALIZATION.md`](./LOCALIZATION.md) for the wider localization design.

---

### Phase 3 — Storage abstraction

A driver interface — `put`, `get`, `delete`, `getSignedUrl`, `exists` — with a local-disk implementation and an S3-compatible one. `S3_ENDPOINT` unset keeps the current local behaviour exactly.

This is what gets uploads off the container filesystem, so DentalERP can run more than one replica and survive a redeploy without losing files. Multi-tenant isolation is preserved: every stored object stays namespaced by clinic, and the existing access check on served files does not weaken.

---

### Phase 4 — Production self-hosting bundle

Published container images, a production Compose stack, and documentation good enough that someone can self-host without reading the source. This is the point at which the self-hosting story is coherent, which is why it is the natural place to stop and reassess.

---

## Deliberately not doing

**Migrating from MySQL to PostgreSQL.** It has been suggested, and it is not unreasonable — Postgres is the more common default in this ecosystem. But the schema carries 142 MySQL-specific native type annotations, there is raw SQL in two routes, and the migration lock is pinned to MySQL. A port means regenerating the entire migration history and re-verifying 81 models against the full test suite, in exchange for no capability this project currently lacks. If Postgres support arrives it should be as an _additional_ supported database, driven by real demand from people self-hosting, not as a replacement.

**Bundling an identity provider.** Keycloak in the Compose stack would make SSO look easy and self-hosting hard. The plan is to support any OIDC provider through configuration, which is strictly more useful and costs a fraction of the operational weight.

---

## Contributing to this

The most valuable feedback is on the phases that have not been built yet — Phase 3's driver interface, and whether anything in Phases 5–7 matters enough to commit to. Phase 2 has shipped, but its cascade semantics are still worth arguing with: changing them later means a data migration, so an objection now is much cheaper than an objection in six months.

Open an issue, or comment on the pull request for the phase in question. See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the general workflow.
