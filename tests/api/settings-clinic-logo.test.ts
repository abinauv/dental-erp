import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

// The route writes through the storage driver rather than fs, so that it works
// the same on local disk and on an object store. The key helpers are left real.
const mockStorage = vi.hoisted(() => ({
  name: 'local' as const,
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  getSignedUrl: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return { ...actual, getStorage: () => mockStorage }
})

const mod = await import('@/app/api/settings/clinic/logo/route')

function makeMockFormDataRequest(file: any | null) {
  const formData = new Map<string, any>()
  if (file) formData.set('file', file)
  return {
    formData: vi.fn().mockResolvedValue({ get: (key: string) => formData.get(key) ?? null }),
  } as any
}

describe('POST /api/settings/clinic/logo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('uploads a logo and updates hospital record', async () => {
    const mockFile = {
      name: 'logo.png',
      type: 'image/png',
      size: 50000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    ;(prisma.hospital.update as any).mockResolvedValue({})

    const req = makeMockFormDataRequest(mockFile)
    const res = await mod.POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.logo).toContain('logo.png')
    expect(prisma.hospital.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hospital-1' },
        data: expect.objectContaining({ logo: expect.any(String) }),
      })
    )
  })

  it('stores the logo under a tenant-prefixed key', async () => {
    const mockFile = {
      name: 'new-logo.webp',
      type: 'image/webp',
      size: 30000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
    ;(prisma.hospital.update as any).mockResolvedValue({})

    const res = await mod.POST(makeMockFormDataRequest(mockFile))

    expect(res.status).toBe(200)
    expect(mockStorage.put).toHaveBeenCalledWith('hospital-1/logo.webp', expect.any(Buffer), {
      contentType: 'image/webp',
    })
    expect((await res.json()).logo).toBe('/api/uploads/hospital-1/logo.webp')
  })

  it('takes the extension from the validated type, not the uploaded filename', async () => {
    // The filename is attacker-controlled and need not agree with the content
    // type. Deriving it from the MIME type also keeps the set of keys a logo
    // can occupy closed, which is what makes the sweep below complete.
    const mockFile = {
      name: 'logo.jpeg.exe',
      type: 'image/png',
      size: 1000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
    ;(prisma.hospital.update as any).mockResolvedValue({})

    await mod.POST(makeMockFormDataRequest(mockFile))

    expect(mockStorage.put).toHaveBeenCalledWith(
      'hospital-1/logo.png',
      expect.any(Buffer),
      expect.anything()
    )
  })

  it('removes every extension a previous logo could have used before writing', async () => {
    // An object store has no directory to readdir, so replacing a logo clears
    // the whole known key set instead. Deletes are idempotent, so the ones that
    // do not exist cost a round trip and nothing else.
    const mockFile = {
      name: 'new-logo.webp',
      type: 'image/webp',
      size: 30000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
    ;(prisma.hospital.update as any).mockResolvedValue({})

    await mod.POST(makeMockFormDataRequest(mockFile))

    expect(mockStorage.delete.mock.calls.map((c: any[]) => c[0]).sort()).toEqual([
      'hospital-1/logo.gif',
      'hospital-1/logo.jpg',
      'hospital-1/logo.png',
      'hospital-1/logo.svg',
      'hospital-1/logo.webp',
    ])
  })

  it('never sweeps another clinic’s logo', async () => {
    const mockFile = {
      name: 'logo.png',
      type: 'image/png',
      size: 1000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
    ;(prisma.hospital.update as any).mockResolvedValue({})

    await mod.POST(makeMockFormDataRequest(mockFile))

    for (const [key] of mockStorage.delete.mock.calls as any[][]) {
      expect(key.startsWith('hospital-1/')).toBe(true)
    }
  })

  it('returns 400 when no file provided', async () => {
    const req = makeMockFormDataRequest(null)
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No file')
  })

  it('returns 400 for disallowed file type', async () => {
    const mockFile = { name: 'doc.pdf', type: 'application/pdf', size: 100 }
    const req = makeMockFormDataRequest(mockFile)
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('allowed')
  })

  it('returns 400 for oversized file (>2MB)', async () => {
    const mockFile = { name: 'big.png', type: 'image/png', size: 3 * 1024 * 1024 }
    const req = makeMockFormDataRequest(mockFile)
    const res = await mod.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('2 MB')
  })

  it('returns 401 for non-ADMIN users', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })
    const req = makeMockFormDataRequest(null)
    const res = await mod.POST(req)
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/settings/clinic/logo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('deletes logo files and clears DB', async () => {
    ;(prisma.hospital.update as any).mockResolvedValue({})

    const res = await mod.DELETE()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockStorage.delete.mock.calls.map((c: any[]) => c[0]).sort()).toEqual([
      'hospital-1/logo.gif',
      'hospital-1/logo.jpg',
      'hospital-1/logo.png',
      'hospital-1/logo.svg',
      'hospital-1/logo.webp',
    ])
    expect(prisma.hospital.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { logo: null } })
    )
  })

  it('succeeds even if no logo files exist', async () => {
    // Deletes are idempotent by driver contract, so this is the normal case
    // for a clinic that never uploaded a logo — not an error path.
    mockStorage.delete.mockResolvedValue(undefined)
    ;(prisma.hospital.update as any).mockResolvedValue({})

    const res = await mod.DELETE()
    expect(res.status).toBe(200)
  })

  it('reports a storage failure rather than clearing the record anyway', async () => {
    // Blanking the column while the file is still being served would leave the
    // old logo reachable with nothing in the UI to remove it.
    mockStorage.delete.mockRejectedValueOnce(new Error('bucket unreachable'))

    const res = await mod.DELETE()
    expect(res.status).toBe(500)
    expect(prisma.hospital.update).not.toHaveBeenCalled()
  })

  it('returns 401 for non-ADMIN', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })
    const res = await mod.DELETE()
    expect(res.status).toBe(403)
  })
})
