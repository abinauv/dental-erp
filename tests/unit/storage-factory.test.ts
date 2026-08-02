import { describe, it, expect } from 'vitest'
import { createStorage } from '@/lib/storage'
import { LocalStorageDriver } from '@/lib/storage/local'
import { S3StorageDriver } from '@/lib/storage/s3'
import path from 'path'

// The default here is a design commitment, not an implementation detail: every
// service this project adds has to be optional with a working default, so that
// a single clinic on one small VPS is never made to run object storage to see
// a patient list.

describe('createStorage — driver selection', () => {
  it('defaults to local when nothing is configured', () => {
    expect(createStorage({})).toBeInstanceOf(LocalStorageDriver)
  })

  it('defaults to local even when S3 settings happen to be present', () => {
    // Setting S3_* must not silently move a clinic's files. Switching drivers
    // is an explicit act, because the files do not follow on their own.
    const driver = createStorage({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'dental-erp-uploads',
    })
    expect(driver).toBeInstanceOf(LocalStorageDriver)
  })

  it('honours UPLOAD_DIR, which was declared in .env.example and read by nothing', () => {
    const driver = createStorage({ UPLOAD_DIR: './var/files' }) as LocalStorageDriver
    expect(driver.rootDirectory).toBe(path.resolve(process.cwd(), 'var', 'files'))
  })

  it('selects s3 when asked', () => {
    expect(createStorage({ STORAGE_DRIVER: 's3', S3_BUCKET: 'dental-erp-uploads' })).toBeInstanceOf(
      S3StorageDriver
    )
  })

  it('tolerates case and surrounding whitespace', () => {
    expect(createStorage({ STORAGE_DRIVER: ' LOCAL ' })).toBeInstanceOf(LocalStorageDriver)
    expect(createStorage({ STORAGE_DRIVER: ' S3 ', S3_BUCKET: 'b' })).toBeInstanceOf(
      S3StorageDriver
    )
  })

  it('fails at startup, naming the variable, when s3 is selected without a bucket', () => {
    // Rather than at the first patient X-ray upload, with an SDK stack trace.
    expect(() => createStorage({ STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/)
  })

  it('rejects an unknown driver instead of falling back silently', () => {
    // A typo in STORAGE_DRIVER must not quietly write patient records to local
    // disk on a host whose filesystem is discarded on redeploy.
    expect(() => createStorage({ STORAGE_DRIVER: 'gcs' })).toThrow(/Unknown STORAGE_DRIVER/)
  })

  it('passes S3 settings through, including path-style addressing', () => {
    const driver = createStorage({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'dental-erp-uploads',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'ap-south-1',
      S3_ACCESS_KEY: 'dentalerp',
      S3_SECRET_KEY: 'dentalerp123',
      S3_FORCE_PATH_STYLE: 'true',
    })
    expect(driver).toBeInstanceOf(S3StorageDriver)
    expect(driver.name).toBe('s3')
  })

  it('accepts the usual spellings of a true flag', () => {
    for (const value of ['true', 'TRUE', '1', 'yes']) {
      expect(
        createStorage({ STORAGE_DRIVER: 's3', S3_BUCKET: 'b', S3_FORCE_PATH_STYLE: value })
      ).toBeInstanceOf(S3StorageDriver)
    }
  })
})
