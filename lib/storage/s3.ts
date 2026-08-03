import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { getSignedUrl as presignUrl } from '@aws-sdk/s3-request-presigner'

import { contentTypeFor, toStorageKey } from './keys'
import {
  StorageNotFoundError,
  type PutOptions,
  type StorageDriver,
  type StoredObject,
} from './types'

export interface S3StorageOptions {
  bucket: string
  region?: string
  /** Unset for real AWS; set for MinIO, R2, Spaces, Wasabi, Ceph. */
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  /**
   * Path-style addressing (`host/bucket/key`) instead of virtual-host style
   * (`bucket.host/key`). MinIO and most non-AWS implementations need it —
   * virtual-host style requires wildcard DNS that a local container does not
   * have.
   */
  forcePathStyle?: boolean
}

/**
 * S3-compatible driver. Works against AWS S3, MinIO, Cloudflare R2, DigitalOcean
 * Spaces and anything else speaking the same API — the differences between them
 * are all endpoint and addressing configuration, which is why they are options
 * rather than separate drivers.
 *
 * Only reachable when `STORAGE_DRIVER=s3`. Nothing here runs, and no client is
 * constructed, for an install on the default local driver.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const

  private readonly bucket: string
  private client: S3Client | null = null
  private readonly config: S3ClientConfig

  constructor(options: S3StorageOptions) {
    if (!options.bucket) {
      throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3')
    }

    this.bucket = options.bucket
    this.config = {
      // S3 requires *a* region even when the implementation ignores it; MinIO
      // is happy with anything and rejects an empty value.
      region: options.region || 'us-east-1',
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.forcePathStyle ? { forcePathStyle: true } : {}),
      // Explicit keys when both are supplied, otherwise fall through to the
      // SDK's default chain so an EC2/ECS/EKS instance role works with no
      // secrets in the environment at all.
      ...(options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {}),
    }
  }

  /** Constructed on first use, then reused — one TCP pool, not one per request. */
  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client(this.config)
    }
    return this.client
  }

  async put(key: string, body: Buffer, options: PutOptions = {}): Promise<void> {
    const safeKey = toStorageKey(key)
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        Body: body,
        ContentType: options.contentType || contentTypeFor(safeKey),
      })
    )
  }

  async get(key: string): Promise<StoredObject> {
    const safeKey = toStorageKey(key)
    try {
      const response = await this.getClient().send(
        new GetObjectCommand({ Bucket: this.bucket, Key: safeKey })
      )

      if (!response.Body) throw new StorageNotFoundError(key)

      const bytes = await response.Body.transformToByteArray()
      const body = Buffer.from(bytes)

      return {
        body,
        // Trust what was recorded on upload, but never the generic default an
        // S3 implementation substitutes when it was not told — fall back to
        // the extension so a PDF does not come back as octet-stream.
        contentType:
          response.ContentType && response.ContentType !== 'application/octet-stream'
            ? response.ContentType
            : contentTypeFor(safeKey),
        size: body.byteLength,
      }
    } catch (err) {
      if (isNotFound(err)) throw new StorageNotFoundError(key)
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    // S3 DeleteObject is already idempotent: deleting an absent key succeeds.
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: toStorageKey(key) })
    )
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: toStorageKey(key) })
      )
      return true
    } catch (err) {
      if (isNotFound(err)) return false
      throw err
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return presignUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: toStorageKey(key) }),
      { expiresIn: expiresInSeconds }
    )
  }
}

/**
 * A missing key surfaces differently per command and per implementation:
 * GetObject raises `NoSuchKey`, HeadObject raises a bare `NotFound` with no
 * useful name on some servers, and MinIO is not always identical to AWS. Check
 * the status code as well as the name rather than picking one and hoping.
 */
function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404
}
