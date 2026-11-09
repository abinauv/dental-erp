import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

const mockStorage = vi.hoisted(() => ({
  name: 'local' as const,
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  getSignedUrl: vi.fn(),
}))

const mockParsers = vi.hoisted(() => ({
  parseFile: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return { ...actual, getStorage: () => mockStorage }
})
vi.mock('@/lib/import/parsers', () => mockParsers)
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))

const mod = await import('@/app/api/data-import/commit/route')

function makeRequest(body: any) {
  return new Request('http://localhost/api/data-import/commit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/data-import/commit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('imports patients successfully', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-1',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      filePath: 'uploads/hospital-1/imports/test.csv',
      fileType: 'csv',
      fileName: 'patients.csv',
    })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name', 'Phone'],
      rows: [
        { Name: 'John Doe', Phone: '9876543210' },
        { Name: 'Jane Smith', Phone: '9876543211' },
      ],
      totalRows: 2,
    })

    // For generateId
    ;(prisma.patient.findFirst as any).mockResolvedValue(null)
    ;(prisma.patient.create as any).mockResolvedValue({})
    ;(prisma.auditLog.create as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-1',
        mapping: { Name: 'firstName', Phone: 'phone' },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.imported).toBe(2)
    expect(body.skipped).toBe(0)
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DATA_IMPORT' }),
      })
    )
  })

  it('gives imported staff a Better Auth credential matching User.password', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-staff',
      hospitalId: 'hospital-1',
      entityType: 'staff',
      filePath: 'uploads/hospital-1/imports/staff.csv',
      fileType: 'csv',
      fileName: 'staff.csv',
    })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})
    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name', 'Email', 'Phone', 'Emp'],
      rows: [{ Name: 'Asha Rao', Email: 'asha@clinic.test', Phone: '9876500001', Emp: 'EMP900' }],
      totalRows: 1,
    })
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    ;(prisma.user.create as any).mockResolvedValue({ id: 'imported-user-1' })
    ;(prisma.staff.create as any).mockResolvedValue({})
    ;(prisma.auditLog.create as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-staff',
        mapping: { Name: 'firstName', Email: 'email', Phone: 'phone', Emp: 'employeeId' },
      })
    )

    expect(res.status).toBe(200)
    expect((await res.json()).imported).toBe(1)
    expect(prisma.baAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'bacred_imported-user-1',
        providerId: 'credential',
        userId: 'imported-user-1',
        password: 'hashed-password',
      }),
    })
  })

  describe('imported staff accounts', () => {
    async function importStaffRows(rows: Record<string, string>[]) {
      ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
        id: 'job-staff',
        hospitalId: 'hospital-1',
        entityType: 'staff',
        filePath: 'uploads/hospital-1/imports/staff.csv',
        fileType: 'csv',
        fileName: 'staff.csv',
      })
      ;(prisma.dataImportJob.update as any).mockResolvedValue({})
      mockStorage.get.mockResolvedValue({
        body: Buffer.from('data'),
        contentType: 'text/csv',
        size: 4,
      })
      mockParsers.parseFile.mockResolvedValue({
        columns: Object.keys(rows[0]),
        rows,
        totalRows: rows.length,
      })
      ;(prisma.user.findUnique as any).mockResolvedValue(null)
      ;(prisma.user.create as any).mockImplementation(async ({ data }: any) => ({
        id: `user-${data.email}`,
      }))
      ;(prisma.staff.create as any).mockResolvedValue({})
      ;(prisma.auditLog.create as any).mockResolvedValue({})

      return mod.POST(
        makeRequest({
          jobId: 'job-staff',
          mapping: { Name: 'firstName', Email: 'email', Phone: 'phone', Role: 'role' },
        })
      )
    }

    it('returns each new account’s temporary password once, uncached', async () => {
      const bcrypt = (await import('bcryptjs')).default as any

      const res = await importStaffRows([
        { Name: 'Asha Rao', Email: 'asha@clinic.test', Phone: '9876500001', Role: 'Doctor' },
      ])
      const body = await res.json()

      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(body.credentials).toEqual([
        { name: 'Asha Rao', email: 'asha@clinic.test', temporaryPassword: expect.any(String) },
      ])
      // The password handed back is the one whose hash was stored.
      const temporaryPassword = body.credentials[0].temporaryPassword
      expect(temporaryPassword).toMatch(/^[A-Za-z0-9_-]{12}$/)
      expect(bcrypt.hash).toHaveBeenCalledWith(temporaryPassword, 10)
    })

    it('maps role names onto the app’s roles, and unknown ones to RECEPTIONIST', async () => {
      await importStaffRows([
        { Name: 'A One', Email: 'a@clinic.test', Phone: '9876500011', Role: 'Lab Tech' },
        { Name: 'B Two', Email: 'b@clinic.test', Phone: '9876500012', Role: 'accountant' },
        { Name: 'C Three', Email: 'c@clinic.test', Phone: '9876500013', Role: 'Nurse' },
      ])

      const roles = (prisma.user.create as any).mock.calls.map((c: any) => c[0].data.role)
      expect(roles).toEqual(['LAB_TECH', 'ACCOUNTANT', 'RECEPTIONIST'])
    })

    it('does not return credentials for non-staff imports', async () => {
      ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
        id: 'job-p',
        hospitalId: 'hospital-1',
        entityType: 'patients',
        filePath: 'uploads/hospital-1/imports/p.csv',
        fileType: 'csv',
        fileName: 'p.csv',
      })
      ;(prisma.dataImportJob.update as any).mockResolvedValue({})
      mockStorage.get.mockResolvedValue({
        body: Buffer.from('d'),
        contentType: 'text/csv',
        size: 1,
      })
      mockParsers.parseFile.mockResolvedValue({
        columns: ['Name', 'Phone'],
        rows: [{ Name: 'Pat One', Phone: '9876500021' }],
        totalRows: 1,
      })
      ;(prisma.patient.findFirst as any).mockResolvedValue(null)
      ;(prisma.patient.create as any).mockResolvedValue({})
      ;(prisma.auditLog.create as any).mockResolvedValue({})

      const res = await mod.POST(
        makeRequest({ jobId: 'job-p', mapping: { Name: 'firstName', Phone: 'phone' } })
      )
      expect((await res.json()).credentials).toBeUndefined()
    })
  })

  it('imports inventory items successfully', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-2',
      hospitalId: 'hospital-1',
      entityType: 'inventory',
      filePath: 'uploads/hospital-1/imports/inventory.csv',
      fileType: 'csv',
      fileName: 'inventory.csv',
    })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Item', 'Unit', 'Price'],
      rows: [{ Item: 'Gloves', Unit: 'box', Price: '200' }],
      totalRows: 1,
    })

    ;(prisma.inventoryItem.findFirst as any).mockResolvedValue(null) // no dup SKU
    ;(prisma.inventoryItem.create as any).mockResolvedValue({})
    ;(prisma.auditLog.create as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-2',
        mapping: { Item: 'name', Unit: 'unit', Price: 'purchasePrice' },
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.imported).toBe(1)
  })

  it('skips error rows when skipErrorRows is true', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-3',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      filePath: 'uploads/hospital-1/imports/mixed.csv',
      fileType: 'csv',
      fileName: 'mixed.csv',
    })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name', 'Phone'],
      rows: [
        { Name: 'John Doe', Phone: '9876543210' },
        { Name: '', Phone: '' }, // missing required fields
      ],
      totalRows: 2,
    })

    ;(prisma.patient.findFirst as any).mockResolvedValue(null)
    ;(prisma.patient.create as any).mockResolvedValue({})
    ;(prisma.auditLog.create as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-3',
        mapping: { Name: 'firstName', Phone: 'phone' },
        skipErrorRows: true,
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.imported).toBe(1)
    expect(body.skipped).toBe(1)
    expect(body.errors).toHaveLength(1)
  })

  it('returns 400 when jobId is missing', async () => {
    const res = await mod.POST(makeRequest({ mapping: {} }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when mapping is missing', async () => {
    const res = await mod.POST(makeRequest({ jobId: 'job-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when job not found', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue(null)

    const res = await mod.POST(makeRequest({ jobId: 'nonexistent', mapping: {} }))
    expect(res.status).toBe(404)
  })

  it('marks job as FAILED when all rows error', async () => {
    ;(prisma.dataImportJob.findFirst as any).mockResolvedValue({
      id: 'job-4',
      hospitalId: 'hospital-1',
      entityType: 'patients',
      filePath: 'uploads/hospital-1/imports/bad.csv',
      fileType: 'csv',
      fileName: 'bad.csv',
    })
    ;(prisma.dataImportJob.update as any).mockResolvedValue({})

    mockStorage.get.mockResolvedValue({
      body: Buffer.from('data'),
      contentType: 'text/csv',
      size: 4,
    })
    mockParsers.parseFile.mockResolvedValue({
      columns: ['Name'],
      rows: [{ Name: '' }], // missing phone and firstName
      totalRows: 1,
    })

    ;(prisma.patient.findFirst as any).mockResolvedValue(null)
    ;(prisma.auditLog.create as any).mockResolvedValue({})

    const res = await mod.POST(
      makeRequest({
        jobId: 'job-4',
        mapping: { Name: 'firstName' },
        skipErrorRows: true,
      })
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    // All failed
    expect(body.imported).toBe(0)
    expect(body.skipped).toBe(1)
    // Job marked as FAILED
    expect(prisma.dataImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    )
  })

  it('returns 401 for non-ADMIN users', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Forbidden' }, { status: 403 }),
      hospitalId: null,
    })
    const res = await mod.POST(makeRequest({ jobId: 'job-1', mapping: {} }))
    expect(res.status).toBe(403)
  })
})
