import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma, resetPrismaMocks } from '../__mocks__/prisma'

// Mock prisma before importing the module under test
vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

import { dispatchEvent, type EventType } from '@/lib/ai/event-dispatcher'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const HOSPITAL_ID = 'hospital-test-001'

function buildPayload(type: EventType, extra: Record<string, unknown> = {}) {
  return { type, hospitalId: HOSPITAL_ID, payload: extra }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  resetPrismaMocks()

  // Default mock return values
  prisma.aISkillExecution.create.mockResolvedValue({ id: 'exec-1' })
  prisma.aISkillExecution.update.mockResolvedValue({})
  prisma.aIInsight.create.mockResolvedValue({ id: 'insight-1' })
})

// ---------------------------------------------------------------------------
// 1. Creates AISkillExecution on dispatch (status RUNNING)
// ---------------------------------------------------------------------------
describe('dispatchEvent — execution lifecycle', () => {
  it('creates an AISkillExecution with status RUNNING on dispatch', async () => {
    await dispatchEvent(buildPayload('treatment.completed', { treatmentId: 'tx-1' }))

    expect(prisma.aISkillExecution.create).toHaveBeenCalledTimes(1)
    expect(prisma.aISkillExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        skill: 'event.treatment.completed',
        status: 'RUNNING',
        input: expect.any(Object),
        output: expect.any(Object),
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// 2. treatment.completed — REVENUE / INFO
// ---------------------------------------------------------------------------
describe('treatment.completed', () => {
  it('creates a REVENUE/INFO insight and marks execution COMPLETED', async () => {
    const payload = { treatmentId: 'tx-42', patientName: 'Jane Doe', patientId: 'p-1' }
    await dispatchEvent(buildPayload('treatment.completed', payload))

    // Insight created with correct category + severity
    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'REVENUE',
        severity: 'INFO',
        title: expect.stringContaining('Treatment Completed'),
        description: expect.stringContaining('tx-42'),
        data: expect.objectContaining(payload),
        expiresAt: expect.any(Date),
      }),
    })

    // Execution updated to COMPLETED
    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })
})

// ---------------------------------------------------------------------------
// 3. appointment.no_show — PATIENT / WARNING
// ---------------------------------------------------------------------------
describe('appointment.no_show', () => {
  it('creates a PATIENT/WARNING insight', async () => {
    const payload = { patientName: 'John Smith', appointmentDate: '2026-02-10' }
    await dispatchEvent(buildPayload('appointment.no_show', payload))

    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'PATIENT',
        severity: 'WARNING',
        title: expect.stringContaining('No-Show'),
        description: expect.stringContaining('John Smith'),
      }),
    })

    // Execution completed
    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })
})

// ---------------------------------------------------------------------------
// 4. inventory.below_reorder with currentStock = 0 — CRITICAL
// ---------------------------------------------------------------------------
describe('inventory.below_reorder', () => {
  it('creates INVENTORY/CRITICAL insight when currentStock is 0', async () => {
    const payload = { itemName: 'Composite Resin', currentStock: 0, reorderLevel: 10 }
    await dispatchEvent(buildPayload('inventory.below_reorder', payload))

    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'INVENTORY',
        severity: 'CRITICAL',
        title: expect.stringContaining('Out of Stock'),
        description: expect.stringContaining('Composite Resin'),
      }),
    })

    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })

  // ---------------------------------------------------------------------------
  // 5. inventory.below_reorder with currentStock > 0 — WARNING
  // ---------------------------------------------------------------------------
  it('creates INVENTORY/WARNING insight when currentStock > 0', async () => {
    const payload = { itemName: 'Dental Floss', currentStock: 3, reorderLevel: 10 }
    await dispatchEvent(buildPayload('inventory.below_reorder', payload))

    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'INVENTORY',
        severity: 'WARNING',
        title: expect.stringContaining('Low Stock'),
        description: expect.stringContaining('Dental Floss'),
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// 6. lab_order.delayed — OPERATIONAL / CRITICAL
// ---------------------------------------------------------------------------
describe('lab_order.delayed', () => {
  it('creates an OPERATIONAL/CRITICAL insight', async () => {
    const payload = { vendorName: 'Ivoclar', expectedDate: '2026-01-30' }
    await dispatchEvent(buildPayload('lab_order.delayed', payload))

    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'OPERATIONAL',
        severity: 'CRITICAL',
        title: expect.stringContaining('Lab Order Delayed'),
        description: expect.stringContaining('Ivoclar'),
      }),
    })

    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })
})

