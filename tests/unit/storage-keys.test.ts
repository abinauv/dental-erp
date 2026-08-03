import { describe, it, expect } from 'vitest'
import {
  buildStorageKey,
  contentTypeFor,
  InvalidStorageKeyError,
  keyBelongsToHospital,
  toStorageKey,
  uploadUrl,
} from '@/lib/storage/keys'

// These helpers are the seam every driver sits behind, and the tenant prefix
// they preserve is the multi-tenant boundary. Tested against the real function
// with no mocks — there is nothing here to mock.

describe('toStorageKey — the three shapes already in the database', () => {
  it('accepts a staff document path: leading slash and uploads/ prefix', () => {
    expect(toStorageKey('/uploads/hosp-1/documents/pat-1/x.jpg')).toBe(
      'hosp-1/documents/pat-1/x.jpg'
    )
  })

  it('accepts a data-import path: uploads/ prefix, no leading slash', () => {
    expect(toStorageKey('uploads/hosp-1/imports/abc.csv')).toBe('hosp-1/imports/abc.csv')
  })

  it('accepts a patient triage path: neither prefix', () => {
    expect(toStorageKey('hosp-1/patients/pat-1/triage/x.jpg')).toBe(
      'hosp-1/patients/pat-1/triage/x.jpg'
    )
  })

  it('is idempotent — a canonical key survives normalisation unchanged', () => {
    const key = 'hosp-1/documents/pat-1/x.jpg'
    expect(toStorageKey(toStorageKey(key))).toBe(key)
  })

  it('strips the uploads prefix only once, so a folder named uploads survives', () => {
    expect(toStorageKey('uploads/hosp-1/uploads/x.jpg')).toBe('hosp-1/uploads/x.jpg')
  })
})

describe('toStorageKey — rejections', () => {
  it('rejects parent traversal', () => {
    expect(() => toStorageKey('hosp-1/../hosp-2/secret.jpg')).toThrow(InvalidStorageKeyError)
  })

  it('rejects traversal that starts at the root', () => {
    expect(() => toStorageKey('../../etc/passwd')).toThrow(InvalidStorageKeyError)
  })

  it('rejects traversal hidden behind the uploads prefix', () => {
    expect(() => toStorageKey('/uploads/../../etc/passwd')).toThrow(InvalidStorageKeyError)
  })

  it('rejects a single-dot segment — harmless on disk, a different key on S3', () => {
    expect(() => toStorageKey('hosp-1/./x.jpg')).toThrow(InvalidStorageKeyError)
  })

  it('rejects a null byte', () => {
    expect(() => toStorageKey('hosp-1/x.jpg\0.png')).toThrow(InvalidStorageKeyError)
  })

  it('rejects a Windows absolute path that leaked into the column', () => {
    expect(() => toStorageKey('C:/uploads/hosp-1/x.jpg')).toThrow(InvalidStorageKeyError)
  })

  it('rejects an empty key', () => {
    expect(() => toStorageKey('')).toThrow(InvalidStorageKeyError)
    expect(() => toStorageKey('/uploads/')).toThrow(InvalidStorageKeyError)
  })

  it('rejects a trailing slash rather than inventing an empty final segment', () => {
    expect(() => toStorageKey('hosp-1/documents/')).toThrow(InvalidStorageKeyError)
  })

  it('normalises backslashes rather than treating them as filename characters', () => {
    expect(toStorageKey('hosp-1\\documents\\x.jpg')).toBe('hosp-1/documents/x.jpg')
  })

  it('rejects traversal written with backslashes', () => {
    expect(() => toStorageKey('hosp-1\\..\\hosp-2\\x.jpg')).toThrow(InvalidStorageKeyError)
  })

  it('collapses repeated slashes, which are one path on disk but two keys on S3', () => {
    expect(toStorageKey('hosp-1//documents///x.jpg')).toBe('hosp-1/documents/x.jpg')
  })
})

