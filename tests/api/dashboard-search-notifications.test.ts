// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  getAuthenticatedHospital: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as dashboardGET } from '@/app/api/dashboard/stats/route'
import { GET as searchGET } from '@/app/api/search/route'
import {
  GET as notificationsGET,
  PUT as notificationsPUT,
} from '@/app/api/notifications/route'

import { requireAuthAndRole, getAuthenticatedHospital } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function mockAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(requireAuthAndRole).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockHospitalAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    error: null,
    user: { id: 'u1', name: 'Admin', role: 'ADMIN' },
    hospitalId: 'h1',
  }
  vi.mocked(getAuthenticatedHospital).mockResolvedValue({ ...defaults, ...overrides } as any)
}

function mockAuthError() {
  vi.mocked(requireAuthAndRole).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

function mockHospitalAuthError() {
  vi.mocked(getAuthenticatedHospital).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as any)
}

function makeReq(path: string, method = 'GET', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/dashboard/stats
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/dashboard/stats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await dashboardGET(makeReq('/api/dashboard/stats'))
    expect(res.status).toBe(401)
  })

  it('returns dashboard statistics', async () => {
    mockAuth()

    // Mock all the parallel queries (16 items)
    vi.mocked(prisma.patient.count)
      .mockResolvedValueOnce(250) // total patients
      .mockResolvedValueOnce(12)  // new this month
      .mockResolvedValueOnce(10)  // prev month patients
    vi.mocked(prisma.appointment.count)
      .mockResolvedValueOnce(8)   // today
      .mockResolvedValueOnce(120) // this month
      .mockResolvedValueOnce(15)  // pending
      .mockResolvedValueOnce(5)   // completed today
      .mockResolvedValueOnce(100) // prev month appointments
    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 45000 } } as any) // this month rev
      .mockResolvedValueOnce({ _sum: { amount: 8500 } } as any)  // today rev
      .mockResolvedValueOnce({ _sum: { amount: 950000 } } as any) // total rev
      .mockResolvedValueOnce({ _sum: { amount: 40000 } } as any) // prev month rev
    vi.mocked(prisma.invoice.aggregate)
      .mockResolvedValueOnce({ _sum: { totalAmount: 12000 } } as any) // pending
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ date: '2026-02-14', revenue: 1200 }]) // last 7 days
      .mockResolvedValueOnce([{ month: '2026-01', revenue: 40000 }])  // last 6 months
      .mockResolvedValueOnce([{ name: 'Root Canal', count: 15, revenue: 75000 }]) // top procs
      .mockResolvedValueOnce([]) // low stock
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([
      { status: 'COMPLETED', _count: { status: 80 } },
      { status: 'CANCELLED', _count: { status: 10 } },
    ] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'a1',
        scheduledDate: new Date(),
        appointmentType: 'CHECKUP',
        status: 'SCHEDULED',
        patient: { firstName: 'John', lastName: 'Doe' },
        doctor: { firstName: 'Dr', lastName: 'Smith' },
      },
    ] as any)

    const res = await dashboardGET(makeReq('/api/dashboard/stats'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.overview).toBeDefined()
    expect(body.data.overview.totalPatients).toBe(250)
    expect(body.data.charts).toBeDefined()
    expect(body.data.charts.appointmentsByStatus).toHaveLength(2)
    expect(body.data.recentActivity).toBeDefined()
    expect(body.data.recentActivity.upcomingAppointments).toHaveLength(1)
    expect(body.data.recentActivity.upcomingAppointments[0].patientName).toBe('John Doe')
  })

  it('handles zero previous month values for growth', async () => {
    mockAuth()
    vi.mocked(prisma.patient.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0) // prev month = 0
    vi.mocked(prisma.appointment.count)
      .mockResolvedValue(0)
    vi.mocked(prisma.payment.aggregate)
      .mockResolvedValue({ _sum: { amount: null } } as any)
    vi.mocked(prisma.invoice.aggregate)
      .mockResolvedValue({ _sum: { totalAmount: null } } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])

    const res = await dashboardGET(makeReq('/api/dashboard/stats'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.overview.patientGrowth).toBe(0) // 0 when prev month is 0
    expect(body.data.overview.revenueGrowth).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET /api/search
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthError()
    const res = await searchGET(makeReq('/api/search?q=john'))
    expect(res.status).toBe(401)
  })

  it('returns empty results for short query (< 2 chars)', async () => {
    mockAuth()
    const res = await searchGET(makeReq('/api/search?q=j'))
    const body = await res.json()

    expect(body.patients).toEqual([])
    expect(body.appointments).toEqual([])
    expect(body.invoices).toEqual([])
    expect(body.staff).toEqual([])
    expect(body.treatments).toEqual([])
    expect(prisma.patient.findMany).not.toHaveBeenCalled()
  })

  it('returns empty results when q is missing', async () => {
    mockAuth()
    const res = await searchGET(makeReq('/api/search'))
    const body = await res.json()

    expect(body.patients).toEqual([])
  })

  it('searches across all entity types', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', patientId: 'PT001', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
    ] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'a1',
        appointmentNo: 'APT001',
        scheduledDate: new Date('2026-02-20'),
        scheduledTime: '10:00',
        status: 'SCHEDULED',
        patient: { firstName: 'John', lastName: 'Doe' },
        doctor: { firstName: 'Dr', lastName: 'Smith' },
      },
    ] as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.staff.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    const res = await searchGET(makeReq('/api/search?q=John'))
    const body = await res.json()

    expect(body.patients).toHaveLength(1)
    expect(body.patients[0].label).toBe('John Doe')
    expect(body.patients[0].href).toBe('/patients/p1')
    expect(body.appointments).toHaveLength(1)
    expect(body.appointments[0].label).toContain('APT001')
  })

  it('maps staff results correctly', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.staff.findMany).mockResolvedValue([
      {
        id: 's1',
        firstName: 'Jane',
        lastName: 'Doctor',
        specialization: 'Orthodontics',
        employeeId: 'EMP001',
        user: { role: 'DOCTOR' },
      },
    ] as any)
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    const res = await searchGET(makeReq('/api/search?q=Jane'))
    const body = await res.json()

    expect(body.staff).toHaveLength(1)
    expect(body.staff[0].label).toBe('Jane Doctor')
    expect(body.staff[0].sublabel).toContain('Orthodontics')
    expect(body.staff[0].href).toBe('/staff/s1')
  })

  it('maps invoice results with currency formatting', async () => {
    mockAuth()
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: 'inv1',
        invoiceNo: 'INV001',
        totalAmount: 15000,
        status: 'PENDING',
        patient: { firstName: 'John', lastName: 'Doe' },
      },
    ] as any)
    vi.mocked(prisma.staff.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    const res = await searchGET(makeReq('/api/search?q=INV001'))
    const body = await res.json()

    expect(body.invoices).toHaveLength(1)
    expect(body.invoices[0].label).toContain('INV001')
    expect(body.invoices[0].sublabel).toContain('15,000')
    expect(body.invoices[0].href).toBe('/billing/invoices/inv1')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/notifications
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockHospitalAuthError()
    const res = await notificationsGET(makeReq('/api/notifications'))
    expect(res.status).toBe(401)
  })

  it('returns notifications with unread count', async () => {
    mockHospitalAuth()
    const mockNotifications = [
      { id: 'n1', title: 'New Appointment', isRead: false, createdAt: new Date() },
      { id: 'n2', title: 'Payment Received', isRead: true, createdAt: new Date() },
    ]
    vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications as any)
    vi.mocked(prisma.notification.count).mockResolvedValue(3)

    const res = await notificationsGET(makeReq('/api/notifications'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.notifications).toHaveLength(2)
    expect(body.unreadCount).toBe(3)
    expect(body.nextCursor).toBeNull()
  })

  it('filters unread only notifications', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.notification.findMany).mockResolvedValue([])
    vi.mocked(prisma.notification.count).mockResolvedValue(0)

    await notificationsGET(makeReq('/api/notifications?unread=true'))

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false }),
      })
    )
  })

  it('supports cursor-based pagination', async () => {
    mockHospitalAuth()
    // Return limit+1 items to indicate hasMore
    const mockNotifications = Array.from({ length: 21 }, (_, i) => ({
      id: `n${i}`,
      title: `Notification ${i}`,
    }))
    vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications as any)
    vi.mocked(prisma.notification.count).mockResolvedValue(50)

    const res = await notificationsGET(makeReq('/api/notifications?limit=20'))
    const body = await res.json()

    expect(body.notifications).toHaveLength(20) // last one popped
    expect(body.nextCursor).toBe('n19') // last visible item
  })

  it('caps limit at 50', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.notification.findMany).mockResolvedValue([])
    vi.mocked(prisma.notification.count).mockResolvedValue(0)

    await notificationsGET(makeReq('/api/notifications?limit=100'))

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51, // 50 + 1 for hasMore check
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. PUT /api/notifications (Mark as read)
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockHospitalAuthError()
    const res = await notificationsPUT(makeReq('/api/notifications', 'PUT', { all: true }))
    expect(res.status).toBe(401)
  })

  it('marks all notifications as read', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 } as any)
    vi.mocked(prisma.notification.count).mockResolvedValue(0)

    const res = await notificationsPUT(makeReq('/api/notifications', 'PUT', { all: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.unreadCount).toBe(0)
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'h1',
          userId: 'u1',
          isRead: false,
        }),
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      })
    )
  })

  it('marks specific notifications as read by IDs', async () => {
    mockHospitalAuth()
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 2 } as any)
    vi.mocked(prisma.notification.count).mockResolvedValue(3)

    const res = await notificationsPUT(makeReq('/api/notifications', 'PUT', {
      ids: ['n1', 'n2'],
    }))
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.unreadCount).toBe(3)
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['n1', 'n2'] },
        }),
      })
    )
  })

  it('returns 400 when neither ids nor all provided', async () => {
    mockHospitalAuth()

    const res = await notificationsPUT(makeReq('/api/notifications', 'PUT', {}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain("'ids'")
  })
})
