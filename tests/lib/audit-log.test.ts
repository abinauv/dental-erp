// The audit log's record of changes (lib/audit-log.ts): which writes make
// entries, what they say, that secrets never reach them, and how they behave
// in transactions.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@/lib/generated/prisma/client'
import {
  auditEntries,
  withAuditLog,
  recordSignIn,
  NOT_AUDITED,
  BULK_LIMIT,
  COUNT_KEY,
  HIDDEN,
  CHANGED,
  type ChangeInput,
} from '@/lib/audit-log'
import { beginAuditActor, currentAuditActor, runAsAuditActor } from '@/lib/audit-context'

const actor = {
  userId: 'u-admin',
  hospitalId: 'h1',
  source: 'web' as const,
  ipAddress: '203.0.113.9',
  userAgent: 'Browser',
}
const at = new Date('2026-11-18T10:00:00.000Z')
const later = new Date('2026-11-18T11:00:00.000Z')

function entries(input: Partial<ChangeInput> & Pick<ChangeInput, 'model' | 'operation'>) {
  return auditEntries({ args: {}, before: null, result: null, actor, ...input })
}
const parse = (value: string | null) => (value ? JSON.parse(value) : null)

const patient = {
  id: 'p1',
  hospitalId: 'h1',
  patientId: 'PAT0007',
  firstName: 'Asha',
  lastName: 'Rao',
  phone: '9876543210',
  email: null,
  aadharNumber: '123412341234',
  aiSummary: { text: 'cached' },
  isActive: true,
  createdAt: at,
  updatedAt: at,
}

