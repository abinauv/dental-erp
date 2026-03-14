import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

vi.mock('@/lib/prisma', () => ({ default: prisma }))

const mockSmsService = vi.hoisted(() => ({
  sendSMS: vi.fn().mockResolvedValue({ success: true }),
}))
const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  generateEmailHTML: vi.fn().mockResolvedValue('<html>email</html>'),
}))
const mockTemplateService = vi.hoisted(() => ({
  getDefaultTemplate: vi.fn(),
  replaceVariables: vi.fn().mockImplementation((content: string) => content),
}))

vi.mock('@/lib/services/sms.service', () => ({ smsService: mockSmsService }))
vi.mock('@/lib/services/email.service', () => ({ emailService: mockEmailService }))
vi.mock('@/lib/services/template.service', () => ({ templateService: mockTemplateService }))

const { communicationTriggersService } = await import('@/lib/services/communication-triggers.service')

describe('CommunicationTriggersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendAppointmentReminders24Hours', () => {
    it('sends SMS and email reminders for tomorrow\'s appointments', async () => {
      ;(prisma.appointment.findMany as any).mockResolvedValue([
        {
          id: 'apt-1',
          hospitalId: 'h1',
          patientId: 'pat-1',
          appointmentNo: 'APT-001',
          scheduledDate: new Date('2026-03-04'),
          scheduledTime: '10:00',
          chairNumber: 2,
          patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210', email: 'john@test.com' },
          doctor: { firstName: 'Alice', lastName: 'Brown', user: {} },
        },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockResolvedValue({
        appointmentReminders: true,
        smsEnabled: true,
        emailEnabled: true,
      })

      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic', phone: '1234567890' })

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'tmpl-1',
        content: 'Your appointment is tomorrow',
        subject: 'Reminder',
      })

      ;(prisma.appointmentReminder.create as any).mockResolvedValue({})

      await communicationTriggersService.sendAppointmentReminders24Hours()

      expect(mockSmsService.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '9876543210', patientId: 'pat-1' })
      )
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'john@test.com', patientId: 'pat-1' })
      )
      expect(prisma.appointmentReminder.create).toHaveBeenCalled()
    })

    it('skips patients who disabled appointment reminders', async () => {
      ;(prisma.appointment.findMany as any).mockResolvedValue([
        {
          id: 'apt-1',
          hospitalId: 'h1',
          patientId: 'pat-1',
          appointmentNo: 'APT-001',
          scheduledDate: new Date('2026-03-04'),
          scheduledTime: '10:00',
          patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
          doctor: { firstName: 'Alice', lastName: 'Brown', user: {} },
        },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockResolvedValue({
        appointmentReminders: false,
      })

      await communicationTriggersService.sendAppointmentReminders24Hours()

      expect(mockSmsService.sendSMS).not.toHaveBeenCalled()
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled()
    })

    it('handles empty appointments gracefully', async () => {
      ;(prisma.appointment.findMany as any).mockResolvedValue([])

      await communicationTriggersService.sendAppointmentReminders24Hours()
      expect(mockSmsService.sendSMS).not.toHaveBeenCalled()
    })

    it('continues on error for individual appointment', async () => {
      ;(prisma.appointment.findMany as any).mockResolvedValue([
        {
          id: 'apt-1',
          hospitalId: 'h1',
          patientId: 'pat-1',
          appointmentNo: 'APT-001',
          scheduledDate: new Date('2026-03-04'),
          scheduledTime: '10:00',
          patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
          doctor: { firstName: 'Alice', lastName: 'Brown', user: {} },
        },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockRejectedValue(new Error('DB error'))

      // Should not throw
      await communicationTriggersService.sendAppointmentReminders24Hours()
    })
  })

  describe('sendBirthdayWishes', () => {
    it('sends birthday wishes to patients with birthday today', async () => {
      const today = new Date()
      const dob = new Date(1990, today.getMonth(), today.getDate())

      ;(prisma.patient.findMany as any).mockResolvedValue([
        {
          id: 'pat-1',
          hospitalId: 'h1',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          dateOfBirth: dob,
          isActive: true,
        },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockResolvedValue({
        birthdayWishes: true,
        smsEnabled: true,
      })

      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic', phone: '123' })

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'tmpl-2',
        content: 'Happy Birthday!',
      })

      await communicationTriggersService.sendBirthdayWishes()

      expect(mockSmsService.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '9876543210', patientId: 'pat-1' })
      )
    })

    it('skips patients who disabled birthday wishes', async () => {
      const today = new Date()
      const dob = new Date(1990, today.getMonth(), today.getDate())

      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'pat-1', hospitalId: 'h1', firstName: 'John', lastName: 'Doe', phone: '9876543210', dateOfBirth: dob, isActive: true },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockResolvedValue({
        birthdayWishes: false,
      })

      await communicationTriggersService.sendBirthdayWishes()
      expect(mockSmsService.sendSMS).not.toHaveBeenCalled()
    })

    it('skips patients whose birthday is not today', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dob = new Date(1990, tomorrow.getMonth(), tomorrow.getDate())

      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'pat-1', hospitalId: 'h1', firstName: 'John', lastName: 'Doe', phone: '9876543210', dateOfBirth: dob, isActive: true },
      ])

      await communicationTriggersService.sendBirthdayWishes()
      expect(mockSmsService.sendSMS).not.toHaveBeenCalled()
    })
  })

  describe('sendPaymentReminders', () => {
    it('sends reminders for overdue invoices', async () => {
      ;(prisma.invoice.findMany as any).mockResolvedValue([
        {
          id: 'inv-1',
          hospitalId: 'h1',
          patientId: 'pat-1',
          invoiceNo: 'INV-001',
          totalAmount: 5000,
          balanceAmount: 3000,
          dueDate: new Date('2026-02-15'),
          patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockResolvedValue({
        paymentReminders: true,
        smsEnabled: true,
      })

      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic', phone: '123' })

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'tmpl-3',
        content: 'Payment due',
      })

      await communicationTriggersService.sendPaymentReminders()

      expect(mockSmsService.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '9876543210', patientId: 'pat-1' })
      )
    })

    it('skips patients who disabled payment reminders', async () => {
      ;(prisma.invoice.findMany as any).mockResolvedValue([
        {
          id: 'inv-1',
          hospitalId: 'h1',
          patientId: 'pat-1',
          invoiceNo: 'INV-001',
          totalAmount: 5000,
          balanceAmount: 3000,
          patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        },
      ])

      ;(prisma.patientCommunicationPreference.findUnique as any).mockResolvedValue({
        paymentReminders: false,
      })

      await communicationTriggersService.sendPaymentReminders()
      expect(mockSmsService.sendSMS).not.toHaveBeenCalled()
    })
  })

  describe('sendLabWorkReadyNotifications', () => {
    it('sends notification for ready lab orders', async () => {
      ;(prisma.labOrder.findMany as any).mockResolvedValue([
        {
          id: 'lab-1',
          hospitalId: 'h1',
          patientId: 'pat-1',
          orderNumber: 'LAB-001',
          workType: 'Crown',
          notes: '',
          patient: { firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        },
      ])

      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic', phone: '123' })

      mockTemplateService.getDefaultTemplate.mockResolvedValue({
        id: 'tmpl-4',
        content: 'Your lab work is ready',
      })

      ;(prisma.labOrder.update as any).mockResolvedValue({})

      await communicationTriggersService.sendLabWorkReadyNotifications()

      expect(mockSmsService.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '9876543210', patientId: 'pat-1' })
      )
      expect(prisma.labOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Ready notification sent'),
          }),
        })
      )
    })
  })

  describe('runAllTriggers', () => {
    it('runs all trigger functions', async () => {
      // Mock all queries to return empty
      ;(prisma.appointment.findMany as any).mockResolvedValue([])
      ;(prisma.patient.findMany as any).mockResolvedValue([])
      ;(prisma.invoice.findMany as any).mockResolvedValue([])
      ;(prisma.labOrder.findMany as any).mockResolvedValue([])
      ;(prisma.hospital.findMany as any).mockResolvedValue([])

      await communicationTriggersService.runAllTriggers()
      // Verify each sub-function's query was called
      expect(prisma.appointment.findMany).toHaveBeenCalled()
      expect(prisma.patient.findMany).toHaveBeenCalled()
      expect(prisma.invoice.findMany).toHaveBeenCalled()
      expect(prisma.labOrder.findMany).toHaveBeenCalled()
    })
  })
})
