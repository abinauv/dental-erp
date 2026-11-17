// @ts-nocheck
// GET /api/audit-log, which Reports → Audit Log reads.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => {
  const prisma = { auditLog: { findMany: vi.fn(), count: vi.fn() } }
  return { prisma, default: prisma }
})
vi.mock('@/lib/api-helpers', () => ({ requireAuthAndRole: vi.fn() }))

import { GET } from '@/app/api/audit-log/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const request = (query = '') => new NextRequest(`http://localhost/api/audit-log${query}`)

describe('GET /api/audit-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: null,
      user: { id: 'u1', role: 'ADMIN' },
      hospitalId: 'h1',
    })
    vi.mocked(prisma.auditLog.count).mockResolvedValue(2)
  })

  it('is for admins only', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    await GET(request())
    expect(requireAuthAndRole).toHaveBeenCalledWith(['ADMIN'])
  })

  it('returns record changes as fields, and older entries as text', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: 'l1',
        action: 'UPDATE',
        entityType: 'Patient',
        entityId: 'p1',
        entityLabel: 'Asha Rao (PAT0007)',
        oldValues: '{"phone":"1"}',
        newValues: '{"phone":"2"}',
        source: 'web',
        ipAddress: '203.0.113.9',
        createdAt: new Date('2026-11-18T10:00:00Z'),
        user: { name: 'Admin', email: 'a@x', role: 'ADMIN' },
      },
      {
        id: 'l2',
        action: 'AUTOMATION',
        entityType: 'MarketingAutomation',
        entityId: 'm1',
        entityLabel: null,
        oldValues: 'Sent 4 birthday messages',
        newValues: null,
        source: null,
        ipAddress: null,
        createdAt: new Date('2026-11-18T09:00:00Z'),
        user: null,
      },
    ])
    const body = await (await GET(request())).json()
    expect(body.data[0]).toMatchObject({
      entityLabel: 'Asha Rao (PAT0007)',
      oldValues: { phone: '1' },
      newValues: { phone: '2' },
      details: null,
      source: 'web',
    })
    expect(body.data[1]).toMatchObject({
      oldValues: null,
      newValues: null,
      details: 'Sent 4 birthday messages',
      user: null,
    })
  })

  it('searches record names, changed values and people, within the clinic', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    await GET(request('?q=Asha&action=UPDATE&entity=Patient'))
    const { where } = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0]
    expect(where).toMatchObject({ hospitalId: 'h1', action: 'UPDATE', entityType: 'Patient' })
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { entityLabel: { contains: 'Asha' } },
        { newValues: { contains: 'Asha' } },
        { oldValues: { contains: 'Asha' } },
        { user: { name: { contains: 'Asha' } } },
      ])
    )
  })

  it('pages at most 100 entries at a time', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    await GET(request('?limit=5000&page=-3'))
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 0 })
    )
  })
})
