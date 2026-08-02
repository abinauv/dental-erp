/**
 * Storage keys — the canonical address of an uploaded file, independent of
 * whichever driver is holding the bytes.
 *
 *     {hospitalId}/{...rest}
 *
 * The leading tenant segment is load-bearing. `app/api/uploads/[...path]`
 * compares it against the caller's own hospital, and that comparison is the
 * only thing standing between one clinic and another clinic's patient records.
 * Every helper here preserves it.
 *
 * This module deliberately uses no `node:path` and no `node:fs`, for two
 * reasons. It has to be importable from a client component, and `path.join`
 * is the wrong tool anyway: it emits backslashes on Windows, while an S3 key
 * separator is always `/`. A key that round-trips through `path.join` on a
 * Windows dev machine and then reaches MinIO is a different object from the
 * same key produced on Linux.
 */

/**
 * Three different conventions were written into the database before this
 * module existed, and rows in all three shapes are still out there:
 *
 *   1. `/uploads/{hospitalId}/documents/{patientId}/{file}`
 *      — `Document.filePath`, staff upload. Leading slash, `uploads/` prefix.
 *   2. `{hospitalId}/patients/{patientId}/triage/{file}`
 *      — `Document.filePath`, patient portal upload. Neither.
 *   3. `uploads/{hospitalId}/imports/{file}`
 *      — `DataImportJob.filePath`. Prefix, no leading slash.
 *
 * Shape 2 was a live bug: both the download endpoint and the patient page
 * built their paths by concatenating onto shape 1's assumptions, so a
 * patient-uploaded triage photo resolved to a path that did not exist. New
 * writes all store the canonical key; `toStorageKey` accepts any of the three
 * so existing rows keep working without a data migration.
 */
export class InvalidStorageKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidStorageKeyError'
  }
}

/** Rejects anything that could escape the tenant prefix or the storage root. */
function assertSafeSegments(key: string, original: string): string {
  if (key === '') {
    throw new InvalidStorageKeyError('Storage key is empty')
  }

  const segments = key.split('/')

  for (const segment of segments) {
    if (segment === '') {
      throw new InvalidStorageKeyError(`Storage key has an empty segment: "${original}"`)
    }
    // `..` is the traversal that matters; `.` is harmless locally but produces
    // a genuinely different object key on S3, so neither is allowed through.
    if (segment === '.' || segment === '..') {
      throw new InvalidStorageKeyError(`Storage key must not traverse: "${original}"`)
    }
  }

  // A Windows absolute path that leaked into the column, e.g. "C:/uploads/x".
  if (/^[a-zA-Z]:$/.test(segments[0])) {
    throw new InvalidStorageKeyError(`Storage key must be relative: "${original}"`)
  }

  return key
}

/**
 * Normalise any of the stored path shapes — or an already-canonical key — into
 * a canonical storage key. Throws rather than sanitising: a key that cannot be
 * understood is a bug or an attack, and quietly rewriting it into some nearby
 * valid key is how traversal guards get defeated.
 */
export function toStorageKey(stored: string): string {
  if (typeof stored !== 'string') {
    throw new InvalidStorageKeyError('Storage key must be a string')
  }
  if (stored.includes('\0')) {
    throw new InvalidStorageKeyError('Storage key contains a null byte')
  }

  const normalized = stored
    .replace(/\\/g, '/') // a Windows path that leaked into the database
    .replace(/\/{2,}/g, '/') // "h//documents" is one path locally, two keys on S3
    .replace(/^\//, '')
    .replace(/^uploads\//, '')

  return assertSafeSegments(normalized, stored)
}

/**
 * Build a canonical key from parts already known to be safe. Unlike
 * `toStorageKey` this does *not* strip an `uploads/` prefix, so a hospital or
 * file genuinely named "uploads" survives instead of being silently eaten.
 */
export function buildStorageKey(hospitalId: string, ...rest: string[]): string {
  const joined = [hospitalId, ...rest]
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\//, '')

  if (joined.includes('\0')) {
    throw new InvalidStorageKeyError('Storage key contains a null byte')
  }

  return assertSafeSegments(joined, joined)
}

/**
 * The multi-tenant guard. Returns false rather than throwing on a malformed
 * key so that a caller can answer 403 instead of 500 — a hostile path should
 * look exactly like someone else's file, not like a crash.
 */
export function keyBelongsToHospital(key: string, hospitalId: string | null | undefined): boolean {
  if (!hospitalId) return false
  try {
    return toStorageKey(key).split('/')[0] === hospitalId
  } catch {
    return false
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/**
 * Content type from the key's extension. A whitelist, falling back to
 * `application/octet-stream`: this value is echoed back to a browser, and
 * guessing generously is how a stored file gets executed as something.
 */
export function contentTypeFor(key: string): string {
  const lastDot = key.lastIndexOf('.')
  const lastSlash = key.lastIndexOf('/')
  if (lastDot <= lastSlash + 1) return 'application/octet-stream'
  return CONTENT_TYPES[key.slice(lastDot).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * The authenticated URL that serves a stored file. Safe to call from a client
 * component with a value straight out of the database, including the legacy
 * shapes above. Returns an empty string for a key that cannot be parsed, so a
 * single corrupt row renders a broken image rather than throwing during render
 * and taking the whole page down.
 */
export function uploadUrl(stored: string | null | undefined): string {
  if (!stored) return ''
  try {
    return `/api/uploads/${toStorageKey(stored)}`
  } catch {
    return ''
  }
}
