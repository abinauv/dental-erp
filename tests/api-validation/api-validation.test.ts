// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Auth mock ──────────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
  checkPatientLimit: vi.fn(),
}))
vi.mock('@/lib/api-helpers', () => mockAuth)

// ── Prisma mock ────────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    patient: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    appointment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    invoice: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    inventoryItem: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    staff: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    treatment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    hospital: { findUnique: vi.fn(), findFirst: vi.fn() },
    videoConsultation: { create: vi.fn() },
    stockTransaction: { create: vi.fn() },
    $transaction: vi.fn((fn: any) => fn(prismaMock)),
  }
  return { prisma: prismaMock, default: prismaMock }
})

// ── Other dependency mocks ─────────────────────────────────────────────────────
vi.mock('@/lib/services/video.service', () => ({
  createRoom: vi.fn().mockResolvedValue({ roomUrl: 'https://room.test', roomName: 'room-1' }),
}))

vi.mock('@/lib/billing-utils', () => ({
  generateInvoiceNo: vi.fn().mockResolvedValue('INV202600001'),
  calculateInvoiceTotals: vi.fn().mockReturnValue({
    subtotal: 1000,
    discountAmount: 0,
    taxableAmount: 1000,
    cgstAmount: 90,
    sgstAmount: 90,
    totalAmount: 1180,
  }),
  gstConfig: { cgstRate: 9, sgstRate: 9 },
}))

vi.mock('@prisma/client', () => ({
  DiscountType: { FIXED: 'FIXED', PERCENTAGE: 'PERCENTAGE' },
  InvoiceStatus: { DRAFT: 'DRAFT', PENDING: 'PENDING', PAID: 'PAID' },
}))

// ── Imports (after mocks) ──────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'

import { GET as getPatients, POST as postPatient } from '@/app/api/patients/route'
import { GET as getPatientById } from '@/app/api/patients/[id]/route'
import { GET as getAppointments, POST as postAppointment } from '@/app/api/appointments/route'
import { GET as getInvoices, POST as postInvoice } from '@/app/api/invoices/route'
import { GET as getInventoryItems, POST as postInventoryItem } from '@/app/api/inventory/items/route'

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeRequest(url: string, method: string = 'GET', body?: any) {
  const opts: any = { method }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
    opts.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(`http://localhost${url}`, opts)
}

function authSuccess() {
  mockAuth.requireAuthAndRole.mockResolvedValue({
    error: null,
    hospitalId: 'hospital-1',
    user: { id: 'user-1', role: 'ADMIN' },
    session: { user: { id: 'user-1', role: 'ADMIN', hospitalId: 'hospital-1' } },
  })
}

function authUnauthorized() {
  mockAuth.requireAuthAndRole.mockResolvedValue({
    error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    hospitalId: null,
    user: null,
    session: null,
  })
}

function authForbidden() {
  mockAuth.requireAuthAndRole.mockResolvedValue({
    error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    hospitalId: null,
    user: null,
    session: null,
  })
}

