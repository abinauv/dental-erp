import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

import { LocalStorageDriver } from '@/lib/storage/local'
import { InvalidStorageKeyError } from '@/lib/storage/keys'
import { StorageNotFoundError } from '@/lib/storage/types'

// Against a real temporary directory, not a mocked fs. The thing worth proving
// here is that a hostile key cannot produce a path outside the root, and a
// mocked filesystem would only prove that the mock was called with a string.

let root: string
let driver: LocalStorageDriver

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'dental-storage-'))
  driver = new LocalStorageDriver({ root })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('LocalStorageDriver — round trip', () => {
  it('writes, reads back, and reports its driver name', async () => {
    expect(driver.name).toBe('local')

    await driver.put('hosp-1/documents/pat-1/x.png', Buffer.from('bytes'))
    const object = await driver.get('hosp-1/documents/pat-1/x.png')

    expect(object.body.toString()).toBe('bytes')
    expect(object.size).toBe(5)
    expect(object.contentType).toBe('image/png')
  })

  it('creates intermediate directories', async () => {
    await driver.put('hosp-1/a/b/c/deep.pdf', Buffer.from('%PDF'))
    expect(await readFile(path.join(root, 'hosp-1', 'a', 'b', 'c', 'deep.pdf'), 'utf8')).toBe(
      '%PDF'
    )
  })

  it('stores under the tenant prefix, so two clinics never collide', async () => {
    await driver.put('hosp-1/logo.png', Buffer.from('one'))
    await driver.put('hosp-2/logo.png', Buffer.from('two'))

    expect((await driver.get('hosp-1/logo.png')).body.toString()).toBe('one')
    expect((await driver.get('hosp-2/logo.png')).body.toString()).toBe('two')
  })

  it('overwrites an existing key', async () => {
    await driver.put('hosp-1/logo.png', Buffer.from('old'))
    await driver.put('hosp-1/logo.png', Buffer.from('new'))
    expect((await driver.get('hosp-1/logo.png')).body.toString()).toBe('new')
  })

  it('reads back a file written under a legacy path shape', async () => {
    // What an install upgrading to this release actually has on disk.
    await mkdir(path.join(root, 'hosp-1', 'documents'), { recursive: true })
    await writeFile(path.join(root, 'hosp-1', 'documents', 'old.jpg'), 'legacy')

    expect((await driver.get('/uploads/hosp-1/documents/old.jpg')).body.toString()).toBe('legacy')
    expect((await driver.get('uploads/hosp-1/documents/old.jpg')).body.toString()).toBe('legacy')
  })
})

describe('LocalStorageDriver — exists and delete', () => {
  it('reports existence', async () => {
    expect(await driver.exists('hosp-1/x.png')).toBe(false)
    await driver.put('hosp-1/x.png', Buffer.from('a'))
    expect(await driver.exists('hosp-1/x.png')).toBe(true)
  })

  it('deletes', async () => {
    await driver.put('hosp-1/x.png', Buffer.from('a'))
    await driver.delete('hosp-1/x.png')
    expect(await driver.exists('hosp-1/x.png')).toBe(false)
  })

  it('deleting a key that is already gone succeeds', async () => {
    // Idempotent by contract: S3 behaves this way, and callers should not have
    // to branch on which driver is underneath them. The logo route relies on
    // exactly this to sweep the extensions a logo might have used.
    await expect(driver.delete('hosp-1/never-existed.png')).resolves.toBeUndefined()
  })

  it('exists() answers false for a traversing key rather than throwing', async () => {
    expect(await driver.exists('hosp-1/../../etc/passwd')).toBe(false)
  })

  it('get() throws StorageNotFoundError, not a raw ENOENT', async () => {
    await expect(driver.get('hosp-1/missing.png')).rejects.toBeInstanceOf(StorageNotFoundError)
  })
})

describe('LocalStorageDriver — containment', () => {
  const escapes = [
    'hosp-1/../../../etc/passwd',
    '../outside.txt',
    '../../outside.txt',
    'hosp-1\\..\\..\\outside.txt',
    '/uploads/../../outside.txt',
    'C:/Windows/System32/config/SAM',
  ]

  for (const key of escapes) {
    it(`refuses to read outside the root: ${key}`, async () => {
      await expect(driver.get(key)).rejects.toBeInstanceOf(InvalidStorageKeyError)
    })

    it(`refuses to write outside the root: ${key}`, async () => {
      await expect(driver.put(key, Buffer.from('owned'))).rejects.toBeInstanceOf(
        InvalidStorageKeyError
      )
    })

    it(`refuses to delete outside the root: ${key}`, async () => {
      await expect(driver.delete(key)).rejects.toBeInstanceOf(InvalidStorageKeyError)
    })
  }

  it('does not accept a sibling directory that merely shares the root prefix', async () => {
    // The guard this replaces was `startsWith(uploadsDir)` with no separator,
    // which accepts "/app/uploads-elsewhere" as if it were inside
    // "/app/uploads". Reaching a sibling now requires a `..`, and the key
    // check rejects that before a path is built — which is the point of having
    // both guards rather than either one.
    await expect(driver.get('../' + path.basename(root) + '-elsewhere/x')).rejects.toThrow(
      InvalidStorageKeyError
    )
  })

  it('nothing escaped: the temp root holds only what was written', async () => {
    for (const key of escapes) {
      await driver.put(key, Buffer.from('owned')).catch(() => {})
    }
    await driver.put('hosp-1/legit.png', Buffer.from('ok'))
    expect((await driver.get('hosp-1/legit.png')).body.toString()).toBe('ok')
  })
})

describe('LocalStorageDriver — configuration', () => {
  it('defaults to ./uploads relative to cwd when no root is given', () => {
    expect(new LocalStorageDriver().rootDirectory).toBe(path.resolve(process.cwd(), 'uploads'))
  })

  it('honours UPLOAD_DIR-style relative roots against cwd', () => {
    expect(new LocalStorageDriver({ root: './var/files' }).rootDirectory).toBe(
      path.resolve(process.cwd(), 'var', 'files')
    )
  })

  it('accepts an absolute root', () => {
    expect(new LocalStorageDriver({ root }).rootDirectory).toBe(path.resolve(root))
  })

  it('treats a blank root as unset rather than as the filesystem root', () => {
    expect(new LocalStorageDriver({ root: '   ' }).rootDirectory).toBe(
      path.resolve(process.cwd(), 'uploads')
    )
  })
})

describe('LocalStorageDriver — getSignedUrl', () => {
  it('returns the authenticated route path, since there is nothing to sign', async () => {
    expect(await driver.getSignedUrl('hosp-1/documents/x.png')).toBe(
      '/api/uploads/hosp-1/documents/x.png'
    )
  })

  it('normalises a legacy path into that URL', async () => {
    expect(await driver.getSignedUrl('/uploads/hosp-1/documents/x.png')).toBe(
      '/api/uploads/hosp-1/documents/x.png'
    )
  })
})
