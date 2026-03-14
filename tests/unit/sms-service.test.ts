import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before import
vi.mock('@/lib/prisma', () => {
  const mock = {
    setting: {
      findMany: vi.fn(),
    },
    sMSLog: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    smsLog: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    patientCommunicationPreference: {
      findUnique: vi.fn(),
    },
    communicationTemplate: {
      findUnique: vi.fn(),
    },
  }
  // Alias
  mock.smsLog = mock.sMSLog
  return { default: mock, prisma: mock }
})

// We'll test the service's internal methods via a testing approach
// Since SMSService has private methods, we test them through the public interface

import prisma from '@/lib/prisma'

// Re-create the service for each test to reset state
let smsServiceModule: any

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())

  // Reset the module cache so we get a fresh SMSService instance each time
  vi.resetModules()
  smsServiceModule = await import('@/lib/services/sms.service')
})

// ---------------------------------------------------------------------------
// Phone number validation (tested via sendSMS)
// ---------------------------------------------------------------------------

describe('SMSService - Phone Validation', () => {
  it('rejects invalid phone numbers', async () => {
    const { smsService } = smsServiceModule

    // Set up minimal mocks - the send should fail at validation before DB calls
    await expect(
      smsService.sendSMS({ phone: '12345', message: 'test' })
    ).rejects.toThrow('Invalid phone number')
  })

  it('rejects phone starting with 0-5', async () => {
    const { smsService } = smsServiceModule

    await expect(
      smsService.sendSMS({ phone: '0123456789', message: 'test' })
    ).rejects.toThrow('Invalid phone number')

    await expect(
      smsService.sendSMS({ phone: '5123456789', message: 'test' })
    ).rejects.toThrow('Invalid phone number')
  })

  it('rejects phone with fewer than 10 digits', async () => {
    const { smsService } = smsServiceModule

    await expect(
      smsService.sendSMS({ phone: '98765', message: 'test' })
    ).rejects.toThrow('Invalid phone number')
  })

  it('rejects phone with more than 10 digits', async () => {
    const { smsService } = smsServiceModule

    await expect(
      smsService.sendSMS({ phone: '98765432100', message: 'test' })
    ).rejects.toThrow('Invalid phone number')
  })
})

// ---------------------------------------------------------------------------
// DND / Communication Preference checks
// ---------------------------------------------------------------------------

describe('SMSService - Communication Preferences', () => {
  it('rejects when patient is on DND registry', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.patientCommunicationPreference.findUnique).mockResolvedValue({
      dndRegistered: true,
      smsEnabled: true,
    } as any)

    await expect(
      smsService.sendSMS({
        phone: '9876543210',
        message: 'test',
        patientId: 'patient-1',
      })
    ).rejects.toThrow('DND registry')
  })

  it('rejects when patient has disabled SMS', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.patientCommunicationPreference.findUnique).mockResolvedValue({
      dndRegistered: false,
      smsEnabled: false,
    } as any)

    await expect(
      smsService.sendSMS({
        phone: '9876543210',
        message: 'test',
        patientId: 'patient-1',
      })
    ).rejects.toThrow('disabled SMS')
  })
})

// ---------------------------------------------------------------------------
// Time restrictions
// ---------------------------------------------------------------------------

