import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const {
  execCreatePatient,
  execUpdatePatient,
  execSearchPatients,
  execBookAppointment,
  execCancelAppointment,
  execCreateInvoice,
  execRecordPayment,
  execCheckStock,
  execLowStock,
  execShowStaff,
  execDailySummary,
  executeIntent,
} = await import('@/lib/ai/command-executors')

describe('Command Executors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('execCreatePatient', () => {
    it('creates a patient with required fields', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)
      ;(prisma.patient.count as any).mockResolvedValue(5)
      ;(prisma.patient.create as any).mockResolvedValue({
        patientId: 'PAT-00006',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      })

      const result = await execCreatePatient(
        { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        'hospital-1'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('Patient created')
      expect(result.patientId).toBe('PAT-00006')
    })

    it('rejects when firstName is missing', async () => {
      const result = await execCreatePatient({ phone: '9876543210' } as any, 'h1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('First name')
    })

    it('rejects when phone is missing', async () => {
      const result = await execCreatePatient({ firstName: 'John', lastName: 'Doe' }, 'h1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('Phone')
    })

    it('rejects duplicate patient', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        patientId: 'PAT-00001',
      })

      const result = await execCreatePatient(
        { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        'h1'
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('already exists')
    })
  })

  describe('execUpdatePatient', () => {
    it('updates patient fields', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
      })
      ;(prisma.patient.update as any).mockResolvedValue({})

      const result = await execUpdatePatient(
        { query: 'John', phone: '1111111111', email: 'new@test.com' },
        'h1'
      )
      expect(result.success).toBe(true)
      expect(result.message).toContain('Updated')
      expect(result.message).toContain('phone')
    })

    it('returns error when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const result = await execUpdatePatient({ query: 'Nobody' }, 'h1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })

    it('returns error when no fields to update', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
      })

      const result = await execUpdatePatient({ query: 'John' }, 'h1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('No fields')
    })
  })

  describe('execSearchPatients', () => {
    it('searches patients by query', async () => {
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { patientId: 'PAT-001', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
      ])

      const result = await execSearchPatients({ query: 'John' }, 'h1')
      expect(result.success).toBe(true)
      expect(result.patients).toHaveLength(1)
    })

    it('returns empty array when no matches', async () => {
      ;(prisma.patient.findMany as any).mockResolvedValue([])

      const result = await execSearchPatients({ query: 'Unknown' }, 'h1')
      expect(result.success).toBe(true)
      expect(result.count).toBe(0)
      expect(result.patients).toHaveLength(0)
    })
  })

  describe('execBookAppointment', () => {
    it('books appointment when patient and doctor found', async () => {
      // findPatient uses single findFirst with OR query
      ;(prisma.patient.findFirst as any).mockResolvedValueOnce({ id: 'p1', firstName: 'John', lastName: 'Doe' })
      ;(prisma.staff.findFirst as any).mockResolvedValue({ id: 's1', firstName: 'Alice', lastName: 'Brown' })
      // conflict check returns null (no conflict)
      ;(prisma.appointment.findFirst as any).mockResolvedValue(null)
      ;(prisma.appointment.count as any).mockResolvedValue(10)
      ;(prisma.appointment.create as any).mockResolvedValue({
        appointmentNo: 'APT-00011',
        scheduledDate: new Date('2026-03-10'),
        scheduledTime: '10:00',
      })

      const result = await execBookAppointment(
        { patientName: 'John', date: '2026-03-10', time: '10:00', doctorName: 'Alice' },
        'h1'
      )
      expect(result.success).toBe(true)
      expect(result.message).toContain('Appointment')
    })

    it('returns error when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const result = await execBookAppointment(
        { patientName: 'Nobody', date: '2026-03-10', time: '10:00' },
        'h1'
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })
  })

  describe('execCancelAppointment', () => {
    it('cancels appointment by appointment number', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue({
        id: 'a1',
        appointmentNo: 'APT-001',
        scheduledDate: new Date('2026-03-10'),
        scheduledTime: '10:00',
        patient: { firstName: 'John', lastName: 'Doe' },
        doctor: { firstName: 'Alice' },
      })
      ;(prisma.appointment.update as any).mockResolvedValue({})

      const result = await execCancelAppointment({ appointmentNo: 'APT-001' }, 'h1')
      expect(result.success).toBe(true)
      expect(result.message).toContain('cancelled')
    })

    it('returns error when appointment not found', async () => {
      ;(prisma.appointment.findFirst as any).mockResolvedValue(null)

      const result = await execCancelAppointment({ appointmentNo: 'APT-999' }, 'h1')
      expect(result.success).toBe(false)
    })
  })

  describe('execCreateInvoice', () => {
    it('creates invoice for patient with unbilled treatments', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', firstName: 'John', lastName: 'Doe' })
      ;(prisma.treatment.findMany as any).mockResolvedValue([
        { id: 't1', cost: 5000, procedure: { name: 'Root Canal' } },
      ])
      ;(prisma.invoice.count as any).mockResolvedValue(5)
      ;(prisma.invoice.create as any).mockResolvedValue({
        invoiceNo: 'INV-00006',
        totalAmount: 5900,
        balanceAmount: 5900,
      })

      const result = await execCreateInvoice(
        { query: 'John' },
        'h1'
      )
      expect(result.success).toBe(true)
      expect(result.message).toContain('Invoice')
    })

    it('returns error when patient not found', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)

      const result = await execCreateInvoice({ query: 'Nobody' }, 'h1')
      expect(result.success).toBe(false)
    })

    it('returns error when no unbilled treatments', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', firstName: 'John', lastName: 'Doe' })
      ;(prisma.treatment.findMany as any).mockResolvedValue([])

      const result = await execCreateInvoice({ query: 'John' }, 'h1')
      expect(result.success).toBe(false)
      expect(result.message).toContain('No unbilled')
    })
  })

  describe('execCheckStock', () => {
    it('checks stock for specific item', async () => {
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([{
        name: 'Gloves',
        currentStock: 50,
        minimumStock: 20,
        reorderLevel: 30,
        unit: 'box',
      }])

      const result = await execCheckStock({ itemName: 'Gloves' }, 'h1')
      expect(result.success).toBe(true)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('Gloves')
      expect(result.items[0].stock).toContain('50')
    })

    it('returns not found for unknown item', async () => {
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([])

      const result = await execCheckStock({ itemName: 'Unknown' }, 'h1')
      expect(result.success).toBe(false)
    })
  })

  describe('execLowStock', () => {
    it('returns low stock items', async () => {
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([
        { name: 'Gloves', currentStock: 5, minimumStock: 10, reorderLevel: 20, unit: 'box' },
        { name: 'Masks', currentStock: 100, minimumStock: 10, reorderLevel: 20, unit: 'box' },
      ])

      const result = await execLowStock('h1')
      expect(result.success).toBe(true)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('Gloves')
    })

    it('returns empty when all stock is sufficient', async () => {
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([
        { name: 'Gloves', currentStock: 100, minimumStock: 10, reorderLevel: 20, unit: 'box' },
      ])

      const result = await execLowStock('h1')
      expect(result.success).toBe(true)
      expect(result.count).toBe(0)
    })
  })

  describe('execShowStaff', () => {
    it('returns active staff list', async () => {
      ;(prisma.staff.findMany as any).mockResolvedValue([
        { employeeId: 'EMP-001', firstName: 'Alice', lastName: 'Brown', phone: '9876543210', user: { role: 'DOCTOR' } },
      ])

      const result = await execShowStaff('h1')
      expect(result.success).toBe(true)
      expect(result.staff).toHaveLength(1)
    })
  })

  describe('execDailySummary', () => {
    it('returns comprehensive daily summary', async () => {
      // execDailySummary uses Promise.all with:
      // patient.count (total), patient.count (new today),
      // appointment.count (today), appointment.count (completed), appointment.count (cancelled), appointment.count (no_show),
      // invoice.count (pending), invoice.count (overdue),
      // payment.aggregate (today revenue),
      // inventoryItem.findMany().then() (low stock filter),
      // labOrder.count (active)
      ;(prisma.patient.count as any).mockResolvedValue(100)
      ;(prisma.appointment.count as any).mockResolvedValue(10)
      ;(prisma.invoice.count as any).mockResolvedValue(5)
      ;(prisma.payment.aggregate as any).mockResolvedValue({ _sum: { amount: 50000 } })
      // findMany returns items, then the .then() filter counts low stock
      const findManyResult = [
        { currentStock: 5, reorderLevel: 20 },
        { currentStock: 100, reorderLevel: 20 },
      ]
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue(findManyResult)
      ;(prisma.labOrder.count as any).mockResolvedValue(3)

      const result = await execDailySummary('h1')
      expect(result.success).toBe(true)
      expect(result.summary).toBeDefined()
      expect(result.summary.totalPatients).toBe(100)
    })
  })

  describe('executeIntent', () => {
    it('routes create_patient intent', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)
      ;(prisma.patient.count as any).mockResolvedValue(0)
      ;(prisma.patient.create as any).mockResolvedValue({
        patientId: 'PAT-00001',
        firstName: 'Test',
        lastName: 'User',
        phone: '123',
      })

      const result = await executeIntent('create_patient', { firstName: 'Test', lastName: 'User', phone: '123' }, 'h1')
      expect(result.success).toBe(true)
    })

    it('routes search_patients intent', async () => {
      ;(prisma.patient.findMany as any).mockResolvedValue([])
      const result = await executeIntent('search_patients', { query: 'test' }, 'h1')
      expect(result.success).toBe(true)
    })

    it('routes daily_summary intent', async () => {
      ;(prisma.patient.count as any).mockResolvedValue(0)
      ;(prisma.appointment.count as any).mockResolvedValue(0)
      ;(prisma.invoice.count as any).mockResolvedValue(0)
      ;(prisma.payment.aggregate as any).mockResolvedValue({ _sum: { amount: 0 } })
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([])
      ;(prisma.labOrder.count as any).mockResolvedValue(0)

      const result = await executeIntent('daily_summary', {}, 'h1')
      expect(result.success).toBe(true)
    })

    it('routes generate_invoice as alias for create_invoice', async () => {
      ;(prisma.patient.findFirst as any).mockResolvedValue({ id: 'p1', firstName: 'A', lastName: 'B' })
      ;(prisma.treatment.findMany as any).mockResolvedValue([
        { id: 't1', cost: 100, procedure: { name: 'Filling' } },
      ])
      ;(prisma.invoice.count as any).mockResolvedValue(0)
      ;(prisma.invoice.create as any).mockResolvedValue({ invoiceNo: 'INV-00001', totalAmount: 118, balanceAmount: 118 })

      const result = await executeIntent('generate_invoice', { query: 'A' }, 'h1')
      expect(result.success).toBe(true)
    })

    it('returns null for unknown intent', async () => {
      const result = await executeIntent('unknown_intent', {}, 'h1')
      expect(result).toBeNull()
    })

    it('routes all known intents without error', async () => {
      const intents = [
        'create_patient', 'update_patient', 'search_patients', 'check_patient',
        'book_appointment', 'cancel_appointment', 'reschedule_appointment',
        'complete_appointment', 'show_appointments',
        'create_treatment', 'complete_treatment', 'show_treatments',
        'create_invoice', 'generate_invoice', 'record_payment',
        'show_invoices', 'check_overdue', 'show_revenue',
        'check_stock', 'low_stock', 'add_inventory_item', 'update_stock',
        'create_lab_order', 'update_lab_order', 'show_lab_orders',
        'create_prescription', 'show_prescriptions',
        'add_medication', 'search_medications',
        'show_staff', 'daily_summary',
      ]

      // Stub all prisma methods to return safe defaults
      for (const model of Object.values(prisma)) {
        if (typeof model === 'object' && model !== null) {
          for (const method of Object.values(model)) {
            if (typeof method === 'function' && 'mockResolvedValue' in method) {
              ;(method as any).mockResolvedValue(null)
            }
          }
        }
      }
      ;(prisma.patient.findMany as any).mockResolvedValue([])
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)
      ;(prisma.appointment.findMany as any).mockResolvedValue([])
      ;(prisma.appointment.findFirst as any).mockResolvedValue(null)
      ;(prisma.appointment.count as any).mockResolvedValue(0)
      ;(prisma.treatment.findMany as any).mockResolvedValue([])
      ;(prisma.treatment.count as any).mockResolvedValue(0)
      ;(prisma.invoice.findMany as any).mockResolvedValue([])
      ;(prisma.invoice.count as any).mockResolvedValue(0)
      ;(prisma.inventoryItem.findMany as any).mockResolvedValue([])
      ;(prisma.inventoryItem.findFirst as any).mockResolvedValue(null)
      ;(prisma.inventoryItem.count as any).mockResolvedValue(0)
      ;(prisma.labOrder.findMany as any).mockResolvedValue([])
      ;(prisma.labOrder.findFirst as any).mockResolvedValue(null)
      ;(prisma.prescription.findMany as any).mockResolvedValue([])
      ;(prisma.medication.findMany as any).mockResolvedValue([])
      ;(prisma.staff.findMany as any).mockResolvedValue([])
      ;(prisma.staff.findFirst as any).mockResolvedValue(null)
      ;(prisma.patient.count as any).mockResolvedValue(0)
      ;(prisma.payment.aggregate as any).mockResolvedValue({ _sum: { amount: 0 } })
      ;(prisma.invoice.aggregate as any).mockResolvedValue({ _sum: { balanceAmount: 0 } })
      ;(prisma.labOrder.count as any).mockResolvedValue(0)

      for (const intent of intents) {
        // Each should run without throwing
        const result = await executeIntent(intent, {}, 'h1')
        expect(result).toBeDefined()
      }
    })
  })
})