describe('auditEntries', () => {
  it('logs a creation with the record’s values, its name and who made it', () => {
    const [entry] = entries({
      model: 'Patient',
      operation: 'create',
      args: { data: { firstName: 'Asha', lastName: 'Rao', hospital: { connect: { id: 'h1' } } } },
      result: patient,
    })
    expect(entry).toMatchObject({
      hospitalId: 'h1',
      userId: 'u-admin',
      action: 'CREATE',
      entityType: 'Patient',
      entityId: 'p1',
      entityLabel: 'Asha Rao (PAT0007)',
      oldValues: null,
      source: 'web',
      ipAddress: '203.0.113.9',
      userAgent: 'Browser',
    })
    const values = parse(entry.newValues)
    expect(values).toMatchObject({ firstName: 'Asha', phone: '9876543210', isActive: true })
    // Not the id, clinic, timestamps, empty fields or the AI's cached summary.
    for (const key of ['id', 'hospitalId', 'createdAt', 'updatedAt', 'email', 'aiSummary']) {
      expect(values).not.toHaveProperty(key)
    }
    // An Aadhaar number shows only its last four digits; nor is it the related-record write.
    expect(values.aadharNumber).toBe('****1234')
    expect(values).not.toHaveProperty('hospital')
  })

  it('logs only the fields an update changed, old and new', () => {
    const [entry] = entries({
      model: 'Patient',
      operation: 'update',
      args: { where: { id: 'p1' }, data: { phone: '9000000000', firstName: 'Asha' } },
      before: patient,
      result: { ...patient, phone: '9000000000', updatedAt: later },
    })
    expect(entry.action).toBe('UPDATE')
    expect(parse(entry.oldValues)).toEqual({ phone: '9876543210' })
    expect(parse(entry.newValues)).toEqual({ phone: '9000000000' })
  })

  it('logs nothing when an update changes nothing but bookkeeping', () => {
    expect(
      entries({
        model: 'Patient',
        operation: 'update',
        args: { where: { id: 'p1' }, data: { aiSummary: { text: 'new' }, aiSummaryAt: later } },
        before: patient,
        result: { ...patient, aiSummary: { text: 'new' }, aiSummaryAt: later, updatedAt: later },
      })
    ).toEqual([])
  })

  it('sees a change made by linking a related record', () => {
    const appointment = {
      id: 'a1',
      hospitalId: 'h1',
      appointmentNo: 'APT-0042',
      doctorId: 'd1',
      status: 'SCHEDULED',
    }
    const [entry] = entries({
      model: 'Appointment',
      operation: 'update',
      args: { where: { id: 'a1' }, data: { doctor: { connect: { id: 'd2' } } } },
      before: appointment,
      result: { ...appointment, doctorId: 'd2' },
    })
    expect(entry.entityLabel).toBe('APT-0042')
    expect(parse(entry.oldValues)).toEqual({ doctorId: 'd1' })
    expect(parse(entry.newValues)).toEqual({ doctorId: 'd2' })
  })

  it('compares money as numbers, not as text', () => {
    const invoice = {
      id: 'i1',
      hospitalId: 'h1',
      invoiceNo: 'INV-1',
      paidAmount: new Prisma.Decimal('500.00'),
    }
    expect(
      entries({
        model: 'Invoice',
        operation: 'update',
        args: { where: { id: 'i1' }, data: { paidAmount: 500 } },
        before: invoice,
        result: { ...invoice, paidAmount: new Prisma.Decimal('500') },
      })
    ).toEqual([])
    const [entry] = entries({
      model: 'Invoice',
      operation: 'update',
      args: { where: { id: 'i1' }, data: { paidAmount: { increment: 250 } } },
      before: invoice,
      result: { ...invoice, paidAmount: new Prisma.Decimal('750') },
    })
    expect(parse(entry.oldValues)).toEqual({ paidAmount: '500' })
    expect(parse(entry.newValues)).toEqual({ paidAmount: '750' })
  })

  it('says a computed change happened when the new value wasn’t returned', () => {
    const item = { id: 's1', hospitalId: 'h1', name: 'Gloves', currentStock: 10 }
    const [entry] = entries({
      model: 'InventoryItem',
      operation: 'update',
      args: { where: { id: 's1' }, data: { currentStock: { decrement: 2 } }, select: { id: true } },
      before: item,
      result: { id: 's1' },
    })
    expect(entry.entityLabel).toBe('Gloves')
    expect(parse(entry.oldValues)).toEqual({ currentStock: 10 })
    expect(parse(entry.newValues)).toEqual({ currentStock: CHANGED })
  })

  describe('secrets', () => {
    it('hides passwords, tokens and keys, while still showing they changed', () => {
      const user = {
        id: 'u2',
        hospitalId: 'h1',
        name: 'Ravi',
        password: 'hash-1',
        mustChangePassword: true,
      }
      const [entry] = entries({
        model: 'User',
        operation: 'update',
        args: { where: { id: 'u2' }, data: { password: 'hash-2', mustChangePassword: false } },
        before: user,
        result: { ...user, password: 'hash-2', mustChangePassword: false },
      })
      expect(parse(entry.oldValues)).toEqual({ password: HIDDEN, mustChangePassword: true })
      expect(parse(entry.newValues)).toEqual({ password: HIDDEN, mustChangePassword: false })
      expect(entry.oldValues + entry.newValues!).not.toContain('hash-')

      const [gateway] = entries({
        model: 'PaymentGatewayConfig',
        operation: 'create',
        args: { data: {} },
        result: {
          id: 'g1',
          hospitalId: 'h1',
          razorpayKeyId: 'rzp_live_1',
          razorpayKeySecret: 'enc:s3cret',
          webhookSecret: 'w',
        },
      })
      expect(parse(gateway.newValues)).toEqual({
        razorpayKeyId: 'rzp_live_1',
        razorpayKeySecret: HIDDEN,
        webhookSecret: HIDDEN,
      })
    })

    it('hides a setting’s value when its key names a secret, or isn’t known', () => {
      const smtp = { id: 's1', hospitalId: 'h1', key: 'email.smtp.password', value: 'old-pass' }
      const [entry] = entries({
        model: 'Setting',
        operation: 'upsert',
        args: { where: {}, create: {}, update: { value: 'new-pass' } },
        before: smtp,
        result: { ...smtp, value: 'new-pass' },
      })
      expect(entry.entityLabel).toBe('email.smtp.password')
      expect(parse(entry.newValues)).toEqual({ value: HIDDEN })
      expect(JSON.stringify(entry)).not.toMatch(/old-pass|new-pass/)

      const plain = { id: 's2', hospitalId: 'h1', key: 'clinic.reminderHours', value: '24' }
      const [shown] = entries({
        model: 'Setting',
        operation: 'update',
        args: { where: { id: 's2' }, data: { value: '48' } },
        before: plain,
        result: { ...plain, value: '48' },
      })
      expect(parse(shown.newValues)).toEqual({ value: '48' })

      // Too many to read one by one: the key isn't known, so the value is hidden.
      const [bulk] = entries({
        model: 'Setting',
        operation: 'updateMany',
        args: { where: { key: 'sms.apiKey' }, data: { value: 'k-123' } },
        before: undefined,
        result: { count: 1 },
      })
      expect(parse(bulk.newValues)).toEqual({ [COUNT_KEY]: 1, value: HIDDEN })
    })

    it('hides secrets inside JSON, such as the saved SMTP and SMS settings', () => {
      // Settings → Communications also saves the whole form as one JSON setting.
      const form = {
        smtp_host: 'smtp.example.com',
        smtp_port: '587',
        smtp_user: 'clinic@example.com',
        smtp_password: 'pa55-in-json',
        nested: { authToken: 'tok-in-json', apiKey: 'key-in-json', retries: 3, enabled: true },
      }
      const [entry] = entries({
        model: 'Setting',
        operation: 'create',
        args: { data: {} },
        result: {
          id: 's9',
          hospitalId: 'h1',
          key: 'email_settings',
          value: JSON.stringify(form),
          type: 'json',
        },
      })
      expect(entry.newValues).not.toMatch(/pa55|tok-in|key-in/)
      const value = JSON.parse(parse(entry.newValues).value)
      expect(value).toMatchObject({
        smtp_host: 'smtp.example.com',
        smtp_user: 'clinic@example.com',
        smtp_password: HIDDEN,
        nested: { authToken: HIDDEN, apiKey: HIDDEN, retries: 3, enabled: true },
      })

      // A JSON column, and a bulk update's values.
      const [device] = entries({
        model: 'Device',
        operation: 'update',
        args: { where: { id: 'd1' }, data: { metadata: { password: 'admin123', model: 'X' } } },
        before: { id: 'd1', hospitalId: 'h1', name: 'Sensor', metadata: { model: 'X' } },
        result: {
          id: 'd1',
          hospitalId: 'h1',
          name: 'Sensor',
          metadata: { password: 'admin123', model: 'X' },
        },
      })
      expect(device.newValues).not.toContain('admin123')
      const [bulk] = entries({
        model: 'Device',
        operation: 'updateMany',
        args: { where: {}, data: { metadata: { secret: 'shh' } } },
        before: undefined,
        result: { count: 2 },
      })
      expect(bulk.newValues).not.toContain('shh')
    })

    it('keeps file contents out', () => {
      const [entry] = entries({
        model: 'FormSubmission',
        operation: 'create',
        args: { data: {} },
        result: {
          id: 'f1',
          hospitalId: 'h1',
          signature: 'data:image/png;base64,AAAA',
          notes: 'x'.repeat(500),
        },
      })
      const values = parse(entry.newValues)
      expect(values.signature).toBe('[file]')
      expect(values.notes).toHaveLength(201)
    })
  })

  it('logs a deletion with what the record held', () => {
    const [entry] = entries({
      model: 'Patient',
      operation: 'delete',
      args: { where: { id: 'p1' } },
      before: patient,
      result: patient,
    })
    expect(entry).toMatchObject({
      action: 'DELETE',
      entityId: 'p1',
      entityLabel: 'Asha Rao (PAT0007)',
      newValues: null,
    })
    expect(parse(entry.oldValues)).toMatchObject({ firstName: 'Asha', lastName: 'Rao' })
  })

  it('logs an upsert as a creation or an update of what it changed', () => {
    const args = {
      where: { id: 'h1' },
      create: { name: 'Smile' },
      update: { name: 'Smile Dental' },
    }
    const created = entries({
      model: 'Holiday',
      operation: 'upsert',
      args,
      before: null,
      result: { id: 'x1', hospitalId: 'h1', name: 'Smile' },
    })
    expect(created[0].action).toBe('CREATE')
    const updated = entries({
      model: 'Holiday',
      operation: 'upsert',
      args,
      before: { id: 'x1', hospitalId: 'h1', name: 'Smile' },
      result: { id: 'x1', hospitalId: 'h1', name: 'Smile Dental' },
    })
    expect(updated[0].action).toBe('UPDATE')
    expect(parse(updated[0].oldValues)).toEqual({ name: 'Smile' })
  })

  it('logs a bulk change per record, or as one entry when there are many', () => {
    const rows = [
      { id: 'a1', hospitalId: 'h1', appointmentNo: 'APT-1', status: 'SCHEDULED' },
      { id: 'a2', hospitalId: 'h1', appointmentNo: 'APT-2', status: 'CANCELLED' },
    ]
    const few = entries({
      model: 'Appointment',
      operation: 'updateMany',
      args: { where: { patientId: 'p1' }, data: { status: 'CANCELLED' } },
      before: rows,
      result: { count: 2 },
    })
    // The one already cancelled didn't change.
    expect(few).toHaveLength(1)
    expect(few[0]).toMatchObject({ entityId: 'a1', entityLabel: 'APT-1' })
    expect(parse(few[0].oldValues)).toEqual({ status: 'SCHEDULED' })

    const many = Array.from({ length: BULK_LIMIT + 1 }, (_, i) => ({
      id: `a${i}`,
      hospitalId: 'h1',
    }))
    const one = entries({
      model: 'Appointment',
      operation: 'deleteMany',
      args: { where: { patientId: 'p1' } },
      before: many,
      result: { count: 80 },
    })
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ action: 'DELETE', entityId: '' })
    expect(parse(one[0].newValues)).toEqual({ [COUNT_KEY]: 80 })

    expect(
      entries({
        model: 'Appointment',
        operation: 'deleteMany',
        args: {},
        before: [],
        result: { count: 0 },
      })
    ).toEqual([])
  })

  it('logs the system’s changes with no user, and skips what belongs to no clinic', () => {
    const [entry] = auditEntries({
      model: 'Appointment',
      operation: 'update',
      args: { where: { id: 'a1' }, data: { status: 'NO_SHOW' } },
      before: { id: 'a1', hospitalId: 'h1', status: 'SCHEDULED' },
      result: { id: 'a1', hospitalId: 'h1', status: 'NO_SHOW' },
      actor: undefined,
    })
    expect(entry).toMatchObject({ userId: null, source: null, hospitalId: 'h1' })

    // An invoice line has no hospitalId of its own: the user's clinic, if any.
    expect(
      auditEntries({
        model: 'InvoiceItem',
        operation: 'create',
        args: { data: {} },
        before: null,
        result: { id: 'l1' },
        actor: undefined,
      })
    ).toEqual([])
    expect(
      entries({
        model: 'InvoiceItem',
        operation: 'create',
        args: { data: {} },
        result: { id: 'l1' },
      })[0].hospitalId
    ).toBe('h1')
  })

  it('names only real tables as not audited', () => {
    const tables = Object.values(Prisma.ModelName) as string[]
    for (const name of Object.keys(NOT_AUDITED)) expect(tables).toContain(name)
    for (const name of [
      'Patient',
      'Appointment',
      'Invoice',
      'Payment',
      'User',
      'Staff',
      'Setting',
    ]) {
      expect(NOT_AUDITED).not.toHaveProperty(name)
    }
  })
})