describe('buildStorageKey', () => {
  it('puts the hospital first', () => {
    expect(buildStorageKey('hosp-1', 'documents', 'pat-1', 'x.jpg')).toBe(
      'hosp-1/documents/pat-1/x.jpg'
    )
  })

  it('does not eat a hospital or folder literally named uploads', () => {
    // toStorageKey strips a leading `uploads/` because legacy rows carry one.
    // buildStorageKey must not, or a caller could silently lose its tenant
    // segment and write into the root.
    expect(buildStorageKey('uploads', 'x.jpg')).toBe('uploads/x.jpg')
  })

  it('rejects traversal supplied as a part', () => {
    expect(() => buildStorageKey('hosp-1', '..', 'hosp-2', 'x.jpg')).toThrow(InvalidStorageKeyError)
  })

  it('rejects a part that tries to inject a traversal mid-string', () => {
    expect(() => buildStorageKey('hosp-1', 'documents/../../hosp-2', 'x.jpg')).toThrow(
      InvalidStorageKeyError
    )
  })
})

describe('keyBelongsToHospital — the multi-tenant guard', () => {
  it('accepts a key under the caller’s own hospital', () => {
    expect(keyBelongsToHospital('hosp-1/documents/x.jpg', 'hosp-1')).toBe(true)
  })

  it('accepts the legacy shapes for the caller’s own hospital', () => {
    expect(keyBelongsToHospital('/uploads/hosp-1/documents/x.jpg', 'hosp-1')).toBe(true)
    expect(keyBelongsToHospital('uploads/hosp-1/imports/x.csv', 'hosp-1')).toBe(true)
  })

  it('rejects another hospital', () => {
    expect(keyBelongsToHospital('hosp-2/documents/x.jpg', 'hosp-1')).toBe(false)
  })

  it('rejects a prefix that merely starts with the hospital id', () => {
    // "hosp-10" must not pass as "hosp-1" — the comparison is on the whole
    // segment, not a string prefix.
    expect(keyBelongsToHospital('hosp-10/documents/x.jpg', 'hosp-1')).toBe(false)
  })

  it('rejects traversal instead of throwing, so the route can answer 403', () => {
    expect(keyBelongsToHospital('hosp-1/../hosp-2/x.jpg', 'hosp-1')).toBe(false)
  })

  it('rejects when the caller has no hospital', () => {
    expect(keyBelongsToHospital('hosp-1/x.jpg', null)).toBe(false)
    expect(keyBelongsToHospital('hosp-1/x.jpg', '')).toBe(false)
  })
})

describe('contentTypeFor', () => {
  it('maps the extensions this app actually stores', () => {
    expect(contentTypeFor('h/x.jpg')).toBe('image/jpeg')
    expect(contentTypeFor('h/x.JPEG')).toBe('image/jpeg')
    expect(contentTypeFor('h/x.png')).toBe('image/png')
    expect(contentTypeFor('h/x.pdf')).toBe('application/pdf')
    expect(contentTypeFor('h/x.csv')).toBe('text/csv')
    expect(contentTypeFor('h/x.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('falls back to octet-stream rather than guessing', () => {
    // This value is echoed to a browser. Guessing generously is how a stored
    // file gets executed as something it is not.
    expect(contentTypeFor('h/x.php')).toBe('application/octet-stream')
    expect(contentTypeFor('h/x.html')).toBe('application/octet-stream')
    expect(contentTypeFor('h/noextension')).toBe('application/octet-stream')
  })

  it('does not read an extension out of a parent directory', () => {
    expect(contentTypeFor('h/dir.png/file')).toBe('application/octet-stream')
  })

  it('does not treat a dotfile as an extension', () => {
    expect(contentTypeFor('h/.gitignore')).toBe('application/octet-stream')
  })
})

describe('uploadUrl', () => {
  it('builds the authenticated URL from any stored shape', () => {
    expect(uploadUrl('/uploads/hosp-1/documents/x.jpg')).toBe('/api/uploads/hosp-1/documents/x.jpg')
    // The shape that used to render as "/apihosp-1/patients/..." — a broken
    // image for every patient-uploaded triage photo.
    expect(uploadUrl('hosp-1/patients/pat-1/triage/x.jpg')).toBe(
      '/api/uploads/hosp-1/patients/pat-1/triage/x.jpg'
    )
  })

  it('returns an empty string instead of throwing during render', () => {
    expect(uploadUrl(null)).toBe('')
    expect(uploadUrl(undefined)).toBe('')
    expect(uploadUrl('')).toBe('')
    expect(uploadUrl('../../etc/passwd')).toBe('')
  })
})
