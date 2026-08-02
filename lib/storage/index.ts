import { LocalStorageDriver } from './local'
import { S3StorageDriver } from './s3'
import type { StorageDriver } from './types'

export {
  buildStorageKey,
  contentTypeFor,
  InvalidStorageKeyError,
  keyBelongsToHospital,
  toStorageKey,
  uploadUrl,
} from './keys'
export { StorageNotFoundError } from './types'
export type { PutOptions, StorageDriver, StoredObject } from './types'
export { LocalStorageDriver } from './local'
export { S3StorageDriver } from './s3'

type Env = Record<string, string | undefined>

function isTruthy(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Build a driver from environment configuration.
 *
 * `STORAGE_DRIVER` defaults to `local`, and that default is the whole point:
 * every service this project adds has to be optional with a working default,
 * so a single clinic on one small VPS is never forced to run object storage to
 * see a patient list. Setting nothing keeps the previous behaviour exactly.
 *
 * Exported separately from {@link getStorage} so it can be tested against a
 * fabricated environment without a module-level cache getting in the way.
 */
export function createStorage(env: Env = process.env): StorageDriver {
  const driver = (env.STORAGE_DRIVER || 'local').trim().toLowerCase()

  switch (driver) {
    case 'local':
      return new LocalStorageDriver({ root: env.UPLOAD_DIR })

    case 's3':
      if (!env.S3_BUCKET) {
        // Fail at startup with the name of the missing variable rather than on
        // the first patient X-ray upload with a stack trace from the SDK.
        throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET to be set')
      }
      return new S3StorageDriver({
        bucket: env.S3_BUCKET,
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
        forcePathStyle: isTruthy(env.S3_FORCE_PATH_STYLE),
      })

    default:
      throw new Error(`Unknown STORAGE_DRIVER "${driver}" — expected "local" or "s3"`)
  }
}

let cached: StorageDriver | null = null

/**
 * The driver for this process. Cached because constructing an S3 client per
 * request would throw away its connection pool, and because reading the
 * environment on every upload buys nothing.
 */
export function getStorage(): StorageDriver {
  if (!cached) {
    cached = createStorage()
  }
  return cached
}

/** Test seam. Nothing in the application should need this. */
export function resetStorage(): void {
  cached = null
}