// ---------------------------------------------------------------------------
// The Prisma hook, with a stand-in for the client around it
// ---------------------------------------------------------------------------

type Handler = (params: Record<string, unknown>) => Promise<unknown>

function fakeClient() {
  let handler: Handler | undefined
  const rows: Record<string, Record<string, unknown>> = {
    p1: { id: 'p1', hospitalId: 'h1', firstName: 'Asha', lastName: 'Rao', phone: '1' },
  }
  const reads: string[] = []
  const reader = (via: string) => ({
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      reads.push(via)
      return rows[where.id] ?? null
    }),
    findMany: vi.fn(async () => Object.values(rows)),
  })
  const tx = { patient: reader('tx') }
  const extended = {
    patient: reader('base'),
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: unknown) => unknown)(tx)
        : Promise.all((arg as (() => unknown)[]).map((run) => run()))
    ),
  }
  const base = {
    $extends(extension: unknown) {
      // Prisma.defineExtension gives a function that calls $extends with the definition.
      if (typeof extension === 'function') return extension(base)
      handler = (extension as { query: { $allModels: { $allOperations: Handler } } }).query
        .$allModels.$allOperations
      return extended
    },
    patient: reader('base'),
    auditLog: { createMany: vi.fn(async () => ({ count: 1 })), create: vi.fn() },
  }
  const prisma = withAuditLog(base as never) as unknown as typeof extended
  /** A write as Prisma hands it to the hook. */
  const update = (phone: string) =>
    handler!({
      model: 'Patient',
      operation: 'update',
      args: { where: { id: 'p1' }, data: { phone } },
      query: async () => ({ ...rows.p1, phone }),
    })
  return { prisma, base, update, reads, handler: () => handler! }
}