// ── Reset mocks ────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  authSuccess()
  mockAuth.checkPatientLimit.mockResolvedValue({ allowed: true, current: 0, max: 100 })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5.1 — Request / Response Validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('5.1 Request/Response Validation', () => {
  // ── 5.1.1 GET endpoints return correct JSON structure ──────────────────────
  describe('GET endpoints return correct JSON structure', () => {
    it('GET /api/patients returns { patients, pagination }', async () => {
      prisma.patient.findMany.mockResolvedValue([])
      prisma.patient.count.mockResolvedValue(0)

      const res = await getPatients(makeRequest('/api/patients'))
      const json = await res.json()

      expect(json).toHaveProperty('patients')
      expect(json).toHaveProperty('pagination')
      expect(Array.isArray(json.patients)).toBe(true)
    })

    it('GET /api/appointments returns { appointments, pagination }', async () => {
      prisma.appointment.findMany.mockResolvedValue([])
      prisma.appointment.count.mockResolvedValue(0)

      const res = await getAppointments(makeRequest('/api/appointments'))
      const json = await res.json()

      expect(json).toHaveProperty('appointments')
      expect(json).toHaveProperty('pagination')
      expect(Array.isArray(json.appointments)).toBe(true)
    })

    it('GET /api/invoices returns { invoices, pagination }', async () => {
      prisma.invoice.findMany.mockResolvedValue([])
      prisma.invoice.count.mockResolvedValue(0)

      const res = await getInvoices(makeRequest('/api/invoices'))
      const json = await res.json()

      expect(json).toHaveProperty('invoices')
      expect(json).toHaveProperty('pagination')
      expect(Array.isArray(json.invoices)).toBe(true)
    })

    it('GET /api/inventory/items returns { data, pagination }', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([])

      const res = await getInventoryItems(makeRequest('/api/inventory/items'))
      const json = await res.json()

      expect(json).toHaveProperty('data')
      expect(json).toHaveProperty('pagination')
      expect(Array.isArray(json.data)).toBe(true)
    })
  })

  // ── 5.1.2 POST endpoints validate required fields → 400 ───────────────────
  describe('POST endpoints validate required fields and return 400', () => {
    it('POST /api/patients with empty body → 400', async () => {
      const res = await postPatient(makeRequest('/api/patients', 'POST', {}))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toHaveProperty('error')
    })

    it('POST /api/appointments with missing patientId → 400', async () => {
      const res = await postAppointment(
        makeRequest('/api/appointments', 'POST', { doctorId: 'd-1', scheduledDate: '2027-01-01', scheduledTime: '10:00' })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toHaveProperty('error')
    })

    it('POST /api/invoices with empty items → 400', async () => {
      const res = await postInvoice(
        makeRequest('/api/invoices', 'POST', { patientId: 'p-1', items: [] })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toHaveProperty('error')
    })

    it('POST /api/inventory/items with missing required fields → 400', async () => {
      const res = await postInventoryItem(
        makeRequest('/api/inventory/items', 'POST', { name: 'Gloves' })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toHaveProperty('error')
    })
  })

  // ── 5.1.3 Pagination format — consistent { page, limit, total } keys ──────
  describe('Pagination format is consistent', () => {
    it('patients pagination contains page, limit, total', async () => {
      prisma.patient.findMany.mockResolvedValue([])
      prisma.patient.count.mockResolvedValue(0)

      const res = await getPatients(makeRequest('/api/patients?page=2&limit=5'))
      const json = await res.json()

      expect(json.pagination).toHaveProperty('page')
      expect(json.pagination).toHaveProperty('limit')
      expect(json.pagination).toHaveProperty('total')
    })

    it('appointments pagination contains page, limit, total', async () => {
      prisma.appointment.findMany.mockResolvedValue([])
      prisma.appointment.count.mockResolvedValue(0)

      const res = await getAppointments(makeRequest('/api/appointments?page=1&limit=20'))
      const json = await res.json()

      expect(json.pagination).toHaveProperty('page')
      expect(json.pagination).toHaveProperty('limit')
      expect(json.pagination).toHaveProperty('total')
    })

    it('invoices pagination contains page, limit, total', async () => {
      prisma.invoice.findMany.mockResolvedValue([])
      prisma.invoice.count.mockResolvedValue(0)

      const res = await getInvoices(makeRequest('/api/invoices'))
      const json = await res.json()

      expect(json.pagination).toHaveProperty('page')
      expect(json.pagination).toHaveProperty('limit')
      expect(json.pagination).toHaveProperty('total')
    })

    it('inventory items pagination contains page, limit, total', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([])

      const res = await getInventoryItems(makeRequest('/api/inventory/items'))
      const json = await res.json()

      expect(json.pagination).toHaveProperty('page')
      expect(json.pagination).toHaveProperty('limit')
      expect(json.pagination).toHaveProperty('total')
    })
  })

  // ── 5.1.4 Error response format — { error: string } ───────────────────────
  describe('Error response format includes error string', () => {
    it('validation error returns { error: string }', async () => {
      const res = await postPatient(makeRequest('/api/patients', 'POST', {}))
      const json = await res.json()

      expect(typeof json.error).toBe('string')
      expect(json.error.length).toBeGreaterThan(0)
    })

    it('server error returns { error: string }', async () => {
      prisma.patient.findMany.mockRejectedValue(new Error('DB down'))
      prisma.patient.count.mockRejectedValue(new Error('DB down'))

      const res = await getPatients(makeRequest('/api/patients'))
      const json = await res.json()

      expect(typeof json.error).toBe('string')
      expect(res.status).toBe(500)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5.2 — Status Codes
// ═══════════════════════════════════════════════════════════════════════════════
describe('5.2 Status Codes', () => {
  it('200 for successful GET /api/patients', async () => {
    prisma.patient.findMany.mockResolvedValue([])
    prisma.patient.count.mockResolvedValue(0)

    const res = await getPatients(makeRequest('/api/patients'))
    expect(res.status).toBe(200)
  })

  it('200 for successful GET /api/appointments', async () => {
    prisma.appointment.findMany.mockResolvedValue([])
    prisma.appointment.count.mockResolvedValue(0)

    const res = await getAppointments(makeRequest('/api/appointments'))
    expect(res.status).toBe(200)
  })

  it('200 for successful GET /api/invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([])
    prisma.invoice.count.mockResolvedValue(0)

    const res = await getInvoices(makeRequest('/api/invoices'))
    expect(res.status).toBe(200)
  })

  it('201 for successful POST /api/patients', async () => {
    prisma.patient.findFirst.mockResolvedValue(null) // no duplicate, no last patient
    prisma.patient.create.mockResolvedValue({ id: 'p-1', firstName: 'Jane', lastName: 'Doe', phone: '1234567890' })

    const res = await postPatient(
      makeRequest('/api/patients', 'POST', { firstName: 'Jane', lastName: 'Doe', phone: '1234567890' })
    )
    expect(res.status).toBe(201)
  })

  it('201 for successful POST /api/inventory/items', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null)
    prisma.inventoryItem.create.mockResolvedValue({ id: 'item-1', sku: 'SKU001', name: 'Gloves' })

    const res = await postInventoryItem(
      makeRequest('/api/inventory/items', 'POST', {
        sku: 'SKU001', name: 'Gloves', unit: 'box', purchasePrice: 50,
      })
    )
    expect(res.status).toBe(201)
  })

  it('400 for validation errors', async () => {
    const res = await postPatient(makeRequest('/api/patients', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('401 for unauthenticated request', async () => {
    authUnauthorized()

    const res = await getPatients(makeRequest('/api/patients'))
    expect(res.status).toBe(401)
  })

  it('403 for unauthorized role', async () => {
    authForbidden()

    const res = await getPatients(makeRequest('/api/patients'))
    expect(res.status).toBe(403)
  })

  it('404 for non-existent patient by ID', async () => {
    prisma.patient.findFirst.mockResolvedValue(null)

    const req = makeRequest('/api/patients/non-existent-id')
    const res = await getPatientById(req, { params: Promise.resolve({ id: 'non-existent-id' }) })
    expect(res.status).toBe(404)
  })

  it('500 for server errors (Prisma throws)', async () => {
    prisma.patient.findMany.mockRejectedValue(new Error('Connection refused'))
    prisma.patient.count.mockRejectedValue(new Error('Connection refused'))

    const res = await getPatients(makeRequest('/api/patients'))
    expect(res.status).toBe(500)
  })

  it('500 for appointments server error', async () => {
    prisma.appointment.findMany.mockRejectedValue(new Error('Timeout'))
    prisma.appointment.count.mockRejectedValue(new Error('Timeout'))

    const res = await getAppointments(makeRequest('/api/appointments'))
    expect(res.status).toBe(500)
  })

  it('500 for invoices server error', async () => {
    prisma.invoice.findMany.mockRejectedValue(new Error('Deadlock'))
    prisma.invoice.count.mockRejectedValue(new Error('Deadlock'))

    const res = await getInvoices(makeRequest('/api/invoices'))
    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5.3 — Authentication Tokens
// ═══════════════════════════════════════════════════════════════════════════════
describe('5.3 Authentication Tokens', () => {
  it('unauthenticated request to patients → 401', async () => {
    authUnauthorized()
    const res = await getPatients(makeRequest('/api/patients'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('unauthenticated request to appointments → 401', async () => {
    authUnauthorized()
    const res = await getAppointments(makeRequest('/api/appointments'))
    expect(res.status).toBe(401)
  })

  it('unauthenticated request to invoices → 401', async () => {
    authUnauthorized()
    const res = await getInvoices(makeRequest('/api/invoices'))
    expect(res.status).toBe(401)
  })

  it('unauthenticated request to inventory → 401', async () => {
    authUnauthorized()
    const res = await getInventoryItems(makeRequest('/api/inventory/items'))
    expect(res.status).toBe(401)
  })

  it('unauthenticated POST to patients → 401', async () => {
    authUnauthorized()
    const res = await postPatient(
      makeRequest('/api/patients', 'POST', { firstName: 'Test', lastName: 'User', phone: '999' })
    )
    expect(res.status).toBe(401)
  })

  it('wrong role (forbidden) → 403', async () => {
    authForbidden()
    const res = await getPatients(makeRequest('/api/patients'))
    expect(res.status).toBe(403)
  })

  it('wrong role on POST → 403', async () => {
    authForbidden()
    const res = await postAppointment(
      makeRequest('/api/appointments', 'POST', { patientId: 'p-1' })
    )
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5.4 — Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════
describe('5.4 Edge Cases', () => {
  it('empty request body on POST /api/patients → 400 with meaningful error', async () => {
    const res = await postPatient(makeRequest('/api/patients', 'POST', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeTruthy()
    expect(typeof json.error).toBe('string')
  })

  it('empty request body on POST /api/appointments → 400', async () => {
    const res = await postAppointment(makeRequest('/api/appointments', 'POST', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('extremely long string in search parameter → handled gracefully', async () => {
    const longSearch = 'a'.repeat(10000)
    prisma.patient.findMany.mockResolvedValue([])
    prisma.patient.count.mockResolvedValue(0)

    const res = await getPatients(makeRequest(`/api/patients?search=${longSearch}`))
    // Should not crash — either 200 with empty results or some handled status
    expect([200, 400, 500]).toContain(res.status)
  })

  it('special characters in search → no crash', async () => {
    prisma.patient.findMany.mockResolvedValue([])
    prisma.patient.count.mockResolvedValue(0)

    const search = encodeURIComponent("O'Brien & Co. <script>alert('xss')</script>")
    const res = await getPatients(makeRequest(`/api/patients?search=${search}`))
    expect(res.status).toBe(200)
  })

  it('SQL-like injection in search → no crash', async () => {
    prisma.appointment.findMany.mockResolvedValue([])
    prisma.appointment.count.mockResolvedValue(0)

    const search = encodeURIComponent("'; DROP TABLE patients; --")
    const res = await getAppointments(makeRequest(`/api/appointments?search=${search}`))
    expect(res.status).toBe(200)
  })

  it('invalid JSON body → 500 (JSON parse error caught)', async () => {
    // NextRequest with invalid JSON — the route calls request.json() which throws
    const req = new NextRequest('http://localhost/api/patients', {
      method: 'POST',
      body: 'not-valid-json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await postPatient(req)
    // The route's catch block turns parse errors into 500
    expect([400, 500]).toContain(res.status)
    const json = await res.json()
    expect(json).toHaveProperty('error')
  })

  it('non-existent patient ID → 404', async () => {
    prisma.patient.findFirst.mockResolvedValue(null)

    const req = makeRequest('/api/patients/does-not-exist')
    const res = await getPatientById(req, { params: Promise.resolve({ id: 'does-not-exist' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('not found')
  })

  it('unicode / emoji in patient firstName → Prisma create called with the data', async () => {
    prisma.patient.findFirst.mockResolvedValue(null) // no duplicate
    prisma.patient.create.mockResolvedValue({
      id: 'p-emoji',
      firstName: 'Héllo 🦷',
      lastName: 'Wörld 🌍',
      phone: '5551234567',
    })

    const res = await postPatient(
      makeRequest('/api/patients', 'POST', {
        firstName: 'Héllo 🦷',
        lastName: 'Wörld 🌍',
        phone: '5551234567',
      })
    )
    expect(res.status).toBe(201)
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Héllo 🦷',
          lastName: 'Wörld 🌍',
        }),
      })
    )
  })

  it('unicode in appointment notes → Prisma create called with the data', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    prisma.patient.findFirst.mockResolvedValue({ id: 'p-1', hospitalId: 'hospital-1' })
    prisma.staff.findFirst.mockResolvedValue({ id: 'd-1', hospitalId: 'hospital-1' })
    prisma.appointment.findFirst.mockResolvedValue(null) // no conflict, no last appointment
    prisma.appointment.create.mockResolvedValue({
      id: 'apt-1',
      notes: '牙科检查 — зуб 🦷',
    })

    const res = await postAppointment(
      makeRequest('/api/appointments', 'POST', {
        patientId: 'p-1',
        doctorId: 'd-1',
        scheduledDate: dateStr,
        scheduledTime: '10:00',
        notes: '牙科检查 — зуб 🦷',
      })
    )
    expect(res.status).toBe(201)
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: '牙科检查 — зуб 🦷',
        }),
      })
    )
  })

  it('POST /api/invoices with missing patientId → 400', async () => {
    const res = await postInvoice(
      makeRequest('/api/invoices', 'POST', { items: [{ description: 'Cleaning', quantity: 1, unitPrice: 500 }] })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('POST /api/appointments with invalid time format → 400', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p-1' })
    prisma.staff.findFirst.mockResolvedValue({ id: 'd-1' })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const res = await postAppointment(
      makeRequest('/api/appointments', 'POST', {
        patientId: 'p-1',
        doctorId: 'd-1',
        scheduledDate: tomorrow.toISOString().split('T')[0],
        scheduledTime: '25:99', // invalid
      })
    )
    expect(res.status).toBe(400)
  })

  it('very large page number → returns empty results, no crash', async () => {
    prisma.patient.findMany.mockResolvedValue([])
    prisma.patient.count.mockResolvedValue(5)

    const res = await getPatients(makeRequest('/api/patients?page=999999'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.patients).toEqual([])
  })

  it('negative page/limit → handled gracefully', async () => {
    prisma.patient.findMany.mockResolvedValue([])
    prisma.patient.count.mockResolvedValue(0)

    const res = await getPatients(makeRequest('/api/patients?page=-1&limit=-5'))
    // The route clamps values with Math.max; should not crash
    expect(res.status).toBe(200)
  })
})
