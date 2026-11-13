// The email and SMS services use the sending clinic's own settings, and the
// rules for scheduling a message.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: { createTransport: h.createTransport },
}))

vi.mock('@/lib/prisma', () => {
  const mock = {
    setting: { findMany: vi.fn(), findFirst: vi.fn() },
    emailLog: { create: vi.fn(), update: vi.fn() },
    sMSLog: { create: vi.fn(), update: vi.fn() },
    patientCommunicationPreference: { findUnique: vi.fn() },
  }
  return { default: mock, prisma: mock }
})

import prisma from '@/lib/prisma'

const emailSettings = (hospitalId: string, user: string) =>
  [
    ['email.smtp.host', `smtp.${hospitalId}.test`],
    ['email.smtp.port', '587'],
    ['email.smtp.user', user],
    ['email.smtp.password', 'secret'],
    ['email.from.name', `Clinic ${hospitalId}`],
    ['email.from.email', `${user}@${hospitalId}.test`],
  ].map(([key, value]) => ({ hospitalId, key, value, category: 'email' }))

const smsSettings = (hospitalId: string, apiKey: string) =>
  [
    ['sms.gateway', 'MSG91'],
    ['sms.apiKey', apiKey],
    ['sms.senderId', 'CLINIC'],
  ].map(([key, value]) => ({ hospitalId, key, value, category: 'sms' }))

// Answers setting.findMany like the database: only the asked clinic's rows.
function settingsByClinic(rows: Record<string, any[]>) {
  vi.mocked(prisma.setting.findMany).mockImplementation((async (args: any) => {
    return (rows[args.where.hospitalId] ?? []).filter((r) => r.category === args.where.category)
  }) as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  h.createTransport.mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
    sendMail: h.sendMail.mockResolvedValue({ messageId: 'm1' }),
    close: h.close,
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => ({ type: 'success', requestId: 'r1' }) }))
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('email: each clinic sends with its own SMTP settings', () => {
  it('reads only the sending clinic’s settings', async () => {
    settingsByClinic({ h1: emailSettings('h1', 'one'), h2: emailSettings('h2', 'two') })
    const { emailService } = await import('@/lib/services/email.service')

    await emailService.dispatchLog('e1', {
      hospitalId: 'h2',
      to: 'p@example.com',
      subject: 's',
      body: 'b',
    })

    expect(prisma.setting.findMany).toHaveBeenCalledWith({
      where: { hospitalId: 'h2', category: 'email' },
    })
    expect(h.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.h2.test', auth: { user: 'two', pass: 'secret' } })
    )
    expect(h.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"Clinic h2" <two@h2.test>' })
    )
  })

  it('keeps one connection per clinic, and rebuilds it when the settings change', async () => {
    const rows = { h1: emailSettings('h1', 'one'), h2: emailSettings('h2', 'two') }
    settingsByClinic(rows)
    const { emailService } = await import('@/lib/services/email.service')
    const send = (hospitalId: string) =>
      emailService.dispatchLog('e', { hospitalId, to: 'p@example.com', subject: 's', body: 'b' })

    await send('h1')
    await send('h2')
    await send('h1')
    expect(h.createTransport).toHaveBeenCalledTimes(2)

    rows.h1 = emailSettings('h1', 'changed')
    await send('h1')
    expect(h.createTransport).toHaveBeenCalledTimes(3)
    expect(h.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ auth: { user: 'changed', pass: 'secret' } })
    )
    expect(h.close).toHaveBeenCalledTimes(1)
  })

  it('fails for a clinic without settings, even when another clinic has them', async () => {
    settingsByClinic({ h1: emailSettings('h1', 'one') })
    const { emailService } = await import('@/lib/services/email.service')

    await expect(
      emailService.dispatchLog('e1', {
        hospitalId: 'h2',
        to: 'p@example.com',
        subject: 's',
        body: 'b',
      })
    ).rejects.toThrow('Email not configured')
    expect(h.sendMail).not.toHaveBeenCalled()
    expect(prisma.emailLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    )
  })

  it('refuses a scheduled email with attachments', async () => {
    const { emailService } = await import('@/lib/services/email.service')
    await expect(
      emailService.sendEmail({
        hospitalId: 'h1',
        to: 'p@example.com',
        subject: 's',
        body: 'b',
        attachments: [{ filename: 'x.pdf', content: 'abc' }],
        scheduledFor: new Date(Date.now() + 3600_000),
      })
    ).rejects.toThrow('cannot have attachments')
    expect(prisma.emailLog.create).not.toHaveBeenCalled()
  })

  it('stores a scheduled email without sending it', async () => {
    vi.mocked(prisma.emailLog.create).mockResolvedValue({ id: 'e1' } as any)
    const { emailService } = await import('@/lib/services/email.service')
    await emailService.sendEmail({
      hospitalId: 'h1',
      to: 'p@example.com',
      subject: 's',
      body: 'b',
      scheduledFor: new Date(Date.now() + 3600_000),
    })
    expect(prisma.setting.findMany).not.toHaveBeenCalled()
    expect(h.sendMail).not.toHaveBeenCalled()
  })
})

