import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockFs = vi.hoisted(() => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  readdir: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('fs/promises', () => ({ ...mockFs, default: mockFs }))
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, default: actual }
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
    mockFs.readdir.mockResolvedValue([])
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

  it('removes previous logo files before uploading new one', async () => {
    mockFs.readdir.mockResolvedValue(['logo.jpg', 'logo.png', 'other.txt'])

    const mockFile = {
      name: 'new-logo.webp',
      type: 'image/webp',
      size: 30000,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
    ;(prisma.hospital.update as any).mockResolvedValue({})

    const req = makeMockFormDataRequest(mockFile)
    await mod.POST(req)

    // Should have deleted logo.jpg and logo.png but not other.txt
    expect(mockFs.unlink).toHaveBeenCalledTimes(2)
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
    mockFs.readdir.mockResolvedValue(['logo.png'])
    ;(prisma.hospital.update as any).mockResolvedValue({})

    const res = await mod.DELETE()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockFs.unlink).toHaveBeenCalledTimes(1)
    expect(prisma.hospital.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { logo: null } })
    )
  })

  it('succeeds even if no logo files exist', async () => {
    mockFs.readdir.mockRejectedValue(new Error('ENOENT'))
    ;(prisma.hospital.update as any).mockResolvedValue({})

    const res = await mod.DELETE()
    expect(res.status).toBe(200)
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
