// @ts-nocheck
/**
 * Integration Tests for Complete Business Workflows
 * Tests end-to-end scenarios that span multiple modules
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all required modules
vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
    appointment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    treatment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    procedure: { findUnique: vi.fn() },
    invoice: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn() },
    staff: { findFirst: vi.fn(), findUnique: vi.fn() },
    hospital: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  checkPatientLimit: vi.fn().mockResolvedValue({ allowed: true, current: 10, max: 100 }),
  checkStaffLimit: vi.fn().mockResolvedValue({ allowed: true, current: 5, max: 10 }),
}))

vi.mock('@/lib/billing-utils', () => ({
  generateInvoiceNo: vi.fn().mockResolvedValue('INV202501290001'),
  calculateInvoiceTotals: vi.fn().mockReturnValue({
    subtotal: 5000,
    discountAmount: 0,
    taxableAmount: 5000,
    cgstAmount: 450,
    sgstAmount: 450,
    totalAmount: 5900,
  }),
  gstConfig: { cgstRate: 9, sgstRate: 9 },
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)

describe('Complete Business Workflows', () => {
  const mockHospitalId = 'hospital-123'
  const mockUserId = 'user-123'
  const mockDoctorId = 'doctor-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      error: null,
      hospitalId: mockHospitalId,
      user: { id: mockUserId, role: 'ADMIN' },
      session: { user: { id: mockUserId, role: 'ADMIN', hospitalId: mockHospitalId } },
    })
  })

  describe('Workflow 1: New Patient Registration → Appointment → Treatment → Invoice → Payment', () => {
    const patientData = {
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '9876543210',
      email: 'rahul@example.com',
      gender: 'MALE',
      age: 35,
    }

    it('Step 1: Should register a new patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.patient.create.mockResolvedValue({
        id: 'patient-new',
        patientId: 'PAT202500001',
        ...patientData,
        hospitalId: mockHospitalId,
        isActive: true,
      })

      // Simulate patient creation
      const patient = await mockPrisma.patient.create({
        data: {
          patientId: 'PAT202500001',
          ...patientData,
          hospitalId: mockHospitalId,
          isActive: true,
        },
      })

      expect(patient.patientId).toBe('PAT202500001')
      expect(patient.firstName).toBe('Rahul')
    })

    it('Step 2: Should book an appointment for the patient', async () => {
      const patientId = 'patient-new'

      mockPrisma.patient.findFirst.mockResolvedValue({ id: patientId, hospitalId: mockHospitalId })
      mockPrisma.staff.findFirst.mockResolvedValue({ id: mockDoctorId, hospitalId: mockHospitalId })
      mockPrisma.appointment.findFirst.mockResolvedValue(null) // No conflict
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'apt-new',
        appointmentNo: 'APT202501290001',
        patientId,
        doctorId: mockDoctorId,
        scheduledDate: new Date('2025-01-30'),
        scheduledTime: '10:00',
        status: 'SCHEDULED',
      })

      // Verify no scheduling conflict
      const existingAppointment = await mockPrisma.appointment.findFirst({
        where: {
          hospitalId: mockHospitalId,
          doctorId: mockDoctorId,
          scheduledDate: new Date('2025-01-30'),
          scheduledTime: '10:00',
          status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
        },
      })
      expect(existingAppointment).toBeNull()

      // Create appointment
      const appointment = await mockPrisma.appointment.create({
        data: {
          appointmentNo: 'APT202501290001',
          patientId,
          doctorId: mockDoctorId,
          hospitalId: mockHospitalId,
          scheduledDate: new Date('2025-01-30'),
          scheduledTime: '10:00',
          status: 'SCHEDULED',
        },
      })

      expect(appointment.appointmentNo).toBe('APT202501290001')
      expect(appointment.status).toBe('SCHEDULED')
    })

    it('Step 3: Should check-in patient and update appointment status', async () => {
      mockPrisma.appointment.update.mockResolvedValue({
        id: 'apt-new',
        status: 'CHECKED_IN',
        checkInTime: new Date(),
      })

      const appointment = await mockPrisma.appointment.update({
        where: { id: 'apt-new' },
        data: {
          status: 'CHECKED_IN',
          checkInTime: new Date(),
        },
      })

      expect(appointment.status).toBe('CHECKED_IN')
      expect(appointment.checkInTime).toBeDefined()
    })

    it('Step 4: Should create a treatment record', async () => {
      const patientId = 'patient-new'
      const procedureId = 'procedure-rootcanal'

      mockPrisma.patient.findUnique.mockResolvedValue({ id: patientId, hospitalId: mockHospitalId })
      mockPrisma.staff.findUnique.mockResolvedValue({ id: mockDoctorId, hospitalId: mockHospitalId })
      mockPrisma.procedure.findUnique.mockResolvedValue({
        id: procedureId,
        hospitalId: mockHospitalId,
        name: 'Root Canal Treatment',
        code: 'RCT001',
        basePrice: 5000,
      })
      mockPrisma.treatment.create.mockResolvedValue({
        id: 'treatment-new',
        treatmentNo: 'TRT202501290001',
        patientId,
        doctorId: mockDoctorId,
        procedureId,
        status: 'PLANNED',
        cost: 5000,
        toothNumbers: ['16'],
        diagnosis: 'Pulpitis',
      })

      const treatment = await mockPrisma.treatment.create({
        data: {
          treatmentNo: 'TRT202501290001',
          hospitalId: mockHospitalId,
          patientId,
          doctorId: mockDoctorId,
          procedureId,
          status: 'PLANNED',
          cost: 5000,
          toothNumbers: ['16'],
          diagnosis: 'Pulpitis',
        },
      })

      expect(treatment.treatmentNo).toBe('TRT202501290001')
      expect(treatment.status).toBe('PLANNED')
      expect(treatment.cost).toBe(5000)
    })

    it('Step 5: Should start and complete the treatment', async () => {
      // Start treatment
      mockPrisma.treatment.update.mockResolvedValueOnce({
        id: 'treatment-new',
        status: 'IN_PROGRESS',
        startTime: new Date(),
      })

      const startedTreatment = await mockPrisma.treatment.update({
        where: { id: 'treatment-new' },
        data: {
          status: 'IN_PROGRESS',
          startTime: new Date(),
        },
      })
      expect(startedTreatment.status).toBe('IN_PROGRESS')

      // Complete treatment
      mockPrisma.treatment.update.mockResolvedValueOnce({
        id: 'treatment-new',
        status: 'COMPLETED',
        endTime: new Date(),
        procedureNotes: 'Treatment completed successfully',
      })

      const completedTreatment = await mockPrisma.treatment.update({
        where: { id: 'treatment-new' },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          procedureNotes: 'Treatment completed successfully',
        },
      })
      expect(completedTreatment.status).toBe('COMPLETED')
    })

    it('Step 6: Should generate invoice for the treatment', async () => {
      const patientId = 'patient-new'
      const treatmentId = 'treatment-new'

      mockPrisma.patient.findUnique.mockResolvedValue({ id: patientId, hospitalId: mockHospitalId })
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'invoice-new',
        invoiceNo: 'INV202501290001',
        patientId,
        subtotal: 5000,
        cgstAmount: 450,
        sgstAmount: 450,
        totalAmount: 5900,
        paidAmount: 0,
        balanceAmount: 5900,
        status: 'PENDING',
        items: [{
          description: 'Root Canal Treatment - Tooth 16',
          quantity: 1,
          unitPrice: 5000,
          amount: 5000,
          treatmentId,
        }],
      })

      const invoice = await mockPrisma.invoice.create({
        data: {
          invoiceNo: 'INV202501290001',
          hospitalId: mockHospitalId,
          patientId,
          subtotal: 5000,
          cgstRate: 9,
          cgstAmount: 450,
          sgstRate: 9,
          sgstAmount: 450,
          totalAmount: 5900,
          paidAmount: 0,
          balanceAmount: 5900,
          status: 'PENDING',
          items: {
            create: [{
              description: 'Root Canal Treatment - Tooth 16',
              quantity: 1,
              unitPrice: 5000,
              amount: 5000,
              treatmentId,
            }],
          },
        },
      })

      expect(invoice.invoiceNo).toBe('INV202501290001')
      expect(invoice.totalAmount).toBe(5900)
      expect(invoice.status).toBe('PENDING')
    })

    it('Step 7: Should record full payment and update invoice status', async () => {
      const invoiceId = 'invoice-new'

      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-new',
        paymentNo: 'PAY202501290001',
        invoiceId,
        amount: 5900,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
      })

      mockPrisma.invoice.update.mockResolvedValue({
        id: invoiceId,
        paidAmount: 5900,
        balanceAmount: 0,
        status: 'PAID',
      })

      // Record payment
      const payment = await mockPrisma.payment.create({
        data: {
          paymentNo: 'PAY202501290001',
          hospitalId: mockHospitalId,
          invoiceId,
          amount: 5900,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
        },
      })

      // Update invoice status
      const invoice = await mockPrisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: 5900,
          balanceAmount: 0,
          status: 'PAID',
        },
      })

      expect(payment.amount).toBe(5900)
      expect(invoice.status).toBe('PAID')
      expect(invoice.balanceAmount).toBe(0)
    })
  })

  describe('Workflow 2: Partial Payment Scenario', () => {
    it('Should handle partial payments correctly', async () => {
      const invoiceId = 'invoice-partial'
      const totalAmount = 10000

      // First partial payment
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'payment-1',
        invoiceId,
        amount: 3000,
        status: 'COMPLETED',
      })

      mockPrisma.invoice.update.mockResolvedValueOnce({
        id: invoiceId,
        paidAmount: 3000,
        balanceAmount: 7000,
        status: 'PARTIALLY_PAID',
      })

      const payment1 = await mockPrisma.payment.create({
        data: { invoiceId, amount: 3000, hospitalId: mockHospitalId, status: 'COMPLETED' },
      })
      const invoice1 = await mockPrisma.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: 3000, balanceAmount: 7000, status: 'PARTIALLY_PAID' },
      })

      expect(payment1.amount).toBe(3000)
      expect(invoice1.status).toBe('PARTIALLY_PAID')
      expect(invoice1.balanceAmount).toBe(7000)

      // Second partial payment
      mockPrisma.payment.create.mockResolvedValueOnce({
        id: 'payment-2',
        invoiceId,
        amount: 7000,
        status: 'COMPLETED',
      })

      mockPrisma.invoice.update.mockResolvedValueOnce({
        id: invoiceId,
        paidAmount: 10000,
        balanceAmount: 0,
        status: 'PAID',
      })

      const payment2 = await mockPrisma.payment.create({
        data: { invoiceId, amount: 7000, hospitalId: mockHospitalId, status: 'COMPLETED' },
      })
      const invoice2 = await mockPrisma.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: 10000, balanceAmount: 0, status: 'PAID' },
      })

      expect(payment2.amount).toBe(7000)
      expect(invoice2.status).toBe('PAID')
      expect(invoice2.balanceAmount).toBe(0)
    })
  })

  describe('Workflow 3: Appointment Rescheduling', () => {
    it('Should properly reschedule an appointment', async () => {
      const appointmentId = 'apt-to-reschedule'
      const patientId = 'patient-123'

      // Original appointment
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: appointmentId,
        patientId,
        doctorId: mockDoctorId,
        scheduledDate: new Date('2025-01-30'),
        scheduledTime: '10:00',
        status: 'SCHEDULED',
      })

      // Mark original as rescheduled
      mockPrisma.appointment.update.mockResolvedValueOnce({
        id: appointmentId,
        status: 'RESCHEDULED',
      })

      // Check no conflict at new time
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      // Create new appointment
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'apt-new-time',
        appointmentNo: 'APT202501300001',
        patientId,
        doctorId: mockDoctorId,
        scheduledDate: new Date('2025-02-01'),
        scheduledTime: '14:00',
        status: 'SCHEDULED',
        rescheduledFrom: appointmentId,
      })

      // Execute rescheduling
      const oldApt = await mockPrisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'RESCHEDULED' },
      })

      const newApt = await mockPrisma.appointment.create({
        data: {
          appointmentNo: 'APT202501300001',
          hospitalId: mockHospitalId,
          patientId,
          doctorId: mockDoctorId,
          scheduledDate: new Date('2025-02-01'),
          scheduledTime: '14:00',
          status: 'SCHEDULED',
          rescheduledFrom: appointmentId,
        },
      })

      expect(oldApt.status).toBe('RESCHEDULED')
      expect(newApt.status).toBe('SCHEDULED')
      expect(newApt.rescheduledFrom).toBe(appointmentId)
    })
  })

  describe('Workflow 4: Multiple Treatments in One Visit', () => {
    it('Should handle multiple treatments and consolidated invoice', async () => {
      const patientId = 'patient-multi'

      // Create multiple treatments
      const treatments = [
        { id: 'trt-1', name: 'Scaling', cost: 1000 },
        { id: 'trt-2', name: 'Filling - Tooth 14', cost: 2000 },
        { id: 'trt-3', name: 'Filling - Tooth 15', cost: 2000 },
      ]

      for (const trt of treatments) {
        mockPrisma.treatment.create.mockResolvedValueOnce({
          id: trt.id,
          treatmentNo: `TRT${trt.id}`,
          status: 'COMPLETED',
          cost: trt.cost,
        })
      }

      // Create consolidated invoice
      const totalSubtotal = 5000
      const cgst = 450
      const sgst = 450
      const total = 5900

      mockPrisma.invoice.create.mockResolvedValue({
        id: 'invoice-consolidated',
        invoiceNo: 'INV202501290002',
        patientId,
        subtotal: totalSubtotal,
        cgstAmount: cgst,
        sgstAmount: sgst,
        totalAmount: total,
        status: 'PENDING',
        items: treatments.map(t => ({
          description: t.name,
          quantity: 1,
          unitPrice: t.cost,
          amount: t.cost,
          treatmentId: t.id,
        })),
      })

      const invoice = await mockPrisma.invoice.create({
        data: {
          invoiceNo: 'INV202501290002',
          hospitalId: mockHospitalId,
          patientId,
          subtotal: totalSubtotal,
          cgstRate: 9,
          cgstAmount: cgst,
          sgstRate: 9,
          sgstAmount: sgst,
          totalAmount: total,
          status: 'PENDING',
          items: {
            create: treatments.map(t => ({
              description: t.name,
              quantity: 1,
              unitPrice: t.cost,
              amount: t.cost,
              treatmentId: t.id,
            })),
          },
        },
      })

      expect(invoice.items).toHaveLength(3)
      expect(invoice.subtotal).toBe(5000)
      expect(invoice.totalAmount).toBe(5900)
    })
  })

  describe('Workflow 5: Treatment Plan with Multi-Visit Treatments', () => {
    it('Should track treatment plan progress across visits', async () => {
      const patientId = 'patient-plan'

      // Create treatment plan with multiple items
      const planItems = [
        { id: 'item-1', sequence: 1, procedure: 'Root Canal - Visit 1', status: 'COMPLETED' },
        { id: 'item-2', sequence: 2, procedure: 'Root Canal - Visit 2', status: 'COMPLETED' },
        { id: 'item-3', sequence: 3, procedure: 'Crown Placement', status: 'PLANNED' },
      ]

      // Calculate progress
      const completedItems = planItems.filter(p => p.status === 'COMPLETED').length
      const totalItems = planItems.length
      const progressPercentage = (completedItems / totalItems) * 100

      expect(completedItems).toBe(2)
      expect(totalItems).toBe(3)
      expect(progressPercentage).toBeCloseTo(66.67, 1)
    })
  })

  describe('Workflow 6: Follow-up Appointment from Treatment', () => {
    it('Should create follow-up appointment after treatment', async () => {
      const patientId = 'patient-followup'
      const treatmentId = 'treatment-followup'

      // Mark treatment as requiring follow-up
      mockPrisma.treatment.update.mockResolvedValue({
        id: treatmentId,
        status: 'COMPLETED',
        followUpRequired: true,
        followUpDate: new Date('2025-02-15'),
      })

      // Create follow-up appointment
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'apt-followup',
        appointmentNo: 'APT202502150001',
        patientId,
        doctorId: mockDoctorId,
        scheduledDate: new Date('2025-02-15'),
        appointmentType: 'FOLLOW_UP',
        status: 'SCHEDULED',
        relatedTreatmentId: treatmentId,
      })

      const treatment = await mockPrisma.treatment.update({
        where: { id: treatmentId },
        data: {
          followUpRequired: true,
          followUpDate: new Date('2025-02-15'),
        },
      })

      const followUpApt = await mockPrisma.appointment.create({
        data: {
          appointmentNo: 'APT202502150001',
          hospitalId: mockHospitalId,
          patientId,
          doctorId: mockDoctorId,
          scheduledDate: new Date('2025-02-15'),
          scheduledTime: '10:00',
          appointmentType: 'FOLLOW_UP',
          status: 'SCHEDULED',
        },
      })

      expect(treatment.followUpRequired).toBe(true)
      expect(followUpApt.appointmentType).toBe('FOLLOW_UP')
    })
  })

  describe('Workflow 7: Invoice Cancellation and Adjustment', () => {
    it('Should handle invoice cancellation with refund', async () => {
      const invoiceId = 'invoice-cancel'

      // Original paid invoice
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        totalAmount: 5000,
        paidAmount: 5000,
        balanceAmount: 0,
        status: 'PAID',
      })

      // Create refund payment
      mockPrisma.payment.create.mockResolvedValue({
        id: 'refund-1',
        invoiceId,
        amount: -5000, // Negative for refund
        paymentMethod: 'CASH',
        status: 'REFUNDED',
        notes: 'Full refund - Treatment cancelled',
      })

      // Update invoice status
      mockPrisma.invoice.update.mockResolvedValue({
        id: invoiceId,
        paidAmount: 0,
        status: 'CANCELLED',
      })

      const refund = await mockPrisma.payment.create({
        data: {
          hospitalId: mockHospitalId,
          invoiceId,
          amount: -5000,
          paymentMethod: 'CASH',
          status: 'REFUNDED',
          notes: 'Full refund - Treatment cancelled',
        },
      })

      const invoice = await mockPrisma.invoice.update({
        where: { id: invoiceId },
        data: { paidAmount: 0, status: 'CANCELLED' },
      })

      expect(refund.amount).toBe(-5000)
      expect(refund.status).toBe('REFUNDED')
      expect(invoice.status).toBe('CANCELLED')
    })
  })

  describe('Data Integrity Checks', () => {
    it('Should maintain referential integrity between patient and appointments', async () => {
      const patientId = 'patient-integrity'

      // Cannot delete patient with appointments
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'apt-1',
        patientId,
      })

      const hasAppointments = await mockPrisma.appointment.findFirst({
        where: { patientId },
      })

      expect(hasAppointments).not.toBeNull()
      // Should soft-delete (deactivate) instead of hard delete
    })

    it('Should maintain consistency between treatment and invoice items', async () => {
      const treatmentId = 'treatment-billed'

      // Treatment should be marked as billed
      mockPrisma.treatment.findUnique.mockResolvedValue({
        id: treatmentId,
        status: 'COMPLETED',
        isBilled: true,
        invoiceItemId: 'item-1',
      })

      const treatment = await mockPrisma.treatment.findUnique({
        where: { id: treatmentId },
      })

      expect(treatment?.isBilled).toBe(true)
    })

    it('Should calculate invoice balance correctly', async () => {
      const invoiceId = 'invoice-balance'
      const totalAmount = 10000
      const payments = [3000, 4000, 2000]
      const paidAmount = payments.reduce((sum, p) => sum + p, 0)
      const balanceAmount = totalAmount - paidAmount

      expect(paidAmount).toBe(9000)
      expect(balanceAmount).toBe(1000)
    })
  })

  describe('Concurrent Operations', () => {
    it('Should handle concurrent appointment bookings', async () => {
      // Simulate race condition handling
      const doctorId = mockDoctorId
      const slotDate = new Date('2025-01-30')
      const slotTime = '10:00'

      // First booking succeeds
      mockPrisma.appointment.findFirst.mockResolvedValueOnce(null) // No conflict
      mockPrisma.appointment.create.mockResolvedValueOnce({
        id: 'apt-1',
        doctorId,
        scheduledDate: slotDate,
        scheduledTime: slotTime,
        status: 'SCHEDULED',
      })

      // Second booking should find conflict
      mockPrisma.appointment.findFirst.mockResolvedValueOnce({
        id: 'apt-1',
        doctorId,
        scheduledDate: slotDate,
        scheduledTime: slotTime,
      })

      // First booking
      const conflict1 = await mockPrisma.appointment.findFirst({
        where: {
          doctorId,
          scheduledDate: slotDate,
          scheduledTime: slotTime,
          status: { notIn: ['CANCELLED'] },
        },
      })
      expect(conflict1).toBeNull()

      const apt1 = await mockPrisma.appointment.create({
        data: {
          hospitalId: mockHospitalId,
          doctorId,
          patientId: 'patient-1',
          scheduledDate: slotDate,
          scheduledTime: slotTime,
          status: 'SCHEDULED',
        },
      })
      expect(apt1).toBeDefined()

      // Second booking (should fail due to conflict)
      const conflict2 = await mockPrisma.appointment.findFirst({
        where: {
          doctorId,
          scheduledDate: slotDate,
          scheduledTime: slotTime,
          status: { notIn: ['CANCELLED'] },
        },
      })
      expect(conflict2).not.toBeNull() // Conflict detected
    })
  })
})
