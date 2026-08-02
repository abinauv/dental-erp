/**
 * The contract every storage driver implements. Kept in its own module so the
 * drivers can import the types without importing the factory that constructs
 * them, which would be a cycle.
 */

/** Thrown when a key resolves to nothing. Distinct from a driver being broken. */
export class StorageNotFoundError extends Error {
  constructor(key: string) {
    super(`No stored object for key "${key}"`)
    this.name = 'StorageNotFoundError'
  }
}

export interface StoredObject {
  body: Buffer
  /** From the driver where it records one, otherwise derived from the extension. */
  contentType: string
  size: number
}

export interface PutOptions {
  contentType?: string
}

export interface StorageDriver {
  /** Which driver this is. Surfaced by `/api/ready` and worth having in logs. */
  readonly name: 'local' | 's3'

  /** Write, creating any intermediate structure. Overwrites an existing key. */
  put(key: string, body: Buffer, options?: PutOptions): Promise<void>

  /** Read. Throws {@link StorageNotFoundError} when the key does not exist. */
  get(key: string): Promise<StoredObject>

  /** Remove. Idempotent — deleting a key that is already gone is a success. */
  delete(key: string): Promise<void>

  exists(key: string): Promise<boolean>

  /**
   * A URL that serves the object.
   *
   * On S3 this is a genuinely signed, time-limited URL. On local disk there is
   * nothing to sign, so it is the path of the authenticated route that serves
   * the file — which is why callers must keep treating the result as something
   * to hand to an already-authorised user, not as a capability safe to publish.
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>
}
