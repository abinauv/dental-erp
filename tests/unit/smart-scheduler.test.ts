import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

vi.mock('@/lib/prisma', () => ({ default: prisma }))

const { findMatchingWaitlistPatients, handleCancellationWaitlist, bookFromWaitlist } = await import('@/lib/services/smart-scheduler')

describe('Smart Scheduler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findMatchingWaitlistPatients', () => {
    it('returns matching waitlisted patients for a cancelled slot', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', preferredDays: null, preferredTime: null },
        { id: 'w2', patientId: 'p2', preferredDays: ['MONDAY'], preferredTime: 'MORNING' },
      ])
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        { id: 'p2', firstName: 'Jane', lastName: 'Smith', phone: '9876543211' },
      ])

      // Monday morning slot
      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'), // Monday
        scheduledTime: '09:00',
        duration: 30,
      }

      const result = await findMatchingWaitlistPatients(slot)
      expect(result).toHaveLength(2)
      expect(result[0].patientName).toBe('John Doe')
      expect(result[1].patientName).toBe('Jane Smith')
    })

    it('filters out patients with non-matching preferred days', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', preferredDays: ['TUESDAY', 'WEDNESDAY'], preferredTime: null },
      ])
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
      ])

      // Monday slot - patient prefers Tuesday/Wednesday
      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'), // Monday
        scheduledTime: '09:00',
        duration: 30,
      }

      const result = await findMatchingWaitlistPatients(slot)
      expect(result).toHaveLength(0)
    })

    it('filters out patients with non-matching preferred time', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', preferredDays: null, preferredTime: 'EVENING' },
      ])
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
      ])

      // Morning slot - patient prefers evening
      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'),
        scheduledTime: '09:00',
        duration: 30,
      }

      const result = await findMatchingWaitlistPatients(slot)
      expect(result).toHaveLength(0)
    })

    it('returns empty array when no waitlist entries', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([])

      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'),
        scheduledTime: '09:00',
        duration: 30,
      }

      const result = await findMatchingWaitlistPatients(slot)
      expect(result).toHaveLength(0)
    })

    it('correctly identifies afternoon time of day', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', preferredDays: null, preferredTime: 'AFTERNOON' },
      ])
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
      ])

      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'),
        scheduledTime: '14:00', // 2 PM = AFTERNOON
        duration: 30,
      }

      const result = await findMatchingWaitlistPatients(slot)
      expect(result).toHaveLength(1)
    })
  })

  describe('handleCancellationWaitlist', () => {
    it('finds matches, gets doctor name, and marks as NOTIFIED', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', preferredDays: null, preferredTime: null },
        { id: 'w2', patientId: 'p2', preferredDays: null, preferredTime: null },
      ])
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        { id: 'p2', firstName: 'Jane', lastName: 'Smith', phone: '9876543211' },
      ])
      ;(prisma.staff.findUnique as any).mockResolvedValue({ firstName: 'Alice', lastName: 'Brown' })
      ;(prisma.waitlist.updateMany as any).mockResolvedValue({ count: 2 })

      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'),
        scheduledTime: '10:00',
        duration: 30,
      }

      const result = await handleCancellationWaitlist(slot)
      expect(result.matchedPatients).toHaveLength(2)
      expect(result.slotDetails.doctorName).toBe('Dr. Alice Brown')
      expect(prisma.waitlist.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NOTIFIED' }),
        })
      )
    })

    it('limits notifications to 3 patients', async () => {
      ;(prisma.waitlist.findMany as any).mockResolvedValue([
        { id: 'w1', patientId: 'p1', preferredDays: null, preferredTime: null },
        { id: 'w2', patientId: 'p2', preferredDays: null, preferredTime: null },
        { id: 'w3', patientId: 'p3', preferredDays: null, preferredTime: null },
        { id: 'w4', patientId: 'p4', preferredDays: null, preferredTime: null },
      ])
      ;(prisma.patient.findMany as any).mockResolvedValue([
        { id: 'p1', firstName: 'A', lastName: 'B', phone: '1' },
        { id: 'p2', firstName: 'C', lastName: 'D', phone: '2' },
        { id: 'p3', firstName: 'E', lastName: 'F', phone: '3' },
        { id: 'p4', firstName: 'G', lastName: 'H', phone: '4' },
      ])
      ;(prisma.staff.findUnique as any).mockResolvedValue({ firstName: 'Doc', lastName: 'Tor' })
      ;(prisma.waitlist.updateMany as any).mockResolvedValue({ count: 3 })

      const slot = {
        hospitalId: 'hospital-1',
        doctorId: 'doc-1',
        scheduledDate: new Date('2026-03-02'),
        scheduledTime: '10:00',
        duration: 30,
      }

      const result = await handleCancellationWaitlist(slot)
      expect(result.matchedPatients).toHaveLength(3)
    })
  })

  describe('bookFromWaitlist', () => {
    it('updates waitlist entry to BOOKED status', async () => {
      ;(prisma.waitlist.update as any).mockResolvedValue({})

      await bookFromWaitlist('w1', 'apt-1')
      expect(prisma.waitlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w1' },
          data: expect.objectContaining({ status: 'BOOKED' }),
        })
      )
    })
  })
})
