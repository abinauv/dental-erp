// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The tenant check in this route is the only thing standing between one clinic
// and another clinic's patient records. The storage driver is stubbed, but the
// key helpers are deliberately left real — mocking them would mean testing the
// mock instead of the guard.

const mockAuth = vi.hoisted(() => ({ requireAuthAndRole: vi.fn() }))
const mockDriver = vi.hoisted(() => ({
  name: 'local',
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  getSignedUrl: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getStorage: () => mockDriver }
})

const mod = await import('@/app/api/uploads/[...path]/route')
const { StorageNotFoundError } = await import('@/lib/storage/types')

function request(segments: string[]) {
  return [{} as any, { params: Promise.resolve({ path: segments }) }] as const
}

function stored(content: string, contentType = 'image/png') {
  const body = Buffer.from(content)
  return { body, contentType, size: body.byteLength }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.requireAuthAndRole.mockResolvedValue({
    error: null,
    hospitalId: 'hosp-1',
    session: { user: { id: 'user-1', role: 'ADMIN' } },
  })
  mockDriver.get.mockResolvedValue(stored('bytes'))
})

describe('GET /api/uploads/[...path] — authentication', () => {
  it('rejects an anonymous caller', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({ error: null, hospitalId: null })
    const res = await mod.GET(...request(['hosp-1', 'x.png']))
    expect(res.status).toBe(401)
    expect(mockDriver.get).not.toHaveBeenCalled()
  })

  it('passes through the helper’s own error response', async () => {
    const forbidden = new Response(null, { status: 403 })
    mockAuth.requireAuthAndRole.mockResolvedValue({ error: forbidden, hospitalId: null })
    expect(await mod.GET(...request(['hosp-1', 'x.png']))).toBe(forbidden)
  })
})

describe('GET /api/uploads/[...path] — tenant isolation', () => {
  it('serves a file belonging to the caller’s hospital', async () => {
    const res = await mod.GET(...request(['hosp-1', 'documents', 'pat-1', 'x.png']))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(mockDriver.get).toHaveBeenCalledWith('hosp-1/documents/pat-1/x.png')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('bytes')
  })

  it('refuses a file belonging to another hospital', async () => {
    const res = await mod.GET(...request(['hosp-2', 'documents', 'secret.png']))
    expect(res.status).toBe(403)
  })

  it('does not touch storage before refusing — no existence oracle', async () => {
    // If the 404 were evaluated first, this endpoint would report whether a
    // given file exists inside someone else's clinic.
    await mod.GET(...request(['hosp-2', 'documents', 'secret.png']))
    expect(mockDriver.get).not.toHaveBeenCalled()
  })

  it('answers 403 identically whether the other clinic’s file exists or not', async () => {
    mockDriver.get.mockRejectedValue(new StorageNotFoundError('hosp-2/nope.png'))
    const missing = await mod.GET(...request(['hosp-2', 'nope.png']))
    mockDriver.get.mockResolvedValue(stored('secret'))
    const present = await mod.GET(...request(['hosp-2', 'real.png']))

    expect(missing.status).toBe(403)
    expect(present.status).toBe(403)
  })

  it('refuses a hospital id that merely shares a prefix with the caller’s', async () => {
    const res = await mod.GET(...request(['hosp-10', 'documents', 'x.png']))
    expect(res.status).toBe(403)
  })

  it('refuses traversal out of the tenant prefix', async () => {
    for (const segments of [
      ['hosp-1', '..', 'hosp-2', 'x.png'],
      ['..', '..', 'etc', 'passwd'],
      ['hosp-1', '..', '..', 'hosp-2', 'x.png'],
    ]) {
      const res = await mod.GET(...request(segments))
      expect(res.status).toBe(403)
    }
    expect(mockDriver.get).not.toHaveBeenCalled()
  })

  it('refuses a key smuggled through an uploads/ prefix', async () => {
    // toStorageKey strips a leading `uploads/`, so the tenant segment after
    // stripping is what gets compared — not the raw first URL segment.
    const res = await mod.GET(...request(['uploads', 'hosp-2', 'x.png']))
    expect(res.status).toBe(403)
  })

  it('still serves the caller’s own file when the URL carries that prefix', async () => {
    const res = await mod.GET(...request(['uploads', 'hosp-1', 'x.png']))
    expect(res.status).toBe(200)
    expect(mockDriver.get).toHaveBeenCalledWith('hosp-1/x.png')
  })
})

describe('GET /api/uploads/[...path] — storage outcomes', () => {
  it('answers 404 when the key resolves to nothing', async () => {
    mockDriver.get.mockRejectedValue(new StorageNotFoundError('hosp-1/gone.png'))
    const res = await mod.GET(...request(['hosp-1', 'gone.png']))
    expect(res.status).toBe(404)
  })

  it('answers 500 when the driver itself fails', async () => {
    // A bucket outage is not "file not found"; reporting it as 404 would look
    // to a clinic exactly like their records had been deleted.
    mockDriver.get.mockRejectedValue(new Error('connection refused'))
    const res = await mod.GET(...request(['hosp-1', 'x.png']))
    expect(res.status).toBe(500)
  })

  it('reports the content type and length the driver gives it', async () => {
    mockDriver.get.mockResolvedValue(stored('%PDF-1.7', 'application/pdf'))
    const res = await mod.GET(...request(['hosp-1', 'documents', 'scan.pdf']))

    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Length')).toBe('8')
  })

  it('serves a patient-portal triage photo, whose key has no uploads prefix', async () => {
    const res = await mod.GET(...request(['hosp-1', 'patients', 'pat-1', 'triage', 'photo.jpg']))
    expect(res.status).toBe(200)
    expect(mockDriver.get).toHaveBeenCalledWith('hosp-1/patients/pat-1/triage/photo.jpg')
  })
})
