import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
  checkStaffLimit: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const list = await import('@/app/api/staff/route')
const detail = await import('@/app/api/staff/[id]/route')
const { SENSITIVE_STAFF_FIELDS } = await import('@/lib/staff-privacy')

// A staff record with every sensitive field filled in.
function staffRecord(id: string, userId: string) {
  return {
    id,
    userId,
    hospitalId: 'hospital-1',
    firstName: 'Asha',
    lastName: 'Rao',
    phone: '9876500001',
    email: `${id}@clinic.test`,
    qualification: 'BDS',
    dateOfBirth: '1990-01-01',
    alternatePhone: '9876500002',
    address: '1 Main St',
    city: 'Chennai',
    state: 'TN',
    pincode: '600001',
    aadharNumber: '1234-5678-9012',
    panNumber: 'ABCDE1234F',
    salary: 50000,
    bankAccountNo: '000111222',
    bankIfsc: 'BANK0001',
    emergencyContact: 'Ravi',
    emergencyPhone: '9876500003',
    user: { id: userId, role: 'DOCTOR', isActive: true, email: `${id}@clinic.test` },
  }
}

function signedInAs(role: string, userId = 'me') {
  mockAuth.requireAuthAndRole.mockResolvedValue({
    error: null,
    hospitalId: 'hospital-1',
    user: { id: userId, role },
    session: { user: { id: userId, role } },
  })
}

function expectRedacted(record: Record<string, unknown>) {
  for (const field of SENSITIVE_STAFF_FIELDS) expect(record).not.toHaveProperty(field)
  expect(record.firstName).toBe('Asha')
  expect(record.phone).toBe('9876500001')
}

function expectComplete(record: Record<string, unknown>) {
  expect(record.aadharNumber).toBe('1234-5678-9012')
  expect(record.salary).toBe(50000)
  expect(record.bankAccountNo).toBe('000111222')
}

describe('staff PII is limited to admins and the staff member', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.staff.findMany as any).mockResolvedValue([
      staffRecord('s-other', 'u-other'),
      staffRecord('s-me', 'me'),
    ])
    ;(prisma.staff.count as any).mockResolvedValue(2)
  })

  it('GET /api/staff: a receptionist sees colleagues without PII, and their own record in full', async () => {
    signedInAs('RECEPTIONIST')
    const res = await list.GET(new NextRequest('http://localhost/api/staff'))
    const { staff } = await res.json()

    expectRedacted(staff.find((s: any) => s.id === 's-other'))
    expectComplete(staff.find((s: any) => s.id === 's-me'))
  })

  it('GET /api/staff: an admin sees every field', async () => {
    signedInAs('ADMIN')
    const res = await list.GET(new NextRequest('http://localhost/api/staff'))
    const { staff } = await res.json()

    for (const s of staff) expectComplete(s)
  })

  it('GET /api/staff/[id]: a doctor viewing a colleague gets no PII', async () => {
    signedInAs('DOCTOR')
    ;(prisma.staff.findUnique as any).mockResolvedValue(staffRecord('s-other', 'u-other'))

    const res = await detail.GET(new NextRequest('http://localhost/api/staff/s-other'), {
      params: Promise.resolve({ id: 's-other' }),
    })
    expectRedacted(await res.json())
  })

  it('GET /api/staff/[id]: a staff member viewing their own record gets every field', async () => {
    signedInAs('DOCTOR')
    ;(prisma.staff.findUnique as any).mockResolvedValue(staffRecord('s-me', 'me'))

    const res = await detail.GET(new NextRequest('http://localhost/api/staff/s-me'), {
      params: Promise.resolve({ id: 's-me' }),
    })
    expectComplete(await res.json())
  })

  it('GET /api/staff/[id]: an admin gets every field', async () => {
    signedInAs('ADMIN')
    ;(prisma.staff.findUnique as any).mockResolvedValue(staffRecord('s-other', 'u-other'))

    const res = await detail.GET(new NextRequest('http://localhost/api/staff/s-other'), {
      params: Promise.resolve({ id: 's-other' }),
    })
    expectComplete(await res.json())
  })
})
