// The outbox: sends scheduled email and SMS when they're due.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({ enqueue: vi.fn() }))

vi.mock('@/lib/queue', () => ({ enqueue: h.enqueue }))

vi.mock('@/lib/prisma', () => {
  const log = () => ({ updateMany: vi.fn(), findMany: vi.fn(), update: vi.fn() })
  const mock = {
    emailLog: log(),
    sMSLog: log(),
    patientCommunicationPreference: { findUnique: vi.fn() },
  }
  return { default: mock, prisma: mock }
})

import prisma from '@/lib/prisma'
import {
  drainOutbox,
  NOTE_ATTACHMENTS,
  NOTE_EMAIL_OPTED_OUT,
  NOTE_EXPIRED,
  NOTE_SMS_OPTED_OUT,
} from '@/lib/services/outbox.service'
import { GET as cronGET } from '@/app/api/cron/outbox/route'

const db = prisma as any
// Noon IST, inside SMS hours.
const NOON_IST = new Date('2026-11-12T06:30:00Z')
// 11 PM IST, outside them.
const NIGHT_IST = new Date('2026-11-12T17:30:00Z')

const emailRow = (id: string, extra = {}) => ({
  id,
  hospitalId: 'h1',
  email: 'p@example.com',
  subject: 'Hello',
  body: '<p>Hi</p>',
  patientId: null,
  templateId: null,
  attachments: null,
  status: 'PENDING',
  scheduledFor: new Date(NOON_IST.getTime() - 60_000),
  ...extra,
})
const smsRow = (id: string, extra = {}) => ({
  id,
  hospitalId: 'h1',
  phone: '9876543210',
  message: 'Hi',
  patientId: null,
  templateId: null,
  status: 'PENDING',
  scheduledFor: new Date(NOON_IST.getTime() - 60_000),
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  for (const model of [db.emailLog, db.sMSLog]) {
    model.updateMany.mockResolvedValue({ count: 1 })
    model.findMany.mockResolvedValue([])
    model.update.mockResolvedValue({})
  }
  db.patientCommunicationPreference.findUnique.mockResolvedValue(null)
  h.enqueue.mockResolvedValue({ queued: false })
})

describe('drainOutbox', () => {
  it('cancels messages more than 24 hours late instead of sending them', async () => {
    db.emailLog.updateMany.mockResolvedValueOnce({ count: 3 })
    db.sMSLog.updateMany.mockResolvedValueOnce({ count: 2 })

    const result = await drainOutbox(NOON_IST)

    const cutoff = new Date(NOON_IST.getTime() - 24 * 3600_000)
    for (const model of [db.emailLog, db.sMSLog]) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', scheduledFor: { lt: cutoff } },
        data: { status: 'CANCELLED', errorMessage: NOTE_EXPIRED },
      })
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING', scheduledFor: { gte: cutoff, lte: NOON_IST } },
        })
      )
    }
    expect(result.email.expired).toBe(3)
    expect(result.sms.expired).toBe(2)
    expect(h.enqueue).not.toHaveBeenCalled()
  })

  it('claims each due message, then sends it with the same job an immediate send uses', async () => {
    db.emailLog.findMany.mockResolvedValue([emailRow('e1', { patientId: 'p1' })])
    db.sMSLog.findMany.mockResolvedValue([smsRow('s1')])

    const result = await drainOutbox(NOON_IST)

    expect(db.emailLog.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', status: 'PENDING' },
      data: { status: 'QUEUED' },
    })
    expect(h.enqueue).toHaveBeenCalledWith(
      'send-email',
      {
        emailLogId: 'e1',
        payload: {
          hospitalId: 'h1',
          to: 'p@example.com',
          subject: 'Hello',
          body: '<p>Hi</p>',
          patientId: 'p1',
          templateId: undefined,
        },
      },
      { jobId: 'email:e1' }
    )
    expect(h.enqueue).toHaveBeenCalledWith(
      'send-sms',
      {
        smsLogId: 's1',
        payload: {
          hospitalId: 'h1',
          phone: '9876543210',
          message: 'Hi',
          patientId: undefined,
          templateId: undefined,
        },
      },
      { jobId: 'sms:s1' }
    )
    expect(result.email.sent).toBe(1)
    expect(result.sms.sent).toBe(1)
  })

  it('skips a message another run has already claimed', async () => {
    db.emailLog.findMany.mockResolvedValue([emailRow('e1'), emailRow('e2')])
    db.emailLog.updateMany.mockImplementation(async ({ where }: any) => ({
      count: where.id === 'e1' ? 0 : 1,
    }))

    const result = await drainOutbox(NOON_IST)

    expect(h.enqueue).toHaveBeenCalledTimes(1)
    expect(h.enqueue.mock.calls[0][1].emailLogId).toBe('e2')
    expect(result.email.sent).toBe(1)
  })

  it('cancels instead of sending when the patient has since opted out', async () => {
    db.emailLog.findMany.mockResolvedValue([emailRow('e1', { patientId: 'p1' })])
    db.sMSLog.findMany.mockResolvedValue([
      smsRow('s1', { patientId: 'p1' }),
      smsRow('s2', { patientId: 'p2' }),
    ])
    db.patientCommunicationPreference.findUnique.mockImplementation(async ({ where }: any) =>
      where.patientId === 'p1'
        ? { emailEnabled: false, smsEnabled: false, dndRegistered: false }
        : { emailEnabled: true, smsEnabled: true, dndRegistered: true }
    )

    const result = await drainOutbox(NOON_IST)

    expect(db.emailLog.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'CANCELLED', errorMessage: NOTE_EMAIL_OPTED_OUT },
    })
    for (const id of ['s1', 's2'])
      expect(db.sMSLog.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: 'CANCELLED', errorMessage: NOTE_SMS_OPTED_OUT },
      })
    expect(h.enqueue).not.toHaveBeenCalled()
    expect(result.email.cancelled).toBe(1)
    expect(result.sms.cancelled).toBe(2)
  })

  it('cancels a scheduled email with attachments, whose content was never stored', async () => {
    db.emailLog.findMany.mockResolvedValue([
      emailRow('e1', { attachments: '[{"filename":"x.pdf"}]' }),
    ])

    const result = await drainOutbox(NOON_IST)

    expect(db.emailLog.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'CANCELLED', errorMessage: NOTE_ATTACHMENTS },
    })
    expect(h.enqueue).not.toHaveBeenCalled()
    expect(result.email.cancelled).toBe(1)
  })

  it('holds SMS outside 9 AM–9 PM IST, but still sends email', async () => {
    db.emailLog.findMany.mockResolvedValue([emailRow('e1')])
    db.sMSLog.findMany.mockResolvedValue([smsRow('s1')])

    const result = await drainOutbox(NIGHT_IST)

    expect(db.sMSLog.findMany).not.toHaveBeenCalled()
    expect(h.enqueue).toHaveBeenCalledTimes(1)
    expect(h.enqueue.mock.calls[0][0]).toBe('send-email')
    expect(result.sms.heldUntilSmsHours).toBe(true)
  })

  it('counts queued and failed sends', async () => {
    db.emailLog.findMany.mockResolvedValue([emailRow('e1'), emailRow('e2')])
    h.enqueue.mockResolvedValueOnce({ queued: true }).mockRejectedValueOnce(new Error('SMTP down'))

    const result = await drainOutbox(NOON_IST)

    expect(result.email).toMatchObject({ queued: 1, failed: 1, sent: 0 })
  })
})

