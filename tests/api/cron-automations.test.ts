// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

// ── Imports ──────────────────────────────────────────────────────────────────

import { POST as automationsPOST } from '@/app/api/cron/automations/route'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET || 'your-cron-secret-key'

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/automations', {
    method: 'POST',
    headers,
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/cron/automations
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/cron/automations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without valid cron secret', async () => {
    const res = await automationsPOST(makeReq({ Authorization: 'Bearer wrong-secret' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 without authorization header', async () => {
    const res = await automationsPOST(makeReq())
    expect(res.status).toBe(401)
  })

  it('returns empty results when no automations exist', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([])

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.evaluated).toBe(0)
    expect(body.totalTriggered).toBe(0)
    expect(body.results).toHaveLength(0)
  })

  it('processes NO_VISIT trigger and sends SMS', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto1',
        name: 'Re-engage Lost Patients',
        hospitalId: 'h1',
        isActive: true,
        trigger: { type: 'NO_VISIT', params: { days: 180 } },
        action: { type: 'SEND_SMS', params: { templateId: 'tmpl1' } },
      },
    ] as any)

    // Patients with no recent visit
    vi.mocked(prisma.patient.findMany)
      .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }] as any) // matched by trigger
      .mockResolvedValueOnce([ // fetched for SMS
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        { id: 'p2', firstName: 'Jane', lastName: 'Smith', phone: '9876543211' },
      ] as any)

    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({
      id: 'tmpl1', content: 'Hi {{firstName}}, we miss you!', subject: 'Come back',
    } as any)
    vi.mocked(prisma.sMSLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.evaluated).toBe(1)
    expect(body.totalTriggered).toBe(2)
    expect(body.results[0].matched).toBe(2)
    expect(body.results[0].action).toBe('SEND_SMS')
    // SMS should have been created for each patient
    expect(prisma.sMSLog.create).toHaveBeenCalledTimes(2)
  })

  it('processes BIRTHDAY_UPCOMING trigger', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto2',
        name: 'Birthday Wishes',
        hospitalId: 'h1',
        isActive: true,
        trigger: { type: 'BIRTHDAY_UPCOMING', params: { days: 3 } },
        action: { type: 'CREATE_NOTIFICATION', params: { title: 'Birthday!', message: 'Wish patient' } },
      },
    ] as any)

    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([{ id: 'p1' }] as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.results[0].matched).toBe(1)
    expect(body.results[0].action).toBe('CREATE_NOTIFICATION')
    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
  })

  it('processes PAYMENT_OVERDUE trigger and sends email', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto3',
        name: 'Payment Reminder',
        hospitalId: 'h1',
        isActive: true,
        trigger: { type: 'PAYMENT_OVERDUE', params: { days: 30 } },
        action: { type: 'SEND_EMAIL', params: { templateId: 'tmpl2' } },
      },
    ] as any)

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { patientId: 'p1' },
    ] as any)

    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({
      id: 'tmpl2', name: 'Payment Reminder', subject: 'Payment Due',
      content: 'Dear {{firstName}}, your payment is overdue.',
    } as any)

    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: 'p1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
    ] as any)
    vi.mocked(prisma.emailLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.results[0].matched).toBe(1)
    expect(body.results[0].action).toBe('SEND_EMAIL')
    expect(prisma.emailLog.create).toHaveBeenCalledTimes(1)
  })

  it('processes TREATMENT_PLAN_PENDING trigger', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto4',
        name: 'Follow Up Treatments',
        hospitalId: 'h1',
        isActive: true,
        trigger: { type: 'TREATMENT_PLAN_PENDING', params: { days: 14 } },
        action: { type: 'CREATE_NOTIFICATION', params: { title: 'Treatment Pending' } },
      },
    ] as any)

    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      { patientId: 'p1' },
      { patientId: 'p2' },
    ] as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.results[0].matched).toBe(2)
  })

  it('processes MEMBERSHIP_EXPIRING trigger', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto5',
        name: 'Membership Renewal',
        hospitalId: 'h1',
        isActive: true,
        trigger: { type: 'MEMBERSHIP_EXPIRING', params: { days: 7 } },
        action: { type: 'CREATE_NOTIFICATION', params: { title: 'Membership Expiring' } },
      },
    ] as any)

    vi.mocked(prisma.patientMembership.findMany).mockResolvedValue([
      { patientId: 'p1' },
    ] as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.results[0].matched).toBe(1)
  })

  it('processes POST_APPOINTMENT trigger', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto6',
        name: 'Post Visit Survey',
        hospitalId: 'h1',
        isActive: true,
        trigger: { type: 'POST_APPOINTMENT', params: {} },
        action: { type: 'CREATE_NOTIFICATION', params: { title: 'Survey' } },
      },
    ] as any)

    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { patientId: 'p1' },
    ] as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.results[0].matched).toBe(1)
  })

  it('updates automation stats after run', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto1', name: 'Test', hospitalId: 'h1', isActive: true,
        trigger: { type: 'NO_VISIT', params: { days: 180 } },
        action: { type: 'CREATE_NOTIFICATION', params: {} },
      },
    ] as any)
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])
    vi.mocked(prisma.marketingAutomation.update).mockResolvedValue({} as any)

    await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))

    expect(prisma.marketingAutomation.update).toHaveBeenCalledWith({
      where: { id: 'auto1' },
      data: {
        lastRunAt: expect.any(Date),
        runCount: { increment: 1 },
      },
    })
  })

  it('handles automation errors gracefully', async () => {
    vi.mocked(prisma.marketingAutomation.findMany).mockResolvedValue([
      {
        id: 'auto1', name: 'Broken', hospitalId: 'h1', isActive: true,
        trigger: { type: 'NO_VISIT', params: { days: 180 } },
        action: { type: 'SEND_SMS', params: {} },
      },
    ] as any)
    vi.mocked(prisma.patient.findMany).mockRejectedValue(new Error('DB error'))

    const res = await automationsPOST(makeReq({ Authorization: `Bearer ${CRON_SECRET}` }))
    const body = await res.json()

    expect(body.results[0].action).toBe('ERROR')
    expect(body.results[0].matched).toBe(0)
  })
})
