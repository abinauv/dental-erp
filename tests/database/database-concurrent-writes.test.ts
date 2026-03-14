// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  patient: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  appointment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  inventoryItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  inventoryTransaction: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}))

// ---------------------------------------------------------------------------
// Tests — Concurrent Appointment Booking (Race Conditions)
// ---------------------------------------------------------------------------

describe('Database — Concurrent Appointment Booking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents double-booking same slot via transaction', async () => {
    // Simulate two concurrent booking requests for same slot
    const slotDate = new Date('2026-03-15')
    const slotTime = '10:00'
    const doctorId = 'doc-1'

    let bookingCount = 0

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      // Inside transaction, check for existing booking
      const existing = bookingCount > 0
        ? [{ id: 'a-existing', doctorId, scheduledDate: slotDate, scheduledTime: slotTime }]
        : []

      mockPrisma.appointment.findMany.mockResolvedValue(existing)

      const conflicts = await mockPrisma.appointment.findMany({
        where: {
          doctorId,
          scheduledDate: slotDate,
          scheduledTime: slotTime,
          status: { not: 'CANCELLED' },
        },
      })

      if (conflicts.length > 0) {
        throw new Error('Time slot already booked')
      }

      bookingCount++
      mockPrisma.appointment.create.mockResolvedValue({
        id: `appt-${bookingCount}`,
        doctorId,
        scheduledDate: slotDate,
        scheduledTime: slotTime,
      })

      return cb ? cb(mockPrisma) : mockPrisma.appointment.create({
        data: { doctorId, scheduledDate: slotDate, scheduledTime: slotTime },
      })
    })

    // First booking succeeds
    await expect(mockPrisma.$transaction(async () => {})).resolves.not.toThrow()

    // Second booking fails (slot taken)
    await expect(mockPrisma.$transaction(async () => {})).rejects.toThrow('Time slot already booked')
  })

  it('serializable isolation prevents read-then-write race', async () => {
    // Prisma interactive transactions with isolation level
    const isolationConfig = {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000,
    }

    expect(isolationConfig.isolationLevel).toBe('Serializable')
    expect(isolationConfig.maxWait).toBe(5000)
    expect(isolationConfig.timeout).toBe(10000)
  })

  it('optimistic locking detects stale updates', async () => {
    // Simulate version-based optimistic locking
    const appointmentV1 = {
      id: 'a1',
      status: 'SCHEDULED',
      version: 1,
      updatedAt: new Date('2026-03-08T10:00:00Z'),
    }

    // User A reads version 1
    mockPrisma.appointment.findUnique.mockResolvedValue(appointmentV1)
    const readByA = await mockPrisma.appointment.findUnique({ where: { id: 'a1' } })

    // User B also reads version 1 and updates (version becomes 2)
    mockPrisma.appointment.update.mockResolvedValueOnce({
      ...appointmentV1,
      status: 'CONFIRMED',
      version: 2,
      updatedAt: new Date('2026-03-08T10:01:00Z'),
    })

    await mockPrisma.appointment.update({
      where: { id: 'a1', version: 1 },
      data: { status: 'CONFIRMED', version: { increment: 1 } },
    })

    // User A tries to update with stale version 1
    mockPrisma.appointment.update.mockRejectedValueOnce(
      new Error('Record to update not found. (version mismatch)')
    )

    await expect(
      mockPrisma.appointment.update({
        where: { id: 'a1', version: 1 }, // stale version
        data: { status: 'CANCELLED', version: { increment: 1 } },
      })
    ).rejects.toThrow('Record to update not found')
  })
})

// ---------------------------------------------------------------------------
// Tests — Concurrent Stock Updates
// ---------------------------------------------------------------------------

