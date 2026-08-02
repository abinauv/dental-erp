# File storage

DentalERP stores uploaded files — patient documents, X-rays, clinic logos and
data-import spreadsheets — through a driver, selected by `STORAGE_DRIVER`.

| Driver        | `STORAGE_DRIVER`    | Where files go                    |
| ------------- | ------------------- | --------------------------------- |
| Local disk    | `local` _(default)_ | `UPLOAD_DIR`, default `./uploads` |
| S3-compatible | `s3`                | The bucket in `S3_BUCKET`         |

## Which one do I want?

**Use `local` if you run one instance.** It is the default, it needs nothing
else running, and it is what every existing install is already doing. A single
clinic on one VPS should not have to operate object storage to see a patient
list.

**Use `s3` if any of these are true:**

- **You run more than one app instance.** Two containers do not share a local
  disk, so a file uploaded through one is a 404 through the other.
- **Your host's filesystem is ephemeral.** Fly.io, Railway, Render, Heroku,
  Cloud Run and a plain `docker compose pull && up -d` all replace the
  container, and anything written inside it is gone. This is silent: nothing
  warns you, and the files are unrecoverable afterwards.
- **You want backups of files separate from backups of the host.**

`s3` works against MinIO, AWS S3, Cloudflare R2, DigitalOcean Spaces, Wasabi
and Ceph. The differences between them are all endpoint and addressing
configuration, which is why they are settings rather than separate drivers.

Most non-AWS implementations, MinIO included, need
`S3_FORCE_PATH_STYLE="true"` — virtual-host addressing
(`bucket.host/key`) requires wildcard DNS that a local container does not have.

Leave `S3_ACCESS_KEY` and `S3_SECRET_KEY` unset to use the AWS SDK's default
credential chain, which is what you want on EC2, ECS or EKS with an instance
role — no secrets in the environment at all.

## Switching from local to S3

Setting the `S3_*` variables changes nothing on its own. The driver switch is
`STORAGE_DRIVER`, deliberately separate, because **your existing files do not
move on their own.** Flipping the driver without copying them first leaves
every existing document returning 404.

```bash
# 1. Configure the bucket and confirm what would happen.
npm run storage:migrate -- --dry-run

# 2. Copy. Nothing is deleted from local disk, and re-running resumes.
npm run storage:migrate

# 3. Only now switch the driver, and restart.
STORAGE_DRIVER=s3
```

The script verifies every object's size after writing it, and exits non-zero if
anything failed. It never deletes from the source, which makes **rollback a
matter of setting `STORAGE_DRIVER` back to `local` and restarting** — not a
restore from backup. Delete the local tree only once you have confirmed uploads
and downloads work against the bucket.

## Storage keys

Every file is addressed by a key of the form:

```
{hospitalId}/{...rest}
```

The leading tenant segment is load-bearing, not decoration.
`app/api/uploads/[...path]` compares it against the caller's own hospital, and
that comparison is the only thing standing between one clinic and another
clinic's patient records. Anything reaching storage goes through
`lib/storage/keys.ts`, which rejects traversal, absolute paths and null bytes
before a path or an object key is built.

Uploads are served through the authenticated `/api/uploads/...` route on both
drivers, rather than by handing out a bucket URL. That costs a little
throughput and buys a session check on every single request to a patient
record. `getSignedUrl` exists on the driver interface and is exercised by
tests, but no request path uses it yet, for that reason.

### Three legacy path shapes

Before this abstraction existed, three different conventions were written into
the database, and rows in all three are still out there:

| Written by                  | Shape                                                |
| --------------------------- | ---------------------------------------------------- |
| Staff document upload       | `/uploads/{hospitalId}/documents/{patientId}/{file}` |
| Patient portal triage photo | `{hospitalId}/patients/{patientId}/triage/{file}`    |
| Data import                 | `uploads/{hospitalId}/imports/{file}`                |

`toStorageKey` accepts all three, so **no data migration is needed** — existing
rows keep resolving. New writes store the canonical key.

The second shape was a live bug rather than merely an inconsistency. The
download endpoint and the patient page both built paths by concatenating onto
the first shape's assumptions, so a patient-uploaded triage photo rendered as a
broken image, downloaded as a 404, and on a "permanent" delete had its database
row removed while the file stayed on disk. All three are fixed by everything
agreeing on one key format.

## Adding a driver

Implement `StorageDriver` from `lib/storage/types.ts` — `put`, `get`, `delete`,
`exists`, `getSignedUrl` — and add a case to `createStorage` in
`lib/storage/index.ts`. Two contracts the rest of the app relies on:

- `get` throws `StorageNotFoundError` for a missing key, and lets every other
  failure through. Collapsing an outage into "not found" would look to a clinic
  exactly like their records had been deleted.
- `delete` is idempotent. Deleting a key that is already gone is a success.

`lib/storage/keys.ts` must stay free of `node:path` and `node:fs`: it is
imported by a client component, and `path.join` would emit backslashes on
Windows, where an S3 key separator is always `/`.
