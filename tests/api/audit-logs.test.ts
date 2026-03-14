// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

import { GET } from '@/app/api/settings/audit-logs/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'

function createRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/settings/audit-logs')
  Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, val))
  return new NextRequest(url)
}

const mockLogs = [
  {
    id: 'log-1',
    userId: 'user-1',
    entityType: 'Patient',
    entityId: 'patient-1',
    action: 'CREATE',
    details: '{}',
    hospitalId: 'hospital-1',
    createdAt: new Date('2026-03-01T10:00:00Z'),
    user: { name: 'Admin User', email: 'admin@test.com', role: 'ADMIN' },
  },
  {
    id: 'log-2',
    userId: 'user-2',
    entityType: 'Appointment',
    entityId: 'apt-1',
    action: 'UPDATE',
    details: '{}',
    hospitalId: 'hospital-1',
    createdAt: new Date('2026-03-01T09:00:00Z'),
    user: { name: 'Doctor', email: 'doc@test.com', role: 'DOCTOR' },
  },
]

describe('Audit Logs API — GET /api/settings/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: null,
      user: { id: 'user-1', email: 'admin@test.com', role: 'ADMIN' },
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1' } },
    })
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs)
    vi.mocked(prisma.auditLog.count).mockResolvedValue(2)
  })

  it('should return 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      user: null,
      hospitalId: null,
      session: null,
    })

    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it('should require ADMIN role', async () => {
    await GET(createRequest())
    expect(requireAuthAndRole).toHaveBeenCalledWith(['ADMIN'])
  })

  it('should return audit logs with pagination', async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(50)
  })

  it('should include user details in log entries', async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.data[0].user.name).toBe('Admin User')
    expect(body.data[0].user.email).toBe('admin@test.com')
    expect(body.data[0].user.role).toBe('ADMIN')
  })

  it('should filter by userId', async () => {
    await GET(createRequest({ userId: 'user-1' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      })
    )
  })

  it('should filter by entityType', async () => {
    await GET(createRequest({ entityType: 'Patient' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: 'Patient' }),
      })
    )
  })

  it('should filter by action', async () => {
    await GET(createRequest({ action: 'CREATE' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'CREATE' }),
      })
    )
  })

  it('should filter by date range (from and to)', async () => {
    await GET(createRequest({ from: '2026-03-01', to: '2026-03-31' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    )
  })

  it('should filter by from date only', async () => {
    await GET(createRequest({ from: '2026-03-01' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: expect.any(Date) },
        }),
      })
    )
  })

  it('should filter by to date only', async () => {
    await GET(createRequest({ to: '2026-03-31' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lte: expect.any(Date) },
        }),
      })
    )
  })

  it('should support custom page and limit', async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(100)

    await GET(createRequest({ page: '3', limit: '10' }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    )
  })

  it('should calculate totalPages correctly', async () => {
    vi.mocked(prisma.auditLog.count).mockResolvedValue(55)

    const res = await GET(createRequest({ limit: '10' }))
    const body = await res.json()
    expect(body.pagination.totalPages).toBe(6)
  })

  it('should order by createdAt desc', async () => {
    await GET(createRequest())

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('should scope logs to hospitalId', async () => {
    await GET(createRequest())

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hospitalId: 'hospital-1' }),
      })
    )
  })

  it('should combine multiple filters', async () => {
    await GET(createRequest({
      userId: 'user-1',
      entityType: 'Patient',
      action: 'DELETE',
      from: '2026-01-01',
      to: '2026-12-31',
    }))

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'hospital-1',
          userId: 'user-1',
          entityType: 'Patient',
          action: 'DELETE',
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    )
  })

  it('should return 500 on database error', async () => {
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(new Error('DB down'))

    const res = await GET(createRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('should return empty data array when no logs exist', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0)

    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
    expect(body.pagination.totalPages).toBe(0)
  })

  it('should default to page 1 and limit 50', async () => {
    await GET(createRequest())

    const body = await (await GET(createRequest())).json()
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.limit).toBe(50)
  })
})