describe('outbox timer', () => {
  afterEach(async () => {
    const { stopOutboxScheduler } = await import('@/lib/services/outbox-scheduler')
    stopOutboxScheduler()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('reads OUTBOX_INTERVAL_SECONDS: default 60s, 0 turns it off, at least 10s', async () => {
    const { outboxIntervalMs } = await import('@/lib/services/outbox-scheduler')
    expect(outboxIntervalMs(undefined)).toBe(60_000)
    expect(outboxIntervalMs('')).toBe(60_000)
    expect(outboxIntervalMs('0')).toBe(0)
    expect(outboxIntervalMs('5')).toBe(10_000)
    expect(outboxIntervalMs('120')).toBe(120_000)
    expect(outboxIntervalMs('soon')).toBe(60_000)
  })

  it('runs every interval, once per process', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON_IST)
    vi.stubEnv('OUTBOX_INTERVAL_SECONDS', '30')
    const { startOutboxScheduler } = await import('@/lib/services/outbox-scheduler')

    expect(startOutboxScheduler()).toBe(true)
    expect(startOutboxScheduler()).toBe(false)
    expect(db.emailLog.findMany).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(db.emailLog.findMany).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(db.emailLog.findMany).toHaveBeenCalledTimes(2)
  })

  it('does not start a run while the last one is still going', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON_IST)
    vi.stubEnv('OUTBOX_INTERVAL_SECONDS', '10')
    let finish: () => void = () => {}
    db.emailLog.findMany.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve([])))
    )
    const { startOutboxScheduler } = await import('@/lib/services/outbox-scheduler')
    startOutboxScheduler()

    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(db.emailLog.findMany).toHaveBeenCalledTimes(1)

    finish()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(db.emailLog.findMany).toHaveBeenCalledTimes(2)
  })

  it('stays off when OUTBOX_INTERVAL_SECONDS is 0', async () => {
    vi.stubEnv('OUTBOX_INTERVAL_SECONDS', '0')
    const { startOutboxScheduler } = await import('@/lib/services/outbox-scheduler')
    expect(startOutboxScheduler()).toBe(false)
  })
})

describe('GET /api/cron/outbox', () => {
  const call = (auth?: string) =>
    cronGET(
      new Request('http://localhost/api/cron/outbox', {
        headers: auth ? { Authorization: auth } : {},
      })
    )

  it('needs the cron secret', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    expect(db.emailLog.findMany).not.toHaveBeenCalled()
  })

  it('runs the outbox and reports what it did', async () => {
    db.emailLog.findMany.mockResolvedValue([emailRow('e1')])
    const res = await call(`Bearer ${process.env.CRON_SECRET}`)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.email.sent).toBe(1)
    expect(body.processedAt).toBeTruthy()
  })
})