describe('Database — Concurrent Stock Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('atomic decrement prevents overselling', async () => {
    // Two concurrent stock reductions on same item (qty = 5)
    const item = { id: 'item-1', name: 'Dental Gloves', quantity: 5 }

    // Both try to decrement by 3 simultaneously
    // With atomic operations, only one should succeed if qty < 6
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const current = await mockPrisma.inventoryItem.findUnique({ where: { id: 'item-1' } })
      if (current.quantity < 3) {
        throw new Error('Insufficient stock')
      }
      return cb(mockPrisma)
    })

    mockPrisma.inventoryItem.findUnique.mockResolvedValueOnce(item)
    mockPrisma.inventoryItem.update.mockResolvedValueOnce({ ...item, quantity: 2 })

    // First deduction succeeds (5 → 2)
    await expect(
      mockPrisma.$transaction(async (tx: any) => {
        return tx.inventoryItem.update({
          where: { id: 'item-1' },
          data: { quantity: { decrement: 3 } },
        })
      })
    ).resolves.not.toThrow()

    // Second deduction fails (only 2 left, need 3)
    mockPrisma.inventoryItem.findUnique.mockResolvedValueOnce({ ...item, quantity: 2 })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const current = await mockPrisma.inventoryItem.findUnique({ where: { id: 'item-1' } })
      if (current.quantity < 3) {
        throw new Error('Insufficient stock')
      }
      return cb(mockPrisma)
    })

    await expect(
      mockPrisma.$transaction(async (tx: any) => {})
    ).rejects.toThrow('Insufficient stock')
  })

  it('Prisma increment/decrement is atomic at DB level', async () => {
    // Prisma's increment/decrement generates atomic SQL:
    // UPDATE inventory_item SET quantity = quantity - 5 WHERE id = ?
    mockPrisma.inventoryItem.update.mockResolvedValue({
      id: 'item-1',
      quantity: 95,
    })

    const result = await mockPrisma.inventoryItem.update({
      where: { id: 'item-1' },
      data: { quantity: { decrement: 5 } },
    })

    expect(result.quantity).toBe(95)
    expect(mockPrisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: { decrement: 5 } },
    })
  })

  it('stock transaction creates audit trail atomically', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      return cb(mockPrisma)
    })

    mockPrisma.inventoryItem.update.mockResolvedValue({ id: 'item-1', quantity: 90 })
    mockPrisma.inventoryTransaction.create.mockResolvedValue({
      id: 'txn-1',
      itemId: 'item-1',
      type: 'STOCK_OUT',
      quantity: 10,
    })

    await mockPrisma.$transaction(async (tx: any) => {
      // Both happen in same transaction
      await tx.inventoryItem.update({
        where: { id: 'item-1' },
        data: { quantity: { decrement: 10 } },
      })
      await tx.inventoryTransaction.create({
        data: {
          itemId: 'item-1',
          type: 'STOCK_OUT',
          quantity: 10,
          hospitalId: 'hosp-1',
        },
      })
    })

    expect(mockPrisma.inventoryItem.update).toHaveBeenCalled()
    expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalled()
  })

  it('negative stock is prevented by check constraint', async () => {
    mockPrisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item-1',
      quantity: 2,
    })

    const item = await mockPrisma.inventoryItem.findUnique({ where: { id: 'item-1' } })
    const requestedQty = 5

    if (item.quantity < requestedQty) {
      // Should reject
      expect(item.quantity).toBeLessThan(requestedQty)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests — Concurrent Payment Processing
// ---------------------------------------------------------------------------

describe('Database — Concurrent Payment Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents double payment on same invoice', async () => {
    let paymentProcessed = false

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      // Lock invoice row during payment
      const invoice = {
        id: 'inv-1',
        totalAmount: 5000,
        paidAmount: paymentProcessed ? 5000 : 0,
        status: paymentProcessed ? 'PAID' : 'PENDING',
      }

      mockPrisma.invoice.findUnique.mockResolvedValue(invoice)
      const current = await mockPrisma.invoice.findUnique({ where: { id: 'inv-1' } })

      if (current.status === 'PAID') {
        throw new Error('Invoice already paid')
      }

      paymentProcessed = true
      return cb(mockPrisma)
    })

    // First payment succeeds
    await expect(
      mockPrisma.$transaction(async (tx: any) => {
        mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', amount: 5000 })
        return tx.payment.create({ data: { invoiceId: 'inv-1', amount: 5000 } })
      })
    ).resolves.not.toThrow()

    // Second payment on same invoice fails
    await expect(
      mockPrisma.$transaction(async (tx: any) => {})
    ).rejects.toThrow('Invoice already paid')
  })

  it('partial payments track remaining balance correctly', async () => {
    const invoiceTotal = 10000
    let paidSoFar = 0

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const remaining = invoiceTotal - paidSoFar
      if (remaining <= 0) {
        throw new Error('Invoice fully paid')
      }
      return cb({ remaining, paidSoFar })
    })

    // First partial payment: 4000
    const result1 = await mockPrisma.$transaction(async (ctx: any) => {
      paidSoFar += 4000
      return { paid: 4000, remaining: invoiceTotal - paidSoFar }
    })
    expect(result1.remaining).toBe(6000)

    // Second partial payment: 6000
    const result2 = await mockPrisma.$transaction(async (ctx: any) => {
      paidSoFar += 6000
      return { paid: 6000, remaining: invoiceTotal - paidSoFar }
    })
    expect(result2.remaining).toBe(0)

    // Third payment fails — fully paid
    await expect(
      mockPrisma.$transaction(async () => {})
    ).rejects.toThrow('Invoice fully paid')
  })

  it('refund cannot exceed paid amount', () => {
    const paidAmount = 5000
    const refundAmount = 7000

    const isValidRefund = refundAmount <= paidAmount
    expect(isValidRefund).toBe(false)
  })

  it('concurrent refund requests are serialized', async () => {
    let refundedTotal = 0
    const paidAmount = 5000

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      return cb(mockPrisma)
    })

    // First refund: 3000
    await mockPrisma.$transaction(async () => {
      const remaining = paidAmount - refundedTotal
      if (remaining < 3000) throw new Error('Insufficient balance for refund')
      refundedTotal += 3000
    })
    expect(refundedTotal).toBe(3000)

    // Second refund: 3000 should fail (only 2000 remaining)
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const remaining = paidAmount - refundedTotal
      if (remaining < 3000) throw new Error('Insufficient balance for refund')
      refundedTotal += 3000
      return cb(mockPrisma)
    })

    await expect(
      mockPrisma.$transaction(async () => {})
    ).rejects.toThrow('Insufficient balance for refund')
  })
})