describe('SMSService - Time Restrictions', () => {
  it('rejects SMS outside allowed hours (before 9 AM IST)', async () => {
    const { smsService } = smsServiceModule

    // Mock current time to 3 AM IST (3:00 AM IST = 9:30 PM UTC previous day)
    const mockDate = new Date('2026-02-19T21:30:00Z') // 3 AM IST next day
    vi.setSystemTime(mockDate)

    // No patient preferences to check
    await expect(
      smsService.sendSMS({ phone: '9876543210', message: 'test' })
    ).rejects.toThrow('outside 9 AM - 9 PM')

    vi.useRealTimers()
  })

  it('allows SMS during allowed hours (12 PM IST)', async () => {
    const { smsService } = smsServiceModule

    // 12 PM IST = 6:30 AM UTC
    const mockDate = new Date('2026-02-19T06:30:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)

    // Set up to pass phone validation and time check, then fail at initialize
    vi.mocked(prisma.sMSLog.create).mockResolvedValue({ id: 'sms-1' } as any)
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])

    // Should get past phone validation and time check, fail at initialize
    await expect(
      smsService.sendSMS({ phone: '9876543210', message: 'test' })
    ).rejects.toThrow('SMS gateway not configured')

    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// SMS Logging
// ---------------------------------------------------------------------------

describe('SMSService - SMS Logging', () => {
  it('creates SMS log entry before sending (no patientId)', async () => {
    const { smsService } = smsServiceModule

    // Set time to allowed window
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T06:30:00Z')) // 12 PM IST

    vi.mocked(prisma.sMSLog.create).mockResolvedValue({ id: 'sms-1' } as any)
    vi.mocked(prisma.setting.findMany).mockResolvedValue([])

    try {
      await smsService.sendSMS({
        phone: '9876543210',
        message: 'Hello',
        hospitalId: 'hosp-1',
        // No patientId — skip DND/preference checks
      })
    } catch (e) {
      // Expected to fail at gateway init
    }

    expect(prisma.sMSLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '9876543210',
          message: 'Hello',
          hospitalId: 'hosp-1',
          status: 'QUEUED',
        }),
      })
    )

    vi.useRealTimers()
  })

  it('creates PENDING status for scheduled SMS', async () => {
    const { smsService } = smsServiceModule

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-19T06:30:00Z'))

    const futureDate = new Date('2026-03-01T06:30:00Z')
    vi.mocked(prisma.sMSLog.create).mockResolvedValue({ id: 'sms-1' } as any)

    const result = await smsService.sendSMS({
      phone: '9876543210',
      message: 'Scheduled',
      scheduledFor: futureDate,
    })

    expect(result).toBe('sms-1')
    expect(prisma.sMSLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          scheduledFor: futureDate,
        }),
      })
    )

    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// Template Processing
// ---------------------------------------------------------------------------

describe('SMSService - processTemplate', () => {
  it('replaces variables in template content', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.communicationTemplate.findUnique).mockResolvedValue({
      id: 'tpl-1',
      content: 'Hello {{patientName}}, your appointment is on {{appointmentDate}}',
      isActive: true,
    } as any)

    const result = await smsService.processTemplate('tpl-1', {
      patientName: 'Rahul',
      appointmentDate: '25-Jan-2026',
    })

    expect(result).toBe('Hello Rahul, your appointment is on 25-Jan-2026')
  })

  it('throws for inactive template', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.communicationTemplate.findUnique).mockResolvedValue({
      id: 'tpl-1',
      content: 'Test',
      isActive: false,
    } as any)

    await expect(smsService.processTemplate('tpl-1', {})).rejects.toThrow(
      'Template not found or inactive'
    )
  })

  it('throws for non-existent template', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.communicationTemplate.findUnique).mockResolvedValue(null)

    await expect(smsService.processTemplate('missing', {})).rejects.toThrow(
      'Template not found or inactive'
    )
  })
})

// ---------------------------------------------------------------------------
// Delivery Status
// ---------------------------------------------------------------------------

describe('SMSService - getDeliveryStatus', () => {
  it('returns status from SMS log', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.sMSLog.findUnique).mockResolvedValue({
      id: 'sms-1',
      status: 'SENT',
    } as any)

    const status = await smsService.getDeliveryStatus('sms-1')
    expect(status).toBe('SENT')
  })

  it('throws for non-existent SMS log', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.sMSLog.findUnique).mockResolvedValue(null)

    await expect(smsService.getDeliveryStatus('missing')).rejects.toThrow(
      'SMS log not found'
    )
  })
})

// ---------------------------------------------------------------------------
// SMS History
// ---------------------------------------------------------------------------

describe('SMSService - getSMSHistory', () => {
  it('queries with correct filters', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.sMSLog.findMany).mockResolvedValue([])

    await smsService.getSMSHistory({
      patientId: 'pat-1',
      status: 'SENT',
      limit: 50,
    })

    expect(prisma.sMSLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 'pat-1',
          status: 'SENT',
        }),
        take: 50,
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('defaults limit to 100', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.sMSLog.findMany).mockResolvedValue([])

    await smsService.getSMSHistory({})

    expect(prisma.sMSLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    )
  })

  it('supports date range filters', async () => {
    const { smsService } = smsServiceModule

    vi.mocked(prisma.sMSLog.findMany).mockResolvedValue([])
    const from = new Date('2026-01-01')
    const to = new Date('2026-01-31')

    await smsService.getSMSHistory({ from, to })

    expect(prisma.sMSLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: from, lte: to },
        }),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// Check Balance
// ---------------------------------------------------------------------------

describe('SMSService - checkBalance', () => {
  it('returns balance with currency', async () => {
    const { smsService } = smsServiceModule
    const result = await smsService.checkBalance()
    expect(result).toHaveProperty('balance')
    expect(result).toHaveProperty('currency')
    expect(result.currency).toBe('INR')
  })
})