describe('SMS: each clinic sends through its own gateway', () => {
  it('reads only the sending clinic’s settings and uses its key', async () => {
    settingsByClinic({ h1: smsSettings('h1', 'key-one'), h2: smsSettings('h2', 'key-two') })
    const { smsService } = await import('@/lib/services/sms.service')

    await smsService.dispatchLog('s1', { hospitalId: 'h2', phone: '9876543210', message: 'm' })

    expect(prisma.setting.findMany).toHaveBeenCalledWith({
      where: { hospitalId: 'h2', category: 'sms' },
    })
    const [, init] = vi.mocked(fetch).mock.calls[0] as any
    expect(init.headers.authkey).toBe('key-two')
    expect(prisma.sMSLog.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ status: 'SENT', gateway: 'MSG91' }),
    })
  })

  it('fails for a clinic without a gateway, even when another clinic has one', async () => {
    settingsByClinic({ h1: smsSettings('h1', 'key-one') })
    const { smsService } = await import('@/lib/services/sms.service')
    await expect(
      smsService.dispatchLog('s1', { hospitalId: 'h2', phone: '9876543210', message: 'm' })
    ).rejects.toThrow('SMS gateway not configured')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('SMS: scheduling', () => {
  // 11 PM IST on 19 Feb 2026.
  const lateEvening = new Date('2026-02-19T17:30:00Z')

  it('accepts a daytime slot even when scheduled at night, and doesn’t send it yet', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(lateEvening)
    vi.mocked(prisma.sMSLog.create).mockResolvedValue({ id: 's1' } as any)
    const { smsService } = await import('@/lib/services/sms.service')

    // 10 AM IST the next day.
    const id = await smsService.sendSMS({
      hospitalId: 'h1',
      phone: '9876543210',
      message: 'm',
      scheduledFor: new Date('2026-02-20T04:30:00Z'),
    })

    expect(id).toBe('s1')
    expect(prisma.sMSLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'PENDING' }),
    })
    expect(prisma.setting.findMany).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuses a slot outside 9 AM–9 PM IST', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T06:30:00Z'))
    const { smsService } = await import('@/lib/services/sms.service')

    // 10 PM IST.
    await expect(
      smsService.sendSMS({
        hospitalId: 'h1',
        phone: '9876543210',
        message: 'm',
        scheduledFor: new Date('2026-02-19T16:30:00Z'),
      })
    ).rejects.toThrow('between 9 AM and 9 PM IST')
    expect(prisma.sMSLog.create).not.toHaveBeenCalled()
  })

  it('refuses a scheduled SMS whose log would hold different text', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T06:30:00Z'))
    const { smsService } = await import('@/lib/services/sms.service')
    await expect(
      smsService.sendSMS({
        hospitalId: 'h1',
        phone: '9876543210',
        message: 'code 123456',
        logMessage: 'code ••••••',
        scheduledFor: new Date('2026-02-19T08:30:00Z'),
      })
    ).rejects.toThrow('separate log message')
  })

  it('isWithinSmsHours follows IST', async () => {
    const { isWithinSmsHours } = await import('@/lib/services/sms.service')
    expect(isWithinSmsHours(new Date('2026-02-19T03:29:00Z'))).toBe(false) // 8:59 IST
    expect(isWithinSmsHours(new Date('2026-02-19T03:30:00Z'))).toBe(true) // 9:00 IST
    expect(isWithinSmsHours(new Date('2026-02-19T15:29:00Z'))).toBe(true) // 20:59 IST
    expect(isWithinSmsHours(new Date('2026-02-19T15:30:00Z'))).toBe(false) // 21:00 IST
  })
})