// ---------------------------------------------------------------------------
// 7. payment.received with amount > 5000 — creates REVENUE/INFO insight
// ---------------------------------------------------------------------------
describe('payment.received', () => {
  it('creates a REVENUE/INFO insight when amount > 5000', async () => {
    const payload = { amount: 12000, invoiceId: 'inv-99' }
    await dispatchEvent(buildPayload('payment.received', payload))

    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'REVENUE',
        severity: 'INFO',
        title: expect.stringContaining('Large Payment Received'),
        description: expect.stringContaining('12000'),
      }),
    })

    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })

  // ---------------------------------------------------------------------------
  // 8. payment.received with amount <= 5000 — does NOT create insight
  // ---------------------------------------------------------------------------
  it('does NOT create an insight when amount <= 5000', async () => {
    const payload = { amount: 5000, invoiceId: 'inv-50' }
    await dispatchEvent(buildPayload('payment.received', payload))

    expect(prisma.aIInsight.create).not.toHaveBeenCalled()

    // Execution should still be marked COMPLETED (no error occurred)
    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })

  it('does NOT create an insight when amount is missing (defaults to 0)', async () => {
    const payload = { invoiceId: 'inv-00' }
    await dispatchEvent(buildPayload('payment.received', payload))

    expect(prisma.aIInsight.create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 9. patient.created — PATIENT / INFO
// ---------------------------------------------------------------------------
describe('patient.created', () => {
  it('creates a PATIENT/INFO insight', async () => {
    const payload = { patientName: 'Alice Brown', patientId: 'p-new-1' }
    await dispatchEvent(buildPayload('patient.created', payload))

    expect(prisma.aIInsight.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hospitalId: HOSPITAL_ID,
        category: 'PATIENT',
        severity: 'INFO',
        title: expect.stringContaining('Alice Brown'),
        description: expect.stringContaining('Alice Brown'),
      }),
    })

    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    })
  })

  it('uses fallback name when patientName is not provided', async () => {
    await dispatchEvent(buildPayload('patient.created', { patientId: 'p-new-2' }))

    expect(prisma.aIInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: expect.stringContaining('New Patient'),
        description: expect.stringContaining('A new patient'),
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// 10. Handler error — updates execution to FAILED with error string
// ---------------------------------------------------------------------------
describe('error handling', () => {
  it('updates execution to FAILED with error string when handler throws', async () => {
    const errorMessage = 'Database connection lost'
    prisma.aIInsight.create.mockRejectedValueOnce(new Error(errorMessage))

    await dispatchEvent(
      buildPayload('treatment.completed', { treatmentId: 'tx-err' })
    )

    // The RUNNING execution should still have been created
    expect(prisma.aISkillExecution.create).toHaveBeenCalledTimes(1)

    // Update should mark FAILED with the error string
    expect(prisma.aISkillExecution.update).toHaveBeenCalledTimes(1)
    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: expect.stringContaining(errorMessage),
        output: expect.any(Object),
      }),
    })
  })

  it('does NOT mark execution as COMPLETED when handler throws', async () => {
    prisma.aIInsight.create.mockRejectedValueOnce(new Error('Some failure'))

    await dispatchEvent(
      buildPayload('appointment.no_show', { patientName: 'Error Patient' })
    )

    // Only one update call, and it should be FAILED — not COMPLETED
    const updateCalls = prisma.aISkillExecution.update.mock.calls
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0][0].data.status).toBe('FAILED')
  })

  it('stringifies non-Error thrown values', async () => {
    prisma.aIInsight.create.mockRejectedValueOnce('raw string error')

    await dispatchEvent(
      buildPayload('patient.created', { patientName: 'Bad Data' })
    )

    expect(prisma.aISkillExecution.update).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'raw string error',
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// Additional coverage — skill naming and expiresAt
// ---------------------------------------------------------------------------
describe('skill naming convention', () => {
  const eventTypes: EventType[] = [
    'treatment.completed',
    'appointment.no_show',
    'inventory.below_reorder',
    'lab_order.delayed',
    'payment.received',
    'patient.created',
  ]

  it.each(eventTypes)(
    'uses skill name "event.%s" for event type %s',
    async (eventType) => {
      await dispatchEvent(buildPayload(eventType, { dummy: true }))

      expect(prisma.aISkillExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          skill: `event.${eventType}`,
        }),
      })
    }
  )
})

describe('insight expiresAt', () => {
  it('sets a future expiration date on created insights', async () => {
    await dispatchEvent(
      buildPayload('treatment.completed', { treatmentId: 'tx-exp' })
    )

    const createCall = prisma.aIInsight.create.mock.calls[0][0]
    const expiresAt = createCall.data.expiresAt as Date
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})
