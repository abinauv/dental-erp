import { mkdir, readFile, unlink, writeFile, access } from 'fs/promises'
import path from 'path'

import { contentTypeFor, InvalidStorageKeyError, toStorageKey } from './keys'
import {
  StorageNotFoundError,
  type PutOptions,
  type StorageDriver,
  type StoredObject,
} from './types'

/**
 * The default driver: files on the local filesystem, under `UPLOAD_DIR`
 * (default `./uploads`). This is what every existing install is already doing,
 * so it must behave exactly as before — the same bytes end up at the same
 * paths, and an install that upgrades without setting `STORAGE_DRIVER` sees no
 * change at all.
 *
 * `UPLOAD_DIR` has been declared in `.env.example` since before this driver
 * existed and was read by nothing; the paths were hardcoded to
 * `process.cwd()/uploads` in eight route files. It is honoured here for the
 * first time, and `./uploads` remains the default so nothing moves.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const

  private readonly root: string

  constructor(options: { root?: string } = {}) {
    // Relative values resolve against cwd, matching what the routes did before.
    this.root = path.resolve(process.cwd(), options.root?.trim() || 'uploads')
  }

  /** Exposed for tests and for the migration script's "where is it now" output. */
  get rootDirectory(): string {
    return this.root
  }

  /**
   * Key to absolute path, with the traversal guard.
   *
   * Two independent checks, deliberately. `toStorageKey` rejects `..` before a
   * path is ever built, and then the resolved path is verified to sit inside
   * the root. Either alone would probably do; a single guard that turns out to
   * be wrong fails silently, and what leaks here is patient records.
   */
  private resolvePath(key: string): string {
    const safeKey = toStorageKey(key)
    const full = path.resolve(this.root, ...safeKey.split('/'))

    // The separator matters: a bare `startsWith(this.root)` also accepts
    // "/app/uploads-elsewhere", which is a sibling directory, not a child.
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new InvalidStorageKeyError(`Storage key escapes the storage root: "${key}"`)
    }

    return full
  }

  async put(key: string, body: Buffer, _options: PutOptions = {}): Promise<void> {
    const full = this.resolvePath(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, body)
  }

  async get(key: string): Promise<StoredObject> {
    const full = this.resolvePath(key)
    try {
      const body = await readFile(full)
      return {
        body,
        contentType: contentTypeFor(key),
        size: body.byteLength,
      }
    } catch (err) {
      if (isNotFound(err)) throw new StorageNotFoundError(key)
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    const full = this.resolvePath(key)
    try {
      await unlink(full)
    } catch (err) {
      // Idempotent by contract — S3 deletes behave this way and callers should
      // not have to branch on which driver is underneath them.
      if (!isNotFound(err)) throw err
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolvePath(key))
      return true
    } catch {
      return false
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // Nothing to sign against a filesystem. The honest answer is the route
    // that serves local files, which enforces the session and the tenant
    // prefix on every request — a weaker guarantee than a signed URL in that
    // it never expires, and a stronger one in that it is checked every time.
    return `/api/uploads/${toStorageKey(key)}`
  }
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT'
}