describe('the Prisma hook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the record, makes the change, then logs it as the current actor’s', async () => {
    const { base, update, reads } = fakeClient()
    await runAsAuditActor({ ...actor }, () => update('2'))
    expect(reads).toEqual(['base'])
    expect(base.auditLog.createMany).toHaveBeenCalledTimes(1)
    const [entry] = base.auditLog.createMany.mock.calls[0][0].data
    expect(entry).toMatchObject({ action: 'UPDATE', userId: 'u-admin', entityId: 'p1' })
    expect(JSON.parse(entry.oldValues)).toEqual({ phone: '1' })
  })

  it('passes reads and unaudited tables straight through', async () => {
    const { base, handler } = fakeClient()
    const query = vi.fn(async () => 'ok')
    expect(await handler()({ model: 'Patient', operation: 'findMany', args: {}, query })).toBe('ok')
    expect(
      await handler()({ model: 'EmailLog', operation: 'create', args: { data: {} }, query })
    ).toBe('ok')
    expect(base.auditLog.createMany).not.toHaveBeenCalled()
  })

  it('in a transaction, reads on the transaction and logs only once it commits', async () => {
    const { prisma, base, update, reads } = fakeClient()
    await prisma.$transaction(async () => {
      await update('2')
      expect(base.auditLog.createMany).not.toHaveBeenCalled()
    })
    expect(reads).toEqual(['tx'])
    expect(base.auditLog.createMany).toHaveBeenCalledTimes(1)
  })

  it('logs nothing for a transaction that rolls back', async () => {
    const { prisma, base, update } = fakeClient()
    await expect(
      prisma.$transaction(async () => {
        await update('2')
        throw new Error('rolled back')
      })
    ).rejects.toThrow('rolled back')
    expect(base.auditLog.createMany).not.toHaveBeenCalled()
  })

  it('in a batch, reads nothing before the write', async () => {
    const { prisma, base, update, reads } = fakeClient()
    await (prisma.$transaction as (arg: unknown) => Promise<unknown>)([() => update('2')])
    expect(reads).toEqual([])
    const [entry] = base.auditLog.createMany.mock.calls[0][0].data
    expect(JSON.parse(entry.newValues)).toEqual({ phone: '2' })
    expect(entry.oldValues).toBeNull()
  })

  it('never fails a write over the log', async () => {
    const { base, update } = fakeClient()
    base.auditLog.createMany.mockRejectedValueOnce(new Error('disk full'))
    await expect(update('2')).resolves.toMatchObject({ phone: '2' })
  })
})