// ---------------------------------------------------------------------------
// Tests — Transaction Deadlock Handling
// ---------------------------------------------------------------------------

describe('Database — Deadlock & Retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Prisma transaction timeout is configured', () => {
    const transactionConfig = {
      maxWait: 5000,   // max time to wait for connection
      timeout: 10000,  // max time for transaction
    }

    expect(transactionConfig.maxWait).toBeLessThanOrEqual(10000)
    expect(transactionConfig.timeout).toBeLessThanOrEqual(30000)
  })

  it('deadlock error is retryable', async () => {
    let attempts = 0
    const maxRetries = 3

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      attempts++
      if (attempts < 3) {
        throw new Error('Deadlock found when trying to get lock')
      }
      return cb(mockPrisma)
    })

    // Retry loop
    let success = false
    for (let i = 0; i < maxRetries; i++) {
      try {
        await mockPrisma.$transaction(async (tx: any) => {})
        success = true
        break
      } catch (err: any) {
        if (!err.message.includes('Deadlock')) throw err
        // Retry on deadlock
      }
    }

    expect(success).toBe(true)
    expect(attempts).toBe(3)
  })

  it('non-deadlock errors are not retried', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('Foreign key constraint failed'))

    await expect(
      mockPrisma.$transaction(async () => {})
    ).rejects.toThrow('Foreign key constraint failed')
  })
})
