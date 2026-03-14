import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockPatientAuth = vi.hoisted(() => ({
  requirePatientAuth: vi.fn(),
}))

const mockVideoService = vi.hoisted(() => ({
  getRoomToken: vi.fn(),
  getVideoProvider: vi.fn(),
}))

vi.mock('@/lib/patient-auth', () => mockPatientAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/services/video.service', () => mockVideoService)
vi.mock('fs/promises', () => {
  const m = { writeFile: vi.fn(), mkdir: vi.fn() }
  return { ...m, default: m }
})
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, default: actual }
})
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal() as any
  return { ...actual, randomUUID: () => 'mock-uuid-1234' }
})

const videoModule = await import('@/app/api/patient-portal/video/[id]/route')
const photoModule = await import('@/app/api/patient-portal/upload-photo/route')

const mockPatient = {
  id: 'patient-1',
  hospitalId: 'hospital-1',
  firstName: 'John',
  lastName: 'Doe',
}

describe('GET /api/patient-portal/video/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPatientAuth.requirePatientAuth.mockResolvedValue({
      error: null,
      patient: mockPatient,
    })
  })

  it('returns consultation with Daily token', async () => {
    ;(prisma.videoConsultation.findFirst as any).mockResolvedValue({
      id: 'consult-1',
      roomName: 'room-abc',
      roomUrl: 'https://daily.co/room-abc',
      doctor: { firstName: 'Jane', lastName: 'Smith', specialization: 'Orthodontics' },
      appointment: { appointmentNo: 'APT001', scheduledDate: new Date(), scheduledTime: '10:00', chiefComplaint: 'Checkup' },
    })
    mockVideoService.getVideoProvider.mockReturnValue('daily')
    mockVideoService.getRoomToken.mockResolvedValue('token-xyz')

    const req = new Request('http://localhost/api/patient-portal/video/consult-1') as any
    const ctx = { params: Promise.resolve({ id: 'consult-1' }) }
    const res = await videoModule.GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBe('token-xyz')
    expect(body.provider).toBe('daily')
    expect(body.participantName).toBe('John Doe')
    expect(body.roomUrl).toBe('https://daily.co/room-abc')
  })

  it('returns null token for Jitsi provider', async () => {
    ;(prisma.videoConsultation.findFirst as any).mockResolvedValue({
      id: 'consult-1',
      roomName: 'room-abc',
      roomUrl: 'https://meet.jit.si/room-abc',
      doctor: { firstName: 'Jane', lastName: 'Smith', specialization: 'General' },
      appointment: { appointmentNo: 'APT001', scheduledDate: new Date(), scheduledTime: '10:00', chiefComplaint: null },
    })
    mockVideoService.getVideoProvider.mockReturnValue('jitsi')

    const req = new Request('http://localhost/api/patient-portal/video/consult-1') as any
    const ctx = { params: Promise.resolve({ id: 'consult-1' }) }
    const res = await videoModule.GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeNull()
    expect(body.provider).toBe('jitsi')
  })

  it('returns 404 when consultation not found', async () => {
    ;(prisma.videoConsultation.findFirst as any).mockResolvedValue(null)

    const req = new Request('http://localhost/api/patient-portal/video/consult-999') as any
    const ctx = { params: Promise.resolve({ id: 'consult-999' }) }
    const res = await videoModule.GET(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns error when patient not authenticated', async () => {
    mockPatientAuth.requirePatientAuth.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      patient: null,
    })

    const req = new Request('http://localhost/api/patient-portal/video/consult-1') as any
    const ctx = { params: Promise.resolve({ id: 'consult-1' }) }
    const res = await videoModule.GET(req, ctx)
    expect(res.status).toBe(401)
  })
})

function makeMockFileRequest(file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } | null, extras?: Record<string, string>) {
  const formData = new Map<string, any>()
  if (file) formData.set('file', file)
  if (extras) {
    for (const [k, v] of Object.entries(extras)) formData.set(k, v)
  }
  return {
    formData: vi.fn().mockResolvedValue({ get: (key: string) => formData.get(key) ?? null }),
  } as any
}

describe('POST /api/patient-portal/upload-photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPatientAuth.requirePatientAuth.mockResolvedValue({
      error: null,
      patient: mockPatient,
    })
  })

  it('uploads a photo and creates document record', async () => {
    ;(prisma.document.create as any).mockResolvedValue({
      id: 'doc-1',
      originalName: 'photo.jpg',
      description: 'Triage category: pain — Toothache',
    })
    ;(prisma.user.findMany as any).mockResolvedValue([{ id: 'doctor-1' }])
    ;(prisma.notification.createMany as any).mockResolvedValue({ count: 1 })

    const mockFile = {
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 102400,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    const req = makeMockFileRequest(mockFile, { description: 'Toothache', category: 'pain' })
    const res = await photoModule.POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.document.id).toBe('doc-1')
    expect(prisma.document.create).toHaveBeenCalled()
    expect(prisma.notification.createMany).toHaveBeenCalled()
  })

  it('returns 400 when no file provided', async () => {
    const req = makeMockFileRequest(null)
    const res = await photoModule.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No file')
  })

  it('returns 400 for invalid file type', async () => {
    const mockFile = {
      name: 'doc.pdf',
      type: 'application/pdf',
      size: 1024,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    const req = makeMockFileRequest(mockFile)
    const res = await photoModule.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('JPEG, PNG, and WebP')
  })

  it('returns 400 for oversized file (>10MB)', async () => {
    const mockFile = {
      name: 'big.jpg',
      type: 'image/jpeg',
      size: 11 * 1024 * 1024,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }

    const req = makeMockFileRequest(mockFile)
    const res = await photoModule.POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('10MB')
  })

  it('returns 401 when patient not authenticated', async () => {
    mockPatientAuth.requirePatientAuth.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      patient: null,
    })

    const req = makeMockFileRequest(null)
    const res = await photoModule.POST(req)
    expect(res.status).toBe(401)
  })
})