describe('the actor', () => {
  // How a route uses it: the authenticating function starts the actor before
  // its first await, and fills it in afterwards.
  async function authenticate(userId: string) {
    const started = beginAuditActor()
    await new Promise((resolve) => setTimeout(resolve, 1))
    started.userId = userId
  }
  async function route(userId: string) {
    await authenticate(userId)
    await Promise.resolve()
    return currentAuditActor()?.userId
  }

  it('is shared by every copy of the module, as Next.js bundles one per chunk', async () => {
    vi.resetModules()
    const routeCopy = await import('@/lib/audit-context')
    vi.resetModules()
    const prismaCopy = await import('@/lib/audit-context')
    expect(routeCopy).not.toBe(prismaCopy)
    await routeCopy.runAsAuditActor({ userId: 'u-route' }, async () => {
      expect(prismaCopy.currentAuditActor()?.userId).toBe('u-route')
    })
  })

  it('reaches the route that authenticated, and only that one', async () => {
    const [a, b] = await Promise.all([
      Promise.resolve().then(() => route('alice')),
      Promise.resolve().then(() => route('bob')),
    ])
    expect([a, b]).toEqual(['alice', 'bob'])
  })
})

describe('recordSignIn', () => {
  it('logs a sign-in and never throws', async () => {
    const client = { auditLog: { create: vi.fn().mockResolvedValue({}) } }
    await recordSignIn(client as never, {
      hospitalId: 'h1',
      userId: 'u1',
      entityType: 'User',
      entityId: 'u1',
      label: 'Ravi',
      source: 'mobile',
      ipAddress: '',
      userAgent: 'x'.repeat(300),
    })
    expect(client.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'LOGIN',
      source: 'mobile',
      ipAddress: null,
      entityLabel: 'Ravi',
    })
    expect(client.auditLog.create.mock.calls[0][0].data.userAgent).toHaveLength(191)

    client.auditLog.create.mockRejectedValueOnce(new Error('down'))
    await expect(
      recordSignIn(client as never, {
        hospitalId: 'h1',
        userId: null,
        entityType: 'Patient',
        entityId: 'p1',
        label: null,
        source: 'patient-portal',
      })
    ).resolves.toBeUndefined()
  })
})
