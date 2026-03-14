// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/ai/openrouter', () => ({
  complete: vi.fn().mockResolvedValue({ content: 'Test briefing content', usage: { totalTokens: 100 } }),
}))

vi.mock('@/lib/ai/models', () => ({
  getModelByTier: vi.fn().mockReturnValue({ model: 'test-model', maxTokens: 4096, temperature: 0.7 }),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { GET as briefingGET } from '@/app/api/cron/briefing/route'
import { GET as remindersGET } from '@/app/api/cron/reminders/route'
import { GET as collectionsGET } from '@/app/api/cron/collections/route'
import { GET as recallGET } from '@/app/api/cron/recall/route'
import { GET as inventoryGET } from '@/app/api/cron/inventory/route'
import { POST as cleanupPOST } from '@/app/api/cron/cleanup/route'
import { prisma } from '@/lib/prisma'
import { complete } from '@/lib/ai/openrouter'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MS = 86400000

function authedReq(path: string, method = 'GET'): Request {
  return new Request(`http://localhost/api/cron/${path}`, {
    method,
    headers: { Authorization: 'Bearer test-cron-secret' },
  })
}

function unauthedReq(path: string, method = 'GET'): Request {
  return new Request(`http://localhost/api/cron/${path}`, { method })
}

function badSecretReq(path: string, method = 'GET'): Request {
  return new Request(`http://localhost/api/cron/${path}`, {
    method,
    headers: { Authorization: 'Bearer wrong-secret' },
  })
}

// ── Common mock data ─────────────────────────────────────────────────────────

const now = new Date()
const todayStr = now.toISOString().split('T')[0]

const mockHospitals = [
  { id: 'h1', name: 'Test Clinic' },
]

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/cron/briefing
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/cron/briefing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth header', async () => {
    const res = await briefingGET(unauthedReq('briefing'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const res = await briefingGET(badSecretReq('briefing'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('generates briefing for active hospitals', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue(mockHospitals as any)

    // Data queries inside the loop
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'apt-1',
        scheduledTime: '09:00',
        appointmentType: 'CHECKUP',
        patient: { firstName: 'John', lastName: 'Doe' },
        doctor: { firstName: 'Smith', lastName: 'Jones' },
      },
    ] as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNo: 'INV-001',
        balanceAmount: 5000,
        patient: { firstName: 'Jane', lastName: 'Roe' },
      },
    ] as any)
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { name: 'Gloves', currentStock: 5, reorderLevel: 10, unit: 'boxes' },
    ] as any)
    vi.mocked(prisma.patientRiskScore.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    // Insight + admin notifications
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'admin-1' },
    ] as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    const res = await briefingGET(authedReq('briefing'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toEqual({ hospitalId: 'h1', status: 'ok' })
    expect(body.processedAt).toBeDefined()

    // Verify AI completion was called
    expect(vi.mocked(complete)).toHaveBeenCalledOnce()
  })

  it('creates aiInsight for briefing', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue(mockHospitals as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.patientRiskScore.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    await briefingGET(authedReq('briefing'))

    expect(prisma.aIInsight.create).toHaveBeenCalledOnce()
    const createCall = vi.mocked(prisma.aIInsight.create).mock.calls[0][0]
    expect(createCall.data).toMatchObject({
      hospitalId: 'h1',
      category: 'OPERATIONAL',
      severity: 'INFO',
      title: expect.stringContaining('Morning Briefing'),
      description: 'Test briefing content',
    })
    expect(createCall.data.expiresAt).toBeInstanceOf(Date)
  })

  it('creates notifications for ADMIN users', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue(mockHospitals as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.patientRiskScore.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'admin-1' },
      { id: 'admin-2' },
    ] as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    await briefingGET(authedReq('briefing'))

    // user.findMany called to get admins
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { hospitalId: 'h1', role: 'ADMIN', isActive: true },
      select: { id: true },
    })

    // One notification per admin
    expect(prisma.notification.create).toHaveBeenCalledTimes(2)
    const firstNotifCall = vi.mocked(prisma.notification.create).mock.calls[0][0]
    expect(firstNotifCall.data).toMatchObject({
      hospitalId: 'h1',
      userId: 'admin-1',
      title: expect.stringContaining('Morning Briefing'),
      type: 'INFO',
      entityType: 'AIInsight',
      entityId: 'briefing',
    })
  })

  it('handles errors gracefully per hospital', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([
      { id: 'h1', name: 'Clinic 1' },
      { id: 'h2', name: 'Clinic 2' },
    ] as any)

    // First hospital: make appointment.findMany throw
    let callCount = 0
    vi.mocked(prisma.appointment.findMany).mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('DB connection lost')
      return []
    })
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([])
    vi.mocked(prisma.patientRiskScore.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])

    const res = await briefingGET(authedReq('briefing'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(2)
    // First hospital errored
    expect(body.results[0]).toEqual({ hospitalId: 'h1', status: 'DB connection lost' })
    // Second hospital succeeded
    expect(body.results[1]).toEqual({ hospitalId: 'h2', status: 'ok' })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. GET /api/cron/reminders
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/cron/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth header', async () => {
    const res = await remindersGET(unauthedReq('reminders'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('finds upcoming appointments and creates reminders', async () => {
    const scheduledDate = new Date(now.getTime() + 12 * 3600000) // 12 hours from now

    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'apt-1',
        scheduledDate,
        patient: { id: 'p1', firstName: 'Test', lastName: 'Patient', phone: '9999999999' },
        reminders: [], // no existing reminders
      },
      {
        id: 'apt-2',
        scheduledDate,
        patient: { id: 'p2', firstName: 'Another', lastName: 'Patient', phone: '8888888888' },
        reminders: [], // no existing reminders
      },
    ] as any)
    // Mock groupBy for no-show risk calculation (returns no high-risk patients)
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.appointmentReminder.create).mockResolvedValue({} as any)

    const res = await remindersGET(authedReq('reminders'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.checked).toBe(2)
    expect(body.created).toBe(2)
    expect(body.processedAt).toBeDefined()

    // Verify reminder creation
    expect(prisma.appointmentReminder.create).toHaveBeenCalledTimes(2)
    const firstCall = vi.mocked(prisma.appointmentReminder.create).mock.calls[0][0]
    expect(firstCall.data).toMatchObject({
      appointmentId: 'apt-1',
      reminderType: 'SMS',
      status: 'PENDING',
    })
    // scheduledFor should be set
    expect(firstCall.data.scheduledFor).toBeInstanceOf(Date)
  })

  it('skips appointments that already have pending/sent reminders', async () => {
    const scheduledDate = new Date(now.getTime() + 12 * 3600000)

    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'apt-1',
        scheduledDate,
        patient: { id: 'p1', firstName: 'Test', lastName: 'Patient', phone: '9999999999' },
        reminders: [{ status: 'PENDING' }], // already has a pending reminder
      },
      {
        id: 'apt-2',
        scheduledDate,
        patient: { id: 'p2', firstName: 'Another', lastName: 'Patient', phone: '8888888888' },
        reminders: [{ status: 'SENT' }], // already has a sent reminder
      },
      {
        id: 'apt-3',
        scheduledDate,
        patient: { id: 'p3', firstName: 'New', lastName: 'Patient', phone: '7777777777' },
        reminders: [{ status: 'FAILED' }], // failed reminder — should still create new
      },
    ] as any)
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.appointmentReminder.create).mockResolvedValue({} as any)

    const res = await remindersGET(authedReq('reminders'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.checked).toBe(3)
    expect(body.created).toBe(1) // only apt-3 gets a new reminder
    expect(vi.mocked(prisma.appointmentReminder.create).mock.calls[0][0].data.appointmentId).toBe('apt-3')
  })

  it('returns checked/created counts when no appointments found', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([] as any)

    const res = await remindersGET(authedReq('reminders'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.checked).toBe(0)
    expect(body.created).toBe(0)
    expect(prisma.appointmentReminder.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/cron/collections
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/cron/collections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth header', async () => {
    const res = await collectionsGET(unauthedReq('collections'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('classifies overdue invoices by tier', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      // Tier 1: 5 days old (3-6 days)
      {
        id: 'inv-1',
        invoiceNo: 'INV-001',
        createdAt: new Date(now.getTime() - 5 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 5000,
        patient: { firstName: 'John', lastName: 'Doe' },
      },
      // Tier 2: 10 days old (7-13 days)
      {
        id: 'inv-2',
        invoiceNo: 'INV-002',
        createdAt: new Date(now.getTime() - 10 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 8000,
        patient: { firstName: 'Jane', lastName: 'Roe' },
      },
      // Tier 3: 16 days old (14-20 days)
      {
        id: 'inv-3',
        invoiceNo: 'INV-003',
        createdAt: new Date(now.getTime() - 16 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 12000,
        patient: { firstName: 'Bob', lastName: 'Smith' },
      },
      // Tier 4: 25 days old (21+ days)
      {
        id: 'inv-4',
        invoiceNo: 'INV-004',
        createdAt: new Date(now.getTime() - 25 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 20000,
        patient: { firstName: 'Alice', lastName: 'Brown' },
      },
    ] as any)

    // user.findFirst for finding users with correct roles
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)
    // Mock payment plan processing
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any)

    const res = await collectionsGET(authedReq('collections'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.invoiceCollections).toHaveLength(1)
    expect(body.invoiceCollections[0]).toMatchObject({
      hospitalId: 'h1',
      tier1: 1,
      tier2: 1,
      tier3: 1,
      tier4: 1,
    })
    expect(body.processedAt).toBeDefined()

    // 4 invoices => 4 notifications
    expect(prisma.notification.create).toHaveBeenCalledTimes(4)
  })

  it('creates notifications for appropriate roles', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      // Tier 1 => RECEPTIONIST
      {
        id: 'inv-1',
        invoiceNo: 'INV-001',
        createdAt: new Date(now.getTime() - 4 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 2000,
        patient: { firstName: 'John', lastName: 'Doe' },
      },
      // Tier 4 => ADMIN
      {
        id: 'inv-2',
        invoiceNo: 'INV-002',
        createdAt: new Date(now.getTime() - 30 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 50000,
        patient: { firstName: 'Jane', lastName: 'Roe' },
      },
    ] as any)

    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'target-user' } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any)

    await collectionsGET(authedReq('collections'))

    // Check the roles requested via user.findFirst
    const findFirstCalls = vi.mocked(prisma.user.findFirst).mock.calls
    expect(findFirstCalls.length).toBeGreaterThanOrEqual(2)

    // First call for tier1 => RECEPTIONIST
    expect(findFirstCalls[0][0].where).toMatchObject({
      hospitalId: 'h1',
      role: 'RECEPTIONIST',
      isActive: true,
    })

    // Second call for tier4 => ADMIN
    expect(findFirstCalls[1][0].where).toMatchObject({
      hospitalId: 'h1',
      role: 'ADMIN',
      isActive: true,
    })

    // Verify notification messages
    const notifCalls = vi.mocked(prisma.notification.create).mock.calls

    // Tier 1: friendly reminder
    expect(notifCalls[0][0].data.title).toBe('Payment Collection – Tier 1')
    expect(notifCalls[0][0].data.message).toContain('Friendly reminder')
    expect(notifCalls[0][0].data.message).toContain('INV-001')

    // Tier 4: escalation
    expect(notifCalls[1][0].data.title).toBe('Payment Collection – Tier 4')
    expect(notifCalls[1][0].data.message).toContain('ESCALATION')
    expect(notifCalls[1][0].data.message).toContain('INV-002')
  })

  it('handles empty overdue list', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any)

    const res = await collectionsGET(authedReq('collections'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.invoiceCollections).toHaveLength(1)
    expect(body.invoiceCollections[0]).toMatchObject({
      hospitalId: 'h1',
      tier1: 0,
      tier2: 0,
      tier3: 0,
      tier4: 0,
    })
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('skips invoices that are less than 3 days overdue', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNo: 'INV-001',
        createdAt: new Date(now.getTime() - 1 * DAY_MS), // 1 day old — too recent
        status: 'OVERDUE',
        balanceAmount: 1000,
        patient: { firstName: 'New', lastName: 'Patient' },
      },
      {
        id: 'inv-2',
        invoiceNo: 'INV-002',
        createdAt: new Date(now.getTime() - 2 * DAY_MS), // 2 days old — still too recent
        status: 'OVERDUE',
        balanceAmount: 2000,
        patient: { firstName: 'Recent', lastName: 'Patient' },
      },
    ] as any)
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any)

    const res = await collectionsGET(authedReq('collections'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.invoiceCollections[0]).toMatchObject({
      tier1: 0,
      tier2: 0,
      tier3: 0,
      tier4: 0,
    })
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('does not create notification if no user with matching role exists', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNo: 'INV-001',
        createdAt: new Date(now.getTime() - 5 * DAY_MS),
        status: 'OVERDUE',
        balanceAmount: 3000,
        patient: { firstName: 'Solo', lastName: 'Patient' },
      },
    ] as any)

    // No user found for this role
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any)

    const res = await collectionsGET(authedReq('collections'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.invoiceCollections[0].tier1).toBe(1)
    // No notification created because targetUser was null
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/cron/recall
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/cron/recall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth header', async () => {
    const res = await recallGET(unauthedReq('recall'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('identifies patients with no visit in 6+ months', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    // Active patients
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Inactive', lastName: 'Patient' },
      { id: 'p2', firstName: 'Active', lastName: 'Patient' },
      { id: 'p3', firstName: 'Also', lastName: 'Inactive' },
    ] as any)

    // Only p2 has a recent visit
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { patientId: 'p2' },
    ] as any)

    // No incomplete treatment plans or overdue follow-ups
    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    // Insight + notification
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1' } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    const res = await recallGET(authedReq('recall'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toMatchObject({
      hospitalId: 'h1',
      noVisit: 2, // p1 and p3
      incomplete: 0,
      overdueFollowUp: 0,
    })
  })

  it('creates recall insight with proper counts', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Inactive', lastName: 'One' },
      { id: 'p2', firstName: 'Inactive', lastName: 'Two' },
    ] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]) // no recent visits

    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([
      { id: 'tp1', title: 'Root Canal Plan', patient: { firstName: 'Bob', lastName: 'Planful' } },
    ] as any)

    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      { id: 't1', patient: { firstName: 'Sue', lastName: 'Followup' } },
    ] as any)

    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1' } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    await recallGET(authedReq('recall'))

    expect(prisma.aIInsight.create).toHaveBeenCalledOnce()
    const insightData = vi.mocked(prisma.aIInsight.create).mock.calls[0][0].data

    expect(insightData).toMatchObject({
      hospitalId: 'h1',
      category: 'PATIENT',
      severity: 'INFO', // 2 patients < 10, so INFO
      title: 'Patient Recall Required',
    })
    expect(insightData.description).toContain('2 patient(s) not visited in 6+ months')
    expect(insightData.description).toContain('1 incomplete treatment plan(s)')
    expect(insightData.description).toContain('1 overdue follow-up(s)')

    // Notification to admin
    expect(prisma.notification.create).toHaveBeenCalledOnce()
    expect(vi.mocked(prisma.notification.create).mock.calls[0][0].data).toMatchObject({
      hospitalId: 'h1',
      userId: 'admin-1',
      title: 'Weekly Patient Recall',
      entityType: 'AIInsight',
      entityId: 'recall',
    })
  })

  it('sets severity to WARNING when more than 10 patients have no visit', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    // 12 patients, none with recent visits
    const patients = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      firstName: `Patient`,
      lastName: `${i}`,
    }))
    vi.mocked(prisma.patient.findMany).mockResolvedValue(patients as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1' } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    await recallGET(authedReq('recall'))

    const insightData = vi.mocked(prisma.aIInsight.create).mock.calls[0][0].data
    expect(insightData.severity).toBe('WARNING')
  })

  it('handles no recalls needed', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    // All patients have recent visits
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Active', lastName: 'Patient' },
    ] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { patientId: 'p1' },
    ] as any)
    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])

    const res = await recallGET(authedReq('recall'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results[0]).toMatchObject({
      hospitalId: 'h1',
      noVisit: 0,
      incomplete: 0,
      overdueFollowUp: 0,
    })

    // No insight created when all counts are 0
    expect(prisma.aIInsight.create).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('does not create notification if no ADMIN user exists', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'Lone', lastName: 'Patient' },
    ] as any)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null) // no admin
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    await recallGET(authedReq('recall'))

    expect(prisma.aIInsight.create).toHaveBeenCalledOnce()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. GET /api/cron/inventory
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/cron/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth header', async () => {
    const res = await inventoryGET(unauthedReq('inventory'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('creates CRITICAL alerts for items at/below minimum stock', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { id: 'item-1', name: 'Gloves', currentStock: 2, reorderLevel: 20, minimumStock: 5, unit: 'boxes' },
      { id: 'item-2', name: 'Masks', currentStock: 0, reorderLevel: 10, minimumStock: 3, unit: 'packs' },
    ] as any)
    vi.mocked(prisma.inventoryBatch.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockTransaction.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)

    const res = await inventoryGET(authedReq('inventory'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results[0].alertsCreated).toBeGreaterThanOrEqual(1)

    // Check for CRITICAL insight
    const createCalls = vi.mocked(prisma.aIInsight.create).mock.calls
    const criticalCall = createCalls.find((c) => c[0].data.severity === 'CRITICAL')
    expect(criticalCall).toBeDefined()
    expect(criticalCall![0].data).toMatchObject({
      hospitalId: 'h1',
      category: 'INVENTORY',
      severity: 'CRITICAL',
      title: 'Critical Stock Levels',
    })
    expect(criticalCall![0].data.description).toContain('Gloves')
    expect(criticalCall![0].data.description).toContain('Masks')
  })

  it('creates WARNING alerts for items at reorder level but above minimum', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      // At reorder level but above minimum — should trigger WARNING
      { id: 'item-1', name: 'Composite', currentStock: 8, reorderLevel: 10, minimumStock: 3, unit: 'syringes' },
      // Well stocked — should not trigger anything
      { id: 'item-2', name: 'Cement', currentStock: 50, reorderLevel: 10, minimumStock: 3, unit: 'tubes' },
    ] as any)
    vi.mocked(prisma.inventoryBatch.findMany).mockResolvedValue([])
    vi.mocked(prisma.stockTransaction.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)

    const res = await inventoryGET(authedReq('inventory'))
    expect(res.status).toBe(200)

    const createCalls = vi.mocked(prisma.aIInsight.create).mock.calls
    // WARNING for approaching reorder (not critical because currentStock > minimumStock)
    const warningCall = createCalls.find((c) => c[0].data.severity === 'WARNING')
    expect(warningCall).toBeDefined()
    expect(warningCall![0].data).toMatchObject({
      hospitalId: 'h1',
      category: 'INVENTORY',
      severity: 'WARNING',
      title: 'Reorder Level Reached',
    })
    expect(warningCall![0].data.description).toContain('Composite')
    expect(warningCall![0].data.description).not.toContain('Cement')
  })

  it('creates alerts for expiring batches', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    // All stock is fine
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { id: 'item-1', name: 'Cement', currentStock: 100, reorderLevel: 10, minimumStock: 5, unit: 'tubes' },
    ] as any)

    // But a batch is expiring
    const expiryDate = new Date(now.getTime() + 15 * DAY_MS)
    vi.mocked(prisma.inventoryBatch.findMany).mockResolvedValue([
      {
        id: 'batch-1',
        expiryDate,
        remainingQty: 20,
        item: { name: 'Cement' },
      },
    ] as any)
    vi.mocked(prisma.stockTransaction.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)

    const res = await inventoryGET(authedReq('inventory'))
    expect(res.status).toBe(200)

    const createCalls = vi.mocked(prisma.aIInsight.create).mock.calls
    const expiryCall = createCalls.find((c) => c[0].data.title === 'Batches Expiring Soon')
    expect(expiryCall).toBeDefined()
    expect(expiryCall![0].data).toMatchObject({
      hospitalId: 'h1',
      category: 'INVENTORY',
      severity: 'WARNING',
    })
    expect(expiryCall![0].data.description).toContain('Cement')
    expect(expiryCall![0].data.description).toContain('FEFO')
  })

  it('creates multiple alert types when applicable', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      // Critical: at minimum stock
      { id: 'item-1', name: 'Gloves', currentStock: 2, reorderLevel: 20, minimumStock: 5, unit: 'boxes' },
      // Approaching reorder but above minimum
      { id: 'item-2', name: 'Composite', currentStock: 8, reorderLevel: 10, minimumStock: 3, unit: 'syringes' },
    ] as any)

    vi.mocked(prisma.inventoryBatch.findMany).mockResolvedValue([
      {
        id: 'batch-1',
        expiryDate: new Date(now.getTime() + 10 * DAY_MS),
        remainingQty: 5,
        item: { name: 'Anesthetic' },
      },
    ] as any)
    vi.mocked(prisma.stockTransaction.groupBy).mockResolvedValue([] as any)
    vi.mocked(prisma.aIInsight.create).mockResolvedValue({} as any)

    const res = await inventoryGET(authedReq('inventory'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results[0].alertsCreated).toBeGreaterThanOrEqual(3)

    const createCalls = vi.mocked(prisma.aIInsight.create).mock.calls
    expect(createCalls.length).toBeGreaterThanOrEqual(3)

    const severities = createCalls.map((c) => c[0].data.severity)
    expect(severities).toContain('CRITICAL')
    expect(severities.filter((s) => s === 'WARNING').length).toBeGreaterThanOrEqual(2)
  })

  it('handles no alerts needed', async () => {
    vi.mocked(prisma.hospital.findMany).mockResolvedValue([{ id: 'h1' }] as any)

    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
      { id: 'item-1', name: 'Cement', currentStock: 100, reorderLevel: 10, minimumStock: 5, unit: 'tubes' },
    ] as any)
    vi.mocked(prisma.inventoryBatch.findMany).mockResolvedValue([])

    const res = await inventoryGET(authedReq('inventory'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results[0].alertsCreated).toBe(0)
    expect(prisma.aIInsight.create).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6. POST /api/cron/cleanup
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/cron/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without auth header', async () => {
    const res = await cleanupPOST(unauthedReq('cleanup', 'POST') as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong secret', async () => {
    const res = await cleanupPOST(badSecretReq('cleanup', 'POST') as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('deletes old conversations, executions, and expired insights', async () => {
    vi.mocked(prisma.aIConversation.deleteMany).mockResolvedValue({ count: 15 })
    vi.mocked(prisma.aISkillExecution.deleteMany).mockResolvedValue({ count: 42 })
    vi.mocked(prisma.aIInsight.deleteMany).mockResolvedValue({ count: 8 })

    const res = await cleanupPOST(authedReq('cleanup', 'POST') as any)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.retentionDays).toBe(90)
    expect(body.cutoffDate).toBeDefined()
    expect(body.deleted).toEqual({
      conversations: 15,
      executions: 42,
      expiredInsights: 8,
    })

    // Verify deleteMany calls
    expect(prisma.aIConversation.deleteMany).toHaveBeenCalledOnce()
    expect(prisma.aISkillExecution.deleteMany).toHaveBeenCalledOnce()
    expect(prisma.aIInsight.deleteMany).toHaveBeenCalledOnce()

    // Verify cutoff date is ~90 days ago
    const convCall = vi.mocked(prisma.aIConversation.deleteMany).mock.calls[0][0]
    const cutoff = new Date(convCall.where.createdAt.lt)
    const expectedCutoff = new Date(Date.now() - 90 * DAY_MS)
    // Allow 5 second tolerance for test execution time
    expect(Math.abs(cutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(5000)

    // Expired insights use current date, not cutoff
    const insightCall = vi.mocked(prisma.aIInsight.deleteMany).mock.calls[0][0]
    const expiresLt = new Date(insightCall.where.expiresAt.lt)
    expect(Math.abs(expiresLt.getTime() - Date.now())).toBeLessThan(5000)
  })

  it('returns deletion counts of zero when nothing to clean', async () => {
    vi.mocked(prisma.aIConversation.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.aISkillExecution.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.aIInsight.deleteMany).mockResolvedValue({ count: 0 })

    const res = await cleanupPOST(authedReq('cleanup', 'POST') as any)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.deleted).toEqual({
      conversations: 0,
      executions: 0,
      expiredInsights: 0,
    })
  })
})
